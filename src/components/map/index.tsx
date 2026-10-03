import { lazy, Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";

export type MapPoint = { lat: number; lng: number; label?: string; color?: string; radius?: number };

// Leaflet is only loaded on screens that show a map.
const MapView = lazy(() => import("./MapView"));

export function MapPreview(props: { points: MapPoint[]; zoom?: number; height?: number }) {
  const height = props.height ?? 240;
  return (
    <Suspense fallback={<Skeleton className="w-full" style={{ height }} />}>
      <MapView {...props} />
    </Suspense>
  );
}
