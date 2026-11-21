import { Input, ColorPicker, ToggleSwitch } from "@/shared/ui";
import { useI18n } from "@/shared/i18n";
import { ImageUploadInput } from "./ImageUploadInput";

export const GRADIENT_DIRECTIONS = [
  { value: "to bottom", label: "↓ Top → Bottom" },
  { value: "to right", label: "→ Left → Right" },
  { value: "to bottom right", label: "↘ Top-Left → Bottom-Right" },
  { value: "to bottom left", label: "↙ Top-Right → Bottom-Left" },
];

export interface ColorFieldRowProps {
  label: string;
  colorKey: string;
  placeholder: string;
  settings: Record<string, string>;
  update: (k: string, v: string) => void;
}

export function ColorFieldRow({
  label,
  colorKey,
  placeholder,
  settings,
  update,
}: ColorFieldRowProps) {
  const { t } = useI18n();
  return (
    <div>
      <label className="mb-1 block text-xs text-[var(--color-text-secondary)]">{label}</label>
      <div className="flex items-center gap-2">
        <ColorPicker
          // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
          value={settings[colorKey] || placeholder}
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
            type="button"
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
}

interface ThemeModeBackgroundPanelProps {
  modeTitle: string;
  colorKey: string;
  colorPlaceholder: string;
  defaultGradientEnd: string;
  imageKey?: string;
  alignKey?: string;
  gradientToKey?: string;
  gradientDirKey?: string;
  gradientMidKey?: string;
  settings: Record<string, string>;
  update: (k: string, v: string) => void;
}

/**
 * Shared light/dark mode background editor (color, optional image + alignment, optional gradient + preview).
 * Extracted from ThemeCustomizer to eliminate duplicated light/dark JSX blocks.
 */
export function ThemeModeBackgroundPanel({
  modeTitle,
  colorKey,
  colorPlaceholder,
  defaultGradientEnd,
  imageKey,
  alignKey,
  gradientToKey,
  gradientDirKey,
  gradientMidKey,
  settings,
  update,
}: ThemeModeBackgroundPanelProps) {
  const { t } = useI18n();
  // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
  const showPreview = settings[colorKey] || (imageKey && settings[imageKey]);

  return (
    <div className="rounded-lg bg-[var(--color-background)] p-3">
      <div className="mb-2 flex items-center justify-between">
        <h4 className="text-sm font-medium text-[var(--color-text)]">{modeTitle}</h4>
        {gradientToKey !== undefined && gradientDirKey !== undefined && (
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-[var(--color-text-secondary)]">
              {t("admin_theme_gradient")}
            </span>
            <ToggleSwitch
              checked={!!settings[gradientToKey]}
              onToggle={() => {
                if (settings[gradientToKey]) {
                  update(gradientToKey, "");
                  update(gradientDirKey, "");
                  if (gradientMidKey) update(gradientMidKey, "");
                } else {
                  update(gradientToKey, defaultGradientEnd);
                  update(gradientDirKey, "to bottom");
                  if (gradientMidKey) update(gradientMidKey, "50");
                }
              }}
              size="sm"
            />
          </div>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <ColorFieldRow
          label={t("admin_theme_bg_color")}
          colorKey={colorKey}
          placeholder={colorPlaceholder}
          settings={settings}
          update={update}
        />

        {imageKey !== undefined && (
          <ImageUploadInput
            value={settings[imageKey] ?? ""}
            onChange={(url) => {
              update(imageKey, url);
            }}
            placeholder={t("admin_theme_image_placeholder")}
          />
        )}

        {imageKey && alignKey && settings[imageKey] && (
          <div>
            <label className="mb-1 block text-xs text-[var(--color-text-secondary)]">
              {t("admin_theme_alignment")}
            </label>
            <div className="flex overflow-hidden rounded-lg border border-[var(--color-border)]">
              {(["left", "center", "right"] as const).map((pos) => (
                <button
                  type="button"
                  key={pos}
                  onClick={() => {
                    update(alignKey, pos);
                  }}
                  className={`flex-1 py-1 text-[10px] font-bold uppercase transition-colors ${
                    (settings[alignKey] ?? "left") === pos
                      ? "bg-[var(--color-primary)] text-white"
                      : "text-[var(--color-text-secondary)] hover:bg-[var(--color-background)]"
                  }`}
                >
                  {t(`admin_theme_align_${pos}`)}
                </button>
              ))}
            </div>
          </div>
        )}

        {gradientToKey !== undefined && gradientDirKey !== undefined && settings[gradientToKey] && (
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
        )}

        {showPreview && (
          <div
            className="mt-1 h-12 rounded border border-[var(--color-border)]"
            style={
              gradientToKey && settings[gradientToKey]
                ? {
                    background: `linear-gradient(${settings[gradientDirKey ?? ""] ?? "to bottom"}, ${settings[colorKey]} ${gradientMidKey && settings[gradientMidKey] ? settings[gradientMidKey] + "%" : ""}, ${settings[gradientToKey]})`,
                  }
                : {
                    backgroundColor: settings[colorKey] ?? undefined,
                    backgroundImage:
                      imageKey && settings[imageKey] ? `url(${settings[imageKey]})` : undefined,
                    backgroundSize: "cover",
                    backgroundPosition: `${(alignKey && settings[alignKey]) ?? "left"} center`,
                  }
            }
          />
        )}
      </div>
    </div>
  );
}
