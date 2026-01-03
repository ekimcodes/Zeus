import asyncio
import json
import logging
import os
import redis.asyncio as redis
from app.schemas import FlightData, AircraftState, RestrictedZone
from app.spatial import SpatialIndex, point_in_polygon

logger = logging.getLogger("zeus-processing")

# MVP Zones
MVP_ZONES = [
  RestrictedZone(
      id="sfo-class-b",
      name="SFO Class B",
      severity="WARNING",
      polygon=[
          (37.65, -122.50),
          (37.65, -122.30),
          (37.55, -122.30),
          (37.55, -122.50)
      ],
      altitude_min=0,
      altitude_max=10000
  ),
  RestrictedZone(
      id="travis-afb",
      name="Travis AFB",
      severity="CRITICAL",
      polygon=[
          (38.30, -121.98),
          (38.30, -121.88),
          (38.22, -121.88),
          (38.22, -121.98)
      ],
      altitude_min=0,
      altitude_max=50000
  )
]

class ProcessingEngine:
    def __init__(self):
        self.redis = redis.from_url(f"redis://{os.getenv('REDIS_HOST', 'localhost')}:{os.getenv('REDIS_PORT', 6379)}")
        self.spatial_index = SpatialIndex(level=9) # Level 9 is ~5km cells
        
        # Index Zones
        for zone in MVP_ZONES:
            self.spatial_index.index_zone(zone)
            
    async def process_flights(self):
        pubsub = self.redis.pubsub()
        await pubsub.subscribe("raw_flight_data")
        
        async for message in pubsub.listen():
            if message["type"] == "message":
                try:
                    raw_json = message["data"]
                    flight_data = FlightData.model_validate_json(raw_json)
                    processed_aircraft = []
                    
                    for aircraft in flight_data.aircraft:
                        # Spatial Query
                        candidates = self.spatial_index.query(aircraft.latitude, aircraft.longitude)
                        
                        violation = None
                        level = "NONE"
                        
                        for zone in candidates:
                            # Altitude check
                            # Convert ft to meters if needed? PRD says feet. OpenSky is meters.
                            # OpenSky: altitude is meters. PRD Zones: feet? 
                            # Let's assume everything is meters for consistency or convert.
                            # PRD says OpenSky altitude is meters (implied by API).
                            # PRD zones say feet. 
                            # 1 m = 3.28 ft
                            alt_ft = aircraft.altitude * 3.28084
                            
                            if zone.altitude_min <= alt_ft <= zone.altitude_max:
                                if point_in_polygon(aircraft.longitude, aircraft.latitude, zone.polygon):
                                    violation = zone.name
                                    level = zone.severity
                                    break # Take first violation
                        
                        aircraft.alert_level = level
                        aircraft.violated_zone = violation
                        processed_aircraft.append(aircraft)
                        
                    # Publish Processed Update
                    update = FlightData(timestamp=flight_data.timestamp, aircraft=processed_aircraft)
                    await self.redis.publish("processed_updates", update.model_dump_json())
                    # logger.info(f"Processed {len(processed_aircraft)} aircraft")
                    
                except Exception as e:
                    logger.error(f"Processing Error: {e}")

if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    engine = ProcessingEngine()
    asyncio.run(engine.process_flights())
