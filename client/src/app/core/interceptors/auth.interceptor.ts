import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { AuthService } from '../services/auth.service';

// Calls where a 401 just means "wrong credentials / no session", not "your session expired".
const SESSION_ENDPOINTS = ['/auth/login', '/auth/register', '/auth/me'];

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);
  const router = inject(Router);
  const token = authService.getToken();

  const request = token
    ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } })
    : req;

  return next(request).pipe(
    catchError((error: unknown) => {
      const isSessionCall = SESSION_ENDPOINTS.some((path) => req.url.includes(path));

      // A token was sent and the server rejected it: it expired or the account is gone.
      // Sign out and send the user to log in again instead of failing silently on every click.
      if (
        error instanceof HttpErrorResponse &&
        error.status === 401 &&
        token &&
        !isSessionCall &&
        authService.isLoggedIn()
      ) {
        authService.logout();
        router.navigate(['/login'], { queryParams: { expired: '1' } });
      }

      return throwError(() => error);
    })
  );
};
