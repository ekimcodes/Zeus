export interface AircraftState {
    icao24: string;
    callsign: string | null;
    latitude: number;
    longitude: number;
    altitude: number;
    velocity: number;
    heading: number;
    vertical_rate: number | null;
    on_ground: boolean;
    last_contact: number;
    alert_level: 'NONE' | 'WATCH' | 'WARNING' | 'CRITICAL';
    violated_zone: string | null;
}

export interface FlightData {
    timestamp: number;
    aircraft: AircraftState[];
}

export interface RestrictedZone {
    id: string;
    name: string;
    severity: 'NONE' | 'WATCH' | 'WARNING' | 'CRITICAL';
    polygon: [number, number][]; // lat, lng
    altitude_min: number;
    altitude_max: number;
}
