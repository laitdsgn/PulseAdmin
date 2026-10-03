// HTTP client for the backend. The panel server proxies /v1/* to the API, so every call is
// same-origin and relative.
import { ApiError, type Issue } from "./api-error";
import { expireAccessToken, getAccessToken, refreshOnce } from "./tokens";

export { ApiError, type Issue };

export type Query = Record<string, string | number | boolean | null | undefined>;

type Options = {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  query?: Query;
  body?: unknown;
  /** Send the Bearer token and refresh it on 401. Default true. */
  auth?: boolean;
  signal?: AbortSignal;
};

let language = "pl";
export const setApiLanguage = (lang: string) => {
  language = lang;
};

export const buildUrl = (path: string, query?: Query) => {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value !== undefined && value !== null && value !== "") params.set(key, String(value));
  }
  const qs = params.toString();
  return qs ? `${path}?${qs}` : path;
};

const toApiError = async (res: Response) => {
  const retryAfter = Number(res.headers.get("retry-after")) || undefined;
  try {
    const body = (await res.json()) as { error?: { message?: string; code?: string; issues?: Issue[] } };
    const err = body.error ?? {};
    return new ApiError(res.status, err.message ?? res.statusText, err.code, err.issues, retryAfter);
  } catch {
    return new ApiError(res.status, res.statusText || `HTTP ${res.status}`, undefined, undefined, retryAfter);
  }
};

// 401s that are an answer about credentials, not an expired access token.
const NO_RETRY = new Set(["invalid_credentials", "refresh_reuse"]);

const send = async (path: string, opts: Options) => {
  const auth = opts.auth !== false;
  let sentToken: string | null = null;
  const doFetch = () => {
    const headers: Record<string, string> = { "accept-language": language };
    if (opts.body !== undefined) headers["content-type"] = "application/json";
    sentToken = auth ? getAccessToken() : null;
    if (sentToken) headers.authorization = `Bearer ${sentToken}`;
    return fetch(buildUrl(path, opts.query), {
      method: opts.method ?? "GET",
      headers,
      body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
      signal: opts.signal,
    });
  };

  // Refresh up front when the cached access token is missing or about to expire.
  if (auth && !getAccessToken()) await refreshOnce();
  let res = await doFetch();
  if (res.status === 401 && auth) {
    const error = await toApiError(res.clone());
    if (!NO_RETRY.has(error.code ?? "")) {
      // The backend rejected a token we thought was valid: drop it and refresh once.
      if (sentToken) expireAccessToken(sentToken);
      if (!(await refreshOnce())) throw error;
      res = await doFetch();
    }
  }
  if (!res.ok) throw await toApiError(res);
  return res;
};

export const apiFetch = async <T = void>(path: string, opts: Options = {}): Promise<T> => {
  const res = await send(path, opts);
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
};

/** Fetches binary content that needs the Bearer token (e.g. a staff-only photo). */
export const apiBlob = async (path: string, signal?: AbortSignal) => (await send(path, { signal })).blob();

/** Downloads a file that needs the Bearer token (a plain link cannot send it). */
export const apiDownload = async (path: string, query: Query, fallbackName: string) => {
  const res = await send(path, { query });
  const disposition = res.headers.get("content-disposition") ?? "";
  const name = /filename="?([^";]+)"?/.exec(disposition)?.[1] ?? fallbackName;
  const url = URL.createObjectURL(await res.blob());
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};

/** Photo URLs may be absolute (backend PUBLIC_URL); load them through the same-origin proxy. */
export const photoSrc = (url: string | null) => {
  if (!url) return null;
  const i = url.indexOf("/v1/photos/");
  return i >= 0 ? url.slice(i) : url;
};

/** The photo id at the end of a report's photoUrl. */
export const photoIdOf = (url: string | null) => (url ? (url.split("/").pop() ?? null) : null);
