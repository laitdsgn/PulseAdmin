import { useMutation, useQueryClient, type InfiniteData } from "@tanstack/react-query";
import {
  Check,
  ClipboardList,
  Eye,
  EyeOff,
  Flag,
  HelpCircle,
  MessageSquare,
  MessageSquareReply,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router";
import { toast } from "sonner";
import { CategoryBadge } from "@/components/badges";
import { useUrlFilters } from "@/components/Filters";
import { ReportPhoto } from "@/components/ReportPhoto";
import { EmptyState, ErrorState, LoadingRows, PageHeader } from "@/components/states";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useI18n } from "@/i18n";
import { apiFetch, ApiError } from "@/lib/api";
import { FLAG_REASONS } from "@/lib/enums";
import { toastError } from "@/lib/errors";
import { formatDateTime, shortId } from "@/lib/format";
import { useInfiniteList, useInvalidate } from "@/lib/queries";
import type { FlagAction, FlagGroup, FlagTarget, Page } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useAdminReport } from "./ReportSheet";

const PATH = "/v1/moderation/flags";
const keyOf = (g: FlagGroup) => `${g.targetType}:${g.targetId}`;

type Act = { group: FlagGroup; action: FlagAction };

export function ModerationPage() {
  const { t, lang } = useI18n();
  const queryClient = useQueryClient();
  const invalidate = useInvalidate();
  const { values, set } = useUrlFilters(["status"] as const);
  const status = values.status === "resolved" ? "resolved" : "open";
  const query = { status };
  const list = useInfiniteList<FlagGroup>(PATH, query);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);

  const items = list.items;
  const index = Math.max(
    0,
    items.findIndex((g) => keyOf(g) === selectedKey),
  );
  const selected = items[index];

  const removeFromList = (group: FlagGroup) =>
    queryClient.setQueryData<InfiniteData<Page<FlagGroup>>>(
      [PATH, query],
      (data) =>
        data && {
          ...data,
          pages: data.pages.map((p) => ({ ...p, data: p.data.filter((g) => keyOf(g) !== keyOf(group)) })),
        },
    );

  const resolve = useMutation({
    // Open flags go through the moderation endpoint (closes the flags); already-resolved items
    // only change visibility through the admin endpoints.
    mutationFn: async ({ group, action }: Act) => {
      if (status === "open") {
        const { data } = await apiFetch<{ data: { resolved: number } }>(`${PATH}/resolve`, {
          method: "POST",
          body: { targetType: group.targetType, targetId: group.targetId, action },
        });
        return data.resolved;
      }
      await apiFetch(`/v1/admin/${group.targetType}s/${group.targetId}/visibility`, {
        method: "POST",
        body: { hidden: action === "hide" },
      });
      return 0;
    },
    onSuccess: (resolved, { group, action }) => {
      if (status === "open") {
        // Keep the cursor position: the next item slides into the selected slot.
        const next = items[index + 1] ?? items[index - 1];
        setSelectedKey(next ? keyOf(next) : null);
        removeFromList(group);
        toast.success(t("moderation.done", { count: resolved }));
      } else {
        queryClient.setQueryData<InfiniteData<Page<FlagGroup>>>(
          [PATH, query],
          (data) =>
            data && {
              ...data,
              pages: data.pages.map((p) => ({
                ...p,
                data: p.data.map((g) => (keyOf(g) === keyOf(group) ? { ...g, hidden: action === "hide" } : g)),
              })),
            },
        );
        toast.success(t("common.saved"));
      }
      void invalidate("/v1/admin/dashboard", "/v1/admin/reports", "/v1/admin/comments");
    },
    onError: (err, { group }) => {
      toastError(err, t);
      if (err instanceof ApiError && (err.code === "no_open_flags" || err.status === 404)) removeFromList(group);
    },
  });

  const act = (action: FlagAction) => {
    if (selected && !resolve.isPending) resolve.mutate({ group: selected, action });
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (
        e.metaKey ||
        e.ctrlKey ||
        e.altKey ||
        target.closest("input, textarea, select, [contenteditable], [role=dialog]")
      )
        return;
      const move = (delta: number) => {
        const next = items[Math.min(items.length - 1, Math.max(0, index + delta))];
        if (next) setSelectedKey(keyOf(next));
      };
      if (e.key === "j") move(1);
      else if (e.key === "k") move(-1);
      else if (e.key === "d" && status === "open") act("dismiss");
      else if (e.key === "h") act("hide");
      else if (e.key === "r") act("restore");
      else return;
      e.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  return (
    <>
      <PageHeader title={t("moderation.title")} />
      <Tabs
        value={status}
        onValueChange={(v) => {
          setSelectedKey(null);
          set("status", v === "open" ? "" : v);
        }}
        className="mb-4"
      >
        <TabsList>
          <TabsTrigger value="open">{t("moderation.open")}</TabsTrigger>
          <TabsTrigger value="resolved">{t("moderation.resolved")}</TabsTrigger>
        </TabsList>
      </Tabs>
      <p className="mb-3 text-xs text-muted-foreground">{t("moderation.shortcuts")}</p>

      {list.isLoading ? (
        <LoadingRows />
      ) : list.error && items.length === 0 ? (
        <ErrorState error={list.error} onRetry={() => void list.refetch()} />
      ) : items.length === 0 ? (
        <EmptyState>{status === "open" ? t("moderation.empty") : t("common.empty")}</EmptyState>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
          <div className="space-y-2">
            <ul className="space-y-2" aria-label={t("moderation.title")}>
              {items.map((g) => (
                <li key={keyOf(g)}>
                  <button
                    type="button"
                    onClick={() => setSelectedKey(keyOf(g))}
                    aria-current={selected && keyOf(selected) === keyOf(g)}
                    className={cn(
                      "w-full rounded-lg border p-3 text-left transition-colors hover:bg-accent",
                      selected && keyOf(selected) === keyOf(g) && "border-primary bg-accent",
                    )}
                  >
                    <div className="flex items-center justify-between gap-2 text-sm">
                      <span className="flex items-center gap-1.5 font-medium">
                        <TargetIcon type={g.targetType} />
                        {t(`moderation.${g.targetType}`)}
                      </span>
                      <Badge variant="destructive" className="gap-1">
                        <Flag className="size-3" />
                        {g.flagCount}
                      </Badge>
                    </div>
                    <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                      {previewText(g) ?? t("moderation.noPreview")}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">{formatDateTime(g.lastFlaggedAt, lang)}</p>
                  </button>
                </li>
              ))}
            </ul>
            {list.hasNextPage && (
              <Button
                variant="ghost"
                size="sm"
                className="w-full"
                disabled={list.isFetchingNextPage}
                onClick={() => void list.fetchNextPage()}
              >
                {list.isFetchingNextPage ? t("common.loading") : t("common.loadMore")}
              </Button>
            )}
          </div>

          <div className="lg:sticky lg:top-20 lg:self-start">
            {selected ? (
              <FlagDetail group={selected} status={status} pending={resolve.isPending} onAct={act} />
            ) : (
              <EmptyState>{t("moderation.select")}</EmptyState>
            )}
          </div>
        </div>
      )}
    </>
  );
}

