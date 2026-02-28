import { Palette } from "lucide-react";
import { Input, Card, CardContent, ColorPicker, ToggleSwitch } from "@/shared/ui";
import { useI18n } from "@/shared/i18n";
import { FONT_OPTIONS, applyFont } from "@/shared/lib/fonts";
import { ImageUploadInput } from "./ImageUploadInput";

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

const GRADIENT_DIRECTIONS = [
  { value: "to bottom", label: "↓ Top → Bottom" },
  { value: "to right", label: "→ Left → Right" },
  { value: "to bottom right", label: "↘ Top-Left → Bottom-Right" },
  { value: "to bottom left", label: "↙ Top-Right → Bottom-Left" },
];

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

  const renderColorRow = (colorKey: string, placeholder: string) => (
    <div>
      <label className="mb-1 block text-xs text-[var(--color-text-secondary)]">
        {t("admin_theme_bg_color")}
      </label>
      <div className="flex items-center gap-2">
        <ColorPicker
          value={settings[colorKey] ?? placeholder}
          onChange={(color) => {
            update(colorKey, color);
          }}
        />
        <Input
          placeholder={placeholder}
          value={settings[colorKey] ?? ""}
          onChange={(e) => {
            update(colorKey, e.target.value);
          }}
          className="flex-1 text-xs"
        />
        {settings[colorKey] && (
          <button
            onClick={() => {
              update(colorKey, "");
            }}
            className="text-xs text-[var(--color-destructive)] hover:underline"
          >
            {t("reset")}
          </button>
        )}
      </div>
    </div>
  );

  // Renders end color + direction fields (toggle is in the panel header)
  const renderGradientFields = (
    gradientToKey: string,
    gradientDirKey: string,
    gradientMidKey?: string,
  ) => {
    if (!settings[gradientToKey]) return null;
    return (
      <>
        <div>
          <label className="mb-1 block text-xs text-[var(--color-text-secondary)]">
            {t("admin_theme_gradient_end_color")}
          </label>
          <div className="flex items-center gap-2">
            <ColorPicker
              value={settings[gradientToKey] ?? ""}
              onChange={(color) => {
                update(gradientToKey, color);
              }}
            />
            <Input
              value={settings[gradientToKey] ?? ""}
              onChange={(e) => {
                update(gradientToKey, e.target.value);
              }}
              className="flex-1 text-xs"
            />
          </div>
        </div>
        <div>
          <label className="mb-1 block text-xs text-[var(--color-text-secondary)]">
            {t("admin_theme_gradient_direction")}
          </label>
          <select
            value={settings[gradientDirKey] ?? "to bottom"}
            onChange={(e) => {
              update(gradientDirKey, e.target.value);
            }}
            className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-1 text-xs text-[var(--color-text)]"
          >
            {GRADIENT_DIRECTIONS.map((d) => (
              <option key={d.value} value={d.value}>
                {d.label}
              </option>
            ))}
          </select>
        </div>
        {gradientMidKey && (
          <div>
            <div className="mb-1 flex items-center justify-between">
              <label className="text-xs text-[var(--color-text-secondary)]">
                {t("admin_theme_gradient_midpoint")}
              </label>
              <span className="text-xs font-medium text-[var(--color-text)]">
                {settings[gradientMidKey] ?? "50"}%
              </span>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              step="5"
              value={settings[gradientMidKey] ?? "50"}
              onChange={(e) => {
                update(gradientMidKey, e.target.value);
              }}
              className="h-2 w-full cursor-pointer appearance-none rounded-lg bg-[var(--color-border)] accent-[var(--color-primary)]"
            />
          </div>
        )}
      </>
    );
  };

  return (
    <Card>
      <CardContent className="pt-6">
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

        {/* Primary theme color */}
        <div className="mb-6 rounded-lg border border-[var(--color-border)] p-4">
          <h3 className="mb-1 font-medium text-[var(--color-text)]">
            {t("admin_theme_primary_color")}
          </h3>
          <p className="mb-3 text-xs text-[var(--color-text-secondary)]">
            {t("admin_theme_primary_color_desc")}
          </p>
          <div className="flex items-center gap-2">
            <ColorPicker
              // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
              value={settings.primary_color || "#6c5ce7"}
              onChange={(color) => {
                update("primary_color", color);
              }}
            />
            <Input
              placeholder="#6c5ce7"
              value={settings.primary_color ?? ""}
              onChange={(e) => {
                update("primary_color", e.target.value);
              }}
              className="flex-1 text-xs"
            />
            {settings.primary_color && (
              <button
                onClick={() => {
                  update("primary_color", "");
                }}
                className="text-xs text-[var(--color-destructive)] hover:underline"
              >
                {t("reset")}
              </button>
            )}
          </div>
          {settings.primary_color && (
            <div
              className="mt-2 h-8 rounded border border-[var(--color-border)]"
              style={{ backgroundColor: settings.primary_color }}
            />
          )}
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
            {/* Light Mode */}
            <div className="rounded-lg bg-[var(--color-background)] p-3">
              <h4 className="mb-2 text-sm font-medium text-[var(--color-text)]">
                {t("admin_theme_light_mode")}
              </h4>
              <div className="flex flex-col gap-2">
                <div>
                  <label className="mb-1 block text-xs text-[var(--color-text-secondary)]">
                    {t("admin_theme_surface_color")}
                  </label>
                  <div className="flex items-center gap-2">
                    <ColorPicker
                      value={settings.surface_color_light ?? "#ffffff"}
                      onChange={(color) => {
                        update("surface_color_light", color);
                      }}
                    />
                    <Input
                      placeholder="#ffffff"
                      value={settings.surface_color_light ?? ""}
                      onChange={(e) => {
                        update("surface_color_light", e.target.value);
                      }}
                      className="flex-1 text-xs"
                    />
                    {settings.surface_color_light && (
                      <button
                        onClick={() => {
                          update("surface_color_light", "");
                        }}
                        className="text-xs text-[var(--color-destructive)] hover:underline"
                      >
                        {t("reset")}
                      </button>
                    )}
                  </div>
                </div>
                <div>
                  <label className="mb-1 block text-xs text-[var(--color-text-secondary)]">
                    {t("admin_theme_text_color")}
                  </label>
                  <div className="flex items-center gap-2">
                    <ColorPicker
                      value={settings.text_color_light ?? "#1a1a2e"}
                      onChange={(color) => {
                        update("text_color_light", color);
                      }}
                    />
                    <Input
                      placeholder="#1a1a2e"
                      value={settings.text_color_light ?? ""}
                      onChange={(e) => {
                        update("text_color_light", e.target.value);
                      }}
                      className="flex-1 text-xs"
                    />
                    {settings.text_color_light && (
                      <button
                        onClick={() => {
                          update("text_color_light", "");
                        }}
                        className="text-xs text-[var(--color-destructive)] hover:underline"
                      >
                        {t("reset")}
                      </button>
                    )}
                  </div>
                </div>
                {(settings.surface_color_light ?? settings.text_color_light) && (
                  <div
                    className="mt-1 rounded border border-[var(--color-border)] p-3"
                    style={{
                      backgroundColor: settings.surface_color_light ?? "#ffffff",
                      color: settings.text_color_light ?? "#1a1a2e",
                    }}
                  >
                    <span className="text-xs font-medium">Aa</span>
                  </div>
                )}
              </div>
            </div>
            {/* Dark Mode */}
            <div className="rounded-lg bg-[var(--color-background)] p-3">
              <h4 className="mb-2 text-sm font-medium text-[var(--color-text)]">
                {t("admin_theme_dark_mode")}
              </h4>
              <div className="flex flex-col gap-2">
                <div>
                  <label className="mb-1 block text-xs text-[var(--color-text-secondary)]">
                    {t("admin_theme_surface_color")}
                  </label>
                  <div className="flex items-center gap-2">
                    <ColorPicker
                      value={settings.surface_color_dark ?? "#1a1a24"}
                      onChange={(color) => {
                        update("surface_color_dark", color);
                      }}
                    />
                    <Input
                      placeholder="#1a1a24"
                      value={settings.surface_color_dark ?? ""}
                      onChange={(e) => {
                        update("surface_color_dark", e.target.value);
                      }}
                      className="flex-1 text-xs"
                    />
                    {settings.surface_color_dark && (
                      <button
                        onClick={() => {
                          update("surface_color_dark", "");
                        }}
                        className="text-xs text-[var(--color-destructive)] hover:underline"
                      >
                        {t("reset")}
                      </button>
                    )}
                  </div>
                </div>
                <div>
                  <label className="mb-1 block text-xs text-[var(--color-text-secondary)]">
                    {t("admin_theme_text_color")}
                  </label>
                  <div className="flex items-center gap-2">
                    <ColorPicker
                      value={settings.text_color_dark ?? "#f0f0f5"}
                      onChange={(color) => {
                        update("text_color_dark", color);
                      }}
                    />
                    <Input
                      placeholder="#f0f0f5"
                      value={settings.text_color_dark ?? ""}
                      onChange={(e) => {
                        update("text_color_dark", e.target.value);
                      }}
                      className="flex-1 text-xs"
                    />
                    {settings.text_color_dark && (
                      <button
                        onClick={() => {
                          update("text_color_dark", "");
                        }}
                        className="text-xs text-[var(--color-destructive)] hover:underline"
                      >
                        {t("reset")}
                      </button>
                    )}
                  </div>
                </div>
                {(settings.surface_color_dark ?? settings.text_color_dark) && (
                  <div
                    className="mt-1 rounded border border-[var(--color-border)] p-3"
                    style={{
                      backgroundColor: settings.surface_color_dark ?? "#1a1a24",
                      color: settings.text_color_dark ?? "#f0f0f5",
                    }}
                  >
                    <span className="text-xs font-medium">Aa</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-6">
          {sections.map((section) => {
            const { heightKey } = section;
            const {
              lightColor,
              darkColor,
              lightImage,
              darkImage,
              lightAlign,
              darkAlign,
              lightGradientTo,
              darkGradientTo,
              lightGradientDir,
              darkGradientDir,
              lightGradientMid,
              darkGradientMid,
            } = section.keys;

            // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
            const showLightPreview = settings[lightColor] || (lightImage && settings[lightImage]);
            // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
            const showDarkPreview = settings[darkColor] || (darkImage && settings[darkImage]);

            const lAlign = lightAlign;
            const dAlign = darkAlign;

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
                  {/* Light Mode */}
                  <div className="rounded-lg bg-[var(--color-background)] p-3">
                    <div className="mb-2 flex items-center justify-between">
                      <h4 className="text-sm font-medium text-[var(--color-text)]">
                        {t("admin_theme_light_mode")}
                      </h4>
                      {/* Gradient toggle in header (body section only) */}
                      {lightGradientTo !== undefined && lightGradientDir !== undefined && (
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs text-[var(--color-text-secondary)]">
                            {t("admin_theme_gradient")}
                          </span>
                          <ToggleSwitch
                            checked={!!settings[lightGradientTo]}
                            onToggle={() => {
                              if (settings[lightGradientTo]) {
                                update(lightGradientTo, "");
                                update(lightGradientDir, "");
                                if (lightGradientMid) update(lightGradientMid, "");
                              } else {
                                update(lightGradientTo, "#000000");
                                update(lightGradientDir, "to bottom");
                                if (lightGradientMid) update(lightGradientMid, "50");
                              }
                            }}
                            size="sm"
                            label={t("admin_theme_gradient")}
                          />
                        </div>
                      )}
                    </div>
                    <div className="flex flex-col gap-2">
                      {renderColorRow(lightColor, "#ffffff")}
                      {lightImage !== undefined && (
                        <ImageUploadInput
                          value={settings[lightImage] ?? ""}
                          onChange={(url) => {
                            update(lightImage, url);
                          }}
                          placeholder={t("admin_theme_image_placeholder")}
                        />
                      )}
                      {lightImage && lAlign && settings[lightImage] && (
                        <div>
                          <label className="mb-1 block text-xs text-[var(--color-text-secondary)]">
                            {t("admin_theme_alignment")}
                          </label>
                          <div className="flex overflow-hidden rounded-lg border border-[var(--color-border)]">
                            {["left", "center", "right"].map((pos) => (
                              <button
                                key={pos}
                                onClick={() => {
                                  update(lAlign, pos);
                                }}
                                className={`flex-1 py-1 text-[10px] font-bold uppercase transition-colors ${
                                  (settings[lAlign] ?? "left") === pos
                                    ? "bg-[var(--color-primary)] text-white"
                                    : "text-[var(--color-text-secondary)] hover:bg-[var(--color-background)]"
                                }`}
                              >
                                {t(`admin_theme_align_${pos as "left" | "center" | "right"}`)}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                      {lightGradientTo !== undefined &&
                        lightGradientDir !== undefined &&
                        renderGradientFields(lightGradientTo, lightGradientDir, lightGradientMid)}
                      {/* Preview */}
                      {showLightPreview && (
                        <div
                          className="mt-1 h-12 rounded border border-[var(--color-border)]"
                          style={
                            lightGradientTo && settings[lightGradientTo]
                              ? {
                                  background: `linear-gradient(${settings[lightGradientDir ?? ""] ?? "to bottom"}, ${settings[lightColor]} ${lightGradientMid && settings[lightGradientMid] ? settings[lightGradientMid] + "%" : ""}, ${settings[lightGradientTo]})`,
                                }
                              : {
                                  backgroundColor: settings[lightColor] ?? undefined,
                                  backgroundImage:
                                    lightImage && settings[lightImage]
                                      ? `url(${settings[lightImage]})`
                                      : undefined,
                                  backgroundSize: "cover",
                                  backgroundPosition: `${(lAlign && settings[lAlign]) ?? "left"} center`,
                                }
                          }
                        />
                      )}
                    </div>
                  </div>
                  {/* Dark Mode */}
                  <div className="rounded-lg bg-[var(--color-background)] p-3">
                    <div className="mb-2 flex items-center justify-between">
                      <h4 className="text-sm font-medium text-[var(--color-text)]">
                        {t("admin_theme_dark_mode")}
                      </h4>
                      {/* Gradient toggle in header (body section only) */}
                      {darkGradientTo !== undefined && darkGradientDir !== undefined && (
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs text-[var(--color-text-secondary)]">
                            {t("admin_theme_gradient")}
                          </span>
                          <ToggleSwitch
                            checked={!!settings[darkGradientTo]}
                            onToggle={() => {
                              if (settings[darkGradientTo]) {
                                update(darkGradientTo, "");
                                update(darkGradientDir, "");
                                if (darkGradientMid) update(darkGradientMid, "");
                              } else {
                                update(darkGradientTo, "#ffffff");
                                update(darkGradientDir, "to bottom");
                                if (darkGradientMid) update(darkGradientMid, "50");
                              }
                            }}
                            size="sm"
                            label={t("admin_theme_gradient")}
                          />
                        </div>
                      )}
                    </div>
                    <div className="flex flex-col gap-2">
                      {renderColorRow(darkColor, "#1a1a24")}
                      {darkImage !== undefined && (
                        <ImageUploadInput
                          value={settings[darkImage] ?? ""}
                          onChange={(url) => {
                            update(darkImage, url);
                          }}
                          placeholder={t("admin_theme_image_placeholder")}
                        />
                      )}
                      {darkImage && dAlign && settings[darkImage] && (
                        <div>
                          <label className="mb-1 block text-xs text-[var(--color-text-secondary)]">
                            {t("admin_theme_alignment")}
                          </label>
                          <div className="flex overflow-hidden rounded-lg border border-[var(--color-border)]">
                            {["left", "center", "right"].map((pos) => (
                              <button
                                key={pos}
                                onClick={() => {
                                  update(dAlign, pos);
                                }}
                                className={`flex-1 py-1 text-[10px] font-bold uppercase transition-colors ${
                                  (settings[dAlign] ?? "left") === pos
                                    ? "bg-[var(--color-primary)] text-white"
                                    : "text-[var(--color-text-secondary)] hover:bg-[var(--color-background)]"
                                }`}
                              >
                                {t(`admin_theme_align_${pos as "left" | "center" | "right"}`)}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                      {darkGradientTo !== undefined &&
                        darkGradientDir !== undefined &&
                        renderGradientFields(darkGradientTo, darkGradientDir, darkGradientMid)}
                      {/* Preview */}
                      {showDarkPreview && (
                        <div
                          className="mt-1 h-12 rounded border border-[var(--color-border)]"
                          style={
                            darkGradientTo && settings[darkGradientTo]
                              ? {
                                  background: `linear-gradient(${settings[darkGradientDir ?? ""] ?? "to bottom"}, ${settings[darkColor]} ${darkGradientMid && settings[darkGradientMid] ? settings[darkGradientMid] + "%" : ""}, ${settings[darkGradientTo]})`,
                                }
                              : {
                                  backgroundColor: settings[darkColor] ?? undefined,
                                  backgroundImage:
                                    darkImage && settings[darkImage]
                                      ? `url(${settings[darkImage]})`
                                      : undefined,
                                  backgroundSize: "cover",
                                  backgroundPosition: `${(dAlign && settings[dAlign]) ?? "left"} center`,
                                }
                          }
                        />
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
