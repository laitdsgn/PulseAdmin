import { useMutation, useQuery } from "@tanstack/react-query";
import { Eye, EyeOff, Flag } from "lucide-react";
import { Link } from "react-router";
import { toast } from "sonner";
import { HiddenBadge } from "@/components/badges";
import { AuthorLink } from "@/components/CommentList";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { DataTable, listProps, type Column } from "@/components/DataTable";
import { CityPicker, FilterBar, FilterSelect, SearchInput, useCityName, useUrlFilters } from "@/components/Filters";
import { MapPreview } from "@/components/map";
import { ErrorState, LoadingRows, PageHeader } from "@/components/states";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useI18n } from "@/i18n";
import { apiFetch, ApiError } from "@/lib/api";
import { QUESTION_SOURCES, QUESTION_STATUSES, VISIBILITIES } from "@/lib/enums";
import { toastError } from "@/lib/errors";
import { formatDateTime, formatNumber, shortId } from "@/lib/format";
import { useInfiniteList, useInvalidate } from "@/lib/queries";
import type { AdminAnswer, AdminQuestion, Page } from "@/lib/types";

const FILTERS = ["q", "city", "source", "status", "userId", "visibility", "id"] as const;

export function QuestionsPage() {
  const { t, lang } = useI18n();
  const { values, set } = useUrlFilters(FILTERS);
  const cityName = useCityName();
  const { id, ...query } = values;
  const list = useInfiniteList<AdminQuestion>("/v1/admin/questions", query);

  const columns: Column<AdminQuestion>[] = [
    {
      header: t("questions.text"),
      cell: (q) => <p className="line-clamp-2 max-w-xl text-sm">{q.text}</p>,
    },
    { header: t("questions.asker"), cell: (q) => <Asker question={q} />, className: "hidden md:table-cell" },
    { header: t("questions.status"), cell: (q) => <QuestionBadges question={q} /> },
    {
      header: t("questions.answers"),
      cell: (q) => (
        <span className="tabular-nums">
          {formatNumber(q.answers, lang)}
          {q.hiddenAnswers > 0 && (
            <span className="text-xs text-muted-foreground">
              {" "}
              · {t("questions.hiddenAnswers", { count: q.hiddenAnswers })}
            </span>
          )}
        </span>
      ),
      className: "text-center",
    },
    { header: t("common.city"), cell: (q) => cityName(q.cityId), className: "hidden xl:table-cell" },
    {
      header: t("common.createdAt"),
      cell: (q) => <span className="whitespace-nowrap text-muted-foreground">{formatDateTime(q.createdAt, lang)}</span>,
      className: "hidden md:table-cell",
    },
  ];

  return (
    <>
      <PageHeader title={t("questions.title")} />
      <FilterBar>
        <SearchInput value={values.q} onChange={(v) => set("q", v)} placeholder={t("questions.search")} />
        <CityPicker value={values.city} onChange={(v) => set("city", v)} />
        <FilterSelect
          label={t("questions.status")}
          value={values.status}
          onChange={(v) => set("status", v)}
          options={QUESTION_STATUSES.map((s) => ({ value: s, label: t(`questionStatus.${s}`) }))}
          allLabel={t("common.all")}
          className="w-40"
        />
        <FilterSelect
          label={t("questions.source")}
          value={values.source}
          onChange={(v) => set("source", v)}
          options={QUESTION_SOURCES.map((s) => ({ value: s, label: t(`questionSource.${s}`) }))}
          allLabel={t("common.all")}
          className="w-40"
        />
        <FilterSelect
          label={t("reports.visibility")}
          value={values.visibility}
          onChange={(v) => set("visibility", v)}
          options={VISIBILITIES.filter((v) => v !== "any").map((v) => ({ value: v, label: t(`visibility.${v}`) }))}
          allLabel={t("visibility.any")}
          className="w-40"
        />
        <Input
          inputMode="numeric"
          className="w-36"
          placeholder={t("questions.userId")}
          aria-label={t("questions.userId")}
          value={values.userId}
          onChange={(e) => set("userId", e.target.value.replace(/\D/g, ""))}
        />
      </FilterBar>
      <DataTable
        columns={columns}
        rowKey={(q) => q.id}
        onRowClick={(q) => set("id", String(q.id))}
        selectedKey={id ? Number(id) : null}
        {...listProps(list)}
      />
      <QuestionSheet id={id ? Number(id) : null} onClose={() => set("id", null)} />
    </>
  );
}

