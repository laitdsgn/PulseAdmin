import { Copy, Wand2 } from "lucide-react";
import type { FieldErrors, UseFormRegister, UseFormSetValue } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useT } from "@/i18n";
import { generatePassword } from "./CityChecklist";

// Same rules as PulseBackend/src/routes/admin.ts (username, newPassword).
export const usernameSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9._-]{3,32}$/);
export const passwordSchema = z.string().min(12).max(128);

type Fields = { username: string; password: string };

/** Username + password inputs with a generator; the password is shown in clear text to be copied once. */
export function CredentialsFields<F extends Fields>({
  register,
  setValue,
  errors,
  password,
  idPrefix,
}: {
  register: UseFormRegister<F>;
  setValue: UseFormSetValue<F>;
  errors: FieldErrors<F>;
  password: string;
  idPrefix: string;
}) {
  const t = useT();
  const reg = register as unknown as UseFormRegister<Fields>;
  const set = setValue as unknown as UseFormSetValue<Fields>;
  const errs = errors as FieldErrors<Fields>;
  return (
    <>
      <div className="space-y-1.5">
        <Label htmlFor={`${idPrefix}-username`}>{t("users.username")}</Label>
        <Input id={`${idPrefix}-username`} autoComplete="off" aria-invalid={!!errs.username} {...reg("username")} />
        <p className={errs.username ? "text-xs text-destructive" : "text-xs text-muted-foreground"}>
          {errs.username
            ? errs.username.type === "server"
              ? errs.username.message
              : t("validation.username")
            : t("users.usernameHint")}
        </p>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={`${idPrefix}-password`}>{t("users.password")}</Label>
        <div className="flex gap-2">
          <Input
            id={`${idPrefix}-password`}
            autoComplete="new-password"
            className="font-mono"
            aria-invalid={!!errs.password}
            {...reg("password")}
          />
          <Button
            type="button"
            variant="outline"
            size="icon"
            aria-label={t("users.generate")}
            title={t("users.generate")}
            onClick={() => set("password", generatePassword(), { shouldDirty: true, shouldValidate: true })}
          >
            <Wand2 className="size-4" />
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon"
            aria-label={t("common.copy")}
            title={t("common.copy")}
            disabled={!password}
            onClick={() => void navigator.clipboard.writeText(password).then(() => toast.success(t("common.copied")))}
          >
            <Copy className="size-4" />
          </Button>
        </div>
        <p className={errs.password ? "text-xs text-destructive" : "text-xs text-muted-foreground"}>
          {errs.password?.message ?? t("users.passwordHint")}
        </p>
      </div>
    </>
  );
}
