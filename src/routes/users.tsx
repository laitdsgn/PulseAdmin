import { Badge } from "@/components/ui/badge";
import { RoleBadge } from "@/components/badges";
import { DataTable, listProps, type Column } from "@/components/DataTable";
import { FilterBar, FilterSelect, SearchInput, useCityName, useUrlFilters } from "@/components/Filters";
import { PageHeader } from "@/components/states";
import { useI18n } from "@/i18n";
import { ROLES } from "@/lib/enums";
import { formatDateTime } from "@/lib/format";
import { useInfiniteList } from "@/lib/queries";
import type { AdminUser } from "@/lib/types";
import { CreateUserDialog } from "./CreateUserDialog";
import { UserSheet } from "./UserSheet";

export function UsersPage() {
  const { t, lang } = useI18n();
  const { values, set } = useUrlFilters(["q", "role", "status", "id"] as const);
  const cityName = useCityName();
  const { id, ...query } = values;
  const list = useInfiniteList<AdminUser>("/v1/admin/users", query);

  const columns: Column<AdminUser>[] = [
    { header: t("common.id"), cell: (u) => <span className="font-mono text-xs">#{u.id}</span> },
    {
      header: t("users.username"),
      cell: (u) => (
        <div className="flex flex-col">
          <span className="font-medium">{u.username ?? <span className="text-muted-foreground">—</span>}</span>
          <span className="text-xs text-muted-foreground">
            {u.displayName ?? (u.isAnonymous ? t("users.anonymous") : "")}
          </span>
        </div>
      ),
    },
    { header: t("users.role"), cell: (u) => <RoleBadge role={u.role} /> },
    {
      header: t("users.cities"),
      cell: (u) =>
        u.role === "city" ? (u.cities.length ? u.cities.map(cityName).join(", ") : t("common.allCities")) : "—",
      className: "hidden lg:table-cell",
    },
    {
      header: t("users.status"),
      cell: (u) =>
        u.disabled ? (
          <Badge variant="destructive">{t("users.disabled")}</Badge>
        ) : (
          <Badge variant="outline">{t("users.active")}</Badge>
        ),
    },
    {
      header: t("common.createdAt"),
      cell: (u) => <span className="whitespace-nowrap text-muted-foreground">{formatDateTime(u.createdAt, lang)}</span>,
      className: "hidden md:table-cell",
    },
  ];

  return (
    <>
      <PageHeader title={t("users.title")} actions={<CreateUserDialog onCreated={(u) => set("id", String(u.id))} />} />
      <FilterBar>
        <SearchInput value={values.q} onChange={(v) => set("q", v)} placeholder={t("users.search")} />
        <FilterSelect
          label={t("users.role")}
          value={values.role}
          onChange={(v) => set("role", v)}
          options={ROLES.map((r) => ({ value: r, label: t(`role.${r}`) }))}
          allLabel={t("common.all")}
        />
        <FilterSelect
          label={t("users.status")}
          value={values.status}
          onChange={(v) => set("status", v)}
          options={[
            { value: "active", label: t("users.active") },
            { value: "disabled", label: t("users.disabled") },
          ]}
          allLabel={t("common.all")}
        />
      </FilterBar>
      <DataTable
        columns={columns}
        rowKey={(u) => u.id}
        onRowClick={(u) => set("id", String(u.id))}
        selectedKey={id ? Number(id) : null}
        {...listProps(list)}
      />
      <UserSheet id={id ? Number(id) : null} onClose={() => set("id", null)} />
    </>
  );
}
