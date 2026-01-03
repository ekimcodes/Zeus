import asyncio
import aiohttp
import json
import time
import redis.asyncio as redis
import logging
from app.schemas import FlightData, AircraftState
import os
from typing import Optional

logger = logging.getLogger("zeus-ingestion")

# OpenSky API Configuration
OPENSKY_API_URL = "https://opensky-network.org/api/states/all"
# Bounding Box for California
LAMIN = 32.5
LOMIN = -124.5
LAMAX = 42.0
LOMAX = -114.0

class IngestionService:
    def __init__(self):
        self.redis = redis.from_url(f"redis://{os.getenv('REDIS_HOST', 'localhost')}:{os.getenv('REDIS_PORT', 6379)}")
        
    async def fetch_flights(self, session: aiohttp.ClientSession):
        params = {
            "lamin": LAMIN,
            "lomin": LOMIN,
            "lamax": LAMAX,
            "lomax": LOMAX
        }
        try:
            async with session.get(OPENSKY_API_URL, params=params) as response:
                if response.status == 200:
                    data = await response.json()
                    return data
                elif response.status == 429:
                    logger.warning("Rate limit hit. Backing off.")
                    return None
                else:
                    logger.error(f"Error fetching data: {response.status}")
                    return None
        except Exception as e:
            logger.error(f"Exception during fetch: {e}")
            return None

    def parse_state_vector(self, state) -> Optional[AircraftState]:
        # state vector indices: 0: icao24, 1: callsign, 5: long, 6: lat, 7: baro_altitude, 9: velocity, 10: true_track, 8: on_ground, 4: time_position, 3: last_contact
        # OpenSky returns null for some fields
        try:
            if state[6] is None or state[5] is None:
                return None
                
            return AircraftState(
                icao24=state[0],
                callsign=state[1].strip() if state[1] else "N/A",
                latitude=state[6],
                longitude=state[5],
                altitude=state[7] if state[7] is not None else 0,
                velocity=state[9] if state[9] is not None else 0,
                heading=state[10] if state[10] is not None else 0,
                vertical_rate=state[11],
                on_ground=state[8],
                last_contact=state[3] if state[3] else time.time()
            )
        except Exception as e:
            logger.debug(f"Error parsing state {state[0]}: {e}")
            return None

    async def run_loop(self):
        async with aiohttp.ClientSession() as session:
            while True:
                start_time = time.time()
                raw_data = await self.fetch_flights(session)
                
                if raw_data and "states" in raw_data and raw_data["states"]:
                    aircraft_list = []
                    for state in raw_data["states"]:
                        aircraft = self.parse_state_vector(state)
                        if aircraft:
                            aircraft_list.append(aircraft)
                    
                    flight_data = FlightData(
                        timestamp=raw_data["time"],
                        aircraft=aircraft_list
                    )
                    
                    # Publish to Redis
                    await self.redis.publish("raw_flight_data", flight_data.model_dump_json())
                    logger.info(f"Published {len(aircraft_list)} aircraft states")
                
                # Rate limit handling: 10s for anonymous
                elapsed = time.time() - start_time
                sleep_time = max(10 - elapsed, 0)
                await asyncio.sleep(sleep_time)

if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    service = IngestionService()
    asyncio.run(service.run_loop())
