import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router";
import { LoadingRows } from "@/components/states";
import { useAuth } from "@/lib/auth";
import { canAccess, type Area } from "@/lib/roles";
import { ForbiddenPage } from "@/routes/errors";

/** Renders children only for a signed-in user; otherwise redirects to /login. */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { status } = useAuth();
  const location = useLocation();
  if (status === "loading") {
    return (
      <div className="mx-auto max-w-md p-8">
        <LoadingRows rows={3} />
      </div>
    );
  }
  if (status === "signedOut") {
    return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  }
  return children;
}

/** Renders children only when the user's role may open `area`. */
export function RoleGuard({ area, children }: { area: Area; children: ReactNode }) {
  const { user } = useAuth();
  return canAccess(user?.role, area) ? children : <ForbiddenPage />;
}
