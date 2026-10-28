import { inject } from '@angular/core';
import { CanDeactivateFn } from '@angular/router';
import { ConfirmService } from '../services/confirm.service';

// Implemented by pages that hold work the user would lose by navigating away.
export interface HasUnsavedChanges {
  hasUnsavedChanges(): boolean;
}

export const unsavedChangesGuard: CanDeactivateFn<HasUnsavedChanges> = (component) => {
  if (!component.hasUnsavedChanges()) {
    return true;
  }

  return inject(ConfirmService).confirm({
    title: 'Discard this post?',
    message: 'You have details that have not been posted yet. If you leave now, they will be lost.',
    confirmLabel: 'Discard',
    cancelLabel: 'Keep editing',
    tone: 'danger',
  });
};
