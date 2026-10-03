import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Eye, EyeOff, ExternalLink } from "lucide-react";
import { useEffect } from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { CategoryBadge, HiddenBadge, SeverityBadge, StatusBadge } from "@/components/badges";
import { AuthorLink, CommentList } from "@/components/CommentList";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { useCityName } from "@/components/Filters";
import { MapPreview } from "@/components/map";
import { ReportPhoto } from "@/components/ReportPhoto";
import { ErrorState, LoadingRows } from "@/components/states";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { useI18n } from "@/i18n";
import { apiFetch, ApiError } from "@/lib/api";
import { CATEGORIES, CATEGORIES_BY_KIND, PROFILES, SEVERITIES } from "@/lib/enums";
import { applyFieldErrors, toastError } from "@/lib/errors";
import { formatDateTime, formatNumber, formatPercent, osmLink } from "@/lib/format";
import { useInfiniteList, useInvalidate } from "@/lib/queries";
import type { AdminComment, AdminReport, Page } from "@/lib/types";
import { ReportQuestions } from "./questions";

/** Loads one report (hidden ones too) through the admin list's exact-id search. */
export const useAdminReport = (id: string | null) =>
  useQuery({
    queryKey: ["/v1/admin/reports", { id }],
    enabled: !!id,
    queryFn: async () => {
      const { data } = await apiFetch<Page<AdminReport>>("/v1/admin/reports", { query: { q: id, limit: 1 } });
      return data.find((r) => r.id === id) ?? null;
    },
  });

export function ReportSheet({ id, onClose }: { id: string | null; onClose: () => void }) {
  const { t } = useI18n();
  const report = useAdminReport(id);
  return (
    <Sheet open={!!id} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
        {report.isLoading ? (
          <div className="p-4">
            <SheetTitle className="sr-only">{t("common.loading")}</SheetTitle>
            <LoadingRows />
          </div>
        ) : report.error || !report.data ? (
          <div className="p-4">
            <SheetTitle className="sr-only">{t("common.error")}</SheetTitle>
            <ErrorState
              error={report.error ?? new ApiError(404, "Not found", "not_found")}
              onRetry={() => void report.refetch()}
            />
          </div>
        ) : (
          <ReportDetails report={report.data} />
        )}
      </SheetContent>
    </Sheet>
  );
}

