import { useState, useRef, useEffect, lazy, Suspense } from "react";
import { Palette, Copy, Check } from "lucide-react";
import { useClickOutside } from "@/shared/hooks/useClickOutside";
import { useI18n } from "@/shared/i18n";
import { usePopoverAlignment } from "@/shared/hooks/usePopoverAlignment";
import { PRESET_COLORS_DARK, PRESET_COLORS_LIGHT } from "@/shared/lib/markdown-toolbar-utils";

const HexColorPicker = lazy(() =>
  import("react-colorful").then((m) => ({ default: m.HexColorPicker })),
);

interface ColorPickerProps {
  isOpen: boolean;
  onToggle: () => void;
  onClose: () => void;
  applyWrap: (prefix: string, suffix: string, placeholder: string) => void;
}

export function ColorPicker({ isOpen, onToggle, onClose, applyWrap }: ColorPickerProps) {
  const { t } = useI18n();
  const { alignPopover } = usePopoverAlignment();
  const colorRef = useRef<HTMLDivElement>(null);
  const colorPopoverRef = useRef<HTMLDivElement>(null);

  const [colorMode, setColorMode] = useState<"text" | "bg">("text");
  const [customColor, setCustomColor] = useState("#dc2626");
  const [colorCopied, setColorCopied] = useState(false);

  useClickOutside(colorRef, onClose, isOpen);

  useEffect(() => {
    if (isOpen) {
      alignPopover(colorPopoverRef.current, colorRef.current);
    }
  }, [isOpen, alignPopover]);

  const applyColor = (hex: string, mode: "text" | "bg") => {
    const style = mode === "text" ? `color:${hex}` : `background-color:${hex}`;
    applyWrap(`<span style="${style}">`, "</span>", "colored text");
    onClose();
  };

  const copyHex = async (hex: string) => {
    try {
      await navigator.clipboard.writeText(hex);
      setColorCopied(true);
      setTimeout(() => {
        setColorCopied(false);
      }, 1500);
    } catch {
      // Clipboard API may not be available
    }
  };

  return (
    <div ref={colorRef} className="relative">
      <button
        type="button"
        title={t("toolbar_color")}
        aria-label={t("toolbar_color")}
        aria-expanded={isOpen}
        aria-haspopup="true"
        onClick={onToggle}
        className="text-text-secondary hover:text-text hover:bg-background rounded p-1.5 transition-colors"
      >
        <Palette className="h-4 w-4" />
      </button>
      {isOpen && (
        <div
          ref={colorPopoverRef}
          className="border-border bg-surface absolute top-full z-50 mt-1 rounded-lg border p-3 shadow-lg"
          style={{ minWidth: 220 }}
        >
          {/* Mode toggle tabs */}
          <div className="mb-2 flex gap-1 rounded-md bg-[var(--color-background)] p-0.5">
            <button
              type="button"
              className={`flex-1 rounded px-2 py-1 text-xs font-medium transition-colors ${
                colorMode === "text"
                  ? "bg-[var(--color-surface)] text-[var(--color-text)] shadow-sm"
                  : "text-[var(--color-text-secondary)] hover:text-[var(--color-text)]"
              }`}
              onClick={() => {
                setColorMode("text");
              }}
            >
              {t("toolbar_color_text")}
            </button>
            <button
              type="button"
              className={`flex-1 rounded px-2 py-1 text-xs font-medium transition-colors ${
                colorMode === "bg"
                  ? "bg-[var(--color-surface)] text-[var(--color-text)] shadow-sm"
                  : "text-[var(--color-text-secondary)] hover:text-[var(--color-text)]"
              }`}
              onClick={() => {
                setColorMode("bg");
              }}
            >
              {t("toolbar_color_bg")}
            </button>
          </div>

          {/* Preset colors — dark row */}
          <div className="mb-1 flex gap-1">
            {PRESET_COLORS_DARK.map((hex) => (
              <button
                key={hex}
                type="button"
                className="h-5 w-5 rounded-sm border border-[var(--color-border)] transition-transform hover:scale-125"
                style={{ backgroundColor: hex }}
                aria-label={hex}
                onClick={() => {
                  applyColor(hex, colorMode);
                }}
              />
            ))}
          </div>
          {/* Preset colors — light row */}
          <div className="mb-2 flex gap-1">
            {PRESET_COLORS_LIGHT.map((hex) => (
              <button
                key={hex}
                type="button"
                className="h-5 w-5 rounded-sm border border-[var(--color-border)] transition-transform hover:scale-125"
                style={{ backgroundColor: hex }}
                aria-label={hex}
                onClick={() => {
                  applyColor(hex, colorMode);
                }}
              />
            ))}
          </div>

          {/* Custom color picker */}
          <div className="border-border border-t pt-2">
            <Suspense
              fallback={
                <div className="bg-surface text-text-secondary p-4 text-center text-sm">
                  Loading color picker...
                </div>
              }
            >
              <HexColorPicker
                color={customColor}
                onChange={setCustomColor}
                style={{ width: "100%" }}
              />
            </Suspense>
            <div className="mt-2 flex items-center gap-1.5">
              <button
                type="button"
                className="bg-primary hover:bg-primary/90 flex-1 rounded px-2 py-1 text-xs text-white transition-colors"
                onClick={() => {
                  applyColor(customColor, colorMode);
                }}
              >
                {colorMode === "text" ? t("toolbar_color_text") : t("toolbar_color_bg")}
              </button>
              <code className="text-text-secondary bg-background rounded px-1.5 py-1 text-xs">
                {customColor}
              </code>
              <button
                type="button"
                title={t("toolbar_color_copy")}
                aria-label={t("toolbar_color_copy")}
                className="text-text-secondary hover:text-text rounded p-1 transition-colors"
                onClick={() => copyHex(customColor)}
              >
                {colorCopied ? (
                  <Check className="h-3.5 w-3.5 text-green-500" />
                ) : (
                  <Copy className="h-3.5 w-3.5" />
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
