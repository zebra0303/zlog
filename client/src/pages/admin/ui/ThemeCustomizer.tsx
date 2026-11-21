import { Palette } from "lucide-react";
import { Card, CardContent } from "@/shared/ui";
import { useI18n } from "@/shared/i18n";
import { FONT_OPTIONS, applyFont } from "@/shared/lib/fonts";
import { ColorFieldRow, ThemeModeBackgroundPanel } from "./ThemeColorSection";

interface ThemeSection {
  title: string;
  heightKey: string | null;
  keys: {
    lightColor: string;
    darkColor: string;
    lightImage?: string;
    darkImage?: string;
    lightAlign?: string;
    darkAlign?: string;
    lightGradientTo?: string;
    darkGradientTo?: string;
    lightGradientDir?: string;
    darkGradientDir?: string;
    lightGradientMid?: string;
    darkGradientMid?: string;
  };
}

export function ThemeCustomizer({
  settings,
  update,
}: {
  settings: Record<string, string>;
  update: (k: string, v: string) => void;
}) {
  const { t } = useI18n();

  const heightOptions = [
    { value: "auto", label: t("admin_theme_auto") },
    { value: "80px", label: "80px" },
    { value: "100px", label: "100px" },
    { value: "120px", label: "120px" },
    { value: "160px", label: "160px" },
    { value: "200px", label: "200px" },
    { value: "250px", label: "250px" },
  ];

  const sections: ThemeSection[] = [
    {
      title: t("admin_theme_header"),
      heightKey: "header_height",
      keys: {
        lightColor: "header_bg_color_light",
        darkColor: "header_bg_color_dark",
        lightImage: "header_bg_image_light",
        darkImage: "header_bg_image_dark",
        lightAlign: "header_image_alignment_light",
        darkAlign: "header_image_alignment_dark",
      },
    },
    {
      title: t("admin_theme_footer"),
      heightKey: "footer_height",
      keys: {
        lightColor: "footer_bg_color_light",
        darkColor: "footer_bg_color_dark",
        lightImage: "footer_bg_image_light",
        darkImage: "footer_bg_image_dark",
        lightAlign: "footer_image_alignment_light",
        darkAlign: "footer_image_alignment_dark",
      },
    },
    {
      title: t("admin_theme_body"),
      heightKey: null,
      keys: {
        lightColor: "body_bg_color_light",
        darkColor: "body_bg_color_dark",
        lightGradientTo: "body_bg_gradient_to_light",
        darkGradientTo: "body_bg_gradient_to_dark",
        lightGradientDir: "body_bg_gradient_direction_light",
        darkGradientDir: "body_bg_gradient_direction_dark",
        lightGradientMid: "body_bg_gradient_midpoint_light",
        darkGradientMid: "body_bg_gradient_midpoint_dark",
      },
    },
  ];

  const surfaceModes = [
    {
      title: t("admin_theme_light_mode"),
      surfaceKey: "surface_color_light",
      surfaceFallback: "#ffffff",
      textKey: "text_color_light",
      textFallback: "#1a1a2e",
    },
    {
      title: t("admin_theme_dark_mode"),
      surfaceKey: "surface_color_dark",
      surfaceFallback: "#1a1a24",
      textKey: "text_color_dark",
      textFallback: "#f0f0f5",
    },
  ];

  return (
    <Card>
      <CardContent className="p-8">
        <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-[var(--color-text)]">
          <Palette className="h-5 w-5" />
          {t("admin_theme_title")}
        </h2>
        <p className="mb-4 text-sm text-[var(--color-text-secondary)]">{t("admin_theme_desc")}</p>

        {/* Font Selection */}
        <div className="mb-6 rounded-lg border border-[var(--color-border)] p-4">
          <h3 className="mb-1 font-medium text-[var(--color-text)]">{t("admin_theme_font")}</h3>
          <div className="flex flex-col gap-2">
            <select
              value={settings.font_family ?? "system"}
              onChange={(e) => {
                const val = e.target.value;
                update("font_family", val);
                applyFont(val);
              }}
              className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-text)]"
            >
              {FONT_OPTIONS.map((font) => (
                <option key={font.value} value={font.value}>
                  {font.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Default Theme Mode Selection */}
        <div className="mb-6 rounded-lg border border-[var(--color-border)] p-4">
          <h3 className="mb-1 font-medium text-[var(--color-text)]">
            {t("admin_theme_default_mode")}
          </h3>
          <div className="flex flex-col gap-2">
            <select
              value={settings.default_theme ?? "system"}
              onChange={(e) => {
                update("default_theme", e.target.value);
              }}
              className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-text)]"
            >
              <option value="system">{t("admin_theme_default_mode_system")}</option>
              <option value="light">{t("admin_theme_default_mode_light")}</option>
              <option value="dark">{t("admin_theme_default_mode_dark")}</option>
            </select>
          </div>
        </div>

        {/* Primary & Accent Colors */}
        <div className="mb-6 rounded-lg border border-[var(--color-border)] p-4">
          <h3 className="mb-1 font-medium text-[var(--color-text)]">
            {t("admin_theme_primary_color")}
          </h3>
          <p className="mb-3 text-xs text-[var(--color-text-secondary)]">
            {t("admin_theme_primary_color_desc")}
          </p>
          <ColorFieldRow
            label={t("admin_theme_primary_color")}
            colorKey="primary_color"
            placeholder="#6c5ce7"
            settings={settings}
            update={update}
          />
        </div>

        <div className="mb-6 rounded-lg border border-[var(--color-border)] p-4">
          <h3 className="mb-1 font-medium text-[var(--color-text)]">
            {t("admin_theme_accent_color")}
          </h3>
          <p className="mb-3 text-xs text-[var(--color-text-secondary)]">
            {t("admin_theme_accent_color_desc")}
          </p>
          <ColorFieldRow
            label={t("admin_theme_accent_color")}
            colorKey="accent_color"
            placeholder="#ff6b6b"
            settings={settings}
            update={update}
          />
        </div>

        {/* Surface & Text Colors */}
        <div className="mb-6 rounded-lg border border-[var(--color-border)] p-4">
          <h3 className="mb-1 font-medium text-[var(--color-text)]">
            {t("admin_theme_surface_text")}
          </h3>
          <p className="mb-3 text-xs text-[var(--color-text-secondary)]">
            {t("admin_theme_surface_text_desc")}
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            {surfaceModes.map((mode) => (
              <div key={mode.surfaceKey} className="rounded-lg bg-[var(--color-background)] p-3">
                <h4 className="mb-2 text-sm font-medium text-[var(--color-text)]">{mode.title}</h4>
                <div className="flex flex-col gap-2">
                  <ColorFieldRow
                    label={t("admin_theme_surface_color")}
                    colorKey={mode.surfaceKey}
                    placeholder={mode.surfaceFallback}
                    settings={settings}
                    update={update}
                  />
                  <ColorFieldRow
                    label={t("admin_theme_text_color")}
                    colorKey={mode.textKey}
                    placeholder={mode.textFallback}
                    settings={settings}
                    update={update}
                  />
                  {(settings[mode.surfaceKey] ?? settings[mode.textKey]) && (
                    <div
                      className="mt-1 rounded border border-[var(--color-border)] p-3"
                      style={{
                        backgroundColor: settings[mode.surfaceKey] ?? mode.surfaceFallback,
                        color: settings[mode.textKey] ?? mode.textFallback,
                      }}
                    >
                      <span className="text-xs font-medium">Aa</span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Header, Footer, Body sections */}
        <div className="flex flex-col gap-8">
          {sections.map((section) => {
            const { heightKey, keys } = section;
            return (
              <div
                key={section.title}
                className="rounded-lg border border-[var(--color-border)] p-4"
              >
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="font-medium text-[var(--color-text)]">{section.title}</h3>
                  {heightKey !== null && (
                    <div className="flex items-center gap-2">
                      <label className="text-xs text-[var(--color-text-secondary)]">
                        {t("admin_theme_height")}
                      </label>
                      <select
                        value={settings[heightKey] ?? "auto"}
                        onChange={(e) => {
                          update(heightKey, e.target.value);
                        }}
                        className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-1 text-xs text-[var(--color-text)]"
                      >
                        {heightOptions.map((o) => (
                          <option key={o.value} value={o.value}>
                            {o.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <ThemeModeBackgroundPanel
                    modeTitle={t("admin_theme_light_mode")}
                    colorKey={keys.lightColor}
                    colorPlaceholder="#ffffff"
                    defaultGradientEnd="#000000"
                    imageKey={keys.lightImage}
                    alignKey={keys.lightAlign}
                    gradientToKey={keys.lightGradientTo}
                    gradientDirKey={keys.lightGradientDir}
                    gradientMidKey={keys.lightGradientMid}
                    settings={settings}
                    update={update}
                  />
                  <ThemeModeBackgroundPanel
                    modeTitle={t("admin_theme_dark_mode")}
                    colorKey={keys.darkColor}
                    colorPlaceholder="#1a1a24"
                    defaultGradientEnd="#ffffff"
                    imageKey={keys.darkImage}
                    alignKey={keys.darkAlign}
                    gradientToKey={keys.darkGradientTo}
                    gradientDirKey={keys.darkGradientDir}
                    gradientMidKey={keys.darkGradientMid}
                    settings={settings}
                    update={update}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
