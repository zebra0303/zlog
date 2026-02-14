import { create } from "zustand";
import { en, type TranslationKeys } from "./locales/en";
import { ko } from "./locales/ko";

export type Locale = "en" | "ko";

const translations: Record<Locale, Record<TranslationKeys, string>> = { en, ko };

interface I18nState {
  locale: Locale;
  t: (key: TranslationKeys, params?: Record<string, string>) => string;
  setLocale: (locale: Locale) => void;
  initLocale: () => void;
}

export const useI18n = create<I18nState>((set, get) => ({
  locale: "en",
  t: (key, params) => {
    let text = translations[get().locale][key];
    if (params) {
      for (const [k, v] of Object.entries(params)) {
        text = text.replace(`{${k}}`, v);
      }
    }
    return text;
  },
  setLocale: (locale) => {
    localStorage.setItem("zlog_locale", locale);
    set({ locale });
  },
  initLocale: () => {
    const saved = localStorage.getItem("zlog_locale");
    if (saved === "en" || saved === "ko") {
      set({ locale: saved });
    }
  },
}));

export type { TranslationKeys };
