import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, catchError, finalize, of, tap } from 'rxjs';
import { API_BASE_URL } from '../config/api.config';
import { AuthResponse, CurrentUserResponse } from '../models/auth.model';
import { User } from '../models/user.model';
import { StorageService } from './storage.service';

export interface RegisterPayload {
  fullName: string;
  username: string;
  email: string;
  password: string;
}

export interface LoginPayload {
  emailOrUsername: string;
  password: string;
}

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly storageService = inject(StorageService);

  private readonly currentUserSignal = signal<User | null>(null);
  private readonly loadingSignal = signal(false);
  private readonly sessionCheckedSignal = signal(false);

  readonly currentUser = computed(() => this.currentUserSignal());
  readonly isLoggedIn = computed(() => this.currentUserSignal() !== null);
  readonly isLoading = computed(() => this.loadingSignal());
  readonly sessionChecked = computed(() => this.sessionCheckedSignal());

  register(payload: RegisterPayload): Observable<AuthResponse> {
    this.loadingSignal.set(true);

    return this.http
      .post<AuthResponse>(`${API_BASE_URL}/auth/register`, payload)
      .pipe(
        tap((response) => {
          this.storageService.setToken(response.token);
          this.currentUserSignal.set(response.user);
        }),
        finalize(() => this.loadingSignal.set(false))
      );
  }

  login(payload: LoginPayload): Observable<AuthResponse> {
    this.loadingSignal.set(true);

    return this.http
      .post<AuthResponse>(`${API_BASE_URL}/auth/login`, payload)
      .pipe(
        tap((response) => {
          this.storageService.setToken(response.token);
          this.currentUserSignal.set(response.user);
        }),
        finalize(() => this.loadingSignal.set(false))
      );
  }

  restoreSession(): Observable<CurrentUserResponse | null> {
    const token = this.storageService.getToken();

    if (!token) {
      this.currentUserSignal.set(null);
      this.sessionCheckedSignal.set(true);
      return of(null);
    }

    return this.http.get<CurrentUserResponse>(`${API_BASE_URL}/auth/me`).pipe(
      tap((response) => {
        this.currentUserSignal.set(response.user);
        this.sessionCheckedSignal.set(true);
      }),
      catchError(() => {
        this.storageService.removeToken();
        this.currentUserSignal.set(null);
        this.sessionCheckedSignal.set(true);
        return of(null);
      })
    );
  }

  logout(): void {
    this.storageService.clear();
    this.currentUserSignal.set(null);
    this.sessionCheckedSignal.set(true);
  }

  getToken(): string | null {
    return this.storageService.getToken();
  }
}