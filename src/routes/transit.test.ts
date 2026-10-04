import { expect, test } from "bun:test";
import type { TransitFeed } from "@/lib/types";
import { feedWarnings } from "./transit";

const NOW = Date.parse("2026-10-04T12:00:00Z");
const ago = (minutes: number) => new Date(NOW - minutes * 60_000).toISOString();
const live = { fetchedAt: null, feedTimestamp: null, lastError: null };

const feed = (vehicles: Partial<TransitFeed["vehicles"]> = {}): TransitFeed => ({
  id: "krakow-t",
  cityId: "krakow",
  name: "Tramwaje",
  version: "1",
  importedAt: ago(60),
  stops: 1,
  trips: 1,
  // the timetable covers the real today (feedWarnings compares it with the clock)
  servesFrom: new Date().toISOString().slice(0, 10),
  servesTo: "2099-12-31",
  realtimeUrl: null,
  realtime: { ...live, trips: null },
  vehiclePositionsUrl: "https://example.test/vp.pb",
  vehicles: { ...live, vehicles: null, ...vehicles },
});

test("vehicle positions that stopped changing are information, not a problem", () => {
  expect(feedWarnings(feed(), NOW)).toEqual([]);
  // fetched just now, but the operator's data is 30 minutes old
  expect(feedWarnings(feed({ fetchedAt: ago(1), feedTimestamp: ago(30), vehicles: 0 }), NOW)).toEqual([
    { key: "transit.vehiclesStale", info: true },
  ]);
  // fresh data, or a fetch long ago (nobody asked since): nothing to say
  expect(feedWarnings(feed({ fetchedAt: ago(1), feedTimestamp: ago(1), vehicles: 40 }), NOW)).toEqual([]);
  expect(feedWarnings(feed({ fetchedAt: ago(60), feedTimestamp: ago(90), vehicles: 40 }), NOW)).toEqual([]);
});
