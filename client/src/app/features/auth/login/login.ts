import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-login',
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './login.html',
  styleUrl: './login.css',
})
export class Login {
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  emailOrUsername = '';
  password = '';
  rememberMe = false;
  showPassword = signal(false);
  isLoading = signal(false);
  errorMessage = signal('');

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
      next: () => {
        this.router.navigate(['/home']);
      },
      error: (err) => {
        const msg = err?.error?.message || 'Login failed. Please try again.';
        this.errorMessage.set(msg);
        this.isLoading.set(false);
      },
    });
  }
}