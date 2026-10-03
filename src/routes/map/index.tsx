import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { lazy, Suspense, useEffect, useState } from "react";
import { CityPicker, FilterSelect, useUrlFilters } from "@/components/Filters";
import { ErrorState } from "@/components/states";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { useI18n } from "@/i18n";
import { apiFetch, type Query } from "@/lib/api";
import { CATEGORIES_BY_KIND, REPORT_KINDS, REPORT_STATUSES, WHEELCHAIR, type ReportKind } from "@/lib/enums";
import { useCities } from "@/lib/queries";
import type { Page, Report } from "@/lib/types";
import { PlaceSheet } from "../PlaceSheet";
import { ReportSheet } from "../ReportSheet";
import { REPORT_LEGEND, WHEELCHAIR_COLORS } from "./colors";
import type { Bounds, MapPlace } from "./MapCanvas";

// Leaflet is only loaded on screens that show a map.
const MapCanvas = lazy(() => import("./MapCanvas"));

const PAGE_LIMIT = 200;
const MAX_PAGES = 5; // at most 1000 points per layer; beyond that the user is asked to zoom in
const FALLBACK_CENTER = { lat: 50.0614, lng: 19.9366 }; // Kraków, Rynek Główny

/** Every page of a bbox query, up to MAX_PAGES. */
const fetchAll = async <T,>(path: string, query: Query, signal: AbortSignal) => {
  const items: T[] = [];
  let cursor: string | undefined;
  for (let page = 0; page < MAX_PAGES; page++) {
    const res = await apiFetch<Page<T>>(path, { query: { ...query, cursor, limit: PAGE_LIMIT }, signal });
    items.push(...res.data);
    if (!res.nextCursor) return { items, truncated: false };
    cursor = res.nextCursor;
  }
  return { items, truncated: true };
};

// Rounded so tiny pans do not refetch; ~100 m precision is plenty for a viewport query.
const bboxParam = (b: Bounds) => b.map((v) => v.toFixed(3)).join(",");

