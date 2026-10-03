// Mirrors PulseBackend/src/domain/categories.ts, status.ts, places.ts, community.ts and db/schema.ts.

export const BARRIER_CATEGORIES = [
  "stairs",
  "high_curb",
  "steep_ramp",
  "narrow_passage",
  "bad_surface",
  "broken_elevator",
  "no_elevator",
  "heavy_door",
  "threshold",
  "sidewalk_obstacle",
  "roadworks",
  "no_tactile_paving",
  "no_audio_signal",
  "broken_escalator",
  "broken_streetlight",
  "broken_toilet",
  "other_barrier",
] as const;

export const FACILITY_CATEGORIES = [
  "ramp",
  "elevator",
  "accessible_toilet",
  "lowered_curb",
  "tactile_paving",
  "audio_signal",
  "disabled_parking",
  "bench",
  "induction_loop",
  "step_free_entrance",
] as const;

export const LIVE_CATEGORIES = [
  "queue",
  "crowd",
  "traffic_jam",
  "accident",
  "police_check",
  "transit_delay",
  "fuel_price",
] as const;

export const CATEGORIES = [...BARRIER_CATEGORIES, ...FACILITY_CATEGORIES, ...LIVE_CATEGORIES] as const;
export type Category = (typeof CATEGORIES)[number];

export const REPORT_KINDS = ["barrier", "facility", "live"] as const;
export type ReportKind = (typeof REPORT_KINDS)[number];

export const CATEGORIES_BY_KIND: Record<ReportKind, readonly Category[]> = {
  barrier: BARRIER_CATEGORIES,
  facility: FACILITY_CATEGORIES,
  live: LIVE_CATEGORIES,
};

export const kindOf = (category: Category): ReportKind =>
  (BARRIER_CATEGORIES as readonly string[]).includes(category)
    ? "barrier"
    : (FACILITY_CATEGORIES as readonly string[]).includes(category)
      ? "facility"
      : "live";

export const SEVERITIES = ["blocking", "difficult", "info"] as const;
export type Severity = (typeof SEVERITIES)[number];

export const REPORT_STATUSES = ["active", "resolved", "unverified"] as const;
export type ReportStatus = (typeof REPORT_STATUSES)[number];

export const REPORT_SOURCES = ["user", "seed", "osm", "detection"] as const;
export type ReportSource = (typeof REPORT_SOURCES)[number];

export const PROFILES = ["wheelchair", "stroller", "walking", "vision", "none"] as const;
export type Profile = (typeof PROFILES)[number];

export const PLACE_TYPES = [
  "museum",
  "church",
  "office",
  "station",
  "park",
  "monument",
  "culture",
  "toilet",
  "square",
  "street",
] as const;
export type PlaceType = (typeof PLACE_TYPES)[number];

export const WHEELCHAIR = ["yes", "limited", "no", "unknown"] as const;
export type Wheelchair = (typeof WHEELCHAIR)[number];

export const ROLES = ["user", "moderator", "city", "admin"] as const;
export type Role = (typeof ROLES)[number];
export const STAFF_ROLES = ["admin", "moderator", "city"] as const;
export type StaffRole = (typeof STAFF_ROLES)[number];

export const FLAG_REASONS = ["spam", "offensive", "inaccurate", "other"] as const;
export type FlagReason = (typeof FLAG_REASONS)[number];

export const FLAG_TARGETS = ["report", "comment", "question", "answer"] as const;
export type FlagTarget = (typeof FLAG_TARGETS)[number];

export const QUESTION_SOURCES = ["user", "detection"] as const;
export type QuestionSource = (typeof QUESTION_SOURCES)[number];
export const QUESTION_STATUSES = ["open", "closed"] as const;
export type QuestionStatus = (typeof QUESTION_STATUSES)[number];

// Mirrors PulseBackend/src/domain/pois.ts (`/v1/pois` names).
export const POI_TYPES = ["grocery", "pharmacy", "post_office", "parcel_locker", "drugstore"] as const;
export type PoiType = (typeof POI_TYPES)[number];

export const VISIBILITIES = ["any", "visible", "hidden"] as const;
export type Visibility = (typeof VISIBILITIES)[number];

export const AUDIT_ACTIONS = [
  "user.created",
  "user.updated",
  "user.deleted",
  "user.credentials_set",
  "user.sessions_revoked",
  "password.changed",
  "report.hidden",
  "report.restored",
  "comment.hidden",
  "comment.restored",
  "question.hidden",
  "question.restored",
  "answer.hidden",
  "answer.restored",
  "place.updated",
  "poi.updated",
] as const;
export type AuditAction = (typeof AUDIT_ACTIONS)[number];
