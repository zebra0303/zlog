import { useI18n } from "@/shared/i18n";

const LOCALE_MAP: Record<string, string> = {
  en: "en-US",
  ko: "ko-KR",
};

function getLocale(): string {
  return LOCALE_MAP[useI18n.getState().locale] ?? "en-US";
}

const DIVISIONS: { amount: number; name: Intl.RelativeTimeFormatUnit }[] = [
  { amount: 60, name: "seconds" },
  { amount: 60, name: "minutes" },
  { amount: 24, name: "hours" },
  { amount: 7, name: "days" },
  { amount: 4.34524, name: "weeks" },
  { amount: 12, name: "months" },
  { amount: Number.POSITIVE_INFINITY, name: "years" },
];

export function timeAgo(dateStr: string): string {
  const locale = getLocale();
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
  const date = new Date(dateStr);
  let duration = (date.getTime() - Date.now()) / 1000;
  for (const division of DIVISIONS) {
    if (Math.abs(duration) < division.amount) {
      return rtf.format(Math.round(duration), division.name);
    }
    duration /= division.amount;
  }
  return formatDate(dateStr);
}

export function formatDate(dateStr: string): string {
  const locale = getLocale();
  return new Intl.DateTimeFormat(locale, { year: "numeric", month: "long", day: "numeric" }).format(new Date(dateStr));
}

export function formatDateShort(dateStr: string): string {
  const locale = getLocale();
  return new Intl.DateTimeFormat(locale, { year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(dateStr)).replace(/\s/g, "");
}
