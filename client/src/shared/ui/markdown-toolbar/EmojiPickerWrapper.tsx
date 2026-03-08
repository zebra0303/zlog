import { useRef, useEffect, lazy, Suspense } from "react";
import { SmilePlus } from "lucide-react";
import type { EmojiClickData, Theme } from "emoji-picker-react";
import { useClickOutside } from "@/shared/hooks/useClickOutside";
import { useI18n } from "../../i18n";
import { usePopoverAlignment } from "../../hooks/usePopoverAlignment";
import { useThemeStore } from "@/features/toggle-theme/model/store";

const EmojiPicker = lazy(() => import("emoji-picker-react"));

interface EmojiPickerWrapperProps {
  isOpen: boolean;
  onToggle: () => void;
  onClose: () => void;
  applyInsert: (text: string) => void;
}

export function EmojiPickerWrapper({
  isOpen,
  onToggle,
  onClose,
  applyInsert,
}: EmojiPickerWrapperProps) {
  const { t } = useI18n();
  const { isDark } = useThemeStore();
  const { alignPopover } = usePopoverAlignment();
  const emojiRef = useRef<HTMLDivElement>(null);
  const emojiPopoverRef = useRef<HTMLDivElement>(null);

  useClickOutside(emojiRef, onClose, isOpen);

  useEffect(() => {
    if (isOpen) {
      alignPopover(emojiPopoverRef.current, emojiRef.current);
    }
  }, [isOpen, alignPopover]);

  const onEmojiClick = (emojiData: EmojiClickData) => {
    applyInsert(emojiData.emoji);
    onClose();
  };

  return (
    <div ref={emojiRef} className="relative">
      <button
        type="button"
        title={t("toolbar_emoji")}
        aria-label={t("toolbar_emoji")}
        aria-expanded={isOpen}
        aria-haspopup="true"
        onClick={onToggle}
        className="text-text-secondary hover:text-text hover:bg-background rounded p-1.5 transition-colors"
      >
        <SmilePlus className="h-4 w-4" />
      </button>
      {isOpen && (
        <div ref={emojiPopoverRef} className="absolute top-full z-50 mt-1 shadow-lg">
          <Suspense
            fallback={<div className="bg-surface text-text-secondary p-4 text-sm">Loading...</div>}
          >
            <EmojiPicker
              onEmojiClick={onEmojiClick}
              theme={(isDark ? "dark" : "light") as Theme}
              lazyLoadEmojis={true}
              searchDisabled={true}
              skinTonesDisabled={true}
            />
          </Suspense>
        </div>
      )}
    </div>
  );
}
