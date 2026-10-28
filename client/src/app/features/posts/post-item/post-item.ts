import { Component, HostListener, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { PostService } from '../../../core/services/post.service';
import { AuthService } from '../../../core/services/auth.service';
import { ConfirmService } from '../../../core/services/confirm.service';
import { ToastService } from '../../../core/services/toast.service';
import { compressImage, validateImageFile } from '../../../core/utils/image';

type PostType = 'Lost' | 'Found';

const CATEGORIES = [
  'Electronics', 'Bags & Wallets', 'Clothing & Accessories',
  'Keys', 'Documents & IDs', 'Jewelry', 'Toys & Collectibles',
  'Books & School Supplies', 'Sports Equipment', 'Pets', 'Others',
];

const TIME_OPTIONS = ['Morning', 'Afternoon', 'Evening', 'Night'];

const MAX_IMAGES = 4;

const LANDMARKS = [
  'SM City Clark', 'Marquee Mall', 'Nepo Mall', 'Robinsons Angeles',
  'Holy Angel University', 'DMMA College', 'Angeles University Foundation',
  'Balibago', 'Friendship Highway', 'MacArthur Highway', 'Sto. Domingo',
  'Hensonville', 'Malabanias', 'Pampang', 'Other',
];

@Component({
  selector: 'app-post-item',
  imports: [CommonModule, FormsModule],
  templateUrl: './post-item.html',
  styleUrl: './post-item.css',
})
export class PostItem {
  private readonly postService = inject(PostService);
  private readonly router = inject(Router);
  private readonly authService = inject(AuthService);
  private readonly toast = inject(ToastService);
  private readonly confirmService = inject(ConfirmService);

  readonly categories = CATEGORIES;
  readonly timeOptions = TIME_OPTIONS;
  readonly landmarks = LANDMARKS;

  // Step control
  currentStep = signal(1);
  totalSteps = 3;

  isLoading = signal(false);
  // Photos currently being decoded and resized (the submit button waits for them)
  processingImages = signal(0);
  // Set once the post is created, so leaving the page afterwards is not treated as losing work
  private submitted = false;
  errorMessage = signal('');

  // ── Step 1: Basic info ──
  postType: PostType = 'Lost';
  itemName = '';
  category = '';
  description = '';

  // ── Step 2: Details ──
  color = '';
  brand = '';
  landmark = '';
  locationDetails = '';
  dateLostOrFound = '';
  incidentTimeApprox = '';
  rewardOffered = '';

  // ── Step 3: Images ──
  // Resized photos as data URLs. A signal, because this app is zoneless: async work such as
  // image decoding only re-renders the view through a signal change.
  imagePreviews = signal<string[]>([]);

  // Step labels
  readonly steps = [
    { num: 1, label: 'Basic Info' },
    { num: 2, label: 'Details' },
    { num: 3, label: 'Images & Submit' },
  ];

  // ── Navigation ──
  nextStep() {
    this.errorMessage.set('');
    if (this.currentStep() === 1 && !this.validateStep1()) return;
    if (this.currentStep() === 2 && !this.validateStep2()) return;
    if (this.currentStep() < this.totalSteps) {
      this.currentStep.update(s => s + 1);
    }
  }

  prevStep() {
    this.errorMessage.set('');
    if (this.currentStep() > 1) this.currentStep.update(s => s - 1);
  }

  // ── Validation ──
  validateStep1(): boolean {
    if (!this.itemName.trim()) {
      this.errorMessage.set('Item name is required.'); return false;
    }
    if (!this.category) {
      this.errorMessage.set('Please select a category.'); return false;
    }
    if (!this.description.trim()) {
      this.errorMessage.set('Description is required.'); return false;
    }
    return true;
  }

  validateStep2(): boolean {
    if (!this.landmark) {
      this.errorMessage.set('Please select a landmark.'); return false;
    }
    if (!this.dateLostOrFound) {
      this.errorMessage.set('Date is required.'); return false;
    }
    return true;
  }

  // ── Image handling ──
  async onImageSelect(event: Event) {
    const input = event.target as HTMLInputElement;
    const files = Array.from(input.files ?? []);
    // Reset so choosing the same file again still fires a change event.
    input.value = '';
    if (files.length === 0) return;

    const room = MAX_IMAGES - this.imagePreviews().length - this.processingImages();
    if (room <= 0) {
      this.toast.error(`You can add up to ${MAX_IMAGES} photos.`);
      return;
    }

    const batch = files.slice(0, room);
    if (files.length > room) {
      this.toast.info(`Only ${MAX_IMAGES} photos are allowed, so ${files.length - room} were skipped.`);
    }

    this.processingImages.update(n => n + batch.length);

    // One at a time, so the previews keep the order the files were picked in.
    for (const file of batch) {
      try {
        const problem = validateImageFile(file);
        if (problem) {
          this.toast.error(problem);
          continue;
        }

        // Shrinks the photo (a 6 MB phone shot becomes a few hundred KB) and strips EXIF/GPS data.
        const dataUrl = await compressImage(file, { maxSize: 1600 });
        this.imagePreviews.update(previews => [...previews, dataUrl]);
      } catch {
        this.toast.error(`"${file.name}" could not be read as an image. Try a different one.`);
      } finally {
        this.processingImages.update(n => n - 1);
      }
    }
  }

  removeImage(index: number) {
    this.imagePreviews.update(previews => previews.filter((_, i) => i !== index));
  }

  // ── Submit ──
  async onSubmit() {
    this.errorMessage.set('');
    this.isLoading.set(true);

    const images = [...this.imagePreviews()];

    this.postService.createPost({
      type: this.postType,
      itemName: this.itemName.trim(),
      category: this.category,
      description: this.description.trim(),
      color: this.color.trim() || undefined,
      brand: this.brand.trim() || undefined,
      landmark: this.landmark,
      locationDetails: this.locationDetails.trim() || undefined,
      dateLostOrFound: this.dateLostOrFound,
      incidentTimeApprox: this.incidentTimeApprox || undefined,
      rewardOffered: this.postType === 'Lost' && this.rewardOffered.trim()
        ? this.rewardOffered.trim()
        : undefined,
      images,
    }).subscribe({
      next: (res) => {
        this.submitted = true;
        this.toast.success('Your post is live!');
        this.router.navigate(['/posts', res.post._id]);
      },
      error: (err) => {
        this.errorMessage.set(err?.error?.message || 'Failed to create post. Please try again.');
        this.isLoading.set(false);
      },
    });
  }

  async resetForm() {
    if (this.hasUnsavedChanges()) {
      const confirmed = await this.confirmService.confirm({
        title: 'Clear the whole form?',
        message: 'Everything you have entered, including photos, will be removed.',
        confirmLabel: 'Clear form',
        tone: 'danger',
      });
      if (!confirmed) return;
    }

    this.currentStep.set(1);
    this.postType = 'Lost';
    this.itemName = '';
    this.category = '';
    this.description = '';
    this.color = '';
    this.brand = '';
    this.landmark = '';
    this.locationDetails = '';
    this.dateLostOrFound = '';
    this.incidentTimeApprox = '';
    this.rewardOffered = '';
    this.imagePreviews.set([]);
    this.errorMessage.set('');
  }

  // True while the form holds anything the user would lose by leaving. Used by the route guard
  // (in-app navigation) and the beforeunload handler below (closing or refreshing the tab).
  hasUnsavedChanges(): boolean {
    // After submitting, or after logging out, there is nothing left to protect.
    if (this.submitted || !this.authService.isLoggedIn()) return false;

    return Boolean(
      this.itemName.trim() || this.category || this.description.trim() || this.color.trim() ||
      this.brand.trim() || this.landmark || this.locationDetails.trim() || this.dateLostOrFound ||
      this.incidentTimeApprox || this.rewardOffered.trim() || this.imagePreviews().length > 0
    );
  }

  @HostListener('window:beforeunload', ['$event'])
  warnBeforeLeavingPage(event: BeforeUnloadEvent) {
    if (this.hasUnsavedChanges()) {
      event.preventDefault();
    }
  }

  // Today's date in the user's own time zone. (toISOString() is UTC, which in the Philippines
  // is still "yesterday" between midnight and 8 am, so today could not be picked.)
  today(): string {
    const now = new Date();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${now.getFullYear()}-${month}-${day}`;
  }
}