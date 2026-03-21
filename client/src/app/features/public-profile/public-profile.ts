import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, ActivatedRoute } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { API_BASE_URL } from '../../core/config/api.config';
import { Post } from '../../core/models/post.model';

interface PublicUser {
  _id: string;
  fullName: string;
  username: string;
  email?: string | null;
  avatar?: string;
  role: string;
  createdAt: string;
  isPrivate?: boolean;
}

@Component({
  selector: 'app-public-profile',
  imports: [CommonModule, RouterLink],
  templateUrl: './public-profile.html',
  styleUrl: './public-profile.css',
})
export class PublicProfile implements OnInit {
  user = signal<PublicUser | null>(null);
  posts = signal<Post[]>([]);
  isLoading = signal(true);
  notFound = signal(false);

  constructor(
    private route: ActivatedRoute,
    private http: HttpClient,
  ) {}

  ngOnInit() {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) { this.notFound.set(true); this.isLoading.set(false); return; }

    this.http.get<{ success: boolean; user: PublicUser; posts: Post[] }>(
      `${API_BASE_URL}/users/${id}`
    ).subscribe({
      next: (res) => {
        this.user.set(res.user);
        this.posts.set(res.posts);
        this.isLoading.set(false);
      },
      error: () => {
        this.notFound.set(true);
        this.isLoading.set(false);
      },
    });
  }

  getInitial(): string {
    return (this.user()?.fullName || 'U')[0].toUpperCase();
  }

  formatDate(dateStr: string): string {
    return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  getStatusClass(status: string): string {
    switch (status) {
      case 'Active': return 'status-active';
      case 'Claim Pending': return 'status-pending';
      case 'Resolved': return 'status-resolved';
      default: return '';
    }
  }
}