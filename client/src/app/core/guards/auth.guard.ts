import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { filter, map, switchMap, take, of } from 'rxjs';

export const authGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  // If session is already checked (e.g. navigating within the app), decide immediately
  if (authService.sessionChecked()) {
    return authService.isLoggedIn()
      ? true
      : router.createUrlTree(['/login']);
  }

  // Session not yet checked — wait for restoreSession() to complete, then decide
  return authService.restoreSession().pipe(
    take(1),
    map(() => {
      if (authService.isLoggedIn()) {
        return true;
      }
      return router.createUrlTree(['/login']);
    })
  );
};