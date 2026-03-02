import { useState, useRef, useCallback, lazy, Suspense } from "react";
import { useClickOutside } from "@/shared/hooks/useClickOutside";

const HexColorPicker = lazy(() =>
  import("react-colorful").then((m) => ({ default: m.HexColorPicker })),
);

interface ColorPickerProps {
  value: string;
  onChange: (color: string) => void;
}

export function ColorPicker({ value, onChange }: ColorPickerProps) {
  const [open, setOpen] = useState(false);
  // Single wrapper ref covers both the swatch button and popover
  const wrapperRef = useRef<HTMLDivElement>(null);

  const close = useCallback(() => {
    setOpen(false);
  }, []);
  useClickOutside(wrapperRef, close, open);

  return (
    <div className="relative" ref={wrapperRef}>
      <button
        type="button"
        onClick={() => {
          setOpen(!open);
        }}
        className="h-8 w-8 shrink-0 cursor-pointer rounded border border-[var(--color-border)] transition-shadow hover:ring-2 hover:ring-[var(--color-primary)]/40"
        style={{ backgroundColor: value || "#ffffff" }}
        aria-label="Pick color"
      />
      {open && (
        <div className="absolute top-10 left-0 z-50 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-3 shadow-lg">
          <Suspense
            fallback={
              <div className="h-[200px] w-[200px] animate-pulse rounded-md bg-[var(--color-background)]" />
            }
          >
            <HexColorPicker color={value || "#ffffff"} onChange={onChange} />
          </Suspense>
        </div>
      )}
    </div>
  );
}
