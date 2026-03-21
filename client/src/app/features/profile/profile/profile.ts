import { Component, OnInit, inject, signal, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { UserService } from '../../../core/services/user.service';
import { ClaimService } from '../../../core/services/claim.service';
import { Post } from '../../../core/models/post.model';
import { Claim } from '../../../core/models/claim.model';

type Tab = 'posts' | 'incoming' | 'myclaims' | 'edit';

@Component({
  selector: 'app-profile',
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './profile.html',
  styleUrl: './profile.css',
})
export class Profile implements OnInit {
  private readonly authService = inject(AuthService);
  private readonly userService = inject(UserService);
  private readonly claimService = inject(ClaimService);

  @ViewChild('avatarInput') avatarInput!: ElementRef<HTMLInputElement>;

  readonly currentUser = this.authService.currentUser;

  activeTab = signal<Tab>('posts');

  // Data
  myPosts = signal<Post[]>([]);
  incomingClaims = signal<Claim[]>([]);
  myClaims = signal<Claim[]>([]);

  // Loading states
  postsLoading = signal(true);
  incomingLoading = signal(true);
  myClaimsLoading = signal(true);

  // Edit profile form
  editFullName = '';
  editUsername = '';
  editEmail = '';
  editLoading = signal(false);
  editSuccess = signal('');
  editError = signal('');

  // Avatar upload
  avatarLoading = signal(false);
  avatarError = signal('');

  // Change password form
  currentPassword = '';
  newPassword = '';
  confirmNewPassword = '';
  passwordLoading = signal(false);
  passwordSuccess = signal('');
  passwordError = signal('');

  // Delete post confirm
  deletingPostId = signal<string | null>(null);

  ngOnInit() {
    this.loadMyPosts();
    this.loadIncomingClaims();
    this.loadMyClaims();
    this.resetEditForm();
  }

  resetEditForm() {
    const user = this.currentUser();
    if (user) {
      this.editFullName = user.fullName;
      this.editUsername = user.username;
      this.editEmail    = user.email;
    }
  }

  setTab(tab: Tab) {
    this.activeTab.set(tab);
    this.editSuccess.set('');
    this.editError.set('');
    this.avatarError.set('');
    this.passwordSuccess.set('');
    this.passwordError.set('');
  }

  // ── Avatar Upload ─────────────────────────────
  triggerAvatarInput() {
    this.avatarInput.nativeElement.click();
  }

  onAvatarFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    // Validate type
    if (!file.type.startsWith('image/')) {
      this.avatarError.set('Please select an image file.');
      return;
    }

    // Validate size (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      this.avatarError.set('Image must be under 2MB.');
      return;
    }

    this.avatarError.set('');
    this.avatarLoading.set(true);

    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result as string;

      this.userService.updateProfile({ avatar: base64 }).subscribe({
        next: (res) => {
          (this.authService as any).currentUserSignal?.set(res.user);
          this.avatarLoading.set(false);
        },
        error: () => {
          this.avatarError.set('Failed to update avatar. Please try again.');
          this.avatarLoading.set(false);
        },
      });
    };
    reader.onerror = () => {
      this.avatarError.set('Could not read the file.');
      this.avatarLoading.set(false);
    };
    reader.readAsDataURL(file);

    // Reset input so the same file can be re-selected
    input.value = '';
  }

  // ── My Posts ──────────────────────────────────
  loadMyPosts() {
    this.postsLoading.set(true);
    this.userService.getMyPosts().subscribe({
      next: (res) => { this.myPosts.set(res.posts); this.postsLoading.set(false); },
      error: () => this.postsLoading.set(false),
    });
  }

  confirmDelete(postId: string) {
    this.deletingPostId.set(postId);
  }

  cancelDelete() {
    this.deletingPostId.set(null);
  }

  deletePost(postId: string) {
    this.userService.deletePost(postId).subscribe({
      next: () => {
        this.myPosts.update(posts => posts.filter(p => p._id !== postId));
        this.deletingPostId.set(null);
      },
    });
  }

  // ── Incoming Claims ───────────────────────────
  loadIncomingClaims() {
    this.incomingLoading.set(true);
    this.claimService.getIncomingClaims().subscribe({
      next: (res) => { this.incomingClaims.set(res.claims); this.incomingLoading.set(false); },
      error: () => this.incomingLoading.set(false),
    });
  }

  approveClaim(claimId: string) {
    this.claimService.approveClaim(claimId).subscribe({
      next: () => {
        this.incomingClaims.update(claims =>
          claims.map(c => c._id === claimId
            ? { ...c, status: 'Approved' as const }
            : { ...c, status: c.status === 'Pending' ? 'Rejected' as const : c.status }
          )
        );
        this.loadMyPosts();
      },
    });
  }

  rejectClaim(claimId: string) {
    this.claimService.rejectClaim(claimId).subscribe({
      next: () => {
        this.incomingClaims.update(claims =>
          claims.map(c => c._id === claimId ? { ...c, status: 'Rejected' as const } : c)
        );
      },
    });
  }

  // ── My Claims ─────────────────────────────────
  loadMyClaims() {
    this.myClaimsLoading.set(true);
    this.claimService.getMyClaims().subscribe({
      next: (res) => { this.myClaims.set(res.claims); this.myClaimsLoading.set(false); },
      error: () => this.myClaimsLoading.set(false),
    });
  }

  // ── Edit Profile ──────────────────────────────
  onUpdateProfile() {
    this.editSuccess.set('');
    this.editError.set('');

    if (!this.editFullName.trim() || !this.editUsername.trim() || !this.editEmail.trim()) {
      this.editError.set('All fields are required.');
      return;
    }

    this.editLoading.set(true);
    this.userService.updateProfile({
      fullName: this.editFullName.trim(),
      username: this.editUsername.trim(),
      email:    this.editEmail.trim(),
    }).subscribe({
      next: (res) => {
        (this.authService as any).currentUserSignal?.set(res.user);
        this.editSuccess.set('Profile updated successfully!');
        this.editLoading.set(false);
      },
      error: (err) => {
        this.editError.set(err?.error?.message || 'Failed to update profile.');
        this.editLoading.set(false);
      },
    });
  }

  onChangePassword() {
    this.passwordSuccess.set('');
    this.passwordError.set('');

    if (!this.currentPassword || !this.newPassword || !this.confirmNewPassword) {
      this.passwordError.set('All password fields are required.');
      return;
    }

    if (this.newPassword.length < 6) {
      this.passwordError.set('New password must be at least 6 characters.');
      return;
    }

    if (this.newPassword !== this.confirmNewPassword) {
      this.passwordError.set('New passwords do not match.');
      return;
    }

    this.passwordLoading.set(true);
    this.userService.changePassword({
      currentPassword: this.currentPassword,
      newPassword:     this.newPassword,
    }).subscribe({
      next: () => {
        this.passwordSuccess.set('Password changed successfully!');
        this.currentPassword      = '';
        this.newPassword          = '';
        this.confirmNewPassword   = '';
        this.passwordLoading.set(false);
      },
      error: (err) => {
        this.passwordError.set(err?.error?.message || 'Failed to change password.');
        this.passwordLoading.set(false);
      },
    });
  }

  // ── Helpers ───────────────────────────────────
  formatDate(dateStr: string): string {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric',
    });
  }

  getStatusClass(status: string): string {
    switch (status) {
      case 'Active':        return 'status-active';
      case 'Claim Pending': return 'status-pending';
      case 'Resolved':      return 'status-resolved';
      case 'Approved':      return 'status-approved';
      case 'Rejected':      return 'status-rejected';
      default:              return '';
    }
  }

  getInitial(): string {
    return (this.currentUser()?.fullName || 'U')[0].toUpperCase();
  }
}