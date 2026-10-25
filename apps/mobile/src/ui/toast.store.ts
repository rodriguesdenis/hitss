import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';

export type ToastTone = 'info' | 'error';

export interface ToastAction {
  label: string;
  onPress: () => void;
}

export interface ToastInput {
  message: string;
  tone?: ToastTone;
  action?: ToastAction;
}

export interface Toast extends ToastInput {
  id: number;
}

interface ToastState {
  current?: Toast;
  show: (toast: ToastInput) => number;
  hide: (id?: number) => void;
}

let nextId = 1;

export const useToastStore = create<ToastState>()(
  immer((set) => ({
    current: undefined,
    show: (toast) => {
      const id = nextId++;
      set((state) => {
        state.current = { ...toast, id };
      });
      return id;
    },
    hide: (id) =>
      set((state) => {
        if (id === undefined || state.current?.id === id) {
          state.current = undefined;
        }
      }),
  })),
);

export function showToast(toast: ToastInput): number {
  return useToastStore.getState().show(toast);
}

export function hideToast(id?: number): void {
  useToastStore.getState().hide(id);
}
