import type { FieldValues, Path, UseFormSetError } from "react-hook-form";
import { toast } from "sonner";
import { isMessageKey, type MessageKey, type Vars } from "@/i18n";
import { ApiError } from "./api";

type T = (key: MessageKey, vars?: Vars) => string;

/** A user-facing message for any error thrown by apiFetch or fetch. */
export const errorMessage = (error: unknown, t: T) => {
  if (error instanceof ApiError) {
    if (error.code === "rate_limited" || (error.status === 429 && !error.code)) {
      return t("error.rate_limited", { seconds: error.retryAfter ?? 60 });
    }
    const key = `error.${error.code}`;
    if (error.code && isMessageKey(key)) return t(key);
    return error.message || t("error.generic");
  }
  if (error instanceof TypeError) return t("error.network");
  return t("error.generic");
};

export const toastError = (error: unknown, t: T) => toast.error(errorMessage(error, t));

/**
 * Puts backend validation issues on the matching form fields. Returns true when at least one
 * issue matched a field, so the caller can skip the generic toast.
 */
export const applyFieldErrors = <F extends FieldValues>(
  error: unknown,
  setError: UseFormSetError<F>,
  fields: readonly string[],
) => {
  if (!(error instanceof ApiError) || !error.issues) return false;
  let matched = false;
  for (const issue of error.issues) {
    const field = issue.path.split(".")[0] ?? "";
    if (fields.includes(field)) {
      setError(field as Path<F>, { type: "server", message: issue.message });
      matched = true;
    }
  }
  return matched;
};
