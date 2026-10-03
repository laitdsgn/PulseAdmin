import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { useEffect } from "react";
import { CircleMarker, MapContainer, Marker, TileLayer, Tooltip, useMap, useMapEvents } from "react-leaflet";
import type { Wheelchair } from "@/lib/enums";
import type { Report } from "@/lib/types";
import { reportColor, WHEELCHAIR_COLORS } from "./colors";

export type Bounds = [number, number, number, number]; // west, south, east, north
export type MapPlace = {
  id: string;
  name: string;
  lat: number;
  lng: number;
  wheelchair: Wheelchair;
  address: string | null;
};

type Props = {
  /** Where to look; the map recentres whenever it changes (city switch). */
  center: { lat: number; lng: number };
  reports: Report[];
  places: MapPlace[];
  selectedId: string | null;
  onBounds: (bounds: Bounds) => void;
  onReport: (id: string) => void;
  onPlace: (id: string) => void;
};

// Places are drawn as squares (a CSS div icon, no image assets) to tell them apart from reports.
const placeIcons = Object.fromEntries(
  Object.entries(WHEELCHAIR_COLORS).map(([key, color]) => [
    key,
    L.divIcon({
      className: "",
      iconSize: [14, 14],
      html: `<div style="width:14px;height:14px;background:${color};border:2px solid #fff;border-radius:3px;box-shadow:0 0 0 1px rgba(0,0,0,.35)"></div>`,
    }),
  ]),
) as Record<Wheelchair, L.DivIcon>;

const toBounds = (b: L.LatLngBounds): Bounds => [b.getWest(), b.getSouth(), b.getEast(), b.getNorth()];

// A city's bbox covers its whole metro area, where reports collapse into one blob; start at the
// centre, zoomed in enough to tell points apart.
const START_ZOOM = 13;

function Sync({ center, onBounds }: { center: Props["center"]; onBounds: (b: Bounds) => void }) {
  const map = useMap();
  useEffect(() => {
    map.setView([center.lat, center.lng], START_ZOOM);
    onBounds(toBounds(map.getBounds()));
  }, [map, center.lat, center.lng]); // eslint-disable-line react-hooks/exhaustive-deps
  useMapEvents({ moveend: () => onBounds(toBounds(map.getBounds())) });
  return null;
}

export default function MapCanvas({ center, reports, places, selectedId, onBounds, onReport, onPlace }: Props) {
  return (
    <MapContainer center={[center.lat, center.lng]} zoom={START_ZOOM} preferCanvas className="z-0 h-full w-full">
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <Sync center={center} onBounds={onBounds} />
      {places.map((p) => (
        <Marker
          key={p.id}
          position={[p.lat, p.lng]}
          icon={placeIcons[p.wheelchair]}
          eventHandlers={{ click: () => onPlace(p.id) }}
        >
          <Tooltip>
            <strong>{p.name}</strong>
            {p.address && <div>{p.address}</div>}
          </Tooltip>
        </Marker>
      ))}
      {reports.map((r) => (
        <CircleMarker
          key={r.id}
          center={[r.lat, r.lng]}
          radius={r.id === selectedId ? 11 : 7}
          pathOptions={{
            color: r.id === selectedId ? "#111827" : "#ffffff",
            weight: r.id === selectedId ? 3 : 1.5,
            fillColor: reportColor(r),
            fillOpacity: r.status === "resolved" ? 0.5 : 0.9,
          }}
          eventHandlers={{ click: () => onReport(r.id) }}
        >
          <Tooltip>
            <strong>{r.title}</strong>
            {r.address && <div>{r.address}</div>}
          </Tooltip>
        </CircleMarker>
      ))}
    </MapContainer>
  );
}
