import { useEffect } from "react";
import { RouterProvider } from "react-router";
import { router } from "./router";
import { Providers } from "./providers";
import { useThemeStore } from "@/features/toggle-theme/model/store";
import { useAuthStore } from "@/features/auth/model/store";
import { useSiteSettingsStore } from "@/features/site-settings/model/store";

export default function App() {
  const { initTheme } = useThemeStore();
  const { checkAuth } = useAuthStore();
  const { fetchSettings } = useSiteSettingsStore();
  useEffect(() => { initTheme(); void checkAuth(); void fetchSettings(); }, [initTheme, checkAuth, fetchSettings]);
  return <Providers><RouterProvider router={router} /></Providers>;
}
