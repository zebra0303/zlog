import { useState, useEffect, useRef } from "react";
import { ZlogLogo } from "@/shared/ui";
import { useThemeStore } from "@/features/toggle-theme/model/store";
import { useSiteSettingsStore } from "@/features/site-settings/model/store";

const glassBase = "backdrop-blur-md bg-[var(--color-surface)]/70 rounded-xl px-4";

export function Footer() {
  const { isDark } = useThemeStore();
  const { getFooterStyle } = useSiteSettingsStore();
  const customStyle = getFooterStyle(isDark);
  const hasCustom = Boolean((customStyle.backgroundColor ?? "") || (customStyle.backgroundImage ?? ""));
  const hasCustomHeight = !!customStyle.minHeight;
  const compactMinHeight = "72px";

  const [expanded, setExpanded] = useState(false);
  const sentinelRef = useRef<HTMLDivElement>(null);

  // sentinel이 뷰포트에 들어오면 확장 (sentinel 높이는 고정 -> 루프 없음)
  useEffect(() => {
    if (!hasCustomHeight) return;
    const el = sentinelRef.current;
    if (!el) return;

    const observer = new IntersectionObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      setExpanded(entry.isIntersecting);
    }, { threshold: 0 });
    observer.observe(el);
    return () => {
      observer.disconnect();
    };
  }, [hasCustomHeight]);

  const isExpanded = !hasCustomHeight || expanded;
  const isCompact = hasCustomHeight && !isExpanded;
  const glass = `${glassBase} ${isCompact ? "py-1.5" : "py-2"}`;

  const footerStyle: React.CSSProperties | undefined = (hasCustom || hasCustomHeight)
    ? {
        ...customStyle,
        minHeight: hasCustomHeight ? (isExpanded ? customStyle.minHeight : compactMinHeight) : undefined,
        transition: "min-height 0.3s ease",
        overflow: "hidden",
      }
    : undefined;

  return (
    <>
      {/* 확장 높이만큼 공간을 미리 확보하는 sentinel (높이 고정 -> 깜빡임 방지) */}
      {hasCustomHeight && (
        <div
          ref={sentinelRef}
          style={{ height: isExpanded ? customStyle.minHeight : compactMinHeight }}
          aria-hidden="true"
        />
      )}
      <footer
        className={`${hasCustomHeight ? "sticky bottom-0 z-40" : ""} border-t border-[var(--color-border)] ${hasCustom ? "" : "bg-[var(--color-surface)]"}`}
        style={footerStyle}
      >
        <div className={`mx-auto flex max-w-6xl items-center justify-between px-4 ${isCompact ? "py-3" : "py-6"}`}>
          <div className={`flex items-center gap-2 ${hasCustom ? glass : ""}`}>
            <ZlogLogo size={24} />
            <span className="text-sm text-[var(--color-text-secondary)]">
              Powered by <a href="https://github.com/zebra0303/zlog" target="_blank" rel="noopener noreferrer" className="no-underline hover:text-[var(--color-primary)]">zlog</a>
            </span>
          </div>
          <div className={hasCustom ? glass : ""}>
            <p className="text-sm text-[var(--color-text-secondary)]">&copy; {new Date().getFullYear()} zlog</p>
          </div>
        </div>
      </footer>
    </>
  );
}
