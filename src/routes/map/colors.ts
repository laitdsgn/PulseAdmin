// Marker colours, shared by the map and its legend (kept out of MapCanvas so the legend does not
// pull Leaflet into the main bundle).
import type { Wheelchair } from "@/lib/enums";
import type { Report } from "@/lib/types";

export const REPORT_LEGEND = [
  { color: "#dc2626", key: "severity.blocking" },
  { color: "#f97316", key: "severity.difficult" },
  { color: "#eab308", key: "severity.info" },
  { color: "#16a34a", key: "kind.facility" },
  { color: "#0284c7", key: "kind.live" },
  { color: "#6b7280", key: "status.resolved" },
] as const;

export const reportColor = (r: Pick<Report, "kind" | "severity" | "status">) => {
  if (r.status === "resolved") return "#6b7280";
  if (r.kind === "facility") return "#16a34a";
  if (r.kind === "live") return "#0284c7";
  return r.severity === "blocking" ? "#dc2626" : r.severity === "difficult" ? "#f97316" : "#eab308";
};

export const WHEELCHAIR_COLORS: Record<Wheelchair, string> = {
  yes: "#16a34a",
  limited: "#f59e0b",
  no: "#dc2626",
  unknown: "#6b7280",
};
