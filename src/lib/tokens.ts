// Session tokens, shared by every tab through localStorage.
//
// The backend rotates refresh tokens and treats a reused one as theft (401 refresh_reuse revokes
// every session), and it allows only 10 refreshes per minute per IP — shared by all staff behind the
// panel's proxy. So: the access token is cached with its expiry and reused across reloads and tabs,
// a refresh only happens when it is about to expire, and refreshes are deduplicated inside a tab and
// serialised across tabs with a Web Lock.
import { ApiError } from "./api-error";
import type { AdminUser, AuthSession } from "./types";

export const REFRESH_KEY = "pulse-admin.refresh";
export const ACCESS_KEY = "pulse-admin.access";
const LOCK_NAME = "pulse-admin.refresh";
// Refresh this long before the access token expires, so a request never races the expiry.
const EXPIRY_MARGIN_MS = 30_000;

export type SessionEnd = { reason: string };
type Listener = (user: AdminUser | null, end?: SessionEnd) => void;
type CachedAccess = { token: string; exp: number };

// Fallback when localStorage is blocked: the session then lasts until the tab closes.
const memory = new Map<string, string>();
let inFlight: Promise<boolean> | null = null;
const listeners = new Set<Listener>();

const read = (key: string) => {
  try {
    const value = globalThis.localStorage?.getItem(key);
    if (value !== undefined) return value;
  } catch {}
  return memory.get(key) ?? null;
};

const write = (key: string, value: string | null) => {
  if (value === null) memory.delete(key);
  else memory.set(key, value);
  try {
    if (value === null) globalThis.localStorage?.removeItem(key);
    else globalThis.localStorage?.setItem(key, value);
  } catch {}
};

/** Expiry (ms) from the JWT `exp` claim; 0 when it cannot be read. */
export const tokenExpiry = (token: string) => {
  try {
    const payload = token.split(".")[1] ?? "";
    const json = atob(payload.replace(/-/g, "+").replace(/_/g, "/"));
    const exp = (JSON.parse(json) as { exp?: number }).exp;
    return typeof exp === "number" ? exp * 1000 : 0;
  } catch {
    return 0;
  }
};

const cachedAccess = (): CachedAccess | null => {
  try {
    return JSON.parse(read(ACCESS_KEY) ?? "null") as CachedAccess | null;
  } catch {
    return null;
  }
};

/** A usable access token, or null when there is none or it is about to expire. */
export const getAccessToken = () => {
  const cached = cachedAccess();
  return cached && cached.exp - EXPIRY_MARGIN_MS > Date.now() ? cached.token : null;
};
export const getRefreshToken = () => read(REFRESH_KEY);

export const onSessionChange = (listener: Listener) => {
  listeners.add(listener);
  return () => void listeners.delete(listener);
};

const emit = (user: AdminUser | null, end?: SessionEnd) => listeners.forEach((l) => l(user, end));

const store = (session: Pick<AuthSession, "accessToken" | "refreshToken">) => {
  const cached: CachedAccess = { token: session.accessToken, exp: tokenExpiry(session.accessToken) };
  write(ACCESS_KEY, JSON.stringify(cached));
  write(REFRESH_KEY, session.refreshToken);
};

export const setSession = (session: AuthSession) => {
  store(session);
  emit(session.user);
};

export const clearSession = (end?: SessionEnd) => {
  write(ACCESS_KEY, null);
  write(REFRESH_KEY, null);
  emit(null, end);
};

const withLock = <T>(fn: () => Promise<T>): Promise<T> => {
  const locks = globalThis.navigator?.locks;
  return locks ? (locks.request(LOCK_NAME, fn) as Promise<T>) : fn();
};

const toError = async (res: Response) => {
  const retryAfter = Number(res.headers.get("retry-after")) || undefined;
  try {
    const body = (await res.json()) as { error?: { message?: string; code?: string } };
    return new ApiError(res.status, body.error?.message ?? res.statusText, body.error?.code, undefined, retryAfter);
  } catch {
    return new ApiError(res.status, res.statusText, undefined, undefined, retryAfter);
  }
};

/**
 * Makes sure a fresh access token is stored. Resolves to false (and ends the session) when the
 * backend rejects the refresh token; throws on network errors, rate limits and server errors, so a
 * flaky connection does not log the user out.
 */
export const refreshOnce = (): Promise<boolean> => {
  const staleAccess = cachedAccess()?.token;
  inFlight ??= withLock(async () => {
    // Another tab may have refreshed while we waited for the lock.
    const current = getAccessToken();
    if (current && current !== staleAccess) return true;

    const refreshToken = getRefreshToken();
    if (!refreshToken) return false;
    const res = await fetch("/v1/admin/auth/refresh", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ refreshToken }),
    });
    if (res.ok) {
      const { data } = (await res.json()) as { data: AuthSession };
      setSession(data);
      return true;
    }
    const error = await toError(res);
    if (res.status === 401 || res.status === 403) {
      clearSession({ reason: error.code ?? "unauthorized" });
      return false;
    }
    throw error;
  }).finally(() => {
    inFlight = null;
  });
  return inFlight;
};

/** Forces the next request to refresh (used when the backend rejects a cached access token). */
export const expireAccessToken = (token: string) => {
  if (cachedAccess()?.token === token) write(ACCESS_KEY, null);
};
