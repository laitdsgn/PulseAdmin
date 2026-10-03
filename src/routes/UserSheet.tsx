import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Ban, KeyRound, LogOut, Trash2, Unlock } from "lucide-react";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { Link } from "react-router";
import { toast } from "sonner";
import { z } from "zod";
import { RoleBadge } from "@/components/badges";
import { CityChecklist } from "@/components/CityChecklist";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { CredentialsFields, passwordSchema, usernameSchema } from "@/components/CredentialsFields";
import { ErrorState, LoadingRows } from "@/components/states";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useI18n } from "@/i18n";
import { apiFetch, ApiError } from "@/lib/api";
import { useUser } from "@/lib/auth";
import { ROLES, type Role } from "@/lib/enums";
import { applyFieldErrors, errorMessage, toastError } from "@/lib/errors";
import { formatDateTime, formatNumber } from "@/lib/format";
import { useInvalidate } from "@/lib/queries";
import type { AdminUser, AdminUserDetail } from "@/lib/types";

const userKey = (id: number) => ["/v1/admin/users", { id }];

export function UserSheet({ id, onClose }: { id: number | null; onClose: () => void }) {
  const { t } = useI18n();
  const user = useQuery({
    queryKey: userKey(id ?? 0),
    enabled: id !== null && id > 0,
    queryFn: () => apiFetch<{ data: AdminUserDetail }>(`/v1/admin/users/${id}`).then((r) => r.data),
  });
  return (
    <Sheet open={id !== null} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
        {user.isLoading ? (
          <div className="p-4">
            <SheetTitle className="sr-only">{t("common.loading")}</SheetTitle>
            <LoadingRows />
          </div>
        ) : user.error || !user.data ? (
          <div className="p-4">
            <SheetTitle className="sr-only">{t("common.error")}</SheetTitle>
            <ErrorState
              error={user.error ?? new ApiError(404, "Not found", "not_found")}
              onRetry={() => void user.refetch()}
            />
          </div>
        ) : (
          <UserDetails user={user.data} onDeleted={onClose} />
        )}
      </SheetContent>
    </Sheet>
  );
}

const useUserMutation = <V,>(fn: (vars: V) => Promise<unknown>, onDone?: () => void) => {
  const { t } = useI18n();
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      toast.success(t("common.saved"));
      void invalidate("/v1/admin/users", "/v1/admin/dashboard", "/v1/admin/audit");
      onDone?.();
    },
    onError: (err) => toastError(err, t),
  });
};

function UserDetails({ user: u, onDeleted }: { user: AdminUserDetail; onDeleted: () => void }) {
  const { t, lang } = useI18n();
  const me = useUser();
  const self = me.id === u.id;
  const n = (v: number) => formatNumber(v, lang);
  const name = u.username ?? `#${u.id}`;

  const patch = useUserMutation((body: Partial<Pick<AdminUser, "role" | "cities" | "disabled">>) =>
    apiFetch(`/v1/admin/users/${u.id}`, { method: "PATCH", body }),
  );
  const revoke = useUserMutation(() => apiFetch(`/v1/admin/users/${u.id}/revoke-sessions`, { method: "POST" }));
  const remove = useUserMutation(() => apiFetch(`/v1/admin/users/${u.id}`, { method: "DELETE" }), onDeleted);

  const stats: [string, string][] = [
    [t("users.statReports"), n(u.stats.reports)],
    [t("users.statHiddenReports"), n(u.stats.hiddenReports)],
    [t("users.statComments"), n(u.stats.comments)],
    [t("users.statHiddenComments"), n(u.stats.hiddenComments)],
    [t("users.statFlags"), n(u.stats.flagsFiled)],
    [t("users.statDevices"), n(u.stats.devices)],
    [t("users.statReputation"), n(u.stats.reputation)],
    [t("users.statSessions"), n(u.stats.activeSessions)],
  ];

  return (
    <>
      <SheetHeader>
        <SheetTitle className="flex flex-wrap items-center gap-2 pr-6">
          {u.username ?? u.displayName ?? `#${u.id}`}
          <RoleBadge role={u.role} />
          {u.disabled && <Badge variant="destructive">{t("users.disabled")}</Badge>}
        </SheetTitle>
        <SheetDescription>
          #{u.id}
          {u.displayName && ` · ${u.displayName}`}
          {u.isAnonymous && ` · ${t("users.anonymous")}`} · {t("common.createdAt")} {formatDateTime(u.createdAt, lang)}{" "}
          · {t("users.lastSeen")} {formatDateTime(u.stats.lastSeenAt, lang)}
        </SheetDescription>
      </SheetHeader>

      <div className="space-y-6 px-4 pb-6">
        {self && <p className="rounded-md bg-muted p-3 text-sm">{t("users.self")}</p>}

        <section className="space-y-2">
          <h3 className="font-medium">{t("users.stats")}</h3>
          <dl className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
            {stats.map(([label, value]) => (
              <div key={label} className="rounded-md border p-2">
                <dt className="text-xs text-muted-foreground">{label}</dt>
                <dd className="text-lg font-semibold tabular-nums">{value}</dd>
              </div>
            ))}
          </dl>
          <div className="flex flex-wrap gap-3 text-sm">
            <Link to={`/reports?authorId=${u.id}`} className="text-primary underline-offset-4 hover:underline">
              {t("users.reportsLink")} →
            </Link>
            <Link to={`/comments?userId=${u.id}`} className="text-primary underline-offset-4 hover:underline">
              {t("users.commentsLink")} →
            </Link>
          </div>
        </section>

        {!self && <RoleForm user={u} pending={patch.isPending} onSave={(body) => patch.mutate(body)} />}

        {!self && (
          <section className="space-y-2 border-t pt-4">
            <div className="flex flex-wrap gap-2">
              {u.disabled ? (
                <Button
                  variant="secondary"
                  disabled={patch.isPending}
                  onClick={() => patch.mutate({ disabled: false })}
                >
                  <Unlock className="size-4" />
                  {t("users.unblock")}
                </Button>
              ) : (
                <ConfirmDialog
                  trigger={
                    <Button variant="destructive" disabled={patch.isPending}>
                      <Ban className="size-4" />
                      {t("users.block")}
                    </Button>
                  }
                  title={t("users.block")}
                  description={t("users.blockConfirm")}
                  destructive
                  onConfirm={() => patch.mutate({ disabled: true })}
                />
              )}
              <ConfirmDialog
                trigger={
                  <Button variant="outline" disabled={revoke.isPending}>
                    <LogOut className="size-4" />
                    {t("users.revoke")}
                  </Button>
                }
                title={t("users.revoke")}
                description={t("users.revokeConfirm")}
                onConfirm={() => revoke.mutate(undefined)}
              />
            </div>
          </section>
        )}

        {/* Your own password is changed on the account page; resetting it here would end this session. */}
        {!self && <CredentialsForm user={u} />}

        {!self && (
          <section className="border-t pt-4">
            <ConfirmDialog
              trigger={
                <Button variant="ghost" className="text-destructive hover:text-destructive" disabled={remove.isPending}>
                  <Trash2 className="size-4" />
                  {t("common.delete")}
                </Button>
              }
              title={t("users.deleteTitle")}
              description={t("users.deleteBody", { name })}
              typeToConfirm={name}
              confirmLabel={t("common.delete")}
              destructive
              onConfirm={() => remove.mutate(undefined)}
            />
          </section>
        )}
      </div>
    </>
  );
}

