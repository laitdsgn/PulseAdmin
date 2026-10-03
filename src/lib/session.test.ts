import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import { ApiError, apiFetch, buildUrl, photoSrc } from "./api";
import {
  ACCESS_KEY,
  REFRESH_KEY,
  clearSession,
  getAccessToken,
  getRefreshToken,
  onSessionChange,
  refreshOnce,
  setSession,
  tokenExpiry,
} from "./tokens";
import type { AdminUser } from "./types";

const user: AdminUser = {
  id: 1,
  username: "root",
  displayName: null,
  role: "admin",
  isAnonymous: false,
  disabled: false,
  cities: [],
  createdAt: "2026-01-01T00:00:00Z",
};

const store = new Map<string, string>();
globalThis.localStorage = {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => void store.set(k, String(v)),
  removeItem: (k: string) => void store.delete(k),
  clear: () => store.clear(),
  key: () => null,
  get length() {
    return store.size;
  },
} as Storage;

const json = (status: number, body: unknown, headers: Record<string, string> = {}) =>
  new Response(body === undefined ? null : JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", ...headers },
  });

type Call = { url: string; method: string; auth: string | null; body: unknown };
let calls: Call[] = [];
let handler: (call: Call) => Response | Promise<Response>;

const realFetch = globalThis.fetch;
beforeEach(() => {
  calls = [];
  store.clear();
  clearSession();
  globalThis.fetch = mock(async (input: RequestInfo | URL, init?: RequestInit) => {
    const headers = new Headers(init?.headers);
    const call = {
      url: String(input),
      method: init?.method ?? "GET",
      auth: headers.get("authorization"),
      body: init?.body ? JSON.parse(String(init.body)) : undefined,
    };
    calls.push(call);
    return handler(call);
  }) as unknown as typeof fetch;
});
afterEach(() => {
  globalThis.fetch = realFetch;
});

// A JWT-shaped token whose payload carries `exp` (seconds); the signature is irrelevant here.
const jwt = (n: number, ttlSeconds = 900) => {
  const b64 = (v: object) => btoa(JSON.stringify(v)).replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_");
  return `${b64({ alg: "HS256" })}.${b64({ sub: "1", n, exp: Math.floor(Date.now() / 1000) + ttlSeconds })}.sig`;
};
const access = (n: number) => jwt(n);
const session = (n: number, ttlSeconds = 900) => ({
  user,
  accessToken: jwt(n, ttlSeconds),
  refreshToken: `refresh-${n}`,
});

describe("refreshOnce", () => {
  test("rotates the stored refresh token", async () => {
    store.set(REFRESH_KEY, "refresh-0");
    handler = () => json(200, { data: session(1) });
    expect(await refreshOnce()).toBe(true);
    expect(getAccessToken()).toBe(access(1));
    expect(getRefreshToken()).toBe("refresh-1");
    expect(calls[0]?.body).toEqual({ refreshToken: "refresh-0" });
  });

  test("parallel callers share one refresh request", async () => {
    store.set(REFRESH_KEY, "refresh-0");
    handler = async () => {
      await Bun.sleep(5);
      return json(200, { data: session(1) });
    };
    const results = await Promise.all([refreshOnce(), refreshOnce(), refreshOnce()]);
    expect(calls).toHaveLength(1);
    expect(results).toEqual([true, true, true]);
    expect(getRefreshToken()).toBe("refresh-1");
  });

  test("a rejected token ends the session with the backend's reason", async () => {
    store.set(REFRESH_KEY, "refresh-0");
    const ended: (string | undefined)[] = [];
    const off = onSessionChange((u, end) => {
      if (!u) ended.push(end?.reason);
    });
    handler = () => json(401, { error: { message: "reused", code: "refresh_reuse" } });
    expect(await refreshOnce()).toBe(false);
    expect(getRefreshToken()).toBeNull();
    expect(ended).toEqual(["refresh_reuse"]);
    off();
  });

  test("a server error keeps the session", async () => {
    store.set(REFRESH_KEY, "refresh-0");
    handler = () => json(503, { error: { message: "down" } });
    await expect(refreshOnce()).rejects.toThrow();
    expect(getRefreshToken()).toBe("refresh-0");
  });

  test("a rate-limited refresh keeps the session and reports Retry-After", async () => {
    store.set(REFRESH_KEY, "refresh-0");
    handler = () => json(429, { error: { message: "slow", code: "rate_limited" } }, { "retry-after": "12" });
    const err = await refreshOnce().catch((e) => e);
    expect(err).toMatchObject({ status: 429, retryAfter: 12 });
    expect(getRefreshToken()).toBe("refresh-0");
  });

  test("skips the network when another tab refreshed while we waited for the lock", async () => {
    setSession(session(1, 10)); // about to expire
    let release!: () => void;
    const gate = new Promise<void>((resolve) => (release = resolve));
    Object.defineProperty(globalThis.navigator, "locks", {
      configurable: true,
      value: { request: async (_name: string, fn: () => Promise<unknown>) => (await gate, fn()) },
    });
    try {
      handler = () => json(500, {});
      const pending = refreshOnce();
      // Another tab holds the lock and stores a fresh pair.
      store.set(ACCESS_KEY, JSON.stringify({ token: access(2), exp: tokenExpiry(access(2)) }));
      store.set(REFRESH_KEY, "refresh-2");
      release();
      expect(await pending).toBe(true);
      expect(calls).toHaveLength(0);
      expect(getAccessToken()).toBe(access(2));
    } finally {
      delete (globalThis.navigator as { locks?: unknown }).locks;
    }
  });
});

