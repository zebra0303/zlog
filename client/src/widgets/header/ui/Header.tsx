import { useState } from "react";
import { Link, useNavigate } from "react-router";
import { Menu, X, Sun, Moon, PenSquare, Settings, LogOut } from "lucide-react";
import { Button, ZlogLogo } from "@/shared/ui";
import { useAuthStore } from "@/features/auth/model/store";
import { useThemeStore } from "@/features/toggle-theme/model/store";
import { useSiteSettingsStore } from "@/features/site-settings/model/store";

const glass = "backdrop-blur-md bg-[var(--color-surface)]/70 rounded-xl px-3 py-1";

export function Header() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const { isAuthenticated, logout } = useAuthStore();
  const { isDark, toggle } = useThemeStore();
  const { getHeaderStyle } = useSiteSettingsStore();
  const navigate = useNavigate();
  const handleLogout = () => { logout(); void navigate("/"); };

  const customStyle = getHeaderStyle(isDark);
  const hasCustom = !!(customStyle.backgroundColor || customStyle.backgroundImage);
  const hasCustomHeight = !!customStyle.minHeight;

  return (
    <header
      className={`sticky top-0 z-50 border-b border-[var(--color-border)] ${hasCustom ? "" : "bg-[var(--color-surface)]/80 backdrop-blur-md"}`}
      style={hasCustom ? customStyle : undefined}
    >
      <div className={`mx-auto flex max-w-6xl items-center justify-between px-4 ${hasCustomHeight ? "py-4" : "h-16"}`}>
        <Link to="/" className={`flex items-center gap-2 ${hasCustom ? glass : ""}`}>
          <ZlogLogo size={36} />
          <span className="text-xl font-bold text-[var(--color-text)]">zlog</span>
        </Link>
        <nav className={`hidden items-center gap-2 md:flex ${hasCustom ? glass : ""}`}>
          <Button variant="ghost" size="sm" asChild><Link to="/">홈</Link></Button>
          <Button variant="ghost" size="sm" asChild><Link to="/profile">프로필</Link></Button>
          {isAuthenticated && (<>
            <Button variant="ghost" size="sm" asChild><Link to="/write"><PenSquare className="mr-1 h-4 w-4" />글쓰기</Link></Button>
            <Button variant="ghost" size="sm" asChild><Link to="/admin"><Settings className="mr-1 h-4 w-4" />관리</Link></Button>
          </>)}
          <Button variant="ghost" size="icon" onClick={toggle} aria-label="테마 전환">{isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}</Button>
          {isAuthenticated ? <Button variant="ghost" size="sm" onClick={handleLogout}><LogOut className="mr-1 h-4 w-4" />로그아웃</Button> : <Button variant="outline" size="sm" asChild><Link to="/login">로그인</Link></Button>}
        </nav>
        <div className={`flex items-center gap-2 md:hidden ${hasCustom ? glass : ""}`}>
          <Button variant="ghost" size="icon" onClick={toggle} aria-label="테마 전환">{isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}</Button>
          <Button variant="ghost" size="icon" onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} aria-label="메뉴">{isMobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}</Button>
        </div>
      </div>
      {isMobileMenuOpen && (
        <div className="border-t border-[var(--color-border)] bg-[var(--color-surface)] p-4 md:hidden">
          <nav className="flex flex-col gap-2">
            <Link to="/" className="rounded-lg px-4 py-3 text-[var(--color-text)] hover:bg-[var(--color-background)]" onClick={() => setIsMobileMenuOpen(false)}>홈</Link>
            <Link to="/profile" className="rounded-lg px-4 py-3 text-[var(--color-text)] hover:bg-[var(--color-background)]" onClick={() => setIsMobileMenuOpen(false)}>프로필</Link>
            {isAuthenticated && (<>
              <Link to="/write" className="rounded-lg px-4 py-3 text-[var(--color-text)] hover:bg-[var(--color-background)]" onClick={() => setIsMobileMenuOpen(false)}>글쓰기</Link>
              <Link to="/admin" className="rounded-lg px-4 py-3 text-[var(--color-text)] hover:bg-[var(--color-background)]" onClick={() => setIsMobileMenuOpen(false)}>관리</Link>
              <button className="rounded-lg px-4 py-3 text-left text-red-500 hover:bg-[var(--color-background)]" onClick={() => { handleLogout(); setIsMobileMenuOpen(false); }}>로그아웃</button>
            </>)}
            {!isAuthenticated && <Link to="/login" className="rounded-lg px-4 py-3 text-[var(--color-primary)] hover:bg-[var(--color-background)]" onClick={() => setIsMobileMenuOpen(false)}>로그인</Link>}
          </nav>
        </div>
      )}
    </header>
  );
}
