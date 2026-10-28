import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { map, take } from 'rxjs';
import { AuthService } from '../services/auth.service';

export const authGuard: CanActivateFn = (_route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  // Remember where the user was going, so login can send them back there.
  const toLogin = () =>
    router.createUrlTree(['/login'], { queryParams: { returnUrl: state.url } });

  // If session is already checked (e.g. navigating within the app), decide immediately
  if (authService.sessionChecked()) {
    return authService.isLoggedIn() ? true : toLogin();
  }

  // Session not yet checked — wait for restoreSession() to complete, then decide
  return authService.restoreSession().pipe(
    take(1),
    map(() => (authService.isLoggedIn() ? true : toLogin()))
  );
};
