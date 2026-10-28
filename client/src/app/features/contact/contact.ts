import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { FIELD_LIMITS, isValidEmail } from '../../core/utils/validators';

// ─── EmailJS config ───────────────────────────────────────────────
// These three values are public by design (they ship in the browser bundle). Protect the quota in
// the EmailJS dashboard instead: Account -> Security -> allow requests only from your own domain.
const EMAILJS_SERVICE_ID  = 'service_h64pn57';
const EMAILJS_TEMPLATE_ID = 'template_gdfdmqa';
const EMAILJS_PUBLIC_KEY  = 'fdKiUJiJkms7lnJ1D';
// ─────────────────────────────────────────────────────────────────

const SENT_MESSAGE = "Your message was sent! We'll get back to you shortly.";
const COOLDOWN_MS = 30_000;
const MIN_MESSAGE_LENGTH = 10;

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
  readonly limits = FIELD_LIMITS;

  name     = '';
  email    = '';
  subject  = '';
  message  = '';
  // Honeypot: invisible to people, tempting to bots. Anything typed here means "not a human".
  website  = '';

  isLoading  = signal(false);
  successMsg = signal('');
  errorMsg   = signal('');
  // One message per field, keyed by the input's id
  fieldErrors = signal<Record<string, string>>({});

  private lastSentAt = 0;

  clearFieldError(field: string) {
    if (!this.fieldErrors()[field]) return;

    const remaining = { ...this.fieldErrors() };
    delete remaining[field];
    this.fieldErrors.set(remaining);
  }

  private validate(): Record<string, string> {
    const errors: Record<string, string> = {};

    if (!this.name.trim()) errors['name'] = 'Please enter your name.';

    if (!this.email.trim()) errors['email'] = 'Please enter your email.';
    else if (!isValidEmail(this.email)) errors['email'] = 'Please enter a valid email address.';

    if (!this.subject.trim()) errors['subject'] = 'Please add a subject.';

    const length = this.message.trim().length;
    if (length === 0) errors['message'] = 'Please write a message.';
    else if (length < MIN_MESSAGE_LENGTH) {
      errors['message'] = `Please write at least ${MIN_MESSAGE_LENGTH} characters so we can help.`;
    }

    return errors;
  }

  private resetFields() {
    this.name    = '';
    this.email   = '';
    this.subject = '';
    this.message = '';
    this.website = '';
  }

  async onSubmit() {
    this.successMsg.set('');
    this.errorMsg.set('');

    const errors = this.validate();
    this.fieldErrors.set(errors);

    const firstInvalid = Object.keys(errors)[0];
    if (firstInvalid) {
      setTimeout(() => document.getElementById(firstInvalid)?.focus());
      return;
    }

    // A bot filled the hidden field: say it worked, send nothing.
    if (this.website) {
      this.successMsg.set(SENT_MESSAGE);
      this.resetFields();
      return;
    }

    const waitMs = COOLDOWN_MS - (Date.now() - this.lastSentAt);
    if (waitMs > 0) {
      this.errorMsg.set(`Please wait ${Math.ceil(waitMs / 1000)} seconds before sending another message.`);
      return;
    }

    this.isLoading.set(true);

    try {
      await emailjs.send(
        EMAILJS_SERVICE_ID,
        EMAILJS_TEMPLATE_ID,
        {
          from_name:  this.name.trim(),
          from_email: this.email.trim(),
          subject:    this.subject.trim(),
          message:    this.message.trim(),
        },
        EMAILJS_PUBLIC_KEY
      );

      this.lastSentAt = Date.now();
      this.successMsg.set(SENT_MESSAGE);
      this.resetFields();
    } catch {
      this.errorMsg.set('Something went wrong. Please try again later.');
    } finally {
      this.isLoading.set(false);
    }
  }
}
