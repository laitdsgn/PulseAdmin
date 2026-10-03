import { Link } from "react-router";
import { HiddenBadge } from "@/components/badges";
import { AuthorLink, CommentVisibilityButton } from "@/components/CommentList";
import { DataTable, listProps, type Column } from "@/components/DataTable";
import { FilterBar, FilterSelect, useUrlFilters } from "@/components/Filters";
import { PageHeader } from "@/components/states";
import { Input } from "@/components/ui/input";
import { useI18n } from "@/i18n";
import { VISIBILITIES } from "@/lib/enums";
import { formatDateTime, shortId } from "@/lib/format";
import { useInfiniteList } from "@/lib/queries";
import type { AdminComment } from "@/lib/types";

export function CommentsPage() {
  const { t, lang } = useI18n();
  const { values, set } = useUrlFilters(["reportId", "userId", "visibility"] as const);
  const list = useInfiniteList<AdminComment>("/v1/admin/comments", values);

  const columns: Column<AdminComment>[] = [
    {
      header: t("comments.body"),
      cell: (c) => <p className="line-clamp-3 max-w-xl text-sm whitespace-pre-wrap">{c.body}</p>,
    },
    { header: t("comments.author"), cell: (c) => <AuthorLink id={c.userId} name={c.displayName} /> },
    {
      header: t("comments.reportId"),
      cell: (c) => (
        <Link to={`/reports?id=${c.reportId}`} className="font-mono text-xs underline-offset-4 hover:underline">
          {shortId(c.reportId)}
        </Link>
      ),
      className: "hidden md:table-cell",
    },
    {
      header: t("common.createdAt"),
      cell: (c) => <span className="whitespace-nowrap text-muted-foreground">{formatDateTime(c.createdAt, lang)}</span>,
      className: "hidden md:table-cell",
    },
    {
      header: "",
      cell: (c) => (
        <div className="flex items-center justify-end gap-2">
          <HiddenBadge hidden={c.hidden} />
          <CommentVisibilityButton comment={c} />
        </div>
      ),
    },
  ];

  return (
    <>
      <PageHeader title={t("comments.title")} />
      <FilterBar>
        <Input
          className="w-72"
          placeholder={t("comments.reportId")}
          aria-label={t("comments.reportId")}
          value={values.reportId}
          onChange={(e) => set("reportId", e.target.value.trim())}
        />
        <Input
          inputMode="numeric"
          className="w-36"
          placeholder={t("comments.userId")}
          aria-label={t("comments.userId")}
          value={values.userId}
          onChange={(e) => set("userId", e.target.value.replace(/\D/g, ""))}
        />
        <FilterSelect
          label={t("reports.visibility")}
          value={values.visibility}
          onChange={(v) => set("visibility", v)}
          options={VISIBILITIES.filter((v) => v !== "any").map((v) => ({ value: v, label: t(`visibility.${v}`) }))}
          allLabel={t("visibility.any")}
          className="w-40"
        />
      </FilterBar>
      <DataTable columns={columns} rowKey={(c) => c.id} {...listProps(list)} />
    </>
  );
}