function RoleForm({
  user: u,
  pending,
  onSave,
}: {
  user: AdminUser;
  pending: boolean;
  onSave: (body: { role?: Role; cities?: string[] }) => void;
}) {
  const { t } = useI18n();
  const [role, setRole] = useState<Role>(u.role);
  const [cities, setCities] = useState<string[]>(u.cities);
  useEffect(() => {
    setRole(u.role);
    setCities(u.cities);
  }, [u.role, u.cities.join(",")]); // eslint-disable-line react-hooks/exhaustive-deps

  const citiesChanged = [...cities].sort().join(",") !== [...u.cities].sort().join(",");
  const changed = role !== u.role || (role === "city" && citiesChanged);

  return (
    <section className="space-y-3 border-t pt-4">
      <h3 className="font-medium">{t("users.roleAndCities")}</h3>
      <div className="space-y-1.5">
        <Label>{t("users.role")}</Label>
        <Select value={role} onValueChange={(v) => setRole(v as Role)}>
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {ROLES.map((r) => (
              <SelectItem key={r} value={r}>
                {t(`role.${r}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {role === "city" && <CityChecklist value={cities} onChange={setCities} />}
      <Button
        disabled={!changed || pending}
        onClick={() =>
          onSave({
            ...(role !== u.role && { role }),
            // The backend clears cities for every role but `city`.
            ...(role === "city" && citiesChanged && { cities }),
          })
        }
      >
        {pending ? t("common.saving") : t("common.save")}
      </Button>
    </section>
  );
}

const credentialsSchema = z.object({ username: usernameSchema, password: passwordSchema });
type Credentials = z.infer<typeof credentialsSchema>;

function CredentialsForm({ user: u }: { user: AdminUser }) {
  const { t } = useI18n();
  const invalidate = useInvalidate();
  const form = useForm<Credentials>({
    resolver: zodResolver(credentialsSchema),
    defaultValues: { username: u.username ?? "", password: "" },
  });
  const save = useMutation({
    mutationFn: (body: Credentials) => apiFetch(`/v1/admin/users/${u.id}/credentials`, { method: "PUT", body }),
    onSuccess: () => {
      toast.success(t("common.saved"));
      void invalidate("/v1/admin/users", "/v1/admin/audit");
    },
    onError: (err) => {
      if (err instanceof ApiError && err.code === "username_taken") {
        form.setError("username", { type: "server", message: errorMessage(err, t) });
      } else if (!applyFieldErrors(err, form.setError, ["username", "password"])) {
        toastError(err, t);
      }
    },
  });
  const password = form.watch("password");

  return (
    <section className="space-y-3 border-t pt-4">
      <div>
        <h3 className="font-medium">{t("users.credentials")}</h3>
        <p className="text-xs text-muted-foreground">{t("users.credentialsHint")}</p>
      </div>
      <form onSubmit={form.handleSubmit((v) => save.mutate(v))} className="space-y-3">
        <CredentialsFields
          register={form.register}
          setValue={form.setValue}
          errors={form.formState.errors}
          password={password}
          idPrefix={`user-${u.id}`}
        />
        <Button type="submit" variant="outline" disabled={save.isPending}>
          <KeyRound className="size-4" />
          {save.isPending ? t("common.saving") : t("users.setCredentials")}
        </Button>
      </form>
    </section>
  );
}
