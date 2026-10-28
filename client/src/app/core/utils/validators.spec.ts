import { isValidEmail, passwordError, usernameError } from './validators';

describe('validators', () => {
  describe('isValidEmail', () => {
    it('accepts normal addresses, ignoring surrounding spaces', () => {
      expect(isValidEmail('maria@example.com')).toBe(true);
      expect(isValidEmail('  maria@example.com ')).toBe(true);
    });

    it('rejects addresses without a name, domain or dot', () => {
      for (const bad of ['', 'maria', 'maria@', '@example.com', 'maria@example', 'ma ria@example.com']) {
        expect(isValidEmail(bad)).toBe(false);
      }
    });

    it('rejects addresses longer than 254 characters', () => {
      expect(isValidEmail('a'.repeat(250) + '@b.co')).toBe(false);
    });
  });

  describe('usernameError', () => {
    it('accepts letters, numbers and underscores (3-30)', () => {
      expect(usernameError('maria_s')).toBeNull();
      expect(usernameError('abc')).toBeNull();
    });

    it('explains what is wrong otherwise', () => {
      expect(usernameError('')).toMatch(/required/i);
      expect(usernameError('ab')).toMatch(/3-30/);
      expect(usernameError('has space')).toMatch(/letters, numbers/);
      expect(usernameError('a'.repeat(31))).toMatch(/3-30/);
    });
  });

  describe('passwordError', () => {
    it('accepts 8 to 72 characters', () => {
      expect(passwordError('12345678')).toBeNull();
      expect(passwordError('a'.repeat(72))).toBeNull();
    });

    it('rejects empty, short and too-long passwords', () => {
      expect(passwordError('')).toMatch(/required/i);
      expect(passwordError('1234567')).toMatch(/at least 8/);
      expect(passwordError('a'.repeat(73))).toMatch(/at most 72/);
    });
  });
});
