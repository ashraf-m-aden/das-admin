import { Injectable, signal } from '@angular/core';
import { Toast, ToastKind } from './toast.model';

@Injectable({ providedIn: 'root' })
export class ToastService {
  private static readonly DEFAULT_DURATION_MS = 4000;

  private sequence = 0;
  private readonly _toasts = signal<Toast[]>([]);
  readonly toasts = this._toasts.asReadonly();

  success(messageKey: string, params?: Record<string, unknown>): void {
    this.show('success', messageKey, params);
  }

  error(messageKey: string, params?: Record<string, unknown>): void {
    this.show('error', messageKey, params);
  }

  info(messageKey: string, params?: Record<string, unknown>): void {
    this.show('info', messageKey, params);
  }

  dismiss(id: number): void {
    this._toasts.update((list) => list.filter((t) => t.id !== id));
  }

  private show(kind: ToastKind, messageKey: string, params?: Record<string, unknown>): void {
    const id = ++this.sequence;
    this._toasts.update((list) => [...list, { id, kind, messageKey, params }]);
    setTimeout(() => this.dismiss(id), ToastService.DEFAULT_DURATION_MS);
  }
}
