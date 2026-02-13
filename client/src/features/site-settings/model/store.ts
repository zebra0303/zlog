import { create } from "zustand";
import { api } from "@/shared/api/client";

interface SiteSettingsState {
  settings: Record<string, string>;
  isLoaded: boolean;
  fetchSettings: () => Promise<void>;
  getHeaderStyle: (isDark: boolean) => React.CSSProperties;
  getFooterStyle: (isDark: boolean) => React.CSSProperties;
}

export const useSiteSettingsStore = create<SiteSettingsState>((set, get) => ({
  settings: {},
  isLoaded: false,

  fetchSettings: async () => {
    try {
      const data = await api.get<Record<string, string>>("/settings");
      set({ settings: data, isLoaded: true });
    } catch {
      set({ isLoaded: true });
    }
  },

  getHeaderStyle: (isDark: boolean) => {
    const { settings } = get();
    const style: React.CSSProperties = {};
    const bgColor = isDark ? settings.header_bg_color_dark : settings.header_bg_color_light;
    const bgImage = isDark ? settings.header_bg_image_dark : settings.header_bg_image_light;
    if (bgColor) style.backgroundColor = bgColor;
    if (bgImage) {
      style.backgroundImage = `url(${bgImage})`;
      style.backgroundSize = "cover";
      style.backgroundPosition = "center";
    }
    return style;
  },

  getFooterStyle: (isDark: boolean) => {
    const { settings } = get();
    const style: React.CSSProperties = {};
    const bgColor = isDark ? settings.footer_bg_color_dark : settings.footer_bg_color_light;
    const bgImage = isDark ? settings.footer_bg_image_dark : settings.footer_bg_image_light;
    if (bgColor) style.backgroundColor = bgColor;
    if (bgImage) {
      style.backgroundImage = `url(${bgImage})`;
      style.backgroundSize = "cover";
      style.backgroundPosition = "center";
    }
    return style;
  },
}));