export function MapPage() {
  const { t, lang } = useI18n();
  const { values, set, setMany } = useUrlFilters([
    "city",
    "kind",
    "category",
    "status",
    "places",
    "id",
    "place",
  ] as const);
  const { data: cities } = useCities();
  const city = values.city || "krakow";
  const cityInfo = cities?.find((c) => c.id === city);
  const center = cityInfo?.center ?? FALLBACK_CENTER;
  const showPlaces = values.places === "1";
  const status = values.status || "active";

  // Debounced viewport: panning fires many moveend events.
  const [viewport, setViewport] = useState<Bounds | null>(null);
  const [pending, setPending] = useState<Bounds | null>(null);
  useEffect(() => {
    if (!pending) return;
    const id = setTimeout(() => setViewport(pending), 300);
    return () => clearTimeout(id);
  }, [pending]);
  const bbox = viewport ? bboxParam(viewport) : null;

  const reportFilters = { kind: values.kind, category: values.category, status };
  const reports = useQuery({
    queryKey: ["/v1/reports", bbox, reportFilters],
    enabled: !!bbox,
    placeholderData: keepPreviousData,
    queryFn: ({ signal }) => fetchAll<Report>("/v1/reports", { bbox, ...reportFilters }, signal),
  });
  const places = useQuery({
    queryKey: ["/v1/places", bbox],
    enabled: !!bbox && showPlaces,
    placeholderData: keepPreviousData,
    queryFn: ({ signal }) => fetchAll<MapPlace>("/v1/places", { bbox }, signal),
  });

  const kind = values.kind as ReportKind | "";
  const categoryOptions = (kind ? [kind] : REPORT_KINDS).flatMap((k) =>
    CATEGORIES_BY_KIND[k].map((c) => ({ value: c, label: t(`category.${c}`) })),
  );
  const reportItems = reports.data?.items ?? [];
  const placeItems = showPlaces ? (places.data?.items ?? []) : [];
  const truncated = reports.data?.truncated || (showPlaces && places.data?.truncated);
  const loading = reports.isFetching || (showPlaces && places.isFetching);

  return (
    // Fill the viewport below the top bar (h-14).
    <div className="flex h-[calc(100dvh-3.5rem)] flex-col">
      <div className="flex flex-wrap items-center gap-2 border-b p-3">
        <h1 className="mr-2 text-lg font-semibold">{t("map.title")}</h1>
        <CityPicker value={city} onChange={(v) => set("city", v)} allowAll={false} />
        <FilterSelect
          label={t("map.kind")}
          value={values.kind}
          onChange={(v) => setMany({ kind: v, category: null })}
          options={REPORT_KINDS.map((k) => ({ value: k, label: t(`kind.${k}`) }))}
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
        <FilterSelect
          label={t("reports.status")}
          value={status}
          onChange={(v) => set("status", v === "active" ? null : v)}
          options={REPORT_STATUSES.map((s) => ({ value: s, label: t(`status.${s}`) }))}
          className="w-40"
        />
        <label className="flex items-center gap-2 text-sm">
          <Switch checked={showPlaces} onCheckedChange={(on) => set("places", on ? "1" : null)} />
          {t("map.showPlaces")}
        </label>
        <span className="ml-auto flex items-center gap-2 text-xs text-muted-foreground" aria-live="polite">
          {loading && <Loader2 className="size-3.5 animate-spin" />}
          {t("map.count", {
            reports: new Intl.NumberFormat(lang).format(reportItems.length),
            places: new Intl.NumberFormat(lang).format(placeItems.length),
          })}
        </span>
      </div>

      <div className="relative min-h-0 flex-1">
        {reports.error ? (
          <div className="p-4">
            <ErrorState error={reports.error} onRetry={() => void reports.refetch()} />
          </div>
        ) : (
          <Suspense fallback={<Skeleton className="h-full w-full rounded-none" />}>
            <MapCanvas
              center={center}
              reports={reportItems}
              places={placeItems}
              selectedId={values.id || null}
              onBounds={setPending}
              onReport={(id) => setMany({ id, place: null })}
              onPlace={(id) => setMany({ place: id, id: null })}
            />
          </Suspense>
        )}

        {truncated && (
          <div className="absolute top-3 left-1/2 z-[400] -translate-x-1/2 rounded-md bg-amber-100 px-3 py-1.5 text-xs text-amber-900 shadow dark:bg-amber-950 dark:text-amber-100">
            {t("map.truncated", { max: PAGE_LIMIT * MAX_PAGES })}
          </div>
        )}

        <div className="absolute bottom-6 left-3 z-[400] max-w-60 space-y-1.5 rounded-md border bg-background/95 p-3 text-xs shadow">
          <p className="font-medium">{t("map.legend")}</p>
          <ul className="grid grid-cols-2 gap-x-3 gap-y-1">
            {REPORT_LEGEND.map((l) => (
              <li key={l.key} className="flex items-center gap-1.5">
                <span className="size-2.5 shrink-0 rounded-full" style={{ background: l.color }} />
                {t(l.key)}
              </li>
            ))}
          </ul>
          {showPlaces && (
            <>
              <p className="pt-1 font-medium">{t("map.placesLegend")}</p>
              <ul className="grid grid-cols-2 gap-x-3 gap-y-1">
                {WHEELCHAIR.map((w) => (
                  <li key={w} className="flex items-center gap-1.5">
                    <span className="size-2.5 shrink-0 rounded-[2px]" style={{ background: WHEELCHAIR_COLORS[w] }} />
                    {t(`wheelchair.${w}`)}
                  </li>
                ))}
              </ul>
            </>
          )}
          <p className="pt-1 text-muted-foreground">{t("map.hiddenNote")}</p>
        </div>
      </div>

      <ReportSheet id={values.id || null} onClose={() => set("id", null)} />
      <PlaceSheet id={values.place || null} onClose={() => set("place", null)} />
    </div>
  );
}
