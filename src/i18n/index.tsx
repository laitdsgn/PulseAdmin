import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { z } from "zod";
import { setApiLanguage } from "@/lib/api";
import { en } from "./en";
import { pl, type MessageKey } from "./pl";

export type Lang = "pl" | "en";
export type { MessageKey };
export type Vars = Record<string, string | number>;

const LANG_KEY = "pulse-admin.lang";
const dictionaries: Record<Lang, Record<MessageKey, string>> = { pl, en };

export const translate = (lang: Lang, key: MessageKey, vars?: Vars) => {
  const text = dictionaries[lang][key] ?? key;
  return vars ? text.replace(/\{(\w+)\}/g, (m, name: string) => String(vars[name] ?? m)) : text;
};

export const isMessageKey = (key: string): key is MessageKey => key in pl;

const initialLang = (): Lang => {
  try {
    const saved = localStorage.getItem(LANG_KEY);
    if (saved === "pl" || saved === "en") return saved;
  } catch {}
  return navigator.language?.toLowerCase().startsWith("pl") ? "pl" : "en";
};

type I18n = { lang: Lang; setLang: (lang: Lang) => void; t: (key: MessageKey, vars?: Vars) => string };
const I18nContext = createContext<I18n | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(initialLang);
  setApiLanguage(lang);
  // Client-side validation messages follow the interface language.
  z.config(lang === "pl" ? z.locales.pl() : z.locales.en());

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  const setLang = useCallback((next: Lang) => {
    try {
      localStorage.setItem(LANG_KEY, next);
    } catch {}
    setLangState(next);
  }, []);

  const value = useMemo<I18n>(() => ({ lang, setLang, t: (key, vars) => translate(lang, key, vars) }), [lang, setLang]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export const useI18n = () => {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n outside I18nProvider");
  return ctx;
};

export const useT = () => useI18n().t;
