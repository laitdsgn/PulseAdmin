import { expect, test } from "bun:test";
import { en } from "@/i18n/en";
import { pl } from "@/i18n/pl";
import {
  AUDIT_ACTIONS,
  CATEGORIES,
  FLAG_REASONS,
  PLACE_TYPES,
  PROFILES,
  ROLES,
  SEVERITIES,
  WHEELCHAIR,
  kindOf,
} from "./enums";
import { formatDate, formatNumber } from "./format";
import { canAccess, homePath } from "./roles";

test("roles match the backend guards", () => {
  expect(canAccess("admin", "users")).toBe(true);
  expect(canAccess("admin", "audit")).toBe(true);
  expect(canAccess("moderator", "users")).toBe(false);
  expect(canAccess("moderator", "audit")).toBe(false);
  expect(canAccess("moderator", "places")).toBe(true);
  expect(canAccess("moderator", "map")).toBe(true);
  expect(canAccess("admin", "map")).toBe(true);
  expect(canAccess("city", "map")).toBe(false);
  expect(canAccess("city", "city")).toBe(true);
  expect(canAccess("city", "reports")).toBe(false);
  expect(canAccess("city", "dashboard")).toBe(false);
  expect(canAccess("user", "account")).toBe(false);
  expect(canAccess(undefined, "account")).toBe(false);
  expect(homePath("city")).toBe("/city");
  expect(homePath("moderator")).toBe("/dashboard");
});

test("dictionaries have the same keys and a label for every enum value", () => {
  expect(Object.keys(en).sort()).toEqual(Object.keys(pl).sort());
  const keys = new Set(Object.keys(pl));
  const required = [
    ...CATEGORIES.map((c) => `category.${c}`),
    ...SEVERITIES.map((s) => `severity.${s}`),
    ...PROFILES.map((p) => `profile.${p}`),
    ...PLACE_TYPES.map((p) => `placeType.${p}`),
    ...WHEELCHAIR.map((w) => `wheelchair.${w}`),
    ...ROLES.map((r) => `role.${r}`),
    ...FLAG_REASONS.map((r) => `reason.${r}`),
    ...AUDIT_ACTIONS.map((a) => `audit.${a}`),
  ];
  expect(required.filter((k) => !keys.has(k))).toEqual([]);
  for (const dict of [pl, en] as Record<string, string>[]) {
    expect(Object.entries(dict).filter(([, v]) => !v.trim())).toEqual([]);
  }
});

test("kindOf groups categories", () => {
  expect(kindOf("stairs")).toBe("barrier");
  expect(kindOf("ramp")).toBe("facility");
  expect(kindOf("queue")).toBe("live");
});

test("formatters", () => {
  expect(formatDate("2026-03-01", "en")).toBe("1 Mar");
  expect(formatDate(null, "pl")).toBe("—");
  expect(formatNumber(1234.5, "en", 1)).toBe("1,234.5");
  expect(formatNumber(null, "en")).toBe("—");
});
