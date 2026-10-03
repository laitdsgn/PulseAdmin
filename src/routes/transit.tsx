import { useMutation, useQuery } from "@tanstack/react-query";
import { AlertTriangle, RefreshCw } from "lucide-react";
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
const today = () => new Date().toISOString().slice(0, 10);

/** Problems worth a warning: a timetable that no longer covers today, ends soon, or an old import. */
export const feedWarnings = (f: TransitFeed, now = Date.now()) => {
  const out: { key: "transit.servesStale" | "transit.servesEnding" | "transit.importOld"; days?: number }[] = [];
  const day = today();
  if (!f.servesTo || !f.servesFrom || f.servesTo < day || f.servesFrom > day) out.push({ key: "transit.servesStale" });
  else {
    const days = Math.round((Date.parse(f.servesTo) - Date.parse(day)) / DAY_MS);
    if (days <= 3) out.push({ key: "transit.servesEnding", days });
  }
  if (now - Date.parse(f.importedAt) > 2 * DAY_MS) out.push({ key: "transit.importOld" });
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
  const rt = f.realtime;
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
      !f.realtimeUrl ? (
        <span className="text-muted-foreground">{t("transit.realtimeNone")}</span>
      ) : (
        <div className="space-y-1">
          {rt.fetchedAt ? (
            <span>
              {t("transit.realtimeOk", {
                trips: formatNumber(rt.trips, lang),
                at: formatDateTime(rt.feedTimestamp ?? rt.fetchedAt, lang),
              })}
            </span>
          ) : (
            !rt.lastError && <span className="text-muted-foreground">{t("transit.realtimeUnknown")}</span>
          )}
          {rt.lastError && (
            <p className="text-destructive">
              {t("transit.realtimeError", { message: rt.lastError.message, at: formatDateTime(rt.lastError.at, lang) })}
            </p>
          )}
        </div>
      ),
    ],
  ];

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-2">
        <div>
          <CardTitle className="text-base">{f.name}</CardTitle>
          <p className="font-mono text-xs text-muted-foreground">{f.id}</p>
        </div>
        {f.realtimeUrl && (
          <Button size="sm" variant="outline" disabled={check.isPending} onClick={() => check.mutate()}>
            <RefreshCw className={check.isPending ? "size-4 animate-spin" : "size-4"} />
            {t("transit.check")}
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-3">
        {warnings.map((w) => (
          <p key={w.key} className="flex items-start gap-1.5 text-sm text-amber-700 dark:text-amber-400">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" />
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
        {warnings.length === 0 && (
          <Badge variant="outline" className="border-emerald-600 text-emerald-700 dark:text-emerald-400">
            OK
          </Badge>
        )}
      </CardContent>
    </Card>
  );
}
