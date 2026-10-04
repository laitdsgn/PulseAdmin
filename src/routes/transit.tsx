import { useMutation, useQuery } from "@tanstack/react-query";
import { AlertTriangle, Info, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { CityPicker, useCityName, useUrlFilters } from "@/components/Filters";
import { EmptyState, ErrorState, LoadingRows, PageHeader } from "@/components/states";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useI18n } from "@/i18n";
import { apiFetch } from "@/lib/api";
import { toastError } from "@/lib/errors";
import { formatDate, formatDateTime, formatNumber } from "@/lib/format";
import { useInvalidate } from "@/lib/queries";
import type { TransitFeed } from "@/lib/types";

const DAY_MS = 86_400_000;
const MIN_MS = 60_000;
const today = () => new Date().toISOString().slice(0, 10);

type FeedWarning = {
  key: "transit.servesStale" | "transit.servesEnding" | "transit.importOld" | "transit.vehiclesStale";
  days?: number;
  /** Worth knowing, not a problem (e.g. no vehicle moves at night). */
  info?: boolean;
};

/**
 * Problems worth a warning: a timetable that no longer covers today, ends soon, or an old import;
 * and, as information, vehicle positions fetched recently that have not changed for 10 minutes.
 */
export const feedWarnings = (f: TransitFeed, now = Date.now()) => {
  const out: FeedWarning[] = [];
  const day = today();
  if (!f.servesTo || !f.servesFrom || f.servesTo < day || f.servesFrom > day) out.push({ key: "transit.servesStale" });
  else {
    const days = Math.round((Date.parse(f.servesTo) - Date.parse(day)) / DAY_MS);
    if (days <= 3) out.push({ key: "transit.servesEnding", days });
  }
  if (now - Date.parse(f.importedAt) > 2 * DAY_MS) out.push({ key: "transit.importOld" });
  const v = f.vehicles;
  if (v?.fetchedAt && v.feedTimestamp && now - Date.parse(v.fetchedAt) < 5 * MIN_MS && now - Date.parse(v.feedTimestamp) > 10 * MIN_MS) {
    out.push({ key: "transit.vehiclesStale", info: true });
  }
  return out;
};

export function TransitPage() {
  const { t } = useI18n();
  const { values, set } = useUrlFilters(["city"] as const);
  const feeds = useQuery({
    queryKey: ["/v1/admin/transit/feeds", values.city],
    queryFn: () =>
      apiFetch<{ data: TransitFeed[] }>("/v1/admin/transit/feeds", { query: { city: values.city } }).then(
        (r) => r.data,
      ),
  });

  return (
    <>
      <PageHeader
        title={t("transit.title")}
        actions={<CityPicker value={values.city} onChange={(v) => set("city", v)} />}
      />
      <p className="mb-4 max-w-3xl text-sm text-muted-foreground">{t("transit.hint")}</p>
      {feeds.isLoading ? (
        <LoadingRows />
      ) : feeds.error ? (
        <ErrorState error={feeds.error} onRetry={() => void feeds.refetch()} />
      ) : !feeds.data?.length ? (
        <EmptyState>{t("transit.empty")}</EmptyState>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-3">
          {feeds.data.map((f) => (
            <FeedCard key={f.id} feed={f} />
          ))}
        </div>
      )}
    </>
  );
}

function FeedCard({ feed: f }: { feed: TransitFeed }) {
  const { t, lang } = useI18n();
  const cityName = useCityName();
  const invalidate = useInvalidate();
  const check = useMutation({
    mutationFn: () => apiFetch(`/v1/admin/transit/feeds/${f.id}/check`, { method: "POST" }),
    onSuccess: () => {
      toast.success(t("transit.checked"));
      void invalidate("/v1/admin/transit/feeds");
    },
    onError: (err) => toastError(err, t),
  });
  const warnings = feedWarnings(f);

  const rows: [string, React.ReactNode][] = [
    [t("common.city"), cityName(f.cityId)],
    [t("transit.version"), f.version ?? "—"],
    [t("transit.imported"), formatDateTime(f.importedAt, lang)],
    [t("transit.stops"), formatNumber(f.stops, lang)],
    [t("transit.trips"), formatNumber(f.trips, lang)],
    [t("transit.serves"), f.servesFrom ? `${formatDate(f.servesFrom, lang)} – ${formatDate(f.servesTo, lang)}` : "—"],
    [
      t("transit.realtime"),
      <LiveStatus
        url={f.realtimeUrl}
        status={f.realtime}
        none={t("transit.realtimeNone")}
        ok={(at) => t("transit.realtimeOk", { trips: formatNumber(f.realtime.trips ?? 0, lang), at })}
      />,
    ],
    [
      t("transit.vehicles"),
      <LiveStatus
        url={f.vehiclePositionsUrl}
        status={f.vehicles}
        none={t("transit.vehiclesNone")}
        ok={(at) => t("transit.vehiclesOk", { vehicles: formatNumber(f.vehicles.vehicles ?? 0, lang), at })}
      />,
    ],
  ];

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-2">
        <div>
          <CardTitle className="text-base">{f.name}</CardTitle>
          <p className="font-mono text-xs text-muted-foreground">{f.id}</p>
        </div>
        {(f.realtimeUrl || f.vehiclePositionsUrl) && (
          <Button size="sm" variant="outline" disabled={check.isPending} onClick={() => check.mutate()}>
            <RefreshCw className={check.isPending ? "size-4 animate-spin" : "size-4"} />
            {t("transit.check")}
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-3">
        {warnings.map((w) => (
          <p
            key={w.key}
            className={
              w.info ? "flex items-start gap-1.5 text-sm text-muted-foreground" : "flex items-start gap-1.5 text-sm text-amber-700 dark:text-amber-400"
            }
          >
            {w.info ? <Info className="mt-0.5 size-4 shrink-0" /> : <AlertTriangle className="mt-0.5 size-4 shrink-0" />}
            {t(w.key, { days: w.days ?? 0 })}
          </p>
        ))}
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
          {rows.map(([label, value]) => (
            <div key={label} className="contents">
              <dt className="text-muted-foreground">{label}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
        {warnings.every((w) => w.info) && (
          <Badge variant="outline" className="border-emerald-600 text-emerald-700 dark:text-emerald-400">
            OK
          </Badge>
        )}
      </CardContent>
    </Card>
  );
}

/** One GTFS-Realtime feed: what was last fetched, or the last error, or that there is no such feed. */
function LiveStatus({
  url,
  status,
  none,
  ok,
}: {
  url: string | null;
  status: { fetchedAt: string | null; feedTimestamp: string | null; lastError: { at: string; message: string } | null };
  none: string;
  ok: (at: string) => string;
}) {
  const { t, lang } = useI18n();
  if (!url) return <span className="text-muted-foreground">{none}</span>;
  return (
    <div className="space-y-1">
      {status.fetchedAt ? (
        <span>{ok(formatDateTime(status.feedTimestamp ?? status.fetchedAt, lang))}</span>
      ) : (
        !status.lastError && <span className="text-muted-foreground">{t("transit.realtimeUnknown")}</span>
      )}
      {status.lastError && (
        <p className="text-destructive">
          {t("transit.realtimeError", { message: status.lastError.message, at: formatDateTime(status.lastError.at, lang) })}
        </p>
      )}
    </div>
  );
}
