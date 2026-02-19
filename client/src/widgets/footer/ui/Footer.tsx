import { useState, useEffect, useRef } from "react";
import { useLocation } from "react-router";
import { ZlogLogo } from "@/shared/ui";
import { useThemeStore } from "@/features/toggle-theme/model/store";
import { useSiteSettingsStore } from "@/features/site-settings/model/store";

const glassBase = "backdrop-blur-md bg-[var(--color-surface)]/70 rounded-xl px-4";

export function Footer() {
  const { pathname } = useLocation();
  const isEditorPage = pathname.startsWith("/write");
  const { isDark } = useThemeStore();
  const { getFooterStyle } = useSiteSettingsStore();
  const customStyle = getFooterStyle(isDark);
  const hasCustom = Boolean(
    (customStyle.backgroundColor ?? "") || (customStyle.backgroundImage ?? ""),
  );
  const hasCustomHeight = !!customStyle.minHeight;
  const compactMinHeight = "clamp(36px, 6vw, 44px)";

  const [expanded, setExpanded] = useState(false);
  const sentinelRef = useRef<HTMLDivElement>(null);

  // Expand when sentinel enters viewport (sentinel height is fixed -> no loop)
  useEffect(() => {
    if (!hasCustomHeight) return;
    const el = sentinelRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (!entry) return;
        setExpanded(entry.isIntersecting);
      },
      { threshold: 0 },
    );
    observer.observe(el);
    return () => {
      observer.disconnect();
    };
  }, [hasCustomHeight]);

  const isExpanded = !hasCustomHeight || expanded;
  const isCompact = hasCustomHeight && !isExpanded;
  const glass = `${glassBase} ${isCompact ? "py-0.5" : "py-2"}`;

  const footerStyle: React.CSSProperties | undefined =
    hasCustom || hasCustomHeight
      ? {
          ...customStyle,
          minHeight: hasCustomHeight
            ? isExpanded
              ? customStyle.minHeight
              : compactMinHeight
            : undefined,
          transition: "min-height 0.3s ease",
          overflow: "hidden",
        }
      : undefined;

  if (isEditorPage) {
    return (
      <footer className="border-t border-[var(--color-border)] bg-[var(--color-surface)]">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-center px-4 py-1.5">
          <span className="text-xs text-[var(--color-text-secondary)]">zlog</span>
        </div>
      </footer>
    );
  }

  return (
    <>
      {/* Sentinel that reserves space for the expanded height (fixed height -> prevents flickering) */}
      {hasCustomHeight && (
        <div
          ref={sentinelRef}
          style={{ height: isExpanded ? customStyle.minHeight : compactMinHeight }}
          aria-hidden="true"
        />
      )}
      <footer
        className={`${hasCustomHeight ? "sticky bottom-0 z-40" : ""} footer-animated ${isCompact ? "footer-compact flex items-center" : ""} border-t border-[var(--color-border)] ${hasCustom ? "" : "bg-[var(--color-surface)]"}`}
        style={footerStyle}
      >
        <div
          className={`footer-inner mx-auto flex w-full max-w-6xl items-center justify-between px-4 ${isCompact ? "py-2" : "py-6"}`}
        >
          <div className={`flex items-center gap-2 ${hasCustom ? glass : ""}`}>
            <ZlogLogo size={24} />
            <span className="text-sm text-[var(--color-text-secondary)]">
              Powered by{" "}
              <a
                href="https://github.com/zebra0303/zlog"
                target="_blank"
                rel="noopener noreferrer"
                className="no-underline hover:text-[var(--color-primary)]"
              >
                zlog
              </a>
            </span>
          </div>
        </div>
      </footer>
      <style>{`
        .footer-animated .footer-inner {
          transition: padding-top 0.3s cubic-bezier(0.4, 0, 0.2, 1),
                      padding-bottom 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .footer-animated.footer-compact .footer-inner {
          padding-top: 0.1rem !important;
          padding-bottom: 0.1rem !important;
        }
        @media (min-width: 768px) {
          .footer-animated.footer-compact .footer-inner {
            padding-top: 0.15rem !important;
            padding-bottom: 0.15rem !important;
          }
        }
        @media (min-width: 1024px) {
          .footer-animated.footer-compact .footer-inner {
            padding-top: 0.2rem !important;
            padding-bottom: 0.2rem !important;
          }
        }
      `}</style>
    </>
  );
}
