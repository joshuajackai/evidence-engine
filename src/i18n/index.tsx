/* =========================================================================
   THE LOCALE LAYER

   Small on purpose. It does the four things a static, offline-first app
   actually needs: pick a language, expose the strings, set `lang` and `dir` on
   the document, and hand back `Intl` formatters bound to the active locale.

   Everything numeric and temporal goes through `Intl` rather than through the
   catalogue, because a date format is not a translation, it is a calculation
   the platform already does correctly in every language.
   ========================================================================= */
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { en, type Strings } from "./strings";
import { es } from "./es";

export interface LocaleDef {
  code: string;
  /** The language's own name for itself, which is what a picker should show. */
  label: string;
  strings: Strings;
  dir: "ltr" | "rtl";
}

export const LOCALES: LocaleDef[] = [
  { code: "en", label: "English", strings: en, dir: "ltr" },
  { code: "es", label: "Español", strings: es, dir: "ltr" },
];

const STORE_KEY = "ee.locale";

/**
 * Honour the browser's ordered preference list rather than only the first
 * entry, and match on the language subtag so `es-MX` and `es-419` both find
 * Spanish.
 */
export function detectLocale(): string {
  try {
    const saved = localStorage.getItem(STORE_KEY);
    if (saved && LOCALES.some((l) => l.code === saved)) return saved;
  } catch {
    /* storage blocked; fall through to the browser preference */
  }
  const wanted = (navigator.languages && navigator.languages.length
    ? navigator.languages
    : [navigator.language || "en"]) as string[];
  for (const w of wanted) {
    const base = String(w).toLowerCase().split("-")[0];
    const hit = LOCALES.find((l) => l.code === base);
    if (hit) return hit.code;
  }
  return "en";
}

interface I18n {
  locale: string;
  dir: "ltr" | "rtl";
  t: Strings;
  setLocale(code: string): void;
  /** Locale-aware formatters, memoised per locale. */
  fmt: {
    number(n: number): string;
    /** Compact form, so 140000 reads as "140K" in English and "140 mil" in Spanish. */
    compact(n: number): string;
    money(n: number, currency?: string): string;
    date(ms: number): string;
    time(ms: number): string;
    /** "3 days ago", in the active language, without a date library. */
    relativeDays(days: number): string;
  };
}

const Ctx = createContext<I18n | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<string>(detectLocale);

  const def = useMemo(() => LOCALES.find((l) => l.code === locale) || LOCALES[0], [locale]);

  /* The document has to carry the language and direction, or a screen reader
     reads Spanish with an English voice and a right-to-left script lays out
     backwards. This is the single most important line in the file. */
  useEffect(() => {
    document.documentElement.lang = def.code;
    document.documentElement.dir = def.dir;
  }, [def]);

  const setLocale = useCallback((code: string) => {
    setLocaleState(code);
    try {
      localStorage.setItem(STORE_KEY, code);
    } catch {
      /* storage blocked; the choice simply does not persist */
    }
  }, []);

  const fmt = useMemo(() => {
    const num = new Intl.NumberFormat(def.code);
    const compact = new Intl.NumberFormat(def.code, { notation: "compact", maximumFractionDigits: 0 });
    const date = new Intl.DateTimeFormat(def.code, { dateStyle: "medium" });
    const time = new Intl.DateTimeFormat(def.code, { timeStyle: "short" });
    const rel = new Intl.RelativeTimeFormat(def.code, { numeric: "auto" });
    return {
      number: (n: number) => num.format(n),
      compact: (n: number) => compact.format(n),
      money: (n: number, currency?: string) => {
        if (!currency) return compact.format(n);
        try {
          return new Intl.NumberFormat(def.code, {
            style: "currency",
            currency,
            notation: "compact",
            maximumFractionDigits: 0,
          }).format(n);
        } catch {
          /* An unrecognised currency code should not take the page down. */
          return compact.format(n);
        }
      },
      date: (ms: number) => date.format(new Date(ms)),
      time: (ms: number) => time.format(new Date(ms)),
      relativeDays: (days: number) => rel.format(-days, "day"),
    };
  }, [def]);

  const value = useMemo<I18n>(
    () => ({ locale: def.code, dir: def.dir, t: def.strings, setLocale, fmt }),
    [def, setLocale, fmt],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useI18n(): I18n {
  const v = useContext(Ctx);
  if (!v) throw new Error("useI18n called outside I18nProvider");
  return v;
}

/** Shorthand for the common case of just wanting the strings. */
export function useT(): Strings {
  return useI18n().t;
}

/**
 * Currency symbols the pay parser reads out of a posting, mapped to ISO codes
 * so `Intl` can format them. The symbol is detected rather than chosen, so this
 * is a lookup and not a preference.
 */
export const SYMBOL_TO_CURRENCY: Record<string, string> = {
  $: "USD",
  "£": "GBP",
  "€": "EUR",
};
