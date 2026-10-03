import { CheckCircle2 } from "lucide-react";
import { WheelchairBadge } from "@/components/badges";
import { DataTable, listProps, type Column } from "@/components/DataTable";
import { CityPicker, FilterBar, FilterSelect, SearchInput, useCityName, useUrlFilters } from "@/components/Filters";
import { PageHeader } from "@/components/states";
import { useI18n } from "@/i18n";
import { PLACE_TYPES, WHEELCHAIR } from "@/lib/enums";
import { useInfiniteList } from "@/lib/queries";
import type { AdminPlace } from "@/lib/types";
import { PlaceSheet } from "./PlaceSheet";

const FILTERS = ["q", "city", "type", "wheelchair", "verified", "id"] as const;

export function PlacesPage() {
  const { t } = useI18n();
  const { values, set } = useUrlFilters(FILTERS);
  const cityName = useCityName();
  const { id, ...query } = values;
  const list = useInfiniteList<AdminPlace>("/v1/admin/places", query);

  const columns: Column<AdminPlace>[] = [
    {
      header: t("places.name"),
      cell: (p) => (
        <div className="flex max-w-80 flex-col gap-0.5">
          <span className="truncate font-medium">{p.name}</span>
          <span className="truncate text-xs text-muted-foreground">{p.address ?? "—"}</span>
        </div>
      ),
    },
    { header: t("places.type"), cell: (p) => t(`placeType.${p.type}`) },
    { header: t("common.city"), cell: (p) => cityName(p.cityId), className: "hidden lg:table-cell" },
    { header: t("places.wheelchair"), cell: (p) => <WheelchairBadge value={p.wheelchair} /> },
    {
      header: t("places.verified"),
      cell: (p) =>
        p.verified ? (
          <CheckCircle2 className="size-4 text-emerald-600" aria-label={t("common.yes")} />
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
      className: "text-center",
    },
  ];

  return (
    <>
      <PageHeader title={t("places.title")} />
      <FilterBar>
        <SearchInput value={values.q} onChange={(v) => set("q", v)} placeholder={t("places.search")} />
        <CityPicker value={values.city} onChange={(v) => set("city", v)} />
        <FilterSelect
          label={t("places.type")}
          value={values.type}
          onChange={(v) => set("type", v)}
          options={PLACE_TYPES.map((p) => ({ value: p, label: t(`placeType.${p}`) }))}
          allLabel={t("common.all")}
        />
        <FilterSelect
          label={t("places.wheelchair")}
          value={values.wheelchair}
          onChange={(v) => set("wheelchair", v)}
          options={WHEELCHAIR.map((w) => ({ value: w, label: t(`wheelchair.${w}`) }))}
          allLabel={t("common.any")}
        />
        <FilterSelect
          label={t("places.verified")}
          value={values.verified}
          onChange={(v) => set("verified", v)}
          options={[
            { value: "true", label: t("common.yes") },
            { value: "false", label: t("common.no") },
          ]}
          allLabel={t("common.any")}
          className="w-40"
        />
      </FilterBar>
      <DataTable
        columns={columns}
        rowKey={(p) => p.id}
        onRowClick={(p) => set("id", p.id)}
        selectedKey={id || null}
        {...listProps(list)}
      />
      <PlaceSheet id={id || null} onClose={() => set("id", null)} />
    </>
  );
}
