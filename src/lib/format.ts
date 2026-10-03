import type { Lang } from "@/i18n";

const locale = (lang: Lang) => (lang === "pl" ? "pl-PL" : "en-GB");

export const formatDateTime = (iso: string | null | undefined, lang: Lang) => {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat(locale(lang), { dateStyle: "medium", timeStyle: "short" }).format(date);
};

export const formatDate = (iso: string | null | undefined, lang: Lang) => {
  if (!iso) return "—";
  // Date-only strings (YYYY-MM-DD) are UTC days; keep them from shifting across midnight.
  const date = /^\d{4}-\d{2}-\d{2}$/.test(iso) ? new Date(`${iso}T12:00:00Z`) : new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat(locale(lang), { day: "numeric", month: "short" }).format(date);
};

export const formatNumber = (value: number | null | undefined, lang: Lang, digits = 0) =>
  value === null || value === undefined
    ? "—"
    : new Intl.NumberFormat(locale(lang), { maximumFractionDigits: digits }).format(value);

export const formatPercent = (value: number | null | undefined, lang: Lang) =>
  value === null || value === undefined
    ? "—"
    : new Intl.NumberFormat(locale(lang), { style: "percent", maximumFractionDigits: 0 }).format(value);

export const shortId = (id: string) => (id.length > 8 ? id.slice(0, 8) : id);

export const osmLink = (lat: number, lng: number) =>
  `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=18/${lat}/${lng}`;
