export type ToastKind = 'success' | 'error' | 'info';

export interface Toast {
  id: number;
  kind: ToastKind;
  messageKey: string;
  params?: Record<string, unknown>;
}
