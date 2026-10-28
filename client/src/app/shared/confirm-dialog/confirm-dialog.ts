import { Component, ElementRef, HostListener, effect, inject, viewChild } from '@angular/core';
import { ConfirmService } from '../../core/services/confirm.service';

@Component({
  selector: 'app-confirm-dialog',
  templateUrl: './confirm-dialog.html',
  styleUrl: './confirm-dialog.css',
})
export class ConfirmDialog {
  readonly confirmService = inject(ConfirmService);

  private readonly cancelButton = viewChild<ElementRef<HTMLButtonElement>>('cancelButton');
  private previouslyFocused: HTMLElement | null = null;

  constructor() {
    effect(() => {
      const isOpen = this.confirmService.request() !== null;

      if (isOpen) {
        this.previouslyFocused =
          document.activeElement instanceof HTMLElement ? document.activeElement : null;
        document.body.style.overflow = 'hidden';
        // Wait for the dialog to render, then start on the safe choice (Cancel).
        setTimeout(() => this.cancelButton()?.nativeElement.focus());
      } else {
        document.body.style.overflow = '';
        this.previouslyFocused?.focus();
        this.previouslyFocused = null;
      }
    });
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.confirmService.request()) {
      this.confirmService.answer(false);
    }
  }

  // Keep Tab / Shift+Tab inside the dialog while it is open.
  onKeydown(event: KeyboardEvent): void {
    if (event.key !== 'Tab') return;

    const buttons = Array.from((event.currentTarget as HTMLElement).querySelectorAll('button'));
    if (buttons.length === 0) return;

    const first = buttons[0];
    const last = buttons[buttons.length - 1];

    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }
}
