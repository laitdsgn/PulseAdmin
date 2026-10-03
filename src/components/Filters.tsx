import { Search } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { useSearchParams } from "react-router";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useI18n, useT } from "@/i18n";
import { useCities } from "@/lib/queries";

/** Filter values kept in the URL so views can be linked and survive a reload. */
export const useUrlFilters = <K extends string>(keys: readonly K[]) => {
  const [params, setParams] = useSearchParams();
  const values = Object.fromEntries(keys.map((k) => [k, params.get(k) ?? ""])) as Record<K, string>;
  /** Changes several params in one navigation (separate `set` calls would overwrite each other). */
  const setMany = (changes: Record<string, string | null>) =>
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        for (const [key, value] of Object.entries(changes)) {
          if (value) next.set(key, value);
          else next.delete(key);
        }
        return next;
      },
      { replace: true },
    );
  const set = (key: string, value: string | null) => setMany({ [key]: value });
  return { values, set, setMany, params };
};

export function FilterBar({ children }: { children: ReactNode }) {
  return <div className="mb-4 flex flex-wrap items-end gap-2">{children}</div>;
}

export function SearchInput({
  value,
  onChange,
  placeholder,
  className = "w-64",
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  className?: string;
}) {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);
  useEffect(() => {
    if (draft === value) return;
    const id = setTimeout(() => onChange(draft.trim()), 350);
    return () => clearTimeout(id);
  }, [draft]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className={`relative ${className}`}>
      <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        type="search"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        className="pl-8"
      />
    </div>
  );
}

const ALL = "__all";

export function FilterSelect({
  label,
  value,
  onChange,
  options,
  allLabel,
  className = "w-44",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: readonly { value: string; label: string }[];
  /** Label of the "no filter" option; omit to make a value required. */
  allLabel?: string;
  className?: string;
}) {
  return (
    <Select value={value || (allLabel ? ALL : undefined)} onValueChange={(v) => onChange(v === ALL ? "" : v)}>
      <SelectTrigger className={className} aria-label={label}>
        <SelectValue placeholder={label} />
      </SelectTrigger>
      <SelectContent>
        {allLabel && (
          <SelectItem value={ALL}>
            <span className="text-muted-foreground">{label}:</span> {allLabel}
          </SelectItem>
        )}
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

/** City filter. `allowed` limits the list (a city account's scope); empty = every city. */
export function CityPicker({
  value,
  onChange,
  allowed = [],
  allowAll = true,
}: {
  value: string;
  onChange: (value: string) => void;
  allowed?: string[];
  allowAll?: boolean;
}) {
  const t = useT();
  const { lang } = useI18n();
  const { data: cities = [] } = useCities();
  const options = cities
    .filter((c) => allowed.length === 0 || allowed.includes(c.id))
    .map((c) => ({ value: c.id, label: lang === "pl" ? c.name : c.nameEn }));
  return (
    <FilterSelect
      label={t("common.city")}
      value={value}
      onChange={onChange}
      options={options}
      allLabel={allowAll ? t("common.allCities") : undefined}
    />
  );
}

export const useCityName = () => {
  const { lang } = useI18n();
  const { data: cities = [] } = useCities();
  return (id: string) => {
    const city = cities.find((c) => c.id === id);
    return city ? (lang === "pl" ? city.name : city.nameEn) : id;
  };
};
