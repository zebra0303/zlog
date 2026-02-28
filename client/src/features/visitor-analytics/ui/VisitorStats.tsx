import { useState, useEffect, useRef, useCallback } from "react";
import { useClickOutside } from "@/shared/hooks/useClickOutside";
import { Users, X } from "lucide-react";
import { useAuthStore } from "@/features/auth/model/store";
import { api } from "@/shared/api/client";
import { useI18n } from "@/shared/i18n";
import { countryFlag, countryName } from "@/shared/lib/country";

interface VisitorLog {
  id: string;
  ip: string | null;
  country?: string | null;
  userAgent?: string;
  os?: string;
  browser?: string;
  referer?: string;
  visitedAt: string;
}

interface VisitorStatsData {
  count: number;
  recent: VisitorLog[];
}

interface VisitorStatsProps {
  className?: string;
}

function decodeReferer(referer: string): string {
  try {
    return decodeURIComponent(referer);
  } catch {
    return referer;
  }
}

export function VisitorStats({ className }: VisitorStatsProps) {
  const { isAuthenticated } = useAuthStore();
  const [stats, setStats] = useState<VisitorStatsData | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);
  const { t } = useI18n();

  useEffect(() => {
    if (isAuthenticated) {
      void api
        .get<VisitorStatsData>("/analytics/visitors")
        .then(setStats)
        .catch(() => null);
    }
  }, [isAuthenticated, isOpen]);

  // Close popover on outside click
  const closePopover = useCallback(() => {
    setIsOpen(false);
  }, []);
  useClickOutside(popoverRef, closePopover, isOpen);

  if (!isAuthenticated || !stats) return null;

  return (
    <div className={`relative ${className ?? ""}`} ref={popoverRef}>
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-[var(--color-text-secondary)]">
          {t("today_visitors")}
        </span>
        <div className="flex items-center gap-2">
          <span className="font-bold text-[var(--color-text)]">{stats.count.toLocaleString()}</span>
          <button
            onClick={() => {
              setIsOpen(!isOpen);
            }}
            className={`cursor-pointer transition-colors ${isOpen ? "text-[var(--color-primary)]" : "text-[var(--color-text-secondary)] hover:text-[var(--color-primary)]"}`}
            aria-label={t("recent_visitors")}
          >
            <Users className="h-4 w-4" />
          </button>
        </div>
      </div>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-40 sm:hidden"
            onClick={() => {
              setIsOpen(false);
            }}
          />
          <div className="absolute top-full right-0 z-50 mt-1 w-full min-w-[320px] rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] shadow-lg sm:w-auto sm:min-w-[480px]">
            <div className="flex items-center justify-between gap-2 rounded-t-lg border-b border-[var(--color-border)] px-3 py-2">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-[var(--color-primary)]" />
                <span className="text-sm font-medium text-[var(--color-text)]">
                  {t("recent_visitors_title")}
                </span>
              </div>
              <button
                onClick={() => {
                  setIsOpen(false);
                }}
                className="text-[var(--color-text-secondary)] hover:text-[var(--color-text)]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="max-h-64 overflow-y-auto">
              {stats.recent.length === 0 ? (
                <p className="px-3 py-4 text-center text-xs text-[var(--color-text-secondary)]">
                  {t("no_visitors_yet")}
                </p>
              ) : (
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-[var(--color-border)] text-left text-[var(--color-text-secondary)]">
                      <th className="px-3 py-1.5 font-medium">Time</th>
                      <th className="px-3 py-1.5 font-medium">IP</th>
                      <th className="px-3 py-1.5 font-medium">OS</th>
                      <th className="px-3 py-1.5 font-medium">Browser</th>
                      <th className="px-3 py-1.5 font-medium">Referer</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.recent.map((log) => (
                      <tr
                        key={log.id}
                        className="border-b border-[var(--color-border)] last:border-0"
                      >
                        <td className="px-3 py-1.5 whitespace-nowrap text-[var(--color-text-secondary)]">
                          {new Date(log.visitedAt).toLocaleString([], {
                            month: "short",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </td>
                        <td className="px-3 py-1.5 whitespace-nowrap text-[var(--color-text)]">
                          <div className="flex items-center gap-1.5">
                            {log.country && (
                              <span
                                title={countryName(log.country)}
                                aria-label={countryName(log.country)}
                                className="text-base leading-none"
                              >
                                {countryFlag(log.country)}
                              </span>
                            )}
                            <div className="w-[7.5rem] truncate font-mono" title={log.ip ?? ""}>
                              {log.ip && log.ip !== "unknown" ? log.ip : "—"}
                            </div>{" "}
                          </div>
                        </td>
                        <td className="px-3 py-1.5 whitespace-nowrap text-[var(--color-text)]">
                          {log.os ?? "—"}
                        </td>
                        <td className="px-3 py-1.5 whitespace-nowrap text-[var(--color-text)]">
                          {log.browser ?? "—"}
                        </td>
                        <td className="px-3 py-1.5 text-[var(--color-text-secondary)]">
                          {log.referer ? (
                            <div
                              className="max-w-[120px] truncate"
                              title={decodeReferer(log.referer)}
                            >
                              {decodeReferer(log.referer)}
                            </div>
                          ) : (
                            "—"
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
