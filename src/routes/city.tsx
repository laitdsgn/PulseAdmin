import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle2, Clock, Download, ShieldAlert, Sparkles } from "lucide-react";
import { useState } from "react";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { CategoryBadge } from "@/components/badges";
import { CityPicker, FilterBar, FilterSelect, useUrlFilters } from "@/components/Filters";
import { MapPreview } from "@/components/map";
import { ErrorState, LoadingRows, PageHeader } from "@/components/states";
import { StatTile } from "@/components/StatTile";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useI18n } from "@/i18n";
import { apiDownload, apiFetch } from "@/lib/api";
import { useUser } from "@/lib/auth";
import { toastError } from "@/lib/errors";
import { formatNumber } from "@/lib/format";
import type { CityStats, Hotspot } from "@/lib/types";
import { CategoryBars } from "./dashboard";

const MONTH_OPTIONS = ["3", "6", "12", "24"];

export function CityPage() {
  const { t, lang } = useI18n();
  const user = useUser();
  const { values, set } = useUrlFilters(["city", "from", "to", "months", "minBarriers"] as const);
  // A city account is limited to its cities; empty list = all, like every other role.
  const scoped = user.role === "city" ? user.cities : [];
  const city = values.city || scoped[0] || "krakow";
  const months = values.months || "6";
  const minBarriers = values.minBarriers || "2";
  const range = { city, from: values.from, to: values.to };
  const [exporting, setExporting] = useState(false);

  const stats = useQuery({
    queryKey: ["/v1/city/stats", range, months],
    queryFn: () =>
      apiFetch<{ data: CityStats }>("/v1/city/stats", { query: { ...range, months, limit: 10 } }).then((r) => r.data),
  });
  const hotspots = useQuery({
    queryKey: ["/v1/city/hotspots", range, minBarriers],
    queryFn: () =>
      apiFetch<{ data: Hotspot[] }>("/v1/city/hotspots", { query: { ...range, minBarriers, limit: 50 } }).then(
        (r) => r.data,
      ),
  });

  const exportCsv = async () => {
    setExporting(true);
    try {
      await apiDownload("/v1/city/reports.csv", range, `pulse-${city}-reports.csv`);
    } catch (err) {
      toastError(err, t);
    } finally {
      setExporting(false);
    }
  };

  const n = (v: number | null | undefined, digits = 0) => formatNumber(v, lang, digits);
  const chartConfig = {
    created: { label: t("city.created"), color: "var(--chart-1)" },
    resolved: { label: t("city.resolved"), color: "var(--chart-2)" },
  } satisfies ChartConfig;
  const s = stats.data;

  return (
    <>
      <PageHeader
        title={t("city.title")}
        actions={
          <Button onClick={exportCsv} disabled={exporting}>
            <Download className="size-4" />
            {exporting ? t("city.exporting") : t("city.export")}
          </Button>
        }
      />
      <FilterBar>
        <CityPicker value={city} onChange={(v) => set("city", v)} allowed={scoped} allowAll={false} />
        <div className="space-y-1">
          <Label htmlFor="from" className="text-xs text-muted-foreground">
            {t("common.from")}
          </Label>
          <Input
            id="from"
            type="date"
            className="w-40"
            value={values.from}
            onChange={(e) => set("from", e.target.value)}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="to" className="text-xs text-muted-foreground">
            {t("common.to")}
          </Label>
          <Input id="to" type="date" className="w-40" value={values.to} onChange={(e) => set("to", e.target.value)} />
        </div>
        <FilterSelect
          label={t("city.months")}
          value={months}
          onChange={(v) => set("months", v)}
          options={MONTH_OPTIONS.map((m) => ({ value: m, label: `${t("city.months")}: ${m}` }))}
          className="w-36"
        />
      </FilterBar>

      {stats.isLoading ? (
        <LoadingRows />
      ) : stats.error || !s ? (
        <ErrorState error={stats.error} onRetry={() => void stats.refetch()} />
      ) : (
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-3 xl:grid-cols-6">
            <StatTile label={t("city.activeBarriers")} icon={AlertTriangle} value={n(s.summary.activeBarriers)} />
            <StatTile label={t("city.blocking")} icon={ShieldAlert} value={n(s.summary.blockingBarriers)} />
            <StatTile label={t("city.facilities")} icon={Sparkles} value={n(s.summary.facilities)} />
            <StatTile label={t("city.resolved")} icon={CheckCircle2} value={n(s.summary.resolved)} />
            <StatTile label={t("city.lastMonth")} value={n(s.summary.lastMonth)} />
            <StatTile label={t("city.avgDays")} icon={Clock} value={n(s.summary.avgDaysToResolve, 1)} />
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle className="text-base">{t("city.monthly")}</CardTitle>
              </CardHeader>
              <CardContent>
                <ChartContainer config={chartConfig} className="aspect-auto h-64 w-full">
                  <BarChart data={s.monthly} margin={{ left: -16 }}>
                    <CartesianGrid vertical={false} />
                    <XAxis dataKey="label" tickLine={false} axisLine={false} />
                    <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={40} />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <ChartLegend content={<ChartLegendContent />} />
                    <Bar dataKey="created" fill="var(--color-created)" radius={3} />
                    <Bar dataKey="resolved" fill="var(--color-resolved)" radius={3} />
                  </BarChart>
                </ChartContainer>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-base">{t("city.barriers")}</CardTitle>
              </CardHeader>
              <CardContent>
                <CategoryBars
                  rows={s.barriers.map((b) => ({
                    label: t(`category.${b.category}`),
                    count: b.count,
                    extra: b.blocking ? `${t("city.blocking").toLowerCase()} ${n(b.blocking)}` : undefined,
                  }))}
                />
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t("city.problemStreets")}</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("city.street")}</TableHead>
                    <TableHead className="text-right">{t("city.activeBarriers")}</TableHead>
                    <TableHead className="text-right">{t("city.blocking")}</TableHead>
                    <TableHead className="text-right">{t("city.confirmations")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {s.problemStreets.map((street) => (
                    <TableRow key={street.name}>
                      <TableCell className="font-medium">{street.name}</TableCell>
                      <TableCell className="text-right tabular-nums">{n(street.barriers)}</TableCell>
                      <TableCell className="text-right tabular-nums">{n(street.blocking)}</TableCell>
                      <TableCell className="text-right tabular-nums">{n(street.confirmations)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      )}

      <Card className="mt-4">
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
          <CardTitle className="text-base">{t("city.hotspots")}</CardTitle>
          <FilterSelect
            label={t("city.minBarriers")}
            value={minBarriers}
            onChange={(v) => set("minBarriers", v)}
            options={["2", "3", "5", "10"].map((m) => ({ value: m, label: `${t("city.minBarriers")}: ${m}` }))}
            className="w-56"
          />
        </CardHeader>
        <CardContent className="space-y-4">
          {hotspots.isLoading ? (
            <LoadingRows rows={3} />
          ) : hotspots.error ? (
            <ErrorState error={hotspots.error} onRetry={() => void hotspots.refetch()} />
          ) : hotspots.data && hotspots.data.length > 0 ? (
            <>
              <MapPreview
                height={360}
                points={hotspots.data.map((h) => ({
                  lat: h.lat,
                  lng: h.lng,
                  radius: 6 + Math.min(14, h.barriers),
                  color: h.blocking > 0 ? "#dc2626" : "#f59e0b",
                  label: `${n(h.barriers)} · ${h.categories.map((c) => t(`category.${c.category}`)).join(", ")}`,
                }))}
              />
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("reports.category")}</TableHead>
                    <TableHead className="text-right">{t("city.activeBarriers")}</TableHead>
                    <TableHead className="text-right">{t("city.blocking")}</TableHead>
                    <TableHead className="text-right">{t("city.confirmations")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {hotspots.data.map((h) => (
                    <TableRow key={h.topReportId}>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {h.categories.map((c) => (
                            <CategoryBadge key={c.category} category={c.category} />
                          ))}
                        </div>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{n(h.barriers)}</TableCell>
                      <TableCell className="text-right tabular-nums">{n(h.blocking)}</TableCell>
                      <TableCell className="text-right tabular-nums">{n(h.confirmations)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">{t("common.empty")}</p>
          )}
        </CardContent>
      </Card>
    </>
  );
}
