// Which panel areas a role may open. Mirrors the guards in PulseBackend/src/routes/admin.ts,
// community.ts (moderation) and city.ts.
import type { Role } from "./enums";

export const AREAS = [
  "dashboard",
  "city",
  "moderation",
  "reports",
  "comments",
  "places",
  "users",
  "audit",
  "account",
] as const;
export type Area = (typeof AREAS)[number];

const ACCESS: Record<Role, readonly Area[]> = {
  admin: AREAS,
  moderator: ["dashboard", "city", "moderation", "reports", "comments", "places", "account"],
  city: ["city", "account"],
  user: [],
};

export const canAccess = (role: Role | undefined, area: Area) => !!role && ACCESS[role].includes(area);

export const isStaff = (role: Role | undefined) => role === "admin" || role === "moderator" || role === "city";

/** The landing page after sign-in. */
export const homePath = (role: Role | undefined) => (role === "city" ? "/city" : "/dashboard");
