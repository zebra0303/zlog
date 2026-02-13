import { create } from "zustand";

interface ThemeState {
  isDark: boolean;
  toggle: () => void;
  setTheme: (isDark: boolean) => void;
  initTheme: () => void;
}

function applyTheme(isDark: boolean) { document.documentElement.classList.toggle("dark", isDark); }

export const useThemeStore = create<ThemeState>((set, get) => ({
  isDark: false,
  toggle: () => {
    const newValue = !get().isDark;
    set({ isDark: newValue }); applyTheme(newValue);
    localStorage.setItem("zlog_theme", newValue ? "dark" : "light");
  },
  setTheme: (isDark: boolean) => { set({ isDark }); applyTheme(isDark); },
  initTheme: () => {
    const stored = localStorage.getItem("zlog_theme");
    const isDark = stored ? stored === "dark" : window.matchMedia("(prefers-color-scheme: dark)").matches;
    set({ isDark }); applyTheme(isDark);
  },
}));
