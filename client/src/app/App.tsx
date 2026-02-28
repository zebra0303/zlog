import { useEffect } from "react";
import { RouterProvider } from "react-router";
import { router } from "./router";
import { Providers } from "./providers";
import { ErrorBoundary } from "./ErrorBoundary";
import { useThemeStore } from "@/features/toggle-theme/model/store";
import { useAuthStore } from "@/features/auth/model/store";
import { useSiteSettingsStore } from "@/features/site-settings/model/store";
import { useI18n } from "@/shared/i18n";
import { recordVisit } from "@/features/visitor-analytics/model/recordVisit";

export default function App() {
  const { initTheme } = useThemeStore();
  const { checkAuth } = useAuthStore();
  const { fetchSettings } = useSiteSettingsStore();
  const { initLocale } = useI18n();

  useEffect(() => {
    initTheme();
    initLocale();
    void checkAuth();
    void fetchSettings();
    recordVisit();
  }, [initTheme, initLocale, checkAuth, fetchSettings]);
  return (
    <ErrorBoundary>
      <Providers>
        <RouterProvider router={router} />
      </Providers>
    </ErrorBoundary>
  );
}