function Asker({ question: q }: { question: AdminQuestion }) {
  const { t } = useI18n();
  return q.source === "detection" ? (
    <span className="text-muted-foreground">{t("questions.pulse")}</span>
  ) : (
    <AuthorLink id={q.userId} name={q.displayName} />
  );
}

export function QuestionBadges({ question: q }: { question: AdminQuestion }) {
  const { t } = useI18n();
  return (
    <div className="flex flex-wrap gap-1">
      <Badge variant={q.status === "open" ? "default" : "outline"}>{t(`questionStatus.${q.status}`)}</Badge>
      {q.source === "detection" && <Badge variant="secondary">{t("questionSource.detection")}</Badge>}
      {q.openFlags > 0 && (
        <Badge variant="destructive" className="gap-1">
          <Flag className="size-3" />
          {q.openFlags}
        </Badge>
      )}
      <HiddenBadge hidden={q.hidden} />
    </div>
  );
}

/** One question (hidden ones too) through the admin list's exact-id search. */
const useAdminQuestion = (id: number | null) =>
  useQuery({
    queryKey: ["/v1/admin/questions", { id }],
    enabled: id !== null,
    queryFn: async () => {
      const { data } = await apiFetch<Page<AdminQuestion>>("/v1/admin/questions", {
        query: { q: String(id), limit: 20 },
      });
      return data.find((q) => q.id === id) ?? null;
    },
  });

const useVisibility = (kind: "questions" | "answers") => {
  const { t } = useI18n();
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({ id, hidden }: { id: number; hidden: boolean }) =>
      apiFetch(`/v1/admin/${kind}/${id}/visibility`, { method: "POST", body: { hidden } }),
    onSuccess: () => {
      toast.success(t("common.saved"));
      void invalidate("/v1/admin/questions", "/v1/admin/dashboard");
    },
    onError: (err) => toastError(err, t),
  });
};

export function QuestionSheet({ id, onClose }: { id: number | null; onClose: () => void }) {
  const { t } = useI18n();
  const question = useAdminQuestion(id);
  return (
    <Sheet open={id !== null} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
        {question.isLoading ? (
          <div className="p-4">
            <SheetTitle className="sr-only">{t("common.loading")}</SheetTitle>
            <LoadingRows />
          </div>
        ) : question.error || !question.data ? (
          <div className="p-4">
            <SheetTitle className="sr-only">{t("common.error")}</SheetTitle>
            <ErrorState
              error={question.error ?? new ApiError(404, "Not found", "not_found")}
              onRetry={() => void question.refetch()}
            />
          </div>
        ) : (
          <QuestionDetails question={question.data} />
        )}
      </SheetContent>
    </Sheet>
  );
}

