import { Component, HostListener, effect, inject, signal, untracked } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, RouterLinkActive, Router } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { ConversationService } from '../../core/services/conversation.service';
import { ToastService } from '../../core/services/toast.service';

@Component({
  selector: 'app-nav',
  imports: [CommonModule, RouterLink, RouterLinkActive],
  templateUrl: './nav.html',
  styleUrl: './nav.css',
})
export class Nav {
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  readonly convoService = inject(ConversationService);
  private readonly toast = inject(ToastService);

  readonly currentUser = this.authService.currentUser;
  readonly isLoggedIn = this.authService.isLoggedIn;

  mobileOpen = signal(false);

  constructor() {
    // The session is restored asynchronously, so this component is usually created before the app
    // knows whether anyone is logged in. React to the login state instead of checking it once.
    effect(() => {
      if (this.isLoggedIn()) {
        untracked(() => {
          this.convoService.connect();
          this.convoService.loadConversations();
        });
      }
    });
  }

  toggleMobile() {
    this.mobileOpen.update(v => !v);
  }

  closeMobile() {
    this.mobileOpen.set(false);
  }

  logout() {
    this.convoService.disconnect();
    this.authService.logout();
    this.router.navigate(['/login']);
    this.toast.info('You have been logged out.');
  }

  @HostListener('document:keydown.escape')
  onEscape() {
    this.mobileOpen.set(false);
  }
}