import { useRef, useEffect } from "react";
import { Info } from "lucide-react";
import { useClickOutside } from "@/shared/hooks/useClickOutside";
import { useI18n } from "../../i18n";
import { usePopoverAlignment } from "../../hooks/usePopoverAlignment";

const calloutTypes = [
  { type: "NOTE", emoji: "\u2139\uFE0F", label: "Note" },
  { type: "TIP", emoji: "\uD83D\uDCA1", label: "Tip" },
  { type: "IMPORTANT", emoji: "\u2757", label: "Important" },
  { type: "WARNING", emoji: "\u26A0\uFE0F", label: "Warning" },
  { type: "CAUTION", emoji: "\uD83D\uDED1", label: "Caution" },
];

interface CalloutPickerProps {
  isOpen: boolean;
  onToggle: () => void;
  onClose: () => void;
  applyInsert: (text: string) => void;
}

export function CalloutPicker({ isOpen, onToggle, onClose, applyInsert }: CalloutPickerProps) {
  const { t } = useI18n();
  const { alignPopover } = usePopoverAlignment();
  const calloutRef = useRef<HTMLDivElement>(null);
  const calloutPopoverRef = useRef<HTMLDivElement>(null);

  useClickOutside(calloutRef, onClose, isOpen);

  useEffect(() => {
    if (isOpen) {
      alignPopover(calloutPopoverRef.current, calloutRef.current);
    }
  }, [isOpen, alignPopover]);

  return (
    <div ref={calloutRef} className="relative">
      <button
        type="button"
        title={t("toolbar_callout")}
        aria-label={t("toolbar_callout")}
        aria-expanded={isOpen}
        aria-haspopup="true"
        onClick={onToggle}
        className="text-text-secondary hover:text-text hover:bg-background rounded p-1.5 transition-colors"
      >
        <Info className="h-4 w-4" />
      </button>
      {isOpen && (
        <div
          ref={calloutPopoverRef}
          className="border-border bg-surface absolute top-full z-50 mt-1 min-w-40 rounded-lg border py-1 shadow-lg"
        >
          {calloutTypes.map((ct) => (
            <button
              key={ct.type}
              type="button"
              className="text-text hover:bg-background flex w-full items-center gap-2 px-3 py-1.5 text-sm transition-colors"
              onClick={() => {
                applyInsert(`> [!${ct.type}]\n> `);
                onClose();
              }}
            >
              <span className="w-5 text-center">{ct.emoji}</span>
              <span>{ct.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