function QuestionDetails({ question: q }: { question: AdminQuestion }) {
  const { t, lang } = useI18n();
  const cityName = useCityName();
  const visibility = useVisibility("questions");
  const rows: [string, React.ReactNode][] = [
    [t("questions.asker"), <Asker question={q} />],
    [t("common.city"), cityName(q.cityId)],
    [t("questions.radius"), `${formatNumber(q.radiusM, lang)} m`],
    [t("common.createdAt"), formatDateTime(q.createdAt, lang)],
    [t("questions.expires"), formatDateTime(q.expiresAt, lang)],
  ];
  if (q.placeId) rows.push([t("questions.place"), <span className="font-mono text-xs">{q.placeId}</span>]);
  if (q.reportId)
    rows.push([
      t("questions.report"),
      <Link to={`/reports?id=${q.reportId}`} className="font-mono text-xs underline-offset-4 hover:underline">
        {shortId(q.reportId)}
      </Link>,
    ]);

  return (
    <>
      <SheetHeader>
        <SheetTitle className="pr-6">{q.text}</SheetTitle>
        <SheetDescription asChild>
          <div>
            <QuestionBadges question={q} />
          </div>
        </SheetDescription>
      </SheetHeader>
      <div className="space-y-5 px-4 pb-6">
        <div className="flex flex-wrap gap-2">
          {q.hidden ? (
            <Button
              variant="secondary"
              disabled={visibility.isPending}
              onClick={() => visibility.mutate({ id: q.id, hidden: false })}
            >
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
              description={t("questions.hideConfirm")}
              destructive
              onConfirm={() => visibility.mutate({ id: q.id, hidden: true })}
            />
          )}
        </div>
        <MapPreview points={[{ lat: q.lat, lng: q.lng, label: q.text }]} />
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
          {rows.map(([label, value]) => (
            <div key={label} className="contents">
              <dt className="text-muted-foreground">{label}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
        <section className="space-y-3 border-t pt-4">
          <h3 className="font-medium">{t("questions.answers")}</h3>
          <AnswerList questionId={q.id} />
        </section>
      </div>
    </>
  );
}

function AnswerList({ questionId }: { questionId: number }) {
  const { t, lang } = useI18n();
  const visibility = useVisibility("answers");
  const answers = useQuery({
    queryKey: ["/v1/admin/questions", { answersOf: questionId }],
    queryFn: () => apiFetch<{ data: AdminAnswer[] }>(`/v1/admin/questions/${questionId}/answers`).then((r) => r.data),
  });
  if (answers.isLoading) return <LoadingRows rows={2} />;
  if (answers.error) return <ErrorState error={answers.error} onRetry={() => void answers.refetch()} />;
  if (!answers.data?.length) return <p className="text-sm text-muted-foreground">{t("questions.noAnswers")}</p>;
  return (
    <ul className="space-y-2">
      {answers.data.map((a) => (
        <li key={a.id} className="rounded-md border p-3 text-sm">
          <div className="mb-1 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
            <span className="flex items-center gap-2">
              <Badge variant={a.answer === "yes" ? "default" : "outline"}>
                {a.answer ? t(`answer.${a.answer}`) : t("answer.none")}
              </Badge>
              <AuthorLink id={a.userId} name={a.displayName} /> · {formatDateTime(a.updatedAt, lang)}
            </span>
            <span className="flex items-center gap-2">
              <HiddenBadge hidden={a.hidden} />
              <Button
                size="sm"
                variant={a.hidden ? "secondary" : "outline"}
                disabled={visibility.isPending}
                onClick={() => visibility.mutate({ id: a.id, hidden: !a.hidden })}
              >
                {a.hidden ? <Eye className="size-4" /> : <EyeOff className="size-4" />}
                {a.hidden ? t("common.restore") : t("common.hide")}
              </Button>
            </span>
          </div>
          {a.text && <p className="whitespace-pre-wrap">{a.text}</p>}
        </li>
      ))}
    </ul>
  );
}

/** Questions Pulse asked about a report (detection), for the report panel. */
export function ReportQuestions({ reportId }: { reportId: string }) {
  const { t, lang } = useI18n();
  const questions = useQuery({
    queryKey: ["/v1/admin/questions", { reportId }],
    queryFn: () =>
      apiFetch<Page<AdminQuestion>>("/v1/admin/questions", { query: { q: reportId, limit: 20 } }).then((r) =>
        r.data.filter((q) => q.reportId === reportId),
      ),
  });
  if (questions.isLoading) return <LoadingRows rows={1} />;
  if (!questions.data?.length) return <p className="text-sm text-muted-foreground">{t("reports.noQuestions")}</p>;
  return (
    <ul className="space-y-2">
      {questions.data.map((q) => (
        <li key={q.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-3 text-sm">
          <Link to={`/questions?id=${q.id}`} className="underline-offset-4 hover:underline">
            {q.text}
          </Link>
          <span className="flex items-center gap-2 text-xs text-muted-foreground">
            {t("questions.answers")}: {formatNumber(q.answers, lang)}
            <QuestionBadges question={q} />
          </span>
        </li>
      ))}
    </ul>
  );
}
