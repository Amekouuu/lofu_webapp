import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { PostService } from '../../../core/services/post.service';
import { ClaimService } from '../../../core/services/claim.service';
import { AuthService } from '../../../core/services/auth.service';
import { Post } from '../../../core/models/post.model';
import { Claim } from '../../../core/models/claim.model';

@Component({
  selector: 'app-detail',
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './detail.html',
  styleUrl: './detail.css',
})
export class Detail implements OnInit {
  private readonly route      = inject(ActivatedRoute);
  private readonly router     = inject(Router);
  private readonly postService  = inject(PostService);
  private readonly claimService = inject(ClaimService);
  private readonly authService  = inject(AuthService);

  readonly currentUser = this.authService.currentUser;
  readonly isLoggedIn  = this.authService.isLoggedIn;

  // Post state
  post = signal<Post | null>(null);
  isLoading = signal(true);
  notFound  = signal(false);

  // Image viewer
  activeImageIndex = signal(0);

  // Claim form
  claimMessage     = '';
  claimProof       = '';
  claimContact     = '';
  claimLoading     = signal(false);
  claimSuccess     = signal('');
  claimError       = signal('');
  alreadyClaimed   = signal(false);

  // Incoming claims (for post owner)
  incomingClaims   = signal<Claim[]>([]);
  claimsLoading    = signal(false);

  ngOnInit() {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) { this.router.navigate(['/items']); return; }
    this.loadPost(id);
  }

  loadPost(id: string) {
    this.isLoading.set(true);
    this.postService.getPostById(id).subscribe({
      next: (res) => {
        this.post.set(res.post);
        this.isLoading.set(false);
        // If owner, load incoming claims
        if (this.isOwner()) this.loadIncomingClaims();
      },
      error: () => {
        this.notFound.set(true);
        this.isLoading.set(false);
      },
    });
  }

  loadIncomingClaims() {
    this.claimsLoading.set(true);
    this.claimService.getIncomingClaims().subscribe({
      next: (res) => {
        // Filter to only claims for this post
        const postId = this.post()?._id;
        this.incomingClaims.set(res.claims.filter(c => c.post._id === postId));
        this.claimsLoading.set(false);
      },
      error: () => this.claimsLoading.set(false),
    });
  }

  isOwner(): boolean {
    const user = this.currentUser();
    const post = this.post();
    if (!user || !post) return false;
    return user.id === post.author._id;
  }

  onClaimSubmit() {
    this.claimError.set('');
    this.claimSuccess.set('');

    if (!this.isLoggedIn()) {
      this.router.navigate(['/login']);
      return;
    }

    if (!this.claimMessage.trim() || !this.claimProof.trim()) {
      this.claimError.set('Message and proof details are required.');
      return;
    }

    const postId = this.post()?._id;
    if (!postId) return;

    this.claimLoading.set(true);
    this.claimService.createClaim({
      postId,
      message: this.claimMessage.trim(),
      proofDetails: this.claimProof.trim(),
      contactInfo: this.claimContact.trim() || undefined,
    }).subscribe({
      next: () => {
        this.claimSuccess.set('Your claim has been submitted! The post owner will review it.');
        this.claimMessage = '';
        this.claimProof   = '';
        this.claimContact = '';
        this.alreadyClaimed.set(true);
        this.claimLoading.set(false);
        // Refresh post to update status
        this.loadPost(postId);
      },
      error: (err) => {
        const msg = err?.error?.message || 'Failed to submit claim.';
        if (msg.includes('already')) this.alreadyClaimed.set(true);
        this.claimError.set(msg);
        this.claimLoading.set(false);
      },
    });
  }

  approveClaim(claimId: string) {
    this.claimService.approveClaim(claimId).subscribe({
      next: () => {
        this.incomingClaims.update(claims =>
          claims.map(c =>
            c._id === claimId
              ? { ...c, status: 'Approved' as const }
              : { ...c, status: c.status === 'Pending' ? 'Rejected' as const : c.status }
          )
        );
        const postId = this.post()?._id;
        if (postId) this.loadPost(postId);
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

  setActiveImage(index: number) {
    this.activeImageIndex.set(index);
  }

  formatDate(dateStr: string): string {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'long', day: 'numeric', year: 'numeric',
    });
  }

  getStatusClass(status: string): string {
    switch (status) {
      case 'Active':        return 'badge-active';
      case 'Claim Pending': return 'badge-pending';
      case 'Resolved':      return 'badge-resolved';
      case 'Approved':      return 'badge-resolved';
      case 'Rejected':      return 'badge-rejected';
      default:              return '';
    }
  }

  getActionLabel(): string {
    return this.post()?.type === 'Lost' ? 'I found this!' : 'This is mine!';
  }
}