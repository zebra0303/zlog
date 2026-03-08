import { useRef, useEffect, lazy, Suspense } from "react";
import { Sticker } from "lucide-react";
import { useClickOutside } from "@/shared/hooks/useClickOutside";
import { useI18n } from "@/shared/i18n";
import { usePopoverAlignment } from "@/shared/hooks/usePopoverAlignment";
import { useThemeStore } from "@/features/toggle-theme/model/store";

const StickerPicker = lazy(() => import("../StickerPicker"));
const giphyApiKey = (import.meta.env.VITE_GIPHY_API_KEY ?? "") as string;

interface StickerPickerWrapperProps {
  isOpen: boolean;
  onToggle: () => void;
  onClose: () => void;
  applyInsert: (text: string) => void;
}

export function StickerPickerWrapper({
  isOpen,
  onToggle,
  onClose,
  applyInsert,
}: StickerPickerWrapperProps) {
  const { t } = useI18n();
  const { isDark } = useThemeStore();
  const { alignPopover } = usePopoverAlignment();
  const stickerRef = useRef<HTMLDivElement>(null);
  const stickerPopoverRef = useRef<HTMLDivElement>(null);

  useClickOutside(stickerRef, onClose, isOpen);

  useEffect(() => {
    if (isOpen) {
      alignPopover(stickerPopoverRef.current, stickerRef.current);
    }
  }, [isOpen, alignPopover]);

  if (!giphyApiKey) return null;

  return (
    <div ref={stickerRef} className="relative">
      <button
        type="button"
        title={t("toolbar_sticker")}
        aria-label={t("toolbar_sticker")}
        aria-expanded={isOpen}
        aria-haspopup="true"
        onClick={onToggle}
        className="text-text-secondary hover:text-text hover:bg-background rounded p-1.5 transition-colors"
      >
        <Sticker className="h-4 w-4" />
      </button>
      {isOpen && (
        <div ref={stickerPopoverRef} className="absolute top-full z-50 mt-1">
          <Suspense
            fallback={
              <div className="border-border bg-surface rounded-lg border p-4 text-center text-xs shadow-lg">
                {t("loading")}
              </div>
            }
          >
            <StickerPicker
              apiKey={giphyApiKey}
              isDark={isDark}
              onSelect={(url) => {
                applyInsert(`![sticker](${url}?align=center&width=180)\n`);
                onClose();
              }}
            />
          </Suspense>
        </div>
      )}
    </div>
  );
}
