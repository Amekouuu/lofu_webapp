import { Injectable, signal } from '@angular/core';

export type ToastKind = 'success' | 'error' | 'info';

export interface Toast {
  id: number;
  kind: ToastKind;
  message: string;
}

const MAX_VISIBLE = 4;

// Small app-wide notification queue. Anything can call toast.success('...') or toast.error('...'),
// and <app-toast-container> (mounted once in app.html) displays them.
@Injectable({ providedIn: 'root' })
export class ToastService {
  private nextId = 1;
  private readonly timers = new Map<number, ReturnType<typeof setTimeout>>();

  readonly toasts = signal<Toast[]>([]);

  success(message: string, durationMs = 4000): void {
    this.show('success', message, durationMs);
  }

  info(message: string, durationMs = 4000): void {
    this.show('info', message, durationMs);
  }

  // Errors stay a little longer: they usually need reading and acting on.
  error(message: string, durationMs = 7000): void {
    this.show('error', message, durationMs);
  }

  dismiss(id: number): void {
    clearTimeout(this.timers.get(id));
    this.timers.delete(id);
    this.toasts.update((list) => list.filter((toast) => toast.id !== id));
  }

  private show(kind: ToastKind, message: string, durationMs: number): void {
    // The same message is already on screen (for example a repeated "can't reach the server"
    // from polling): do not stack copies of it.
    if (this.toasts().some((toast) => toast.kind === kind && toast.message === message)) return;

    const id = this.nextId++;
    this.toasts.update((list) => [...list, { id, kind, message }].slice(-MAX_VISIBLE));
    this.timers.set(id, setTimeout(() => this.dismiss(id), durationMs));
  }
}
