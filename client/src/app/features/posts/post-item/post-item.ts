import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { PostService } from '../../../core/services/post.service';

type PostType = 'Lost' | 'Found';

const CATEGORIES = [
  'Electronics', 'Bags & Wallets', 'Clothing & Accessories',
  'Keys', 'Documents & IDs', 'Jewelry', 'Toys & Collectibles',
  'Books & School Supplies', 'Sports Equipment', 'Pets', 'Others',
];

const TIME_OPTIONS = ['Morning', 'Afternoon', 'Evening', 'Night'];

const LANDMARKS = [
  'SM City Clark', 'Marquee Mall', 'Nepo Mall', 'Robinsons Angeles',
  'Holy Angel University', 'DMMA College', 'Angeles University Foundation',
  'Balibago', 'Friendship Highway', 'MacArthur Highway', 'Sto. Domingo',
  'Hensonville', 'Malabanias', 'Pampang', 'Other',
];

@Component({
  selector: 'app-post-item',
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './post-item.html',
  styleUrl: './post-item.css',
})
export class PostItem {
  private readonly postService = inject(PostService);
  private readonly router = inject(Router);

  readonly categories = CATEGORIES;
  readonly timeOptions = TIME_OPTIONS;
  readonly landmarks = LANDMARKS;

  // Step control
  currentStep = signal(1);
  totalSteps = 3;

  isLoading = signal(false);
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
  imageFiles: File[] = [];
  imagePreviews: string[] = [];

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
  onImageSelect(event: Event) {
    const input = event.target as HTMLInputElement;
    if (!input.files) return;

    const newFiles = Array.from(input.files).slice(0, 4 - this.imageFiles.length);
    newFiles.forEach(file => {
      if (!file.type.startsWith('image/')) return;
      this.imageFiles.push(file);
      const reader = new FileReader();
      reader.onload = (e) => {
        this.imagePreviews.push(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    });
    input.value = '';
  }

  removeImage(index: number) {
    this.imageFiles.splice(index, 1);
    this.imagePreviews.splice(index, 1);
  }

  // ── Submit ──
  async onSubmit() {
    this.errorMessage.set('');
    this.isLoading.set(true);

    const images = [...this.imagePreviews];

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
        this.router.navigate(['/posts', res.post._id]);
      },
      error: (err) => {
        this.errorMessage.set(err?.error?.message || 'Failed to create post. Please try again.');
        this.isLoading.set(false);
      },
    });
  }

  resetForm() {
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
    this.imageFiles = [];
    this.imagePreviews = [];
    this.errorMessage.set('');
  }

  today(): string {
    return new Date().toISOString().split('T')[0];
  }
}