import { ZlogLogo } from "@/shared/ui";
import { useThemeStore } from "@/features/toggle-theme/model/store";
import { useSiteSettingsStore } from "@/features/site-settings/model/store";

const glass = "backdrop-blur-md bg-[var(--color-surface)]/70 rounded-xl px-4 py-2";

export function Footer() {
  const { isDark } = useThemeStore();
  const { getFooterStyle } = useSiteSettingsStore();
  const customStyle = getFooterStyle(isDark);
  const hasCustom = !!(customStyle.backgroundColor || customStyle.backgroundImage);

  return (
    <footer
      className={`border-t border-[var(--color-border)] ${hasCustom ? "" : "bg-[var(--color-surface)]"}`}
      style={hasCustom ? customStyle : undefined}
    >
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-6">
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
  );
}
