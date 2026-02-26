import { useState, useRef, useEffect, useCallback } from "react";
import { HexColorPicker } from "react-colorful";

interface ColorPickerProps {
  value: string;
  onChange: (color: string) => void;
}

export function ColorPicker({ value, onChange }: ColorPickerProps) {
  const [open, setOpen] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);
  const swatchRef = useRef<HTMLButtonElement>(null);

  const handleClickOutside = useCallback((e: MouseEvent) => {
    if (
      popoverRef.current &&
      !popoverRef.current.contains(e.target as Node) &&
      swatchRef.current &&
      !swatchRef.current.contains(e.target as Node)
    ) {
      setOpen(false);
    }
  }, []);

  useEffect(() => {
    if (open) {
      document.addEventListener("click", handleClickOutside);
      return () => {
        document.removeEventListener("click", handleClickOutside);
      };
    }
  }, [open, handleClickOutside]);

  return (
    <div className="relative">
      <button
        ref={swatchRef}
        type="button"
        onClick={() => {
          setOpen(!open);
        }}
        className="h-8 w-8 shrink-0 cursor-pointer rounded border border-[var(--color-border)] transition-shadow hover:ring-2 hover:ring-[var(--color-primary)]/40"
        style={{ backgroundColor: value || "#ffffff" }}
        aria-label="Pick color"
      />
      {open && (
        <div
          ref={popoverRef}
          className="absolute top-10 left-0 z-50 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-3 shadow-lg"
        >
          <HexColorPicker color={value || "#ffffff"} onChange={onChange} />
        </div>
      )}
    </div>
  );
}
