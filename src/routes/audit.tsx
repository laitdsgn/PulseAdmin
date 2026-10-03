import { Link } from "react-router";
import { DataTable, listProps, type Column } from "@/components/DataTable";
import { FilterBar, FilterSelect, useUrlFilters } from "@/components/Filters";
import { PageHeader } from "@/components/states";
import { Input } from "@/components/ui/input";
import { isMessageKey, useI18n } from "@/i18n";
import { AUDIT_ACTIONS } from "@/lib/enums";
import { formatDateTime, shortId } from "@/lib/format";
import { useInfiniteList } from "@/lib/queries";
import type { AuditEntry } from "@/lib/types";

const targetLink = (e: AuditEntry) => {
  switch (e.targetType) {
    case "user":
      return `/users?id=${e.targetId}`;
    case "report":
      return `/reports?id=${e.targetId}`;
    case "place":
      return `/places?id=${e.targetId}`;
    case "comment":
      return `/comments`;
  }
};

export function AuditPage() {
  const { t, lang } = useI18n();
  const { values, set } = useUrlFilters(["actorId", "action"] as const);
  const list = useInfiniteList<AuditEntry>("/v1/admin/audit", values);

  const actionLabel = (action: string) => {
    const key = `audit.${action}`;
    return isMessageKey(key) ? t(key) : action;
  };

  const columns: Column<AuditEntry>[] = [
    {
      header: t("common.createdAt"),
      cell: (e) => <span className="whitespace-nowrap text-muted-foreground">{formatDateTime(e.createdAt, lang)}</span>,
    },
    {
      header: t("audit.actor"),
      cell: (e) =>
        e.actorId === null ? (
          <span className="text-muted-foreground">{t("audit.system")}</span>
        ) : (
          <Link to={`/users?id=${e.actorId}`} className="underline-offset-4 hover:underline">
            #{e.actorId}
          </Link>
        ),
    },
    {
      header: t("audit.action"),
      cell: (e) => (
        <span title={e.action} className="font-medium">
          {actionLabel(e.action)}
        </span>
      ),
    },
    {
      header: t("audit.target"),
      cell: (e) => (
        <Link to={targetLink(e)} className="whitespace-nowrap underline-offset-4 hover:underline">
          {t(`target.${e.targetType}`)} <span className="font-mono text-xs">{shortId(e.targetId)}</span>
        </Link>
      ),
    },
    {
      header: t("audit.details"),
      cell: (e) =>
        Object.keys(e.details).length === 0 ? (
          <span className="text-muted-foreground">—</span>
        ) : (
          <details>
            <summary className="cursor-pointer text-xs text-muted-foreground">
              {Object.keys(e.details).join(", ")}
            </summary>
            <pre className="mt-1 max-w-md overflow-x-auto rounded bg-muted p-2 text-xs">
              {JSON.stringify(e.details, null, 2)}
            </pre>
          </details>
        ),
    },
  ];

  return (
    <>
      <PageHeader title={t("audit.title")} />
      <FilterBar>
        <Input
          inputMode="numeric"
          className="w-40"
          placeholder={t("audit.actor")}
          aria-label={t("audit.actor")}
          value={values.actorId}
          onChange={(e) => set("actorId", e.target.value.replace(/\D/g, ""))}
        />
        <FilterSelect
          label={t("audit.action")}
          value={values.action}
          onChange={(v) => set("action", v)}
          options={AUDIT_ACTIONS.map((a) => ({ value: a, label: actionLabel(a) }))}
          allLabel={t("common.all")}
          className="w-64"
        />
      </FilterBar>
      <DataTable columns={columns} rowKey={(e) => e.id} {...listProps(list)} />
    </>
  );
}
