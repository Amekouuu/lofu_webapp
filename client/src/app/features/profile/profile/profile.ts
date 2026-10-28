import { Component, OnInit, inject, signal, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { UserService } from '../../../core/services/user.service';
import { ClaimService } from '../../../core/services/claim.service';
import { ConfirmService } from '../../../core/services/confirm.service';
import { ToastService } from '../../../core/services/toast.service';
import { compressImage, validateImageFile } from '../../../core/utils/image';
import { isValidEmail, usernameError } from '../../../core/utils/validators';
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
  private readonly confirmService = inject(ConfirmService);
  private readonly toast = inject(ToastService);

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
  // Asked for only when the email address is being changed
  editEmailPassword = '';
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

  // Id of the claim whose approve/reject request is running (disables the buttons, stops double clicks)
  busyClaimId = signal<string | null>(null);

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

  async onAvatarFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    // Reset so choosing the same file again still fires a change event.
    input.value = '';
    if (!file) return;

    const problem = validateImageFile(file);
    if (problem) {
      this.avatarError.set(problem);
      return;
    }

    this.avatarError.set('');
    this.avatarLoading.set(true);

    let avatar: string;
    try {
      // Avatars are shown small, so 512px is plenty and keeps the upload tiny.
      avatar = await compressImage(file, { maxSize: 512, quality: 0.85 });
    } catch {
      this.avatarError.set('That image could not be read. Please try a different one.');
      this.avatarLoading.set(false);
      return;
    }

    this.userService.updateProfile({ avatar }).subscribe({
      next: (res) => {
        this.authService.patchUser(res.user);
        this.avatarLoading.set(false);
        this.toast.success('Profile photo updated.');
      },
      error: (err) => {
        this.avatarError.set(err?.error?.message || 'Failed to update your photo. Please try again.');
        this.avatarLoading.set(false);
      },
    });
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
        this.toast.success('Post deleted.');
      },
      error: (err) => {
        this.deletingPostId.set(null);
        this.toast.error(err?.error?.message || 'Could not delete the post. Please try again.');
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

  async approveClaim(claim: Claim) {
    if (this.busyClaimId()) return;

    const confirmed = await this.confirmService.confirm({
      title: `Approve ${claim.claimant.fullName}'s claim?`,
      message:
        'This marks the item as returned, rejects every other claim on this post, and opens a chat with this person. It cannot be undone.',
      confirmLabel: 'Approve claim',
    });
    if (!confirmed) return;

    this.busyClaimId.set(claim._id);
    this.claimService.approveClaim(claim._id).subscribe({
      next: () => {
        this.incomingClaims.update(claims =>
          claims.map(c => c._id === claim._id
            ? { ...c, status: 'Approved' as const }
            : { ...c, status: c.status === 'Pending' ? 'Rejected' as const : c.status }
          )
        );
        this.busyClaimId.set(null);
        this.toast.success(`Claim approved. You can now chat with ${claim.claimant.fullName} in Messages.`);
        this.loadMyPosts();
      },
      error: (err) => {
        this.busyClaimId.set(null);
        this.toast.error(err?.error?.message || 'Could not approve the claim. Please try again.');
      },
    });
  }

  async rejectClaim(claim: Claim) {
    if (this.busyClaimId()) return;

    const confirmed = await this.confirmService.confirm({
      title: `Reject ${claim.claimant.fullName}'s claim?`,
      message: 'They will not be able to submit another claim for this post.',
      confirmLabel: 'Reject claim',
      tone: 'danger',
    });
    if (!confirmed) return;

    this.busyClaimId.set(claim._id);
    this.claimService.rejectClaim(claim._id).subscribe({
      next: () => {
        this.incomingClaims.update(claims =>
          claims.map(c => c._id === claim._id ? { ...c, status: 'Rejected' as const } : c)
        );
        this.busyClaimId.set(null);
        this.toast.info('Claim rejected.');
      },
      error: (err) => {
        this.busyClaimId.set(null);
        this.toast.error(err?.error?.message || 'Could not reject the claim. Please try again.');
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
  emailChanged(): boolean {
    return this.editEmail.trim().toLowerCase() !== (this.currentUser()?.email ?? '').toLowerCase();
  }

  onUpdateProfile() {
    this.editSuccess.set('');
    this.editError.set('');

    const fullName = this.editFullName.trim();
    const username = this.editUsername.trim();

    if (fullName.length < 2 || fullName.length > 100) {
      this.editError.set('Full name must be between 2 and 100 characters.');
      return;
    }

    const usernameProblem = usernameError(username);
    if (usernameProblem) {
      this.editError.set(usernameProblem);
      return;
    }

    if (!isValidEmail(this.editEmail)) {
      this.editError.set('Please enter a valid email address.');
      return;
    }

    if (this.emailChanged() && !this.editEmailPassword) {
      this.editError.set('Enter your current password to change your email.');
      return;
    }

    this.editLoading.set(true);
    this.userService.updateProfile({
      fullName,
      username,
      email: this.editEmail.trim(),
      ...(this.emailChanged() && { currentPassword: this.editEmailPassword }),
    }).subscribe({
      next: (res) => {
        this.authService.patchUser(res.user);
        this.editEmailPassword = '';
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

    if (this.newPassword.length < 8) {
      this.passwordError.set('New password must be at least 8 characters.');
      return;
    }

    if (this.newPassword.length > 72) {
      this.passwordError.set('New password must be at most 72 characters.');
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