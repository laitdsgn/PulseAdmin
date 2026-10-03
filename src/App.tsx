import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { createBrowserRouter, Navigate, RouterProvider } from "react-router";
import { AppLayout } from "@/components/layout/AppLayout";
import { RequireAuth, RoleGuard } from "@/components/RoleGuard";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { I18nProvider, useI18n } from "@/i18n";
import { ApiError } from "@/lib/api";
import { AuthProvider, useAuth } from "@/lib/auth";
import { homePath } from "@/lib/roles";
import { ThemeProvider } from "@/lib/theme";
import { AccountPage } from "@/routes/account";
import { AuditPage } from "@/routes/audit";
import { CityPage } from "@/routes/city";
import { CommentsPage } from "@/routes/comments";
import { DashboardPage } from "@/routes/dashboard";
import { NotFoundPage } from "@/routes/errors";
import { LoginPage } from "@/routes/login";
import { MapPage } from "@/routes/map";
import { ModerationPage } from "@/routes/moderation";
import { PlacesPage } from "@/routes/places";
import { ReportsPage } from "@/routes/reports";
import { UsersPage } from "@/routes/users";
import "./index.css";

function Home() {
  const { user } = useAuth();
  return <Navigate to={homePath(user?.role)} replace />;
}

const router = createBrowserRouter([
  { path: "/login", element: <LoginPage /> },
  {
    path: "/",
    element: (
      <RequireAuth>
        <AppLayout />
      </RequireAuth>
    ),
    children: [
      { index: true, element: <Home /> },
      {
        path: "dashboard",
        element: (
          <RoleGuard area="dashboard">
            <DashboardPage />
          </RoleGuard>
        ),
      },
      {
        path: "map",
        element: (
          <RoleGuard area="map">
            <MapPage />
          </RoleGuard>
        ),
      },
      {
        path: "city",
        element: (
          <RoleGuard area="city">
            <CityPage />
          </RoleGuard>
        ),
      },
      {
        path: "moderation",
        element: (
          <RoleGuard area="moderation">
            <ModerationPage />
          </RoleGuard>
        ),
      },
      {
        path: "reports",
        element: (
          <RoleGuard area="reports">
            <ReportsPage />
          </RoleGuard>
        ),
      },
      {
        path: "comments",
        element: (
          <RoleGuard area="comments">
            <CommentsPage />
          </RoleGuard>
        ),
      },
      {
        path: "places",
        element: (
          <RoleGuard area="places">
            <PlacesPage />
          </RoleGuard>
        ),
      },
      {
        path: "users",
        element: (
          <RoleGuard area="users">
            <UsersPage />
          </RoleGuard>
        ),
      },
      {
        path: "audit",
        element: (
          <RoleGuard area="audit">
            <AuditPage />
          </RoleGuard>
        ),
      },
      { path: "account", element: <AccountPage /> },
      { path: "*", element: <NotFoundPage /> },
    ],
  },
]);

const makeQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        refetchOnWindowFocus: false,
        // Retrying a 4xx (forbidden, not found, validation) cannot succeed.
        retry: (count, error) => !(error instanceof ApiError && error.status < 500) && count < 2,
      },
    },
  });

/** Localised fields (report titles, flag previews) come from the API, so refetch on language change. */
function RefetchOnLanguageChange() {
  const { lang } = useI18n();
  const queryClient = useQueryClient();
  const [first, setFirst] = useState(true);
  useEffect(() => {
    if (first) setFirst(false);
    else void queryClient.invalidateQueries();
  }, [lang]); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}

export function App() {
  const [queryClient] = useState(makeQueryClient);
  return (
    <ThemeProvider>
      <I18nProvider>
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            <TooltipProvider>
              <RefetchOnLanguageChange />
              <RouterProvider router={router} />
              <Toaster richColors closeButton />
            </TooltipProvider>
          </AuthProvider>
        </QueryClientProvider>
      </I18nProvider>
    </ThemeProvider>
  );
}

export default App;