const TARGET_ICONS: Record<FlagTarget, LucideIcon> = {
  report: ClipboardList,
  comment: MessageSquare,
  question: HelpCircle,
  answer: MessageSquareReply,
};

function TargetIcon({ type }: { type: FlagTarget }) {
  const Icon = TARGET_ICONS[type];
  return <Icon className="size-4" />;
}

type Preview = NonNullable<FlagGroup["preview"]>;
type ReportPreview = Extract<Preview, { title: string }>;
type CommentPreview = Extract<Preview, { body: string }>;
type QuestionPreview = Extract<Preview, { lat: number }>;
type AnswerPreview = Extract<Preview, { questionId: number }>;

const isReportPreview = (p: Preview): p is ReportPreview => "title" in p;
const isCommentPreview = (p: Preview): p is CommentPreview => "body" in p;
const isQuestionPreview = (p: Preview): p is QuestionPreview => "lat" in p;
const isAnswerPreview = (p: Preview): p is AnswerPreview => "questionId" in p;

const previewText = (g: FlagGroup) => {
  const p = g.preview;
  if (!p) return null;
  if (isReportPreview(p)) return p.title;
  if (isCommentPreview(p)) return p.body;
  return p.text;
};

function FlagDetail({
  group,
  status,
  pending,
  onAct,
}: {
  group: FlagGroup;
  status: "open" | "resolved";
  pending: boolean;
  onAct: (action: FlagAction) => void;
}) {
  const { t, lang } = useI18n();
  const p = group.preview;
  const reportId = group.targetType === "report" ? group.targetId : p && isCommentPreview(p) ? p.reportId : null;
  const questionId =
    group.targetType === "question" ? Number(group.targetId) : p && isAnswerPreview(p) ? p.questionId : null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center gap-2 text-base">
          {t(`moderation.${group.targetType}`)}
          <span className="font-mono text-xs text-muted-foreground">{shortId(group.targetId)}</span>
          {group.hidden && <Badge variant="destructive">{t("moderation.currentlyHidden")}</Badge>}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {!p ? (
          <p className="text-sm text-muted-foreground">{t("moderation.noPreview")}</p>
        ) : isCommentPreview(p) ? (
          <blockquote className="rounded-md border-l-4 bg-muted/50 p-3 text-sm whitespace-pre-wrap">
            {p.body}
          </blockquote>
        ) : isQuestionPreview(p) ? (
          <blockquote className="rounded-md border-l-4 bg-muted/50 p-3 text-sm whitespace-pre-wrap">
            {p.text}
          </blockquote>
        ) : isAnswerPreview(p) ? (
          <div className="space-y-2">
            {p.answer && <Badge variant="outline">{t(`answer.${p.answer}`)}</Badge>}
            {p.text && (
              <blockquote className="rounded-md border-l-4 bg-muted/50 p-3 text-sm whitespace-pre-wrap">
                {p.text}
              </blockquote>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-medium">{p.title}</span>
              <CategoryBadge category={p.category} />
            </div>
            {p.description && <p className="text-sm whitespace-pre-wrap">{p.description}</p>}
            {p.address && <p className="text-sm text-muted-foreground">{p.address}</p>}
            {group.targetType === "report" && <FlaggedReportPhoto id={group.targetId} />}
          </div>
        )}

        <div>
          <p className="mb-1 text-xs font-medium text-muted-foreground uppercase">{t("moderation.reasons")}</p>
          <div className="flex flex-wrap gap-1.5">
            {FLAG_REASONS.filter((r) => group.reasons[r]).map((r) => (
              <Badge key={r} variant="outline">
                {t(`reason.${r}`)} · {group.reasons[r]}
              </Badge>
            ))}
          </div>
        </div>

        <dl className="grid grid-cols-2 gap-2 text-sm">
          <dt className="text-muted-foreground">{t("moderation.first")}</dt>
          <dd>{formatDateTime(group.firstFlaggedAt, lang)}</dd>
          <dt className="text-muted-foreground">{t("moderation.last")}</dt>
          <dd>{formatDateTime(group.lastFlaggedAt, lang)}</dd>
        </dl>

        {reportId && (
          <Button asChild variant="link" className="h-auto p-0">
            <Link to={`/reports?id=${reportId}`}>{t("moderation.openReport")} →</Link>
          </Button>
        )}
        {questionId !== null && (
          <Button asChild variant="link" className="h-auto p-0">
            <Link to={`/questions?id=${questionId}`}>{t("moderation.openQuestion")} →</Link>
          </Button>
        )}

        <div className="flex flex-wrap gap-2 border-t pt-4">
          {status === "open" && (
            <Button variant="outline" disabled={pending} onClick={() => onAct("dismiss")}>
              <Check className="size-4" />
              {t("moderation.dismiss")} <kbd className="ml-1 text-xs text-muted-foreground">d</kbd>
            </Button>
          )}
          {(status === "open" || !group.hidden) && (
            <Button variant="destructive" disabled={pending} onClick={() => onAct("hide")}>
              <EyeOff className="size-4" />
              {t("moderation.hide")} <kbd className="ml-1 text-xs opacity-70">h</kbd>
            </Button>
          )}
          {(status === "open" || group.hidden) && (
            <Button variant="secondary" disabled={pending} onClick={() => onAct("restore")}>
              <Eye className="size-4" />
              {t("moderation.restore")} <kbd className="ml-1 text-xs text-muted-foreground">r</kbd>
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

/** The flag preview has no photo; load it from the report (hidden ones included). */
function FlaggedReportPhoto({ id }: { id: string }) {
  const { t } = useI18n();
  const { data: report } = useAdminReport(id);
  if (!report?.photoUrl) return null;
  return (
    <ReportPhoto
      photoUrl={report.photoUrl}
      hidden={report.hidden}
      alt={`${t("reports.photo")}: ${report.title}`}
      className="max-h-80 w-full rounded-md border"
    />
  );
}
