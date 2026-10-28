import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { ToastService } from '../../../core/services/toast.service';
import { safeReturnUrl } from '../../../core/utils/safe-redirect';

@Component({
  selector: 'app-login',
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './login.html',
  styleUrl: './login.css',
})
export class Login {
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly toast = inject(ToastService);

  // Where to go after logging in (set by the auth guard and the "log in to claim" links).
  readonly returnUrl = safeReturnUrl(this.route.snapshot.queryParamMap.get('returnUrl'));

  emailOrUsername = '';
  password = '';
  showPassword = signal(false);
  isLoading = signal(false);
  errorMessage = signal('');

  constructor() {
    // The auth interceptor sends people here with ?expired=1 when their session ran out.
    if (this.route.snapshot.queryParamMap.get('expired')) {
      this.errorMessage.set('Your session has expired. Please log in again.');
    }
  }

  togglePassword() {
    this.showPassword.update(v => !v);
  }

  async onSubmit() {
    this.errorMessage.set('');

    if (!this.emailOrUsername.trim() || !this.password) {
      this.errorMessage.set('Please fill in all fields.');
      return;
    }

    this.isLoading.set(true);

    this.authService.login({
      emailOrUsername: this.emailOrUsername.trim(),
      password: this.password,
    }).subscribe({
      next: (res) => {
        this.toast.success(`Welcome back, ${res.user.fullName.split(' ')[0]}!`);
        this.router.navigateByUrl(this.returnUrl ?? '/home');
      },
      error: (err) => {
        const msg = err?.error?.message || 'Login failed. Please try again.';
        this.errorMessage.set(msg);
        this.isLoading.set(false);
      },
    });
  }
}