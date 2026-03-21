import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { UserService } from '../../../core/services/user.service';

@Component({
  selector: 'app-settings',
  imports: [CommonModule, FormsModule],
  templateUrl: './settings.html',
  styleUrl: './settings.css',
})
export class Settings implements OnInit {
  private readonly authService = inject(AuthService);
  private readonly userService = inject(UserService);
  private readonly router = inject(Router);

  readonly currentUser = this.authService.currentUser;

  // ── Theme ─────────────────────────────────────
  currentTheme = signal<'light' | 'dark'>('light');

  // ── Privacy ───────────────────────────────────
  profileVisible = signal(true);
  showEmail      = signal(false);
  privacySaving  = signal(false);
  privacySuccess = signal('');
  privacyError   = signal('');

  // ── Delete Account ────────────────────────────
  deleteConfirmText = '';
  deleteLoading     = signal(false);
  deleteError       = signal('');
  showDeleteModal   = signal(false);

  ngOnInit() {
    // Restore saved theme
    const saved = localStorage.getItem('lofu-theme') as 'light' | 'dark' | null;
    if (saved) {
      this.currentTheme.set(saved);
      document.documentElement.setAttribute('data-theme', saved);
    }

    // Restore saved privacy prefs
    const privacyRaw = localStorage.getItem('lofu-privacy');
    if (privacyRaw) {
      try {
        const prefs = JSON.parse(privacyRaw);
        this.profileVisible.set(prefs.profileVisible ?? true);
        this.showEmail.set(prefs.showEmail ?? false);
      } catch { /* ignore */ }
    }
  }

  // ── Theme ─────────────────────────────────────
  setTheme(theme: 'light' | 'dark') {
    this.currentTheme.set(theme);
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('lofu-theme', theme);
  }

  // ── Privacy ───────────────────────────────────
  savePrivacy() {
    this.privacySuccess.set('');
    this.privacyError.set('');
    this.privacySaving.set(true);

    // Persist locally (extend to backend later if needed)
    const prefs = {
      profileVisible: this.profileVisible(),
      showEmail:      this.showEmail(),
    };
    localStorage.setItem('lofu-privacy', JSON.stringify(prefs));

    setTimeout(() => {
      this.privacySuccess.set('Privacy preferences saved.');
      this.privacySaving.set(false);
    }, 600);
  }

  // ── Delete Account ────────────────────────────
  openDeleteModal() {
    this.deleteConfirmText = '';
    this.deleteError.set('');
    this.showDeleteModal.set(true);
  }

  closeDeleteModal() {
    this.showDeleteModal.set(false);
    this.deleteConfirmText = '';
    this.deleteError.set('');
  }

  confirmDelete() {
    if (this.deleteConfirmText.trim().toLowerCase() !== 'delete my account') {
      this.deleteError.set('Please type the exact phrase to confirm.');
      return;
    }

    this.deleteLoading.set(true);
    this.deleteError.set('');

    // Call backend delete endpoint
    this.userService.deleteAccount().subscribe({
      next: () => {
        this.authService.logout();
        this.router.navigate(['/login']);
      },
      error: (err) => {
        this.deleteError.set(err?.error?.message || 'Failed to delete account. Please try again.');
        this.deleteLoading.set(false);
      },
    });
  }
}