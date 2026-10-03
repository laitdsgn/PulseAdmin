import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router";
import { CategoryBadge, StatusBadge } from "@/components/badges";
import { CityPicker, FilterSelect, useUrlFilters } from "@/components/Filters";
import { MapPreview } from "@/components/map";
import { EmptyState, ErrorState, LoadingRows, PageHeader } from "@/components/states";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useI18n } from "@/i18n";
import { apiFetch } from "@/lib/api";
import { formatDateTime, formatNumber } from "@/lib/format";
import type { AdminReport, Page, SignalSpot } from "@/lib/types";

const HOURS = ["1", "6", "24"] as const;
/** A spot reaches a suspicion at 3 devices: colour by how close it is. */
const spotColor = (devices: number) => (devices >= 3 ? "#7c3aed" : devices === 2 ? "#f59e0b" : "#94a3b8");

export function DetectionPage() {
  const { t, lang } = useI18n();
  const { values, set } = useUrlFilters(["city", "hours"] as const);
  const hours = values.hours || "24";
  const spots = useQuery({
    queryKey: ["/v1/admin/signals", values.city, hours],
    queryFn: () =>
      apiFetch<{ data: SignalSpot[] }>("/v1/admin/signals", { query: { city: values.city, hours } }).then(
        (r) => r.data,
      ),
  });
  const pending = useQuery({
    queryKey: ["/v1/admin/reports", { status: "unverified", source: "detection", city: values.city }],
    queryFn: () =>
      apiFetch<Page<AdminReport>>("/v1/admin/reports", {
        query: { status: "unverified", source: "detection", city: values.city, visibility: "visible", limit: 20 },
      }).then((r) => r.data),
  });

  return (
    <>
      <PageHeader
        title={t("detection.title")}
        actions={
          <div className="flex flex-wrap gap-2">
            <FilterSelect
              label={t("detection.hours")}
              value={hours}
              onChange={(v) => set("hours", v || null)}
              options={HOURS.map((h) => ({ value: h, label: t("detection.lastHours", { hours: h }) }))}
              allLabel={t("detection.lastHours", { hours: 24 })}
              className="w-44"
            />
            <CityPicker value={values.city} onChange={(v) => set("city", v)} />
          </div>
        }
      />
      <p className="mb-4 max-w-3xl text-sm text-muted-foreground">{t("detection.hint")}</p>
      <div className="grid gap-4 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("detection.spots")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {spots.isLoading ? (
              <LoadingRows rows={3} />
            ) : spots.error ? (
              <ErrorState error={spots.error} onRetry={() => void spots.refetch()} />
            ) : !spots.data?.length ? (
              <EmptyState>{t("detection.noSpots")}</EmptyState>
            ) : (
              <>
                <MapPreview
                  height={320}
                  zoom={13}
                  points={spots.data.map((s) => ({
                    lat: s.lat,
                    lng: s.lng,
                    color: spotColor(s.devices),
                    radius: 6 + Math.min(10, s.signals),
                    label: `${t(`category.${s.category}`)} · ${t("detection.devices")}: ${s.devices}`,
                  }))}
                />
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("reports.category")}</TableHead>
                      <TableHead className="text-right">{t("detection.signals")}</TableHead>
                      <TableHead className="text-right">{t("detection.devices")}</TableHead>
                      <TableHead className="hidden md:table-cell">{t("detection.last")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {spots.data.slice(0, 50).map((s) => (
                      <TableRow key={`${s.lat},${s.lng},${s.category}`}>
                        <TableCell>
                          <CategoryBadge category={s.category} />
                        </TableCell>
                        <TableCell className="text-right tabular-nums">{formatNumber(s.signals, lang)}</TableCell>
                        <TableCell className="text-right tabular-nums">{formatNumber(s.devices, lang)}</TableCell>
                        <TableCell className="hidden whitespace-nowrap text-muted-foreground md:table-cell">
                          {formatDateTime(s.lastAt, lang)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">{t("detection.pending")}</CardTitle>
            <Link
              to="/reports?status=unverified"
              className="text-xs font-medium text-primary underline-offset-4 hover:underline"
            >
              {t("detection.allPending")} →
            </Link>
          </CardHeader>
          <CardContent>
            {pending.isLoading ? (
              <LoadingRows rows={3} />
            ) : pending.error ? (
              <ErrorState error={pending.error} onRetry={() => void pending.refetch()} />
            ) : !pending.data?.length ? (
              <p className="text-sm text-muted-foreground">{t("detection.noPending")}</p>
            ) : (
              <ul className="space-y-2">
                {pending.data.map((r) => (
                  <li key={r.id} className="rounded-md border p-3 text-sm">
                    <Link
                      to={`/reports?id=${r.id}`}
                      className="flex flex-wrap items-center gap-2 underline-offset-4 hover:underline"
                    >
                      <CategoryBadge category={r.category} />
                      <StatusBadge status={r.status} />
                    </Link>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {formatDateTime(r.createdAt, lang)} · {t("reports.confirmations")}: {r.confirmations}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