describe("cached access token", () => {
  test("is reused across reloads until shortly before expiry", () => {
    setSession(session(1));
    expect(getAccessToken()).toBe(access(1));
    expect(JSON.parse(store.get(ACCESS_KEY)!).exp).toBe(tokenExpiry(access(1)));
    setSession(session(2, 20)); // inside the 30 s safety margin
    expect(getAccessToken()).toBeNull();
  });

  test("tokenExpiry reads the JWT exp claim", () => {
    expect(tokenExpiry(jwt(1, 60))).toBeGreaterThan(Date.now());
    expect(tokenExpiry("not-a-jwt")).toBe(0);
  });

  test("a request with an expiring token refreshes first, without a 401 round trip", async () => {
    setSession(session(1, 10));
    handler = (call) => (call.url.endsWith("/refresh") ? json(200, { data: session(2) }) : json(200, { data: 1 }));
    await apiFetch("/v1/x");
    expect(calls.map((c) => c.url)).toEqual(["/v1/admin/auth/refresh", "/v1/x"]);
    expect(calls[1]?.auth).toBe(`Bearer ${access(2)}`);
  });
});

describe("apiFetch", () => {
  test("sends the Bearer token and parses data", async () => {
    setSession(session(1));
    handler = () => json(200, { data: { ok: true } });
    expect(await apiFetch<{ data: { ok: boolean } }>("/v1/admin/auth/me")).toEqual({ data: { ok: true } });
    expect(calls[0]?.auth).toBe(`Bearer ${access(1)}`);
  });

  test("refreshes once on 401 and retries with the new token", async () => {
    setSession(session(1));
    handler = (call) => {
      if (call.url.endsWith("/refresh")) return json(200, { data: session(2) });
      return call.auth === `Bearer ${access(2)}`
        ? json(200, { data: 1 })
        : json(401, { error: { message: "expired", code: "unauthorized" } });
    };
    expect(await apiFetch<{ data: number }>("/v1/admin/users")).toEqual({ data: 1 });
    expect(calls.map((c) => c.url)).toEqual(["/v1/admin/users", "/v1/admin/auth/refresh", "/v1/admin/users"]);
  });

  test("parallel 401s trigger a single refresh", async () => {
    setSession(session(1));
    handler = async (call) => {
      if (call.url.endsWith("/refresh")) {
        await Bun.sleep(5);
        return json(200, { data: session(2) });
      }
      return call.auth === `Bearer ${access(2)}`
        ? json(200, { data: 1 })
        : json(401, { error: { message: "expired" } });
    };
    await Promise.all([apiFetch("/v1/a"), apiFetch("/v1/b"), apiFetch("/v1/c")]);
    expect(calls.filter((c) => c.url.endsWith("/refresh"))).toHaveLength(1);
  });

  test("does not refresh on invalid_credentials", async () => {
    handler = () => json(401, { error: { message: "bad", code: "invalid_credentials" } });
    const err = await apiFetch("/v1/admin/auth/login", { method: "POST", body: {}, auth: false }).catch((e) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err.code).toBe("invalid_credentials");
    expect(calls).toHaveLength(1);
  });

  test("maps the error envelope, validation issues and Retry-After", async () => {
    setSession(session(1));
    handler = () =>
      json(400, {
        error: {
          message: "Validation failed",
          code: "validation_error",
          issues: [{ path: "name", message: "Too long" }],
        },
      });
    const validation = await apiFetch("/v1/x").catch((e) => e);
    expect(validation).toMatchObject({
      status: 400,
      code: "validation_error",
      issues: [{ path: "name", message: "Too long" }],
    });

    handler = () => json(429, { error: { message: "slow down", code: "rate_limited" } }, { "retry-after": "42" });
    const limited = await apiFetch("/v1/x").catch((e) => e);
    expect(limited).toMatchObject({ status: 429, code: "rate_limited", retryAfter: 42 });
  });

  test("returns undefined for 204", async () => {
    setSession(session(1));
    handler = () => new Response(null, { status: 204 });
    expect(await apiFetch("/v1/x", { method: "DELETE" })).toBeUndefined();
  });
});

test("buildUrl skips empty values", () => {
  expect(buildUrl("/v1/x", { q: "a b", city: "", cursor: undefined, limit: 50, verified: false })).toBe(
    "/v1/x?q=a+b&limit=50&verified=false",
  );
  expect(buildUrl("/v1/x")).toBe("/v1/x");
});

test("photoSrc keeps photos same-origin", () => {
  expect(photoSrc("https://api.example.com/v1/photos/abc")).toBe("/v1/photos/abc");
  expect(photoSrc("/v1/photos/abc")).toBe("/v1/photos/abc");
  expect(photoSrc(null)).toBeNull();
});
