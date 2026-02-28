import { create } from "zustand";
import { api } from "@/shared/api/client";
import { useI18n, type Locale } from "@/shared/i18n";
import { applyFont } from "@/shared/lib/fonts";
import { useThemeStore } from "@/features/toggle-theme/model/store";

interface SiteSettingsState {
  settings: Record<string, string>;
  isLoaded: boolean;
  fetchSettings: () => Promise<void>;
  getHeaderStyle: (isDark: boolean) => React.CSSProperties;
  getFooterStyle: (isDark: boolean) => React.CSSProperties;
  getBodyStyle: (isDark: boolean) => { background?: string; backgroundColor?: string };
  hasHeaderCustomBg: (isDark: boolean) => boolean;
  hasFooterCustomBg: (isDark: boolean) => boolean;
  hasBodyCustomBg: (isDark: boolean) => boolean;
  getCurrentFont: () => string;
}

export const useSiteSettingsStore = create<SiteSettingsState>((set, get) => ({
  settings: {},
  isLoaded: false,

  fetchSettings: async () => {
    try {
      const data = await api.get<Record<string, string>>("/settings");
      set({ settings: data, isLoaded: true });
      // Apply font
      if (data.font_family) {
        applyFont(data.font_family);
      }
      // Apply default language from server if exists and user hasn't manually set one
      const serverLang = data.default_language as Locale | undefined;
      if (serverLang && !localStorage.getItem("zlog_locale")) {
        useI18n.getState().setLocale(serverLang);
      }
      // Apply default theme from server if exists and user hasn't manually set one
      const serverTheme = data.default_theme;
      if (serverTheme && serverTheme !== "system" && !localStorage.getItem("zlog_theme")) {
        const isDark = serverTheme === "dark";
        useThemeStore.getState().setTheme(isDark);
      }
    } catch {
      set({ isLoaded: true });
    }
  },

  getHeaderStyle: (isDark: boolean) => {
    const { settings } = get();
    const style: React.CSSProperties = {};
    const bgColor = isDark ? settings.header_bg_color_dark : settings.header_bg_color_light;
    const bgImage = isDark ? settings.header_bg_image_dark : settings.header_bg_image_light;
    const alignment = isDark
      ? settings.header_image_alignment_dark
      : settings.header_image_alignment_light;
    const height = settings.header_height;
    if (bgColor) style.backgroundColor = bgColor;
    if (bgImage) {
      style.backgroundImage = `url(${bgImage})`;
      style.backgroundSize = "cover";
      style.backgroundPosition = `${alignment ?? "left"} center`;
    }
    if (height && height !== "auto") style.minHeight = height;
    return style;
  },

  getFooterStyle: (isDark: boolean) => {
    const { settings } = get();
    const style: React.CSSProperties = {};
    const bgColor = isDark ? settings.footer_bg_color_dark : settings.footer_bg_color_light;
    const bgImage = isDark ? settings.footer_bg_image_dark : settings.footer_bg_image_light;
    const alignment = isDark
      ? settings.footer_image_alignment_dark
      : settings.footer_image_alignment_light;
    const height = settings.footer_height;
    if (bgColor) style.backgroundColor = bgColor;
    if (bgImage) {
      style.backgroundImage = `url(${bgImage})`;
      style.backgroundSize = "cover";
      style.backgroundPosition = `${alignment ?? "left"} center`;
    }
    if (height && height !== "auto") style.minHeight = height;
    return style;
  },

  getBodyStyle: (isDark: boolean) => {
    const { settings } = get();
    const from = isDark ? settings.body_bg_color_dark : settings.body_bg_color_light;
    const to = isDark ? settings.body_bg_gradient_to_dark : settings.body_bg_gradient_to_light;
    const dir = isDark
      ? settings.body_bg_gradient_direction_dark
      : settings.body_bg_gradient_direction_light;
    const mid = isDark
      ? settings.body_bg_gradient_midpoint_dark
      : settings.body_bg_gradient_midpoint_light;

    if (!from) return {};
    if (to) {
      return {
        background: `linear-gradient(${dir ?? "to bottom"}, ${from} ${mid ? mid + "%" : ""}, ${to})`,
      };
    }
    return { backgroundColor: from };
  },

  hasBodyCustomBg: (isDark: boolean) => {
    const { settings } = get();
    const from = isDark ? settings.body_bg_color_dark : settings.body_bg_color_light;
    return !!from;
  },

  hasHeaderCustomBg: (isDark: boolean) => {
    const { settings } = get();
    const bgColor = isDark ? settings.header_bg_color_dark : settings.header_bg_color_light;
    const bgImage = isDark ? settings.header_bg_image_dark : settings.header_bg_image_light;
    return !!(bgColor ?? bgImage);
  },

  hasFooterCustomBg: (isDark: boolean) => {
    const { settings } = get();
    const bgColor = isDark ? settings.footer_bg_color_dark : settings.footer_bg_color_light;
    const bgImage = isDark ? settings.footer_bg_image_dark : settings.footer_bg_image_light;
    return !!(bgColor ?? bgImage);
  },

  getCurrentFont: () => {
    return get().settings.font_family ?? "system";
  },
}));
