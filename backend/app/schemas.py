from pydantic import BaseModel
from typing import List, Optional, Literal

class AircraftState(BaseModel):
    icao24: str
    callsign: Optional[str]
    latitude: float
    longitude: float
    altitude: Optional[float]
    velocity: Optional[float]
    heading: Optional[float]
    vertical_rate: Optional[float] = None
    on_ground: bool
    last_contact: float
    # Enrichment fields
    alert_level: Literal['NONE', 'WATCH', 'WARNING', 'CRITICAL'] = 'NONE'
    violated_zone: Optional[str] = None

class FlightData(BaseModel):
    timestamp: float
    aircraft: List[AircraftState]

class RestrictedZone(BaseModel):
    id: str
    name: str
    severity: Literal['NONE', 'WATCH', 'WARNING', 'CRITICAL']
    polygon: List[tuple[float, float]]  # List of (latitude, longitude)
    altitude_min: float
    altitude_max: float
    active: bool = True
