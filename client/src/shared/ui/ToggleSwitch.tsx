interface ToggleSwitchProps {
  checked: boolean;
  onToggle: () => void;
  label?: string;
  size?: "sm" | "md";
}

/**
 * Reusable toggle switch component with built-in accessibility.
 * - sm: h-5 w-9 track, h-4 w-4 thumb (used in gradient toggles)
 * - md: h-6 w-11 track, h-5 w-5 thumb (default)
 */
export function ToggleSwitch({ checked, onToggle, label, size = "md" }: ToggleSwitchProps) {
  const isMd = size === "md";

  return (
    <button
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={onToggle}
      className={`relative rounded-full transition-colors ${
        checked ? "bg-[var(--color-primary)]" : "bg-[var(--color-border)]"
      } ${isMd ? "h-6 w-11" : "h-5 w-9"}`}
    >
      <span
        className={`absolute top-0.5 rounded-full bg-white transition-transform ${
          isMd
            ? `h-5 w-5 ${checked ? "left-[22px]" : "left-0.5"}`
            : `h-4 w-4 ${checked ? "left-[18px]" : "left-0.5"}`
        }`}
      />
    </button>
  );
}
