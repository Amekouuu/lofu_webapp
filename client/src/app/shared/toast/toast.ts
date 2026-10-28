import { Component, inject } from '@angular/core';
import { ToastService } from '../../core/services/toast.service';

@Component({
  selector: 'app-toast-container',
  templateUrl: './toast.html',
  styleUrl: './toast.css',
})
export class ToastContainer {
  readonly toastService = inject(ToastService);
}
