from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
import asyncio
import logging
import os
import redis.asyncio as redis
from contextlib import asynccontextmanager
from app.ingestion import IngestionService
from app.processing import ProcessingEngine

# Initialize logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("zeus-backend")

# Global Background Tasks
ingestion_service = IngestionService()
processing_engine = ProcessingEngine()

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    logger.info("Starting background services...")
    ingestion_task = asyncio.create_task(ingestion_service.run_loop())
    processing_task = asyncio.create_task(processing_engine.process_flights())
    broadcast_task = asyncio.create_task(redis_connector())
    
    yield
    
    # Shutdown
    ingestion_task.cancel()
    processing_task.cancel()
    broadcast_task.cancel()

app = FastAPI(title="Zeus Airspace Monitor", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
async def root():
    return {"status": "online", "system": "Zeus"}

@app.get("/health")
async def health_check():
    return {"status": "healthy"}

class ConnectionManager:
    def __init__(self):
        self.active_connections: list[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)
        logger.info(f"Client connected. Total: {len(self.active_connections)}")

    def disconnect(self, websocket: WebSocket):
        self.active_connections.remove(websocket)
        logger.info(f"Client disconnected. Total: {len(self.active_connections)}")

    async def broadcast(self, message: str):
        for connection in self.active_connections:
            await connection.send_text(message)

manager = ConnectionManager()

async def redis_connector():
    r = redis.from_url(f"redis://{os.getenv('REDIS_HOST', 'localhost')}:{os.getenv('REDIS_PORT', 6379)}")
    pubsub = r.pubsub()
    await pubsub.subscribe("processed_updates")
    logger.info("Subscribed to processed_updates")
    
    async for message in pubsub.listen():
        if message["type"] == "message":
            await manager.broadcast(message["data"].decode("utf-8"))

@app.websocket("/ws/flights")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket)
    except Exception as e:
        logger.error(f"WebSocket error: {e}")
        manager.disconnect(websocket)
