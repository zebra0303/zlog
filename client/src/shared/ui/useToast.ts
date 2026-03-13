import { createToastStore, type Toast, type ToastType } from "@zebra/core/client";

export type { Toast, ToastType };

// Project-specific singleton instance
export const useToast = createToastStore();
