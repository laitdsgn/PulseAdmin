import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { AlertTriangle, ExternalLink } from "lucide-react";
import { useEffect } from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { WheelchairBadge } from "@/components/badges";
import { DataTable, listProps, type Column } from "@/components/DataTable";
import { CityPicker, FilterBar, FilterSelect, SearchInput, useCityName, useUrlFilters } from "@/components/Filters";
import { MapPreview } from "@/components/map";
import { ErrorState, LoadingRows, PageHeader } from "@/components/states";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useI18n } from "@/i18n";
import { apiFetch, ApiError } from "@/lib/api";
import { POI_TYPES, WHEELCHAIR } from "@/lib/enums";
import { applyFieldErrors, toastError } from "@/lib/errors";
import { formatDateTime, formatNumber } from "@/lib/format";
import { useInfiniteList, useInvalidate } from "@/lib/queries";
import type { AdminPoi, Page } from "@/lib/types";

const FILTERS = ["q", "city", "type", "wheelchair", "id"] as const;

export function PoisPage() {
  const { t, lang } = useI18n();
  const { values, set } = useUrlFilters(FILTERS);
  const cityName = useCityName();
  const { id, ...query } = values;
  const list = useInfiniteList<AdminPoi>("/v1/admin/pois", query);

  const columns: Column<AdminPoi>[] = [
    {
      header: t("places.name"),
      cell: (p) => (
        <div className="flex max-w-80 flex-col gap-0.5">
          <span className="truncate font-medium">{p.name}</span>
          <span className="truncate text-xs text-muted-foreground">{p.address ?? "—"}</span>
        </div>
      ),
    },
    { header: t("pois.type"), cell: (p) => t(`poiType.${p.type}`) },
    { header: t("common.city"), cell: (p) => cityName(p.cityId), className: "hidden lg:table-cell" },
    { header: t("places.wheelchair"), cell: (p) => <WheelchairBadge value={p.wheelchair} /> },
    {
      header: t("pois.openingHours"),
      cell: (p) => <span className="line-clamp-1 max-w-56 font-mono text-xs">{p.openingHours ?? "—"}</span>,
      className: "hidden xl:table-cell",
    },
    { header: t("pois.votes"), cell: (p) => formatNumber(p.votes, lang), className: "text-center" },
  ];

  return (
    <>
      <PageHeader title={t("pois.title")} />
      <FilterBar>
        <SearchInput value={values.q} onChange={(v) => set("q", v)} placeholder={t("pois.search")} />
        <CityPicker value={values.city} onChange={(v) => set("city", v)} />
        <FilterSelect
          label={t("pois.type")}
          value={values.type}
          onChange={(v) => set("type", v)}
          options={POI_TYPES.map((p) => ({ value: p, label: t(`poiType.${p}`) }))}
          allLabel={t("common.all")}
        />
        <FilterSelect
          label={t("places.wheelchair")}
          value={values.wheelchair}
          onChange={(v) => set("wheelchair", v)}
          options={WHEELCHAIR.map((w) => ({ value: w, label: t(`wheelchair.${w}`) }))}
          allLabel={t("common.any")}
        />
      </FilterBar>
      <DataTable
        columns={columns}
        rowKey={(p) => p.id}
        onRowClick={(p) => set("id", p.id)}
        selectedKey={id || null}
        {...listProps(list)}
      />
      <PoiSheet id={id || null} onClose={() => set("id", null)} />
    </>
  );
}

const useAdminPoi = (id: string | null) =>
  useQuery({
    queryKey: ["/v1/admin/pois", { id }],
    enabled: !!id,
    queryFn: async () => {
      const { data } = await apiFetch<Page<AdminPoi>>("/v1/admin/pois", { query: { q: id, limit: 5 } });
      return data.find((p) => p.id === id) ?? null;
    },
  });

function PoiSheet({ id, onClose }: { id: string | null; onClose: () => void }) {
  const { t } = useI18n();
  const poi = useAdminPoi(id);
  return (
    <Sheet open={!!id} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
        {poi.isLoading ? (
          <div className="p-4">
            <SheetTitle className="sr-only">{t("common.loading")}</SheetTitle>
            <LoadingRows />
          </div>
        ) : poi.error || !poi.data ? (
          <div className="p-4">
            <SheetTitle className="sr-only">{t("common.error")}</SheetTitle>
            <ErrorState
              error={poi.error ?? new ApiError(404, "Not found", "not_found")}
              onRetry={() => void poi.refetch()}
            />
          </div>
        ) : (
          <PoiForm poi={poi.data} />
        )}
      </SheetContent>
    </Sheet>
  );
}

