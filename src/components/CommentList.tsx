import { useMutation } from "@tanstack/react-query";
import { Eye, EyeOff } from "lucide-react";
import { Link } from "react-router";
import { toast } from "sonner";
import { HiddenBadge } from "@/components/badges";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/i18n";
import { apiFetch } from "@/lib/api";
import { useUser } from "@/lib/auth";
import { toastError } from "@/lib/errors";
import { formatDateTime } from "@/lib/format";
import { useInvalidate } from "@/lib/queries";
import { canAccess } from "@/lib/roles";
import type { AdminComment } from "@/lib/types";

export const useCommentVisibility = () => {
  const { t } = useI18n();
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({ id, hidden }: { id: number; hidden: boolean }) =>
      apiFetch(`/v1/admin/comments/${id}/visibility`, { method: "POST", body: { hidden } }),
    onSuccess: () => {
      toast.success(t("common.saved"));
      void invalidate("/v1/admin/comments", "/v1/admin/dashboard");
    },
    onError: (err) => toastError(err, t),
  });
};

export function CommentVisibilityButton({ comment }: { comment: AdminComment }) {
  const { t } = useI18n();
  const visibility = useCommentVisibility();
  return (
    <Button
      size="sm"
      variant={comment.hidden ? "secondary" : "outline"}
      disabled={visibility.isPending}
      onClick={(e) => {
        e.stopPropagation();
        visibility.mutate({ id: comment.id, hidden: !comment.hidden });
      }}
    >
      {comment.hidden ? <Eye className="size-4" /> : <EyeOff className="size-4" />}
      {comment.hidden ? t("common.restore") : t("common.hide")}
    </Button>
  );
}

export function AuthorLink({ id, name }: { id: number | null; name?: string | null }) {
  const { t } = useI18n();
  const user = useUser();
  if (id === null) return <span className="text-muted-foreground">{t("reports.anonymous")}</span>;
  const label = name ? `${name} (#${id})` : `#${id}`;
  return canAccess(user.role, "users") ? (
    <Link to={`/users?id=${id}`} className="underline-offset-4 hover:underline" onClick={(e) => e.stopPropagation()}>
      {label}
    </Link>
  ) : (
    <span>{label}</span>
  );
}

/** Compact comment list for the report details panel. */
export function CommentList({ comments }: { comments: AdminComment[] }) {
  const { lang } = useI18n();
  return (
    <ul className="space-y-2">
      {comments.map((c) => (
        <li key={c.id} className="rounded-md border p-3 text-sm">
          <div className="mb-1 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
            <span>
              <AuthorLink id={c.userId} name={c.displayName} /> · {formatDateTime(c.createdAt, lang)}
            </span>
            <span className="flex items-center gap-2">
              <HiddenBadge hidden={c.hidden} />
              <CommentVisibilityButton comment={c} />
            </span>
          </div>
          <p className="whitespace-pre-wrap">{c.body}</p>
        </li>
      ))}
    </ul>
  );
}
