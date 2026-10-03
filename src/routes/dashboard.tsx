import { useQuery } from "@tanstack/react-query";
import {
  Bot,
  ClipboardList,
  Flag,
  HelpCircle,
  MapPinned,
  MessageSquare,
  Radar,
  ShoppingBasket,
  TramFront,
  Users,
} from "lucide-react";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { Link } from "react-router";
import { CityPicker, useUrlFilters } from "@/components/Filters";
import { ErrorState, LoadingRows, PageHeader } from "@/components/states";
import { StatTile } from "@/components/StatTile";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { Progress } from "@/components/ui/progress";
import { useI18n } from "@/i18n";
import { apiFetch } from "@/lib/api";
import { formatDate, formatNumber } from "@/lib/format";
import type { AdminReport, Dashboard, Page } from "@/lib/types";
import { ReportPhoto } from "@/components/ReportPhoto";
import { HiddenBadge } from "@/components/badges";

export function DashboardPage() {
  const { t, lang } = useI18n();
  const { values, set } = useUrlFilters(["city"] as const);
  const query = useQuery({
    queryKey: ["/v1/admin/dashboard", values.city],
    queryFn: () =>
      apiFetch<{ data: Dashboard }>("/v1/admin/dashboard", { query: { city: values.city } }).then((r) => r.data),
  });

  const chartConfig = { count: { label: t("dashboard.count"), color: "var(--chart-1)" } } satisfies ChartConfig;
  const d = query.data;
  const n = (v: number) => formatNumber(v, lang);

  return (
    <>
      <PageHeader
        title={t("dashboard.title")}
        actions={<CityPicker value={values.city} onChange={(v) => set("city", v)} />}
      />
      {query.isLoading ? (
        <LoadingRows />
      ) : query.error || !d ? (
        <ErrorState error={query.error} onRetry={() => void query.refetch()} />
      ) : (
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
            <StatTile
              label={t("dashboard.reportsActive")}
              icon={ClipboardList}
              value={n(d.reports.active)}
              sub={t("dashboard.reportsSub", {
                unverified: n(d.reports.unverified),
                total: n(d.reports.total),
                resolved: n(d.reports.resolved),
                hidden: n(d.reports.hidden),
                new: n(d.reports.newLast7Days),
              })}
            />
            <StatTile
              label={t("dashboard.openFlags")}
              icon={Flag}
              value={n(d.openFlags)}
              footer={
                <Link to="/moderation" className="text-xs font-medium text-primary underline-offset-4 hover:underline">
                  {t("dashboard.openFlagsLink")} →
                </Link>
              }
            />
            <StatTile
              label={t("dashboard.users")}
              icon={Users}
              value={n(d.users.total)}
              sub={t("dashboard.usersSub", {
                new: n(d.users.newLast7Days),
                staff: n(d.users.staff),
                disabled: n(d.users.disabled),
              })}
            />
            <StatTile
              label={t("dashboard.comments")}
              icon={MessageSquare}
              value={n(d.comments.total)}
              sub={t("dashboard.commentsSub", { hidden: n(d.comments.hidden) })}
            />
            <StatTile
              label={t("dashboard.llm")}
              icon={Bot}
              value={`${n(d.llm.callsToday)} / ${n(d.llm.dailyLimit)}`}
              sub={t("dashboard.llmSub", { limit: n(d.llm.dailyLimit) })}
              footer={
                <Progress
                  value={d.llm.dailyLimit ? Math.min(100, (d.llm.callsToday / d.llm.dailyLimit) * 100) : 0}
                  className="mt-2"
                  aria-label={t("dashboard.llm")}
                />
              }
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle className="text-base">{t("dashboard.perDay")}</CardTitle>
              </CardHeader>
              <CardContent>
                <ChartContainer config={chartConfig} className="aspect-auto h-64 w-full">
                  <BarChart data={d.reportsPerDay} margin={{ left: -16 }}>
                    <CartesianGrid vertical={false} />
                    <XAxis
                      dataKey="date"
                      tickLine={false}
                      axisLine={false}
                      minTickGap={24}
                      tickFormatter={(v: string) => formatDate(v, lang)}
                    />
                    <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={40} />
                    <ChartTooltip
                      content={<ChartTooltipContent labelFormatter={(v) => formatDate(String(v), lang)} />}
                    />
                    <Bar dataKey="count" fill="var(--color-count)" radius={3} />
                  </BarChart>
                </ChartContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">{t("dashboard.topCategories")}</CardTitle>
              </CardHeader>
              <CardContent>
                <CategoryBars
                  rows={d.topCategories.map((c) => ({ label: t(`category.${c.category}`), count: c.count }))}
                />
              </CardContent>
            </Card>
          </div>

          <CommunityTiles d={d} />

          <LatestPhotos city={values.city} />
        </div>
      )}
    </>
  );
}

