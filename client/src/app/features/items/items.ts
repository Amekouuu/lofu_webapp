import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { debounceTime, distinctUntilChanged, Subject, switchMap } from 'rxjs';
import { PostService } from '../../core/services/post.service';
import { AuthService } from '../../core/services/auth.service';
import { Post, PostType } from '../../core/models/post.model';

@Component({
  selector: 'app-items',
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './items.html',
  styleUrl: './items.css',
})
export class Items implements OnInit {
  private readonly postService = inject(PostService);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  readonly isLoggedIn = this.authService.isLoggedIn;

  // State
  activeTab = signal<PostType>('Lost');
  posts = signal<Post[]>([]);
  lostCount = signal(0);
  foundCount = signal(0);
  isLoading = signal(true);
  currentPage = signal(1);
  totalPages = signal(1);
  searchQuery = '';

  private readonly searchSubject = new Subject<string>();

  // Derived
  readonly tabCounts = computed(() => ({
    lost: this.lostCount(),
    found: this.foundCount(),
  }));

  ngOnInit() {
    this.loadPosts();

    // Debounce search input
    this.searchSubject.pipe(
      debounceTime(400),
      distinctUntilChanged(),
      switchMap(query =>
        this.postService.getPosts({
          type: this.activeTab(),
          search: query,
          page: 1,
        })
      )
    ).subscribe({
      next: (res) => {
        this.posts.set(res.posts);
        this.lostCount.set(res.counts.lost);
        this.foundCount.set(res.counts.found);
        this.currentPage.set(res.pagination.page);
        this.totalPages.set(res.pagination.totalPages);
        this.isLoading.set(false);
      },
      error: () => this.isLoading.set(false),
    });
  }

  loadPosts() {
    this.isLoading.set(true);
    this.postService.getPosts({
      type: this.activeTab(),
      search: this.searchQuery.trim() || undefined,
      page: this.currentPage(),
    }).subscribe({
      next: (res) => {
        this.posts.set(res.posts);
        this.lostCount.set(res.counts.lost);
        this.foundCount.set(res.counts.found);
        this.currentPage.set(res.pagination.page);
        this.totalPages.set(res.pagination.totalPages);
        this.isLoading.set(false);
      },
      error: () => this.isLoading.set(false),
    });
  }

  switchTab(tab: PostType) {
    if (this.activeTab() === tab) return;
    this.activeTab.set(tab);
    this.currentPage.set(1);
    this.loadPosts();
  }

  onSearchInput() {
    this.searchSubject.next(this.searchQuery);
  }

  onSearchSubmit() {
    this.currentPage.set(1);
    this.loadPosts();
  }

  goToPage(page: number) {
    if (page < 1 || page > this.totalPages()) return;
    this.currentPage.set(page);
    this.loadPosts();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  getPageNumbers(): (number | '...')[] {
    const total = this.totalPages();
    const current = this.currentPage();
    if (total <= 5) return Array.from({ length: total }, (_, i) => i + 1);

    const pages: (number | '...')[] = [1];
    if (current > 3) pages.push('...');
    for (let i = Math.max(2, current - 1); i <= Math.min(total - 1, current + 1); i++) {
      pages.push(i);
    }
    if (current < total - 2) pages.push('...');
    pages.push(total);
    return pages;
  }

  onActionClick(post: Post) {
    if (!this.isLoggedIn()) {
      this.router.navigate(['/login']);
      return;
    }
    this.router.navigate(['/posts', post._id]);
  }

  getActionLabel(post: Post): string {
    return post.type === 'Lost' ? 'I found this!' : 'This is mine!';
  }

  formatDate(dateStr: string): string {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  }

  getImageUrl(post: Post): string | null {
    return post.images?.length > 0 ? post.images[0] : null;
  }
}