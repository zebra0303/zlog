import { create } from "zustand";

interface ConfirmState {
  isOpen: boolean;
  message: string;
  resolve: ((value: boolean) => void) | null;
  confirm: (message: string) => Promise<boolean>;
  onConfirm: () => void;
  onCancel: () => void;
}

export const useConfirm = create<ConfirmState>((set, get) => ({
  isOpen: false,
  message: "",
  resolve: null,
  confirm: (message: string) => {
    return new Promise((resolve) => {
      set({ isOpen: true, message, resolve });
    });
  },
  onConfirm: () => {
    const { resolve } = get();
    if (resolve) resolve(true);
    set({ isOpen: false, resolve: null });
  },
  onCancel: () => {
    const { resolve } = get();
    if (resolve) resolve(false);
    set({ isOpen: false, resolve: null });
  },
}));
