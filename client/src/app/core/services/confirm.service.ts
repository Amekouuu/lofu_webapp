import { Injectable, signal } from '@angular/core';

export interface ConfirmOptions {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  // 'danger' paints the confirm button red (deleting, discarding); 'primary' is the normal colour.
  tone?: 'primary' | 'danger';
}

export interface ConfirmRequest extends ConfirmOptions {
  resolve: (confirmed: boolean) => void;
}

// Promise-based replacement for window.confirm(), rendered by <app-confirm-dialog>:
//   if (!(await this.confirmService.confirm({ title: '...', message: '...' }))) return;
@Injectable({ providedIn: 'root' })
export class ConfirmService {
  readonly request = signal<ConfirmRequest | null>(null);

  confirm(options: ConfirmOptions): Promise<boolean> {
    // One dialog at a time: a newer request cancels an older one that is still open.
    this.request()?.resolve(false);

    return new Promise<boolean>((resolve) => {
      this.request.set({ ...options, resolve });
    });
  }

  answer(confirmed: boolean): void {
    const current = this.request();
    if (!current) return;

    this.request.set(null);
    current.resolve(confirmed);
  }
}
