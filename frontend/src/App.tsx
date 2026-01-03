// @ts-nocheck
import { useEffect, useState, useRef } from 'react';
import MapView from './Map';
import type { AircraftState, FlightData } from './types';
import { Wifi, HelpCircle, X, ShieldAlert, ShieldCheck } from 'lucide-react';

const WEBSOCKET_URL = "ws://localhost:8000/ws/flights";

function App() {
  const [aircraft, setAircraft] = useState<AircraftState[]>([]);
  const [alerts, setAlerts] = useState<AircraftState[]>([]);
  const [connected, setConnected] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const ws = useRef<WebSocket | null>(null);

  useEffect(() => {
    const connect = () => {
      ws.current = new WebSocket(WEBSOCKET_URL);

      ws.current.onopen = () => {
        setConnected(true);
        console.log("Connected to Zeus");
      };

      ws.current.onmessage = (event) => {
        try {
          const data: FlightData = JSON.parse(event.data);
          // Update aircraft state
          setAircraft(data.aircraft);

          // Update alerts
          const newAlerts = data.aircraft.filter(a => a.alert_level !== 'NONE');
          setAlerts(newAlerts);
        } catch (e) {
          console.error("Parse error", e);
        }
      };

      ws.current.onclose = () => {
        setConnected(false);
        setTimeout(connect, 3000); // Reconnect
      };
    };

    connect();

    return () => {
      ws.current?.close();
    };
  }, []);

  return (
    <div className="w-screen h-screen bg-zeus-dark flex overflow-hidden">
      {/* Sidebar / Overlay */}
      <div className="absolute top-4 left-4 z-10 w-80 bg-zeus-panel/90 backdrop-blur border border-white/10 rounded-lg p-4 text-white shadow-2xl flex flex-col gap-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold font-mono tracking-wider text-zeus-accent">ZEUS://SYSTEM</h1>
          <div className={`flex items-center gap-2 px-2 py-1 rounded border ${connected ? 'border-green-500/50 bg-green-500/10 text-green-500' : 'border-red-500/50 bg-red-500/10 text-red-500'}`}>
            <Wifi size={14} />
            <span className="text-xs font-mono font-bold">{connected ? 'ONLINE' : 'OFFLINE'}</span>
          </div>
        </div>

        {/* Stats */}
        <div className="flex items-center gap-4">
          <div className="flex-1 bg-black/50 p-3 rounded border border-white/5">
            <div className="text-xs text-gray-400 uppercase mb-1">Monitored</div>
            <div className="text-2xl font-mono text-white flex items-center gap-2">
              <ShieldCheck size={20} className="text-green-500" />
              {aircraft.length}
            </div>
          </div>
          <div className="flex-1 bg-black/50 p-3 rounded border border-white/5">
            <div className="text-xs text-gray-400 uppercase mb-1">Violations</div>
            <div className="text-2xl font-mono text-red-500 flex items-center gap-2">
              <ShieldAlert size={20} />
              {alerts.length}
            </div>
          </div>
        </div>

        {/* Legend */}
        <div className="bg-white/5 p-3 rounded border border-white/10">
          <div className="text-xs text-gray-400 uppercase font-bold mb-2">Map Legend</div>
          <div className="space-y-2 text-xs font-mono">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-green-500"></div>
              <span>Authorized Aircraft (Safe)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-orange-500"></div>
              <span>Approaching Zone (Warning)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-red-600 animate-pulse"></div>
              <span>Zone Violation (Critical)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 border border-red-500 bg-red-500/20"></div>
              <span>Restricted Airspace</span>
            </div>
          </div>
        </div>

        <div className="space-y-2 max-h-[40vh] overflow-y-auto">
          <h2 className="text-xs text-gray-500 uppercase font-bold tracking-widest sticky top-0 bg-zeus-panel py-2">Violation Log</h2>
          {alerts.length === 0 && (
            <div className="text-sm text-gray-600 italic p-2 text-center border dashed border-gray-800 rounded">
              No active airspace violations.
            </div>
          )}
          {alerts.map((a) => (
            <div key={a.icao24} className="bg-red-900/10 border-l-2 border-red-500 p-3 rounded hover:bg-red-900/20 transition-colors">
              <div className="flex items-center justify-between mb-1">
                <span className="font-mono font-bold text-red-400">{a.callsign || a.icao24}</span>
                <span className="text-xs bg-red-500/20 text-red-400 px-1 rounded">{a.alert_level}</span>
              </div>
              <div className="text-xs text-gray-300">
                In Zone: <span className="text-white font-medium">{a.violated_zone}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Help Button */}
      <button
        onClick={() => setShowHelp(true)}
        className="absolute bottom-6 left-6 z-20 bg-zeus-panel border border-white/20 p-2 rounded-full text-white hover:bg-white/10 transition-colors shadow-lg"
        title="Help & Information"
      >
        <HelpCircle size={24} />
      </button>

      {/* Help Modal */}
      {showHelp && (
        <div className="absolute inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-zeus-panel border border-white/20 rounded-xl p-6 max-w-lg w-full shadow-2xl relative">
            <button
              onClick={() => setShowHelp(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-white"
            >
              <X size={24} />
            </button>

            <h2 className="text-2xl font-bold text-zeus-accent mb-4">About Zeus Monitor</h2>
            <div className="space-y-4 text-gray-300 leading-relaxed">
              <p>
                <strong className="text-white">What is this?</strong><br />
                Zeus is a real-time airspace monitoring system. It tracks live aircraft positions and instantly detects when they enter restricted "No Fly Zones".
              </p>
              <p>
                <strong className="text-white">How does it work?</strong><br />
                We process thousands of flight data points per second. The <span className="text-green-400">Green</span> icons are safe planes. If a plane enters a <span className="text-red-400">Red Zone</span>, it triggers a security alert.
              </p>
              <p>
                <strong className="text-white">Controls</strong><br />
                • <span className="text-gray-400">Pan:</span> Click and drag the map.<br />
                • <span className="text-gray-400">Zoom:</span> Scroll wheel or pinch.<br />
                • <span className="text-gray-400">Details:</span> Hover over any aircraft to see its flight number, speed, and altitude.
              </p>
            </div>
            <div className="mt-8 pt-4 border-t border-white/10 text-center text-xs text-gray-500">
              System v1.0 • Built with Python, React & Deck.gl
            </div>
          </div>
        </div>
      )}

      {/* Main Map */}
      <div className="flex-1 relative">
        <MapView aircraft={aircraft} />
      </div>
    </div>
  );
}

export default App;
