import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { RoleBadge } from "@/components/badges";
import { passwordSchema } from "@/components/CredentialsFields";
import { useCityName } from "@/components/Filters";
import { PageHeader } from "@/components/states";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useI18n } from "@/i18n";
import { ApiError } from "@/lib/api";
import { useAuth, useUser } from "@/lib/auth";
import { errorMessage, toastError } from "@/lib/errors";
import { formatDateTime } from "@/lib/format";

export function AccountPage() {
  const { t, lang } = useI18n();
  const user = useUser();
  const { changePassword } = useAuth();
  const cityName = useCityName();

  const schema = z
    .object({ currentPassword: z.string().min(1).max(128), newPassword: passwordSchema, repeat: z.string() })
    .refine((v) => v.newPassword === v.repeat, { path: ["repeat"], message: t("account.mismatch") });
  type Values = z.infer<typeof schema>;
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { currentPassword: "", newPassword: "", repeat: "" },
  });

  const onSubmit = form.handleSubmit(async ({ currentPassword, newPassword }) => {
    try {
      // Ends the session on success; the login page explains why.
      await changePassword(currentPassword, newPassword);
    } catch (err) {
      if (err instanceof ApiError && err.code === "invalid_credentials") {
        form.setError("currentPassword", { message: errorMessage(err, t) });
      } else {
        toastError(err, t);
      }
    }
  });

  const { errors, isSubmitting } = form.formState;
  const field = (name: keyof Values, label: string, autoComplete: string) => (
    <div className="space-y-1.5">
      <Label htmlFor={name}>{label}</Label>
      <Input
        id={name}
        type="password"
        autoComplete={autoComplete}
        aria-invalid={!!errors[name]}
        {...form.register(name)}
      />
      {errors[name] && <p className="text-xs text-destructive">{errors[name]?.message}</p>}
    </div>
  );

  return (
    <>
      <PageHeader title={t("account.title")} />
      <div className="grid max-w-3xl gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              {user.username}
              <RoleBadge role={user.role} />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
              <dt className="text-muted-foreground">{t("common.id")}</dt>
              <dd>#{user.id}</dd>
              {user.role === "city" && (
                <>
                  <dt className="text-muted-foreground">{t("users.cities")}</dt>
                  <dd>{user.cities.length ? user.cities.map(cityName).join(", ") : t("common.allCities")}</dd>
                </>
              )}
              <dt className="text-muted-foreground">{t("common.createdAt")}</dt>
              <dd>{formatDateTime(user.createdAt, lang)}</dd>
            </dl>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("account.changePassword")}</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={onSubmit} className="space-y-3" noValidate>
              {field("currentPassword", t("account.current"), "current-password")}
              {field("newPassword", t("account.new"), "new-password")}
              {field("repeat", t("account.repeat"), "new-password")}
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? t("common.saving") : t("account.changePassword")}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
