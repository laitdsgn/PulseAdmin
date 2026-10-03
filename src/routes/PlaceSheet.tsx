import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { AlertTriangle } from "lucide-react";
import { useEffect } from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { useCityName } from "@/components/Filters";
import { MapPreview } from "@/components/map";
import { ErrorState, LoadingRows } from "@/components/states";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useI18n } from "@/i18n";
import { apiFetch, ApiError } from "@/lib/api";
import { BARRIER_CATEGORIES, CATEGORIES, FACILITY_CATEGORIES, WHEELCHAIR, type Category } from "@/lib/enums";
import { applyFieldErrors, toastError } from "@/lib/errors";
import { formatDateTime } from "@/lib/format";
import { useInvalidate } from "@/lib/queries";
import type { AdminPlace, Page } from "@/lib/types";

const useAdminPlace = (id: string | null) =>
  useQuery({
    queryKey: ["/v1/admin/places", { id }],
    enabled: !!id,
    queryFn: async () => {
      const { data } = await apiFetch<Page<AdminPlace>>("/v1/admin/places", { query: { q: id, limit: 1 } });
      return data.find((p) => p.id === id) ?? null;
    },
  });

export function PlaceSheet({ id, onClose }: { id: string | null; onClose: () => void }) {
  const { t } = useI18n();
  const place = useAdminPlace(id);
  return (
    <Sheet open={!!id} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
        {place.isLoading ? (
          <div className="p-4">
            <SheetTitle className="sr-only">{t("common.loading")}</SheetTitle>
            <LoadingRows />
          </div>
        ) : place.error || !place.data ? (
          <div className="p-4">
            <SheetTitle className="sr-only">{t("common.error")}</SheetTitle>
            <ErrorState
              error={place.error ?? new ApiError(404, "Not found", "not_found")}
              onRetry={() => void place.refetch()}
            />
          </div>
        ) : (
          <PlaceForm place={place.data} />
        )}
      </SheetContent>
    </Sheet>
  );
}

const schema = z.object({
  name: z.string().trim().min(1).max(200),
  address: z.string().trim().max(300),
  wheelchair: z.enum(WHEELCHAIR),
  accessibility: z.string().trim().min(20).max(800),
  facilities: z.array(z.enum(CATEGORIES)).max(40),
  barriers: z.array(z.enum(CATEGORIES)).max(40),
  verified: z.boolean(),
});
type Values = z.infer<typeof schema>;
const FIELDS = ["name", "address", "wheelchair", "accessibility", "facilities", "barriers", "verified"] as const;

function PlaceForm({ place: p }: { place: AdminPlace }) {
  const { t, lang } = useI18n();
  const invalidate = useInvalidate();
  const cityName = useCityName();
  const defaults: Values = {
    name: p.name,
    address: p.address ?? "",
    wheelchair: p.wheelchair,
    accessibility: p.accessibility,
    facilities: p.facilities,
    barriers: p.barriers,
    verified: p.verified,
  };
  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: defaults });
  useEffect(() => form.reset(defaults), [p.updatedAt]); // eslint-disable-line react-hooks/exhaustive-deps

  const save = useMutation({
    mutationFn: (body: Record<string, unknown>) => apiFetch(`/v1/admin/places/${p.id}`, { method: "PATCH", body }),
    onSuccess: () => {
      toast.success(t("common.saved"));
      void invalidate("/v1/admin/places");
    },
    onError: (err) => {
      if (!applyFieldErrors(err, form.setError, FIELDS)) toastError(err, t);
    },
  });

  const onSubmit = form.handleSubmit((values) => {
    // Send only changed fields: an unchanged description must not drop its English translation.
    const dirty = form.formState.dirtyFields as Partial<Record<keyof Values, unknown>>;
    const body: Record<string, unknown> = {};
    for (const key of FIELDS) {
      if (!dirty[key]) continue;
      body[key] = key === "address" ? values.address || null : values[key];
    }
    if (Object.keys(body).length === 0) return toast.info(t("places.noChanges"));
    save.mutate(body);
  });

  const { errors, dirtyFields } = form.formState;
  const accessibility = form.watch("accessibility");

  return (
    <>
      <SheetHeader>
        <SheetTitle className="pr-6">{t("places.editTitle")}</SheetTitle>
        <SheetDescription>
          {t(`placeType.${p.type}`)} · {cityName(p.cityId)} · {t("places.source")}:{" "}
          {p.source === "osm" ? "OpenStreetMap" : t("source.seed")} · {t("common.updatedAt")}{" "}
          {formatDateTime(p.updatedAt, lang)}
        </SheetDescription>
      </SheetHeader>

      <form onSubmit={onSubmit} className="space-y-4 px-4 pb-6">
        <MapPreview points={[{ lat: p.lat, lng: p.lng, label: p.name }]} height={200} />

        <div className="space-y-1.5">
          <Label htmlFor="place-name">{t("places.name")}</Label>
          <Input id="place-name" aria-invalid={!!errors.name} {...form.register("name")} />
          {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="place-address">{t("places.address")}</Label>
          <Input id="place-address" aria-invalid={!!errors.address} {...form.register("address")} />
          {errors.address && <p className="text-xs text-destructive">{errors.address.message}</p>}
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
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
          <Controller
            control={form.control}
            name="verified"
            render={({ field }) => (
              <label className="flex items-center gap-3 self-end pb-2 text-sm font-medium">
                <Switch checked={field.value} onCheckedChange={field.onChange} />
                {t("places.verified")}
              </label>
            )}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="place-accessibility">{t("places.accessibility")}</Label>
          <Textarea
            id="place-accessibility"
            rows={6}
            aria-invalid={!!errors.accessibility}
            {...form.register("accessibility")}
          />
          <p className={errors.accessibility ? "text-xs text-destructive" : "text-xs text-muted-foreground"}>
            {errors.accessibility
              ? errors.accessibility.message
              : t("common.chars", { count: accessibility.trim().length, max: 800 })}
          </p>
          {dirtyFields.accessibility ? (
            <p className="flex items-start gap-1.5 text-xs text-amber-700 dark:text-amber-400">
              <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
              {t("places.accessibilityHint")}
            </p>
          ) : null}
        </div>

        <CategoryChecklist name="facilities" label={t("places.facilities")} options={FACILITY_CATEGORIES} form={form} />
        <CategoryChecklist name="barriers" label={t("places.barriers")} options={BARRIER_CATEGORIES} form={form} />

        <Button type="submit" disabled={save.isPending || !form.formState.isDirty}>
          {save.isPending ? t("common.saving") : t("common.save")}
        </Button>
      </form>
    </>
  );
}

function CategoryChecklist({
  name,
  label,
  options,
  form,
}: {
  name: "facilities" | "barriers";
  label: string;
  options: readonly Category[];
  form: ReturnType<typeof useForm<Values>>;
}) {
  const { t } = useI18n();
  const error = form.formState.errors[name];
  return (
    <fieldset className="space-y-2">
      <legend className="text-sm font-medium">{label}</legend>
      <Controller
        control={form.control}
        name={name}
        render={({ field }) => (
          <div className="grid gap-x-4 gap-y-2 sm:grid-cols-2">
            {options.map((c) => (
              <label key={c} className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={field.value.includes(c)}
                  onCheckedChange={(checked) =>
                    field.onChange(checked ? [...field.value, c] : field.value.filter((v) => v !== c))
                  }
                />
                {t(`category.${c}`)}
              </label>
            ))}
          </div>
        )}
      />
      {error && <p className="text-xs text-destructive">{t("places.maxItems")}</p>}
    </fieldset>
  );
}
