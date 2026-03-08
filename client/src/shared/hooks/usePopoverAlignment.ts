import { useCallback } from "react";

export function usePopoverAlignment() {
  const alignPopover = useCallback(
    (popover: HTMLDivElement | null, wrapper: HTMLDivElement | null) => {
      if (!popover || !wrapper) return;
      // Reset to natural position before measuring
      popover.style.left = "auto";
      popover.style.right = "auto";
      requestAnimationFrame(() => {
        const wrapperRect = wrapper.getBoundingClientRect();
        const popoverWidth = popover.offsetWidth;
        const viewportWidth = document.documentElement.clientWidth;
        const gap = 8; // minimum distance from screen edge
        // Default: align left edge of popover with left edge of wrapper
        let left = 0;
        const popoverRight = wrapperRect.left + left + popoverWidth;
        // If overflows right, shift left
        if (popoverRight > viewportWidth - gap) {
          left = viewportWidth - gap - popoverWidth - wrapperRect.left;
        }
        // If overflows left after shift, clamp to left edge
        if (wrapperRect.left + left < gap) {
          left = gap - wrapperRect.left;
        }
        popover.style.left = `${left}px`;
      });
    },
    [],
  );

  return { alignPopover };
}
