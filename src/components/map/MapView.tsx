import "leaflet/dist/leaflet.css";
import { useEffect } from "react";
import { CircleMarker, MapContainer, TileLayer, Tooltip, useMap } from "react-leaflet";
import type { MapPoint } from "./index";

function FitBounds({ points }: { points: MapPoint[] }) {
  const map = useMap();
  // Refit only when the coordinates change, not on every re-render with a new array.
  const key = points.map((p) => `${p.lat},${p.lng}`).join(";");
  useEffect(() => {
    if (points.length > 1) {
      map.fitBounds(
        points.map((p) => [p.lat, p.lng] as [number, number]),
        { padding: [24, 24], maxZoom: 16 },
      );
    } else if (points[0]) {
      map.setView([points[0].lat, points[0].lng]);
    }
  }, [map, key]); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}

// Circle markers avoid Leaflet's default PNG icons, which bundlers do not resolve.
export default function MapView({
  points,
  zoom = 16,
  height = 240,
}: {
  points: MapPoint[];
  zoom?: number;
  height?: number;
}) {
  const first = points[0];
  if (!first) return null;
  return (
    <MapContainer
      center={[first.lat, first.lng]}
      zoom={zoom}
      scrollWheelZoom={false}
      style={{ height }}
      className="z-0 w-full overflow-hidden rounded-md border"
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {points.map((p, i) => (
        <CircleMarker
          key={i}
          center={[p.lat, p.lng]}
          radius={p.radius ?? 8}
          pathOptions={{ color: p.color ?? "#e11d48", fillOpacity: 0.6 }}
        >
          {p.label && <Tooltip>{p.label}</Tooltip>}
        </CircleMarker>
      ))}
      <FitBounds points={points} />
    </MapContainer>
  );
}
