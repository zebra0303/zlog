import { useI18n } from "@/shared/i18n";
import {
  formatDate as baseFormatDate,
  formatDateShort as baseFormatDateShort,
  timeAgo as baseTimeAgo,
} from "@zebra/core";

// Wrap zCore pure functions with zlog's locale store
function getLocale(): string {
  return useI18n.getState().locale;
}

export function timeAgo(dateStr: string): string {
  return baseTimeAgo(dateStr, getLocale());
}

export function formatDate(dateStr: string): string {
  return baseFormatDate(dateStr, getLocale());
}

export function formatDateShort(dateStr: string): string {
  return baseFormatDateShort(dateStr, getLocale());
}