const schema = z.object({
  name: z.string().trim().min(1).max(120),
  address: z.string().trim().max(300),
  wheelchair: z.enum(WHEELCHAIR),
  openingHours: z.string().trim().max(120),
  phone: z.string().trim().max(40),
});
type Values = z.infer<typeof schema>;
const FIELDS = ["name", "address", "wheelchair", "openingHours", "phone"] as const;
const NULLABLE = new Set<keyof Values>(["address", "openingHours", "phone"]);

function PoiForm({ poi: p }: { poi: AdminPoi }) {
  const { t, lang } = useI18n();
  const invalidate = useInvalidate();
  const cityName = useCityName();
  const defaults: Values = {
    name: p.name,
    address: p.address ?? "",
    wheelchair: p.wheelchair,
    openingHours: p.openingHours ?? "",
    phone: p.phone ?? "",
  };
  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: defaults });
  useEffect(() => form.reset(defaults), [p.updatedAt]); // eslint-disable-line react-hooks/exhaustive-deps

  const save = useMutation({
    mutationFn: (body: Record<string, unknown>) => apiFetch(`/v1/admin/pois/${p.id}`, { method: "PATCH", body }),
    onSuccess: () => {
      toast.success(t("common.saved"));
      void invalidate("/v1/admin/pois");
    },
    onError: (err) => {
      if (!applyFieldErrors(err, form.setError, FIELDS)) toastError(err, t);
    },
  });

  const onSubmit = form.handleSubmit((values) => {
    const dirty = form.formState.dirtyFields as Partial<Record<keyof Values, unknown>>;
    const body: Record<string, unknown> = {};
    for (const key of FIELDS) {
      if (!dirty[key]) continue;
      body[key] = NULLABLE.has(key) ? values[key] || null : values[key];
    }
    if (Object.keys(body).length === 0) return toast.info(t("places.noChanges"));
    save.mutate(body);
  });

  const { errors } = form.formState;
  const osmUrl = `https://www.openstreetmap.org/${p.osmId}`;

  return (
    <>
      <SheetHeader>
        <SheetTitle className="pr-6">{t("pois.editTitle")}</SheetTitle>
        <SheetDescription>
          {t(`poiType.${p.type}`)} · {cityName(p.cityId)} · <span className="font-mono">{p.id}</span> ·{" "}
          {t("common.updatedAt")} {formatDateTime(p.updatedAt, lang)}
        </SheetDescription>
      </SheetHeader>

      <form onSubmit={onSubmit} className="space-y-4 px-4 pb-6">
        <MapPreview points={[{ lat: p.lat, lng: p.lng, label: p.name }]} height={200} />
        <Button asChild variant="outline" size="sm">
          <a href={osmUrl} target="_blank" rel="noreferrer">
            <ExternalLink className="size-4" />
            {t("pois.openOsm")}
          </a>
        </Button>
        <p className="flex items-start gap-1.5 text-xs text-amber-700 dark:text-amber-400">
          <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
          {t("pois.importHint")}
        </p>

        <div className="space-y-1.5">
          <Label htmlFor="poi-name">{t("places.name")}</Label>
          <Input id="poi-name" aria-invalid={!!errors.name} {...form.register("name")} />
          {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="poi-address">{t("places.address")}</Label>
          <Input id="poi-address" aria-invalid={!!errors.address} {...form.register("address")} />
        </div>
        <div className="space-y-1.5">
          <Label>{t("places.wheelchair")}</Label>
          <Controller
            control={form.control}
            name="wheelchair"
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {WHEELCHAIR.map((w) => (
                    <SelectItem key={w} value={w}>
                      {t(`wheelchair.${w}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="poi-hours">{t("pois.openingHours")}</Label>
          <Input
            id="poi-hours"
            className="font-mono"
            placeholder="Mo-Fr 08:00-20:00; Sa 09:00-14:00"
            aria-invalid={!!errors.openingHours}
            {...form.register("openingHours")}
          />
          {errors.openingHours && <p className="text-xs text-destructive">{errors.openingHours.message}</p>}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="poi-phone">{t("pois.phone")}</Label>
          <Input id="poi-phone" inputMode="tel" aria-invalid={!!errors.phone} {...form.register("phone")} />
        </div>

        <Button type="submit" disabled={save.isPending || !form.formState.isDirty}>
          {save.isPending ? t("common.saving") : t("common.save")}
        </Button>
      </form>
    </>
  );
}
