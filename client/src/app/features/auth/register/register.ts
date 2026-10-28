import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { ToastService } from '../../../core/services/toast.service';
import { safeReturnUrl } from '../../../core/utils/safe-redirect';
import { isValidEmail, passwordError, usernameError } from '../../../core/utils/validators';

@Component({
  selector: 'app-register',
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './register.html',
  styleUrl: './register.css',
})
export class Register {
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly toast = inject(ToastService);

  // Where to go after signing up (carried over from the login page).
  readonly returnUrl = safeReturnUrl(this.route.snapshot.queryParamMap.get('returnUrl'));

  firstName = '';
  lastName = '';
  email = '';
  username = '';
  password = '';
  confirmPassword = '';

  showPassword = signal(false);
  showConfirmPassword = signal(false);
  isLoading = signal(false);
  errorMessage = signal('');
  // One message per field, keyed by the input's id
  fieldErrors = signal<Record<string, string>>({});

  togglePassword() {
    this.showPassword.update(v => !v);
  }

  toggleConfirmPassword() {
    this.showConfirmPassword.update(v => !v);
  }

  clearFieldError(field: string) {
    if (!this.fieldErrors()[field]) return;

    const remaining = { ...this.fieldErrors() };
    delete remaining[field];
    this.fieldErrors.set(remaining);
  }

  private validate(): Record<string, string> {
    const errors: Record<string, string> = {};

    if (!this.firstName.trim()) errors['firstName'] = 'First name is required.';
    if (!this.lastName.trim()) errors['lastName'] = 'Last name is required.';

    if (!this.email.trim()) errors['email'] = 'Email is required.';
    else if (!isValidEmail(this.email)) errors['email'] = 'Please enter a valid email address.';

    const usernameProblem = usernameError(this.username.trim());
    if (usernameProblem) errors['username'] = usernameProblem;

    const passwordProblem = passwordError(this.password);
    if (passwordProblem) errors['password'] = passwordProblem;

    if (!this.confirmPassword) errors['confirmPassword'] = 'Please confirm your password.';
    else if (this.password !== this.confirmPassword) errors['confirmPassword'] = 'Passwords do not match.';

    return errors;
  }

  onSubmit() {
    this.errorMessage.set('');

    const errors = this.validate();
    this.fieldErrors.set(errors);

    const firstInvalid = Object.keys(errors)[0];
    if (firstInvalid) {
      // Move focus to the first problem so keyboard and screen-reader users land on it.
      setTimeout(() => document.getElementById(firstInvalid)?.focus());
      return;
    }

    this.isLoading.set(true);

    const fullName = `${this.firstName.trim()} ${this.lastName.trim()}`;

    this.authService.register({
      fullName,
      username: this.username.trim(),
      email: this.email.trim(),
      password: this.password,
    }).subscribe({
      next: (res) => {
        this.toast.success(`Account created. Welcome to LoFu, ${res.user.fullName.split(' ')[0]}!`);
        this.router.navigateByUrl(this.returnUrl ?? '/home');
      },
      error: (err) => {
        const message: string = err?.error?.message || 'Registration failed. Please try again.';

        // The server's "already taken" answers belong next to the field they are about.
        if (err?.status === 409 && /email/i.test(message)) {
          this.fieldErrors.set({ email: message });
        } else if (err?.status === 409 && /username/i.test(message)) {
          this.fieldErrors.set({ username: message });
        } else {
          this.errorMessage.set(message);
        }

        this.isLoading.set(false);
      },
    });
  }
}
