import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { map, take } from 'rxjs';
import { AuthService } from '../services/auth.service';

// For /login and /register: someone who is already signed in has no use for them.
export const guestGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  const decide = () => (authService.isLoggedIn() ? router.createUrlTree(['/home']) : true);

  if (authService.sessionChecked()) {
    return decide();
  }

  return authService.restoreSession().pipe(take(1), map(decide));
};
