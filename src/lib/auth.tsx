import { useQueryClient } from "@tanstack/react-query";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { ApiError, apiFetch } from "./api";
import { REFRESH_KEY, clearSession, getRefreshToken, onSessionChange, setSession, type SessionEnd } from "./tokens";
import type { AdminUser, AuthSession } from "./types";

type Status = "loading" | "signedOut" | "signedIn";

type Auth = {
  status: Status;
  user: AdminUser | null;
  /** Why the last session ended (refresh_reuse, account_disabled, …), shown on the login page. */
  ended: SessionEnd | null;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>;
};

const AuthContext = createContext<Auth | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [user, setUser] = useState<AdminUser | null>(null);
  const [status, setStatus] = useState<Status>(() => (getRefreshToken() ? "loading" : "signedOut"));
  const [ended, setEnded] = useState<SessionEnd | null>(null);

  useEffect(
    () =>
      onSessionChange((next, end) => {
        setUser(next);
        setStatus(next ? "signedIn" : "signedOut");
        if (!next) {
          setEnded(end ?? null);
          queryClient.clear();
        }
      }),
    [queryClient],
  );

  // Restore the session: the cached access token (or one refresh) loads the current user. Rate
  // limits and network errors are retried instead of being shown as a sign-out.
  const restore = useCallback(async () => {
    if (!getRefreshToken()) return setStatus("signedOut");
    for (let attempt = 0; ; attempt++) {
      try {
        const { data } = await apiFetch<{ data: AdminUser }>("/v1/admin/auth/me");
        setUser(data);
        setStatus("signedIn");
        return;
      } catch (err) {
        // 401/403 already ended the session through onSessionChange.
        if (!getRefreshToken() || (err instanceof ApiError && err.status < 500 && err.status !== 429)) {
          if (getRefreshToken())
            clearSession({ reason: err instanceof ApiError ? (err.code ?? "unauthorized") : "unauthorized" });
          return;
        }
        if (attempt >= 4) {
          setEnded({ reason: "unreachable" });
          return setStatus("signedOut");
        }
        const seconds = err instanceof ApiError && err.retryAfter ? Math.min(err.retryAfter, 30) : 2 ** attempt;
        await new Promise((resolve) => setTimeout(resolve, seconds * 1000));
      }
    }
  }, []);

  useEffect(() => {
    void restore();
  }, [restore]);

  // Keep tabs in sync: sign-out elsewhere ends this tab's session, sign-in elsewhere restores it.
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key !== REFRESH_KEY) return;
      if (e.newValue === null) {
        setUser(null);
        setStatus("signedOut");
        queryClient.clear();
      } else if (status === "signedOut") {
        void restore();
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [status, queryClient, restore]);

  const login = useCallback(async (username: string, password: string) => {
    const { data } = await apiFetch<{ data: AuthSession }>("/v1/admin/auth/login", {
      method: "POST",
      body: { username, password },
      auth: false,
    });
    setEnded(null);
    setSession(data);
  }, []);

  const logout = useCallback(async () => {
    const refreshToken = getRefreshToken();
    try {
      if (refreshToken) await apiFetch("/v1/admin/auth/logout", { method: "POST", body: { refreshToken } });
    } catch {
      // The local session ends regardless.
    }
    clearSession();
  }, []);

  const changePassword = useCallback(async (currentPassword: string, newPassword: string) => {
    await apiFetch("/v1/admin/auth/password", { method: "POST", body: { currentPassword, newPassword } });
    // The backend revoked every refresh token, including ours.
    clearSession({ reason: "password_changed" });
  }, []);

  const value = useMemo<Auth>(
    () => ({ status, user, ended, login, logout, changePassword }),
    [status, user, ended, login, logout, changePassword],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth outside AuthProvider");
  return ctx;
};

/** The signed-in user; only use below the signed-in route guard. */
export const useUser = () => {
  const { user } = useAuth();
  if (!user) throw new Error("useUser without a session");
  return user;
};
