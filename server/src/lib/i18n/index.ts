import { en, type TranslationKeys } from "./locales/en.js";
import { ko } from "./locales/ko.js";

export type Locale = "en" | "ko";

const translations: Record<Locale, Record<TranslationKeys, string>> = { en, ko };

export function getT(locale = "ko") {
  const loc: Locale = locale === "en" ? "en" : "ko";
  return (key: TranslationKeys, params?: Record<string, string>) => {
    let text = translations[loc][key];
    if (params) {
      for (const [k, v] of Object.entries(params)) {
        text = text.replace(`{${k}}`, v);
      }
    }
    return text;
  };
}

export type { TranslationKeys };
