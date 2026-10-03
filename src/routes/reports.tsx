import { CategoryBadge, HiddenBadge, SeverityBadge, StatusBadge } from "@/components/badges";
import { AuthorLink } from "@/components/CommentList";
import { DataTable, listProps, type Column } from "@/components/DataTable";
import { CityPicker, FilterBar, FilterSelect, SearchInput, useCityName, useUrlFilters } from "@/components/Filters";
import { ReportPhoto } from "@/components/ReportPhoto";
import { PageHeader } from "@/components/states";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useI18n } from "@/i18n";
import { CATEGORIES_BY_KIND, REPORT_KINDS, REPORT_SOURCES, REPORT_STATUSES, VISIBILITIES } from "@/lib/enums";
import { formatDateTime } from "@/lib/format";
import { useInfiniteList } from "@/lib/queries";
import type { AdminReport } from "@/lib/types";
import { ReportSheet } from "./ReportSheet";

const FILTERS = ["q", "status", "source", "category", "city", "authorId", "visibility", "hasPhoto", "id"] as const;

export function ReportsPage() {
  const { t, lang } = useI18n();
  const { values, set } = useUrlFilters(FILTERS);
  const cityName = useCityName();
  const { id, ...query } = values;
  const list = useInfiniteList<AdminReport>("/v1/admin/reports", query);

  const categoryOptions = REPORT_KINDS.flatMap((kind) =>
    CATEGORIES_BY_KIND[kind].map((c) => ({ value: c, label: `${t(`kind.${kind}`)} · ${t(`category.${c}`)}` })),
  );

  const columns: Column<AdminReport>[] = [
    {
      header: <span className="sr-only">{t("reports.photo")}</span>,
      cell: (r) =>
        r.photoUrl ? (
          <ReportPhoto photoUrl={r.photoUrl} hidden={r.hidden} alt={r.title} className="size-10 rounded" />
        ) : (
          <div className="size-10 rounded bg-muted/50" aria-hidden />
        ),
      className: "w-12 pr-0",
    },
    {
      header: t("reports.report"),
      cell: (r) => (
        <div className="flex max-w-80 flex-col gap-1">
          <span className="truncate font-medium">{r.title}</span>
          <span className="truncate text-xs text-muted-foreground">
            {r.line
              ? `${t("reports.line")} ${r.line}${r.delayMinutes !== null ? ` · +${r.delayMinutes} min` : ""} · `
              : ""}
            {r.address ?? r.description ?? "—"}
          </span>
        </div>
      ),
    },
    { header: t("reports.category"), cell: (r) => <CategoryBadge category={r.category} /> },
    {
      header: t("reports.severity"),
      cell: (r) => <SeverityBadge severity={r.severity} />,
      className: "hidden lg:table-cell",
    },
    {
      header: t("reports.status"),
      cell: (r) => (
        <div className="flex flex-wrap gap-1">
          <StatusBadge status={r.status} />
          <HiddenBadge hidden={r.hidden} />
        </div>
      ),
    },
    { header: t("common.city"), cell: (r) => cityName(r.cityId), className: "hidden xl:table-cell" },
    { header: t("reports.author"), cell: (r) => <AuthorLink id={r.authorId} />, className: "hidden xl:table-cell" },
    {
      header: t("reports.flags"),
      cell: (r) =>
        r.openFlags > 0 ? (
          <Badge variant="destructive">{r.openFlags}</Badge>
        ) : (
          <span className="text-muted-foreground">0</span>
        ),
      className: "text-center",
    },
    {
      header: t("common.createdAt"),
      cell: (r) => <span className="whitespace-nowrap text-muted-foreground">{formatDateTime(r.createdAt, lang)}</span>,
      className: "hidden md:table-cell",
    },
  ];

  return (
    <>
      <PageHeader title={t("reports.title")} />
      <FilterBar>
        <SearchInput value={values.q} onChange={(v) => set("q", v)} placeholder={t("reports.search")} />
        <FilterSelect
          label={t("reports.status")}
          value={values.status}
          onChange={(v) => set("status", v)}
          options={REPORT_STATUSES.map((s) => ({ value: s, label: t(`status.${s}`) }))}
          allLabel={t("common.all")}
          className="w-40"
        />
        <FilterSelect
          label={t("reports.source")}
          value={values.source}
          onChange={(v) => set("source", v)}
          options={REPORT_SOURCES.map((s) => ({ value: s, label: t(`source.${s}`) }))}
          allLabel={t("common.all")}
          className="w-44"
        />
        <FilterSelect
          label={t("reports.category")}
          value={values.category}
          onChange={(v) => set("category", v)}
          options={categoryOptions}
          allLabel={t("common.all")}
          className="w-56"
        />
        <CityPicker value={values.city} onChange={(v) => set("city", v)} />
        <FilterSelect
          label={t("reports.visibility")}
          value={values.visibility}
          onChange={(v) => set("visibility", v)}
          options={VISIBILITIES.filter((v) => v !== "any").map((v) => ({ value: v, label: t(`visibility.${v}`) }))}
          allLabel={t("visibility.any")}
          className="w-40"
        />
        <FilterSelect
          label={t("reports.photo")}
          value={values.hasPhoto}
          onChange={(v) => set("hasPhoto", v)}
          options={[
            { value: "true", label: t("reports.withPhoto") },
            { value: "false", label: t("reports.withoutPhoto") },
          ]}
          allLabel={t("common.any")}
          className="w-44"
        />
        <Input
          inputMode="numeric"
          className="w-32"
          placeholder={t("reports.author")}
          aria-label={t("reports.author")}
          value={values.authorId}
          onChange={(e) => set("authorId", e.target.value.replace(/\D/g, ""))}
        />
      </FilterBar>
      <DataTable
        columns={columns}
        rowKey={(r) => r.id}
        onRowClick={(r) => set("id", r.id)}
        selectedKey={id || null}
        {...listProps(list)}
      />
      <ReportSheet id={id || null} onClose={() => set("id", null)} />
    </>
  );
}
