import { useState, useEffect, useRef } from "react";
import { Link, useNavigate } from "react-router";
import { Menu, X, Sun, Moon, PenSquare, Settings, LogOut } from "lucide-react";
import { Button, ZlogLogo } from "@/shared/ui";
import { useAuthStore } from "@/features/auth/model/store";
import { useThemeStore } from "@/features/toggle-theme/model/store";
import { useSiteSettingsStore } from "@/features/site-settings/model/store";
import { useI18n } from "@/shared/i18n";

const glass = "backdrop-blur-md bg-surface/70 rounded-xl px-3 py-1";

export function Header() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const { isAuthenticated, logout } = useAuthStore();
  const { isDark, toggle } = useThemeStore();
  const { getHeaderStyle } = useSiteSettingsStore();
  const { t } = useI18n();
  const navigate = useNavigate();
  const handleLogout = () => { logout(); void navigate("/"); };
  const headerRef = useRef<HTMLElement>(null);

  const customStyle = getHeaderStyle(isDark);
  const hasCustom = Boolean((customStyle.backgroundColor ?? "") || (customStyle.backgroundImage ?? ""));
  const hasCustomHeight = !!customStyle.minHeight;

  // 커스텀 높이 값 (px) 파싱
  const parsedMinHeight = hasCustomHeight
    ? Number.parseInt(customStyle.minHeight as string, 10)
    : 0;
  const fullHeightPx = Number.isNaN(parsedMinHeight) ? 0 : parsedMinHeight;

  /**
   * 스크롤 감지 — DOM dataset 직접 토글 (React re-render 없음)
   *
   * 깜빡임 방지 핵심:
   *  - compact 진입 threshold = fullHeightPx (헤더 전체 높이)
   *    → 헤더 높이가 줄어들어 scrollY가 ~186px 감소해도
   *      expand threshold(10px)에 도달하지 못함
   *  - expand threshold = 10px (거의 맨 위)
   */
  useEffect(() => {
    if (!hasCustomHeight || fullHeightPx === 0) return;
    const el = headerRef.current;
    if (!el) return;

    let isCompact = false;
    let rafId = 0;

    const onScroll = () => {
      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        const y = window.scrollY;
        if (!isCompact && y > fullHeightPx) {
          isCompact = true;
          el.dataset.compact = "true";
        } else if (isCompact && y < 10) {
          isCompact = false;
          delete el.dataset.compact;
        }
      });
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(rafId);
    };
  }, [hasCustomHeight, fullHeightPx]);

  const headerStyle: React.CSSProperties | undefined = (hasCustom || hasCustomHeight)
    ? {
        ...customStyle,
        maxHeight: customStyle.minHeight ?? undefined,
        overflow: "hidden",
      }
    : undefined;

  return (
    <>
      <header
        ref={headerRef}
        className={`sticky top-0 z-50 border-b border-border header-animated ${hasCustom ? "" : "bg-surface/80 backdrop-blur-md"}`}
        style={headerStyle}
      >
        <div className={`header-inner mx-auto flex max-w-6xl items-center justify-between px-4 ${hasCustomHeight ? "py-4" : "h-16"}`}>
          <Link to="/" className={`flex items-center gap-2 ${hasCustom ? glass : ""}`}>
            <ZlogLogo size={36} />
            <span className="text-xl font-bold text-text">zlog</span>
          </Link>
          <nav className={`hidden items-center gap-2 md:flex ${hasCustom ? glass : ""}`}>
            <Button variant="ghost" size="sm" asChild><Link to="/">{t("nav_home")}</Link></Button>
            <Button variant="ghost" size="sm" asChild><Link to="/profile">{t("nav_profile")}</Link></Button>
            {isAuthenticated && (<>
              <Button variant="ghost" size="sm" asChild><Link to="/write"><PenSquare className="mr-1 h-4 w-4" />{t("nav_write")}</Link></Button>
              <Button variant="ghost" size="sm" asChild><Link to="/admin"><Settings className="mr-1 h-4 w-4" />{t("nav_admin")}</Link></Button>
            </>)}
            <Button variant="ghost" size="icon" onClick={() => {
              toggle();
            }} aria-label={t("nav_theme_toggle")}>{isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}</Button>
            {isAuthenticated ? <Button variant="ghost" size="sm" onClick={handleLogout}><LogOut className="mr-1 h-4 w-4" />{t("nav_logout")}</Button> : <Button variant="outline" size="sm" asChild><Link to="/login">{t("nav_login")}</Link></Button>}
          </nav>
          <div className={`flex items-center gap-2 md:hidden ${hasCustom ? glass : ""}`}>
            <Button variant="ghost" size="icon" onClick={() => {
              toggle();
            }} aria-label={t("nav_theme_toggle")}>{isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}</Button>
            <Button variant="ghost" size="icon" onClick={() => {
              setIsMobileMenuOpen(!isMobileMenuOpen);
            }} aria-label={t("nav_menu")}>{isMobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}</Button>
          </div>
        </div>
        {isMobileMenuOpen && (
          <div className="border-t border-border bg-surface p-4 md:hidden">
            <nav className="flex flex-col gap-2">
              <Link to="/" className="rounded-lg px-4 py-3 text-text hover:bg-background" onClick={() => {
                setIsMobileMenuOpen(false);
              }}>{t("nav_home")}</Link>
              <Link to="/profile" className="rounded-lg px-4 py-3 text-text hover:bg-background" onClick={() => {
                setIsMobileMenuOpen(false);
              }}>{t("nav_profile")}</Link>
              {isAuthenticated && (<>
                <Link to="/write" className="rounded-lg px-4 py-3 text-text hover:bg-background" onClick={() => {
                  setIsMobileMenuOpen(false);
                }}>{t("nav_write")}</Link>
                <Link to="/admin" className="rounded-lg px-4 py-3 text-text hover:bg-background" onClick={() => {
                  setIsMobileMenuOpen(false);
                }}>{t("nav_admin")}</Link>
                <button className="rounded-lg px-4 py-3 text-left text-red-500 hover:bg-background" onClick={() => { handleLogout(); setIsMobileMenuOpen(false); }}>{t("nav_logout")}</button>
              </>)}
              {!isAuthenticated && <Link to="/login" className="rounded-lg px-4 py-3 text-primary hover:bg-background" onClick={() => {
                setIsMobileMenuOpen(false);
              }}>{t("nav_login")}</Link>}
            </nav>
          </div>
        )}
      </header>
      <style>{`
        .header-animated {
          transition: min-height 0.3s cubic-bezier(0.4, 0, 0.2, 1),
                      max-height 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .header-animated .header-inner {
          transition: padding-top 0.3s cubic-bezier(0.4, 0, 0.2, 1),
                      padding-bottom 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .header-animated[data-compact="true"] {
          min-height: 0 !important;
          max-height: 4rem !important;
        }
        .header-animated[data-compact="true"] .header-inner {
          padding-top: 0.35rem !important;
          padding-bottom: 0.35rem !important;
        }
        @media (min-width: 768px) {
          .header-animated[data-compact="true"] {
            max-height: 4.15rem !important;
          }
          .header-animated[data-compact="true"] .header-inner {
            padding-top: 0.45rem !important;
            padding-bottom: 0.45rem !important;
          }
        }
        @media (min-width: 1024px) {
          .header-animated[data-compact="true"] {
            max-height: 4.25rem !important;
          }
          .header-animated[data-compact="true"] .header-inner {
            padding-top: 0.5rem !important;
            padding-bottom: 0.5rem !important;
          }
        }
      `}</style>
    </>
  );
}
