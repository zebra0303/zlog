import { useToast } from "./useToast";
import { CheckCircle, AlertTriangle, Info, X } from "lucide-react";
import { cn } from "../lib/cn";

export function ToastContainer() {
  const { toasts, removeToast } = useToast();

  if (toasts.length === 0) return null;

  return (
    <div
      aria-live="assertive"
      className="pointer-events-none fixed inset-0 z-[200] flex flex-col items-center justify-end gap-2 px-4 py-6 sm:items-end sm:justify-end"
    >
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={cn(
            "bg-surface animate-in slide-in-from-bottom-5 sm:slide-in-from-right-5 pointer-events-auto flex w-full max-w-sm items-center gap-3 overflow-hidden rounded-lg border p-4 shadow-lg transition-all",
            toast.type === "success" && "border-success/30",
            toast.type === "error" && "border-destructive/30",
            toast.type === "info" && "border-primary/30",
          )}
          role="alert"
        >
          {toast.type === "success" && <CheckCircle className="text-success h-5 w-5 shrink-0" />}
          {toast.type === "error" && (
            <AlertTriangle className="text-destructive h-5 w-5 shrink-0" />
          )}
          {toast.type === "info" && <Info className="text-primary h-5 w-5 shrink-0" />}
          <p className="text-text flex-1 text-sm font-medium">{toast.message}</p>
          <button
            type="button"
            className="text-text-secondary hover:text-text focus:ring-primary shrink-0 rounded-md focus:ring-2 focus:outline-none"
            onClick={() => {
              removeToast(toast.id);
            }}
          >
            <span className="sr-only">Close</span>
            <X className="h-4 w-4" />
          </button>
        </div>
      ))}
    </div>
  );
}