function ReportDetails({ report: r }: { report: AdminReport }) {
  const { t, lang } = useI18n();
  const invalidate = useInvalidate();
  const cityName = useCityName();
  const comments = useInfiniteList<AdminComment>("/v1/admin/comments", { reportId: r.id });

  const visibility = useMutation({
    mutationFn: (hidden: boolean) =>
      apiFetch(`/v1/admin/reports/${r.id}/visibility`, { method: "POST", body: { hidden } }),
    onSuccess: () => {
      toast.success(t("common.saved"));
      void invalidate("/v1/admin/reports", "/v1/admin/dashboard", "/v1/moderation/flags");
    },
    onError: (err) => toastError(err, t),
  });

  const rows: [string, React.ReactNode][] = [
    [t("reports.severity"), <SeverityBadge severity={r.severity} />],
    [t("common.city"), cityName(r.cityId)],
    [t("reports.address"), r.address ?? "—"],
    [t("reports.affects"), r.affects.length ? r.affects.map((p) => t(`profile.${p}`)).join(", ") : "—"],
    [t("reports.author"), <AuthorLink id={r.authorId} />],
    [t("reports.confirmations"), formatNumber(r.confirmations, lang)],
    [t("reports.resolvedVotes"), formatNumber(r.resolvedVotes, lang)],
    [t("reports.flags"), formatNumber(r.openFlags, lang)],
    [
      t("reports.source"),
      `${t(`source.${r.source}`)}${r.aiConfidence !== null ? ` · ${t("reports.aiConfidence")} ${formatPercent(r.aiConfidence, lang)}` : ""}`,
    ],
    ...(r.line !== null || r.delayMinutes !== null
      ? ([
          [t("reports.line"), r.line ?? "—"],
          [t("reports.delay"), r.delayMinutes !== null ? t("reports.delayMinutes", { count: r.delayMinutes }) : "—"],
        ] as [string, React.ReactNode][])
      : []),
    [t("common.createdAt"), formatDateTime(r.createdAt, lang)],
    [t("common.updatedAt"), formatDateTime(r.updatedAt, lang)],
    [t("reports.lastConfirmed"), formatDateTime(r.lastConfirmedAt, lang)],
    [t("reports.expires"), formatDateTime(r.expiresAt, lang)],
  ];

  return (
    <>
      <SheetHeader>
        <SheetTitle className="pr-6">{r.title}</SheetTitle>
        <SheetDescription asChild>
          <div className="flex flex-wrap items-center gap-1.5">
            <CategoryBadge category={r.category} />
            <StatusBadge status={r.status} />
            <HiddenBadge hidden={r.hidden} />
            <span className="font-mono text-xs">{r.id}</span>
          </div>
        </SheetDescription>
      </SheetHeader>

      <div className="space-y-5 px-4 pb-6">
        <div className="flex flex-wrap gap-2">
          {r.hidden ? (
            <Button variant="secondary" disabled={visibility.isPending} onClick={() => visibility.mutate(false)}>
              <Eye className="size-4" />
              {t("common.restore")}
            </Button>
          ) : (
            <ConfirmDialog
              trigger={
                <Button variant="destructive" disabled={visibility.isPending}>
                  <EyeOff className="size-4" />
                  {t("common.hide")}
                </Button>
              }
              title={t("common.hide")}
              description={t("reports.hideConfirm")}
              destructive
              onConfirm={() => visibility.mutate(true)}
            />
          )}
          <Button asChild variant="outline">
            <a href={osmLink(r.lat, r.lng)} target="_blank" rel="noreferrer">
              <ExternalLink className="size-4" />
              {t("common.openInMap")}
            </a>
          </Button>
        </div>

        <ReportPhoto
          photoUrl={r.photoUrl}
          hidden={r.hidden}
          alt={`${t("reports.photo")}: ${r.title}`}
          className="max-h-72 w-full rounded-md border"
        />

        {r.source === "detection" && r.status === "unverified" && (
          <p className="rounded-md border border-violet-300 bg-violet-50 p-3 text-sm text-violet-900 dark:border-violet-800 dark:bg-violet-950 dark:text-violet-200">
            {t("reports.detectionInfo")}
          </p>
        )}

        {r.description && <p className="text-sm whitespace-pre-wrap">{r.description}</p>}

        <MapPreview points={[{ lat: r.lat, lng: r.lng, label: r.title }]} />

        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
          {rows.map(([label, value]) => (
            <div key={label} className="contents">
              <dt className="text-muted-foreground">{label}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>

        {r.source === "detection" && (
          <section className="space-y-3 border-t pt-4">
            <h3 className="font-medium">{t("reports.questions")}</h3>
            <ReportQuestions reportId={r.id} />
          </section>
        )}

        <section className="space-y-3 border-t pt-4">
          <h3 className="font-medium">{t("reports.editTitle")}</h3>
          {r.hidden ? (
            <p className="text-sm text-muted-foreground">{t("reports.hiddenEditHint")}</p>
          ) : (
            <ReportEditForm report={r} />
          )}
        </section>

        <section className="space-y-3 border-t pt-4">
          <h3 className="font-medium">{t("reports.comments")}</h3>
          {comments.isLoading ? (
            <LoadingRows rows={2} />
          ) : comments.items.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("reports.noComments")}</p>
          ) : (
            <CommentList comments={comments.items} />
          )}
          {comments.hasNextPage && (
            <Button variant="ghost" size="sm" onClick={() => void comments.fetchNextPage()}>
              {t("common.loadMore")}
            </Button>
          )}
        </section>
      </div>
    </>
  );
}

const editSchema = z.object({
  category: z.enum(CATEGORIES),
  severity: z.enum(SEVERITIES),
  description: z.string().max(1000),
  address: z.string().max(200),
  affects: z.array(z.enum(PROFILES)),
});
type EditValues = z.infer<typeof editSchema>;

function ReportEditForm({ report: r }: { report: AdminReport }) {
  const { t } = useI18n();
  const invalidate = useInvalidate();
  const defaults: EditValues = {
    category: r.category,
    severity: r.severity,
    description: r.description ?? "",
    address: r.address ?? "",
    affects: r.affects,
  };
  const form = useForm<EditValues>({ resolver: zodResolver(editSchema), defaultValues: defaults });
  useEffect(() => form.reset(defaults), [r.updatedAt]); // eslint-disable-line react-hooks/exhaustive-deps

  const save = useMutation({
    mutationFn: (body: Partial<EditValues>) => apiFetch(`/v1/reports/${r.id}`, { method: "PATCH", body }),
    onSuccess: () => {
      toast.success(t("common.saved"));
      void invalidate("/v1/admin/reports");
    },
    onError: (err) => {
      if (!applyFieldErrors(err, form.setError, Object.keys(defaults))) toastError(err, t);
    },
  });

  const onSubmit = form.handleSubmit((values) => {
    const dirty = form.formState.dirtyFields;
    const body: Partial<EditValues> = {};
    if (dirty.category) body.category = values.category;
    if (dirty.severity) body.severity = values.severity;
    if (dirty.description) body.description = values.description;
    if (dirty.address) body.address = values.address;
    if (dirty.affects) body.affects = values.affects;
    if (Object.keys(body).length === 0) return toast.info(t("places.noChanges"));
    save.mutate(body);
  });

  const description = form.watch("description");
  const { errors } = form.formState;

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label>{t("reports.category")}</Label>
          <Controller
            control={form.control}
            name="category"
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {/* The backend only accepts a category of the same kind. */}
                  {CATEGORIES_BY_KIND[r.kind].map((c) => (
                    <SelectItem key={c} value={c}>
                      {t(`category.${c}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </div>
        <div className="space-y-1.5">
          <Label>{t("reports.severity")}</Label>
          <Controller
            control={form.control}
            name="severity"
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SEVERITIES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {t(`severity.${s}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="report-description">{t("reports.description")}</Label>
        <Textarea
          id="report-description"
          rows={4}
          aria-invalid={!!errors.description}
          {...form.register("description")}
        />
        <p className={errors.description ? "text-xs text-destructive" : "text-xs text-muted-foreground"}>
          {errors.description?.message ?? t("common.chars", { count: description.length, max: 1000 })}
        </p>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="report-address">{t("reports.address")}</Label>
        <Input id="report-address" aria-invalid={!!errors.address} {...form.register("address")} />
        {errors.address && <p className="text-xs text-destructive">{errors.address.message}</p>}
      </div>
      <fieldset className="space-y-1.5">
        <legend className="text-sm font-medium">{t("reports.affects")}</legend>
        <Controller
          control={form.control}
          name="affects"
          render={({ field }) => (
            <div className="flex flex-wrap gap-x-4 gap-y-2">
              {PROFILES.map((p) => (
                <label key={p} className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={field.value.includes(p)}
                    onCheckedChange={(checked) =>
                      field.onChange(checked ? [...field.value, p] : field.value.filter((v) => v !== p))
                    }
                  />
                  {t(`profile.${p}`)}
                </label>
              ))}
            </div>
          )}
        />
      </fieldset>
      <Button type="submit" disabled={save.isPending || !form.formState.isDirty}>
        {save.isPending ? t("common.saving") : t("common.save")}
      </Button>
    </form>
  );
}