const tileLink = (to: string, label: string) => (
  <Link to={to} className="text-xs font-medium text-primary underline-offset-4 hover:underline">
    {label} →
  </Link>
);

/** Questions, presence, detection, transport and errand places (the features added for the app). */
function CommunityTiles({ d }: { d: Dashboard }) {
  const { t, lang } = useI18n();
  const n = (v: number) => formatNumber(v, lang);
  const c = d.community;
  return (
    <section className="space-y-2">
      <h2 className="text-sm font-medium text-muted-foreground">{t("dashboard.community")}</h2>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <StatTile
          label={t("dashboard.questionsOpen")}
          icon={HelpCircle}
          value={n(c.questions.open)}
          sub={t("dashboard.questionsSub", {
            new: n(c.questions.last24h),
            answers: n(c.questions.answersLast24h),
            hidden: n(c.questions.hidden),
          })}
          footer={tileLink("/questions?status=open", t("nav.questions"))}
        />
        <StatTile
          label={t("dashboard.presence")}
          icon={MapPinned}
          value={n(c.presenceNow)}
          sub={t("dashboard.presenceSub")}
        />
        <StatTile
          label={t("dashboard.detection")}
          icon={Radar}
          value={n(c.detection.unverified)}
          sub={t("dashboard.detectionSub", {
            signals: n(c.detection.signalsLast24h),
            confirmed: n(c.detection.confirmedLast7Days),
          })}
          footer={tileLink("/detection", t("nav.detection"))}
        />
        <StatTile
          label={t("dashboard.transit")}
          icon={TramFront}
          value={n(c.transit.stops)}
          sub={t("dashboard.transitSub", { feeds: n(c.transit.feeds), stops: n(c.transit.stops) })}
          footer={tileLink("/transit", t("nav.transit"))}
        />
        <StatTile
          label={t("dashboard.pois")}
          icon={ShoppingBasket}
          value={n(c.pois)}
          footer={tileLink("/pois", t("nav.pois"))}
        />
      </div>
    </section>
  );
}

/** Horizontal bars as plain HTML: readable labels of any length, no chart library needed. */
export function CategoryBars({ rows }: { rows: { label: string; count: number; extra?: string }[] }) {
  const { lang } = useI18n();
  const max = Math.max(1, ...rows.map((r) => r.count));
  if (rows.length === 0) return <p className="text-sm text-muted-foreground">—</p>;
  return (
    <ul className="space-y-2">
      {rows.map((r) => (
        <li key={r.label} className="space-y-1">
          <div className="flex justify-between gap-2 text-sm">
            <span className="truncate">{r.label}</span>
            <span className="tabular-nums text-muted-foreground">
              {formatNumber(r.count, lang)}
              {r.extra && ` · ${r.extra}`}
            </span>
          </div>
          <div className="h-2 rounded-full bg-muted">
            <div className="h-2 rounded-full bg-chart-1" style={{ width: `${(r.count / max) * 100}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

const PHOTO_COUNT = 8;

/** The newest reports that came with a photo; a click opens the report. */
function LatestPhotos({ city }: { city: string }) {
  const { t, lang } = useI18n();
  const photos = useQuery({
    queryKey: ["/v1/admin/reports", { hasPhoto: "true", city, limit: PHOTO_COUNT }],
    queryFn: () =>
      apiFetch<Page<AdminReport>>("/v1/admin/reports", {
        query: { hasPhoto: true, city, limit: PHOTO_COUNT },
      }).then((r) => r.data),
  });
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">{t("dashboard.latestPhotos")}</CardTitle>
        <Link
          to={`/reports?hasPhoto=true${city ? `&city=${city}` : ""}`}
          className="text-xs font-medium text-primary underline-offset-4 hover:underline"
        >
          {t("dashboard.allPhotos")} →
        </Link>
      </CardHeader>
      <CardContent>
        {photos.isLoading ? (
          <LoadingRows rows={2} />
        ) : photos.error ? (
          <ErrorState error={photos.error} onRetry={() => void photos.refetch()} />
        ) : !photos.data?.length ? (
          <p className="text-sm text-muted-foreground">{t("dashboard.noPhotos")}</p>
        ) : (
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-8">
            {photos.data.map((r) => (
              <li key={r.id} className="space-y-1">
                <ReportPhoto
                  photoUrl={r.photoUrl}
                  hidden={r.hidden}
                  alt={r.title}
                  className="aspect-square w-full rounded-md"
                />
                <Link to={`/reports?id=${r.id}`} className="block text-xs underline-offset-4 hover:underline">
                  <span className="line-clamp-1 font-medium">{r.title}</span>
                  <span className="flex items-center gap-1 text-muted-foreground">
                    {formatDate(r.createdAt, lang)} <HiddenBadge hidden={r.hidden} />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
