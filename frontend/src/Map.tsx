// @ts-ignore
import DeckGL from '@deck.gl/react';
import { IconLayer, PolygonLayer, TextLayer } from '@deck.gl/layers';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import type { AircraftState, RestrictedZone } from './types';
import { useEffect, useRef, useState, Component, type ErrorInfo, type ReactNode } from 'react';

// Error Boundary Component
class ErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean, error: Error | null }> {
    constructor(props: { children: ReactNode }) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error: Error) {
        return { hasError: true, error };
    }

    componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error("Uncaught error:", error, errorInfo);
    }

    render() {
        if (this.state.hasError) {
            return (
                <div className="flex items-center justify-center h-screen w-screen bg-zeus-dark text-red-500 p-8 flex-col gap-4">
                    <h1 className="text-2xl font-bold">Something went wrong.</h1>
                    <pre className="bg-black p-4 rounded border border-red-900 overflow-auto max-w-2xl">
                        {this.state.error?.message}
                    </pre>
                    <p className="text-gray-400">Check the console for more details.</p>
                </div>
            );
        }

        return this.props.children;
    }
}

// Hardcoded Zones matching Backend for visualization (or fetch via API later)
const MVP_ZONES: RestrictedZone[] = [
    {
        id: "sfo-class-b",
        name: "SFO Class B",
        severity: "WARNING",
        polygon: [
            [37.65, -122.50],
            [37.65, -122.30],
            [37.55, -122.30],
            [37.55, -122.50]
        ],
        altitude_min: 0,
        altitude_max: 10000
    },
    {
        id: "travis-afb",
        name: "Travis AFB",
        severity: "CRITICAL",
        polygon: [
            [38.30, -121.98],
            [38.30, -121.88],
            [38.22, -121.88],
            [38.22, -121.98]
        ],
        altitude_min: 0,
        altitude_max: 50000
    }
];

interface MapViewProps {
    aircraft: AircraftState[];
}

const INITIAL_VIEW_STATE = {
    longitude: -122.4,
    latitude: 37.7,
    zoom: 8,
    pitch: 0,
    bearing: 0
};

function MapContent({ aircraft }: MapViewProps) {
    const mapContainer = useRef<HTMLDivElement>(null);
    const mapRef = useRef<mapboxgl.Map | null>(null);
    const [viewState, setViewState] = useState(INITIAL_VIEW_STATE);
    const [tokenError, setTokenError] = useState<string | null>(null);

    useEffect(() => {
        if (!mapContainer.current) return;

        const token = import.meta.env.VITE_MAPBOX_TOKEN;
        if (!token || token === 'pk.eyJ1Ijoi...') {
            setTokenError("Missing VITE_MAPBOX_TOKEN in .env file");
            return;
        }

        mapboxgl.accessToken = token;

        try {
            const map = new mapboxgl.Map({
                container: mapContainer.current,
                style: 'mapbox://styles/mapbox/dark-v11',
                center: [INITIAL_VIEW_STATE.longitude, INITIAL_VIEW_STATE.latitude],
                zoom: INITIAL_VIEW_STATE.zoom,
                interactive: false // Managed by DeckGL
            });

            mapRef.current = map;
        } catch (e: any) {
            setTokenError(e.message);
        }

        return () => {
            mapRef.current?.remove();
        };
    }, []);

    // Sync Mapbox with DeckGL viewState
    useEffect(() => {
        if (mapRef.current) {
            mapRef.current.jumpTo({
                center: [viewState.longitude, viewState.latitude],
                zoom: viewState.zoom,
                bearing: viewState.bearing,
                pitch: viewState.pitch
            });
        }
    }, [viewState]);

    const layers = [
        new PolygonLayer({
            id: 'zones',
            data: MVP_ZONES,
            stroked: true,
            filled: true,
            lineWidthMinPixels: 2,
            getPolygon: (d: RestrictedZone) => d.polygon.map(p => [p[1], p[0]]),
            getFillColor: (d: RestrictedZone) => d.severity === 'CRITICAL' ? [255, 0, 0, 50] : [255, 165, 0, 50],
            getLineColor: (d: RestrictedZone) => d.severity === 'CRITICAL' ? [255, 0, 0] : [255, 165, 0],
        }),
        new TextLayer({
            id: 'zone-labels',
            data: MVP_ZONES,
            getPosition: (d: RestrictedZone) => {
                // Calculate centroid
                const lats = d.polygon.map(p => p[0]);
                const lngs = d.polygon.map(p => p[1]);
                const centerLat = (Math.min(...lats) + Math.max(...lats)) / 2;
                const centerLng = (Math.min(...lngs) + Math.max(...lngs)) / 2;
                return [centerLng, centerLat];
            },
            getText: (d: RestrictedZone) => `${d.name}\nNO FLY ZONE`,
            getSize: 16,
            getColor: [255, 255, 255],
            getAngle: 0,
            getTextAnchor: 'middle',
            getAlignmentBaseline: 'center',
            fontFamily: 'Monaco, monospace',
            fontWeight: 800
        }),
        new IconLayer({
            id: 'aircraft',
            data: aircraft,
            pickable: true,
            iconAtlas: 'https://raw.githubusercontent.com/visgl/deck.gl-data/master/website/icon-atlas.png',
            iconMapping: {
                marker: { x: 0, y: 0, width: 128, height: 128, mask: true }
            },
            getIcon: _d => 'marker',
            getPosition: (d: AircraftState) => [d.longitude, d.latitude],
            getSize: 20,
            getColor: (d: AircraftState) => {
                if (d.alert_level === 'CRITICAL') return [255, 0, 0];
                if (d.alert_level === 'WARNING') return [255, 165, 0];
                return [0, 255, 0];
            },
            getAngle: (d: AircraftState) => 360 - d.heading,
            billboard: false,
            updateTriggers: {
                getColor: [aircraft]
            }
        })
    ];

    if (tokenError) {
        return (
            <div className="flex items-center justify-center h-full w-full bg-zeus-dark text-red-500">
                <div className="text-center">
                    <h2 className="text-xl font-bold">Map Configuration Error</h2>
                    <p>{tokenError}</p>
                </div>
            </div>
        );
    }

    return (
        <div className="w-full h-full relative">
            <div ref={mapContainer} className="absolute inset-0 z-0" />
            <DeckGL
                viewState={viewState}
                onViewStateChange={({ viewState }: any) => setViewState(viewState)}
                controller={true}
                layers={layers}
                style={{ width: '100%', height: '100%', pointerEvents: 'none' }}
                getCursor={() => 'default'}
                getTooltip={({ object }) => object && {
                    html: `
                        <div style="font-family: monospace; padding: 8px; background: rgba(0,0,0,0.8); color: white; border-radius: 4px; border: 1px solid #333;">
                            <div style="font-weight: bold; color: #3b82f6;">FLIGHT ${object.callsign || object.icao24}</div>
                            <div>ALT: ${Math.round(object.altitude)} ft</div>
                            <div>SPD: ${Math.round(object.velocity)} kts</div>
                            ${object.alert_level !== 'NONE' ? `<div style="color: #ef4444; font-weight: bold; margin-top: 4px;">⚠️ ${object.alert_level}</div>` : ''}
                        </div>
                    `,
                    style: { backgroundColor: 'transparent' }
                }}
            >
                {/* DeckGL overlays mapbox */}
            </DeckGL>
        </div>
    );
}

export default function MapView(props: MapViewProps) {
    return (
        <ErrorBoundary>
            <MapContent {...props} />
        </ErrorBoundary>
    );
}
