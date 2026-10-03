import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { UserPlus } from "lucide-react";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { CityChecklist } from "@/components/CityChecklist";
import { CredentialsFields, passwordSchema, usernameSchema } from "@/components/CredentialsFields";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useI18n } from "@/i18n";
import { apiFetch, ApiError } from "@/lib/api";
import { STAFF_ROLES } from "@/lib/enums";
import { applyFieldErrors, errorMessage, toastError } from "@/lib/errors";
import { useInvalidate } from "@/lib/queries";
import type { AdminUser } from "@/lib/types";

const schema = z.object({
  username: usernameSchema,
  password: passwordSchema,
  role: z.enum(STAFF_ROLES),
  cities: z.array(z.string()),
});
type Values = z.infer<typeof schema>;
const DEFAULTS: Values = { username: "", password: "", role: "moderator", cities: [] };

export function CreateUserDialog({ onCreated }: { onCreated: (user: AdminUser) => void }) {
  const { t } = useI18n();
  const invalidate = useInvalidate();
  const [open, setOpen] = useState(false);
  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: DEFAULTS });

  const create = useMutation({
    mutationFn: (values: Values) =>
      apiFetch<{ data: AdminUser }>("/v1/admin/users", {
        method: "POST",
        body: { ...values, cities: values.role === "city" ? values.cities : undefined },
      }).then((r) => r.data),
    onSuccess: (user) => {
      toast.success(t("users.created", { username: user.username ?? `#${user.id}` }));
      void invalidate("/v1/admin/users", "/v1/admin/dashboard");
      setOpen(false);
      form.reset(DEFAULTS);
      onCreated(user);
    },
    onError: (err) => {
      if (err instanceof ApiError && err.code === "username_taken") {
        form.setError("username", { type: "server", message: errorMessage(err, t) });
      } else if (!applyFieldErrors(err, form.setError, ["username", "password", "role", "cities"])) {
        toastError(err, t);
      }
    },
  });

  const role = form.watch("role");
  const password = form.watch("password");

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <UserPlus className="size-4" />
          {t("users.new")}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("users.new")}</DialogTitle>
          <DialogDescription>{t("users.passwordHint")}</DialogDescription>
        </DialogHeader>
        <form id="create-user" onSubmit={form.handleSubmit((v) => create.mutate(v))} className="space-y-4">
          <CredentialsFields
            register={form.register}
            setValue={form.setValue}
            errors={form.formState.errors}
            password={password}
            idPrefix="new"
          />
          <div className="space-y-1.5">
            <Label>{t("users.role")}</Label>
            <Controller
              control={form.control}
              name="role"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STAFF_ROLES.map((r) => (
                      <SelectItem key={r} value={r}>
                        {t(`role.${r}`)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </div>
          {role === "city" && (
            <Controller
              control={form.control}
              name="cities"
              render={({ field }) => <CityChecklist value={field.value} onChange={field.onChange} />}
            />
          )}
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            {t("common.cancel")}
          </Button>
          <Button type="submit" form="create-user" disabled={create.isPending}>
            {create.isPending ? t("common.saving") : t("users.create")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
