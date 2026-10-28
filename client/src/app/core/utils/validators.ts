// Client-side mirrors of the server rules in server/src/validation/schemas.ts. The server is the
// real gatekeeper; these exist to give instant, field-level feedback before a request is sent.

export const FIELD_LIMITS = {
  firstName: 50,
  lastName: 50,
  email: 254,
  username: 30,
  passwordMin: 8,
  passwordMax: 72,
  contactName: 100,
  contactSubject: 150,
  contactMessage: 2000,
} as const;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const USERNAME_PATTERN = /^[A-Za-z0-9_]{3,30}$/;

export function isValidEmail(value: string): boolean {
  const email = value.trim();
  return email.length > 0 && email.length <= FIELD_LIMITS.email && EMAIL_PATTERN.test(email);
}

/** Returns a message when the username breaks the rules, otherwise null. */
export function usernameError(value: string): string | null {
  if (!value) return 'Username is required.';

  return USERNAME_PATTERN.test(value)
    ? null
    : 'Username must be 3-30 characters: letters, numbers and underscores only.';
}

/** Returns a message when the password breaks the rules, otherwise null. */
export function passwordError(value: string): string | null {
  if (!value) return 'Password is required.';
  if (value.length < FIELD_LIMITS.passwordMin) return 'Password must be at least 8 characters.';
  if (value.length > FIELD_LIMITS.passwordMax) return 'Password must be at most 72 characters.';
  return null;
}
