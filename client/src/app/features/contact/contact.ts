import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

// ─── EmailJS config ───────────────────────────────────────────────
// Replace these with your actual EmailJS values from emailjs.com
const EMAILJS_SERVICE_ID  = 'YOUR_SERVICE_ID';
const EMAILJS_TEMPLATE_ID = 'YOUR_TEMPLATE_ID';
const EMAILJS_PUBLIC_KEY  = 'YOUR_PUBLIC_KEY';
// ─────────────────────────────────────────────────────────────────

declare const emailjs: {
  send: (
    serviceId: string,
    templateId: string,
    params: Record<string, string>,
    publicKey: string
  ) => Promise<void>;
};

@Component({
  selector: 'app-contact',
  imports: [CommonModule, FormsModule],
  templateUrl: './contact.html',
  styleUrl: './contact.css',
})
export class Contact {
  name     = '';
  email    = '';
  subject  = '';
  message  = '';

  isLoading = signal(false);
  successMsg = signal('');
  errorMsg   = signal('');

  async onSubmit() {
    this.successMsg.set('');
    this.errorMsg.set('');

    if (!this.name.trim() || !this.email.trim() || !this.subject.trim() || !this.message.trim()) {
      this.errorMsg.set('Please fill in all fields.');
      return;
    }

    this.isLoading.set(true);

    try {
      await emailjs.send(
        EMAILJS_SERVICE_ID,
        EMAILJS_TEMPLATE_ID,
        {
          from_name: this.name.trim(),
          from_email: this.email.trim(),
          subject: this.subject.trim(),
          message: this.message.trim(),
        },
        EMAILJS_PUBLIC_KEY
      );

      this.successMsg.set('Your message was sent! We\'ll get back to you shortly.');
      this.name = '';
      this.email = '';
      this.subject = '';
      this.message = '';
    } catch {
      this.errorMsg.set('Something went wrong. Please try again later.');
    } finally {
      this.isLoading.set(false);
    }
  }
}