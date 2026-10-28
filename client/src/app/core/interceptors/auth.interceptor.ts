import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { AuthService } from '../services/auth.service';
import { ToastService } from '../services/toast.service';

// Calls where a 401 just means "wrong credentials / no session", not "your session expired".
const SESSION_ENDPOINTS = ['/auth/login', '/auth/register', '/auth/me'];

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);
  const router = inject(Router);
  const toast = inject(ToastService);
  const token = authService.getToken();

  const request = token
    ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } })
    : req;

  return next(request).pipe(
    catchError((error: unknown) => {
      if (error instanceof HttpErrorResponse) {
        const isSessionCall = SESSION_ENDPOINTS.some((path) => req.url.includes(path));

        // The server marks genuine session failures with code "invalid_session". Other 401s (such
        // as a wrong current password) must not sign the user out.
        const sessionExpired = error.status === 401 && error.error?.code === 'invalid_session';

        if (sessionExpired && token && authService.isLoggedIn()) {
          // A token was sent and the server rejected it: it expired or the account is gone.
          // Sign out and send the user to log in again instead of failing silently on every click.
          authService.logout();
          router.navigate(['/login'], { queryParams: { expired: '1' } });
        } else if (error.status === 0) {
          // No response at all: offline, server down, or blocked.
          toast.error("Can't reach the server. Check your internet connection and try again.");
        } else if (error.status === 429 && !isSessionCall) {
          toast.error(error.error?.message || 'Too many requests. Please wait a moment and try again.');
        }
      }

      return throwError(() => error);
    })
  );
};
