import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
}

export function Modal({ isOpen, onClose, title, children }: ModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (isOpen) {
      dialog.showModal();
    } else {
      dialog.close();
    }
  }, [isOpen]);

  // Handle escape key automatically by <dialog>
  // Handle click outside to close
  const handleBackdropClick = (e: React.MouseEvent<HTMLDialogElement>) => {
    if (e.target === dialogRef.current) {
      onClose();
    }
  };

  if (!isOpen) return null;

  return createPortal(
    <dialog
      ref={dialogRef}
      className="open:animate-in open:fade-in-0 open:zoom-in-95 backdrop:open:animate-in backdrop:open:fade-in-0 fixed inset-0 z-50 flex max-h-[85vh] w-full max-w-lg flex-col gap-4 rounded-lg bg-[var(--color-surface)] p-6 shadow-xl backdrop:bg-black/50"
      onClose={onClose}
      onClick={handleBackdropClick}
    >
      <div className="flex items-center justify-between">
        {title && <h2 className="text-lg font-semibold text-[var(--color-text)]">{title}</h2>}
        <button
          onClick={onClose}
          className="rounded-sm opacity-70 ring-offset-[var(--color-background)] transition-opacity hover:opacity-100 focus:ring-2 focus:ring-[var(--color-primary)] focus:ring-offset-2 focus:outline-none disabled:pointer-events-none"
        >
          <X className="h-4 w-4 text-[var(--color-text)]" />
          <span className="sr-only">Close</span>
        </button>
      </div>
      <div className="overflow-y-auto text-[var(--color-text)]">{children}</div>
    </dialog>,
    document.body,
  );
}
