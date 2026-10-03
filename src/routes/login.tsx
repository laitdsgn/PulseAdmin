import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Navigate, useLocation } from "react-router";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useI18n, type MessageKey } from "@/i18n";
import { useAuth } from "@/lib/auth";
import { errorMessage } from "@/lib/errors";
import { homePath } from "@/lib/roles";

const ENDED: Record<string, MessageKey> = {
  refresh_reuse: "session.reuse",
  account_disabled: "session.disabled",
  forbidden: "session.forbidden",
  unauthorized: "session.ended",
  password_changed: "account.changed",
  unreachable: "error.network",
};

export function LoginPage() {
  const { t, lang, setLang } = useI18n();
  const { status, user, ended, login } = useAuth();
  const location = useLocation();
  const [error, setError] = useState<string | null>(null);

  const schema = z.object({
    username: z.string().trim().min(1, t("login.required")).max(64),
    password: z.string().min(1, t("login.required")).max(128),
  });
  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { username: "", password: "" },
  });

  if (status === "signedIn") {
    const from = (location.state as { from?: string } | null)?.from;
    return <Navigate to={from && from !== "/login" ? from : homePath(user?.role)} replace />;
  }

  const onSubmit = form.handleSubmit(async ({ username, password }) => {
    setError(null);
    try {
      await login(username, password);
    } catch (err) {
      setError(errorMessage(err, t));
      form.resetField("password");
    }
  });

  const endedKey = ended ? ENDED[ended.reason] : undefined;
  const { errors, isSubmitting } = form.formState;

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40 p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-xl">{t("login.title")}</CardTitle>
          <CardDescription>
            {t("app.name")} · {t("login.subtitle")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-4" noValidate>
            {(error || endedKey) && (
              <p role="alert" className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                {error ?? (endedKey && t(endedKey))}
              </p>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="username">{t("login.username")}</Label>
              <Input
                id="username"
                autoComplete="username"
                autoFocus
                aria-invalid={!!errors.username}
                {...form.register("username")}
              />
              {errors.username && <p className="text-xs text-destructive">{errors.username.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">{t("login.password")}</Label>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                aria-invalid={!!errors.password}
                {...form.register("password")}
              />
              {errors.password && <p className="text-xs text-destructive">{errors.password.message}</p>}
            </div>
            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? t("common.loading") : t("login.submit")}
            </Button>
          </form>
          <div className="mt-4 flex justify-center gap-2 text-xs">
            {(["pl", "en"] as const).map((l) => (
              <button
                key={l}
                type="button"
                onClick={() => setLang(l)}
                className={l === lang ? "font-semibold underline" : "text-muted-foreground hover:underline"}
              >
                {l === "pl" ? "Polski" : "English"}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
