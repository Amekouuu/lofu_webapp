// Unit tests for the request validation rules. They need no server, database or network.
// Run: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { ZodType } from 'zod';
import {
  changePasswordSchema,
  createClaimSchema,
  createPostSchema,
  loginSchema,
  messageSchema,
  registerSchema,
  updateProfileSchema,
} from '../src/validation/schemas';

const PNG =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
const someUuid = '3f2b8c1e-5a4d-4e6f-9b1a-2c3d4e5f6a7b';

const goodUser = { fullName: 'Maria Santos', username: 'maria_s', email: 'Maria@Example.com ', password: 'longenough1' };
const goodPost = {
  type: 'Lost', itemName: 'Wallet', category: 'Bags & Wallets', description: 'Brown leather',
  landmark: 'SM City Clark', dateLostOrFound: '2026-10-20',
};

function firstMessage(schema: ZodType, input: unknown): string | null {
  const result = schema.safeParse(input);
  return result.success ? null : result.error.issues[0]?.message ?? '';
}

function rejects(name: string, schema: ZodType, input: unknown, messagePart: string) {
  test(name, () => {
    const message = firstMessage(schema, input);
    assert.notEqual(message, null, 'input was accepted but should have been rejected');
    assert.ok(
      (message as string).toLowerCase().includes(messagePart.toLowerCase()),
      `expected the message "${message}" to contain "${messagePart}"`
    );
  });
}

function accepts(name: string, schema: ZodType, input: unknown, verify?: (data: any) => void) {
  test(name, () => {
    const result = schema.safeParse(input);
    assert.ok(result.success, result.success ? '' : result.error.issues[0]?.message);
    if (verify) verify(result.data);
  });
}

// ── register ──
accepts('register: valid user, email trimmed and lowercased', registerSchema, goodUser, (d) => {
  assert.equal(d.email, 'maria@example.com');
});
accepts('register: unknown field "role" is stripped', registerSchema, { ...goodUser, role: 'admin' }, (d) => {
  assert.ok(!('role' in d));
});
rejects('register: bad email', registerSchema, { ...goodUser, email: 'not-an-email' }, 'valid email');
rejects('register: username with a space', registerSchema, { ...goodUser, username: 'bad name' }, 'letters, numbers and underscores');
rejects('register: username with symbols', registerSchema, { ...goodUser, username: 'x<script>' }, 'letters, numbers and underscores');
rejects('register: username too short', registerSchema, { ...goodUser, username: 'ab' }, '3-30');
rejects('register: username too long', registerSchema, { ...goodUser, username: 'a'.repeat(31) }, '3-30');
rejects('register: 7-character password', registerSchema, { ...goodUser, password: '1234567' }, 'at least 8');
rejects('register: 73-character password', registerSchema, { ...goodUser, password: 'a'.repeat(73) }, 'at most 72');
rejects('register: one-letter full name', registerSchema, { ...goodUser, fullName: 'A' }, 'at least 2');
rejects('register: blank full name', registerSchema, { ...goodUser, fullName: '   ' }, 'at least 2');
rejects('register: missing password', registerSchema, { ...goodUser, password: undefined }, 'Password is required');

// ── login (accounts made under the old 6-character rule must still log in) ──
accepts('login: short legacy password is accepted', loginSchema, { emailOrUsername: 'maria_s', password: 'abc12' });
rejects('login: blank identifier', loginSchema, { emailOrUsername: '  ', password: 'x' }, 'required');
rejects('login: absurdly long password', loginSchema, { emailOrUsername: 'a', password: 'x'.repeat(129) }, 'too long');

// ── posts ──
accepts('post: valid, images default to an empty list', createPostSchema, goodPost, (d) => {
  assert.deepEqual(d.images, []);
});
accepts('post: valid with an image and empty optional strings', createPostSchema, { ...goodPost, images: [PNG], color: '', incidentTimeApprox: '' });
accepts('post: today is allowed', createPostSchema, { ...goodPost, dateLostOrFound: new Date().toISOString().split('T')[0] });
accepts('post: status and author cannot be set by the client', createPostSchema, { ...goodPost, status: 'Resolved', author: 'x' }, (d) => {
  assert.ok(!('status' in d) && !('author' in d));
});
rejects('post: description over 500 characters', createPostSchema, { ...goodPost, description: 'x'.repeat(501) }, 'at most 500');
rejects('post: item name over 100 characters', createPostSchema, { ...goodPost, itemName: 'x'.repeat(101) }, 'at most 100');
rejects('post: blank item name', createPostSchema, { ...goodPost, itemName: '   ' }, 'required');
rejects('post: unknown category', createPostSchema, { ...goodPost, category: 'Spaceships' }, 'valid category');
rejects('post: bad time of day', createPostSchema, { ...goodPost, incidentTimeApprox: 'Midnight' }, 'time of day');
rejects('post: bad type', createPostSchema, { ...goodPost, type: 'Stolen' }, 'Lost or Found');
rejects('post: garbage date', createPostSchema, { ...goodPost, dateLostOrFound: 'yesterday-ish' }, 'not valid');
rejects('post: date 30 days ahead', createPostSchema, { ...goodPost, dateLostOrFound: new Date(Date.now() + 30 * 864e5).toISOString() }, 'future');
rejects('post: five images', createPostSchema, { ...goodPost, images: Array(5).fill(PNG) }, 'up to 4');
rejects('post: remote URL instead of an image', createPostSchema, { ...goodPost, images: ['https://example.com/a.png'] }, 'PNG, JPG, WEBP or GIF');
rejects('post: SVG image (can carry script)', createPostSchema, { ...goodPost, images: ['data:image/svg+xml;base64,PHN2Zz48L3N2Zz4='] }, 'PNG, JPG, WEBP or GIF');
rejects('post: HTML pretending to be an image', createPostSchema, { ...goodPost, images: ['data:text/html;base64,PGgxPmhpPC9oMT4='] }, 'PNG, JPG, WEBP or GIF');
rejects('post: image over about 5 MB', createPostSchema, { ...goodPost, images: ['data:image/png;base64,' + 'A'.repeat(7_000_001)] }, 'under 5 MB');
rejects('post: images that are not a list', createPostSchema, { ...goodPost, images: 'nope' }, 'list');

// ── claims and chat ──
accepts('claim: valid', createClaimSchema, { postId: someUuid, message: 'mine', proofDetails: 'has my id' });
rejects('claim: malformed post id', createClaimSchema, { postId: 'nope', message: 'm', proofDetails: 'p' }, 'Invalid post');
rejects('claim: message over 1000 characters', createClaimSchema, { postId: someUuid, message: 'x'.repeat(1001), proofDetails: 'p' }, 'at most 1000');
rejects('claim: blank proof', createClaimSchema, { postId: someUuid, message: 'm', proofDetails: '  ' }, 'required');
rejects('claim: contact info over 200 characters', createClaimSchema, { postId: someUuid, message: 'm', proofDetails: 'p', contactInfo: 'x'.repeat(201) }, 'at most 200');
accepts('message: trimmed', messageSchema, { content: '  hi  ' }, (d) => assert.equal(d.content, 'hi'));
rejects('message: blank', messageSchema, { content: '   ' }, 'required');
rejects('message: over 2000 characters', messageSchema, { content: 'x'.repeat(2001) }, 'at most 2000');

// ── account ──
accepts('profile: empty update', updateProfileSchema, {});
accepts('profile: avatar as an image data URL', updateProfileSchema, { avatar: PNG });
accepts('profile: avatar "" removes it', updateProfileSchema, { avatar: '' });
accepts('profile: role and password_hash are stripped', updateProfileSchema, { fullName: 'Ok Name', role: 'admin', password_hash: 'x' }, (d) => {
  assert.ok(!('role' in d) && !('password_hash' in d));
});
accepts('profile: current password passes through (needed for an email change)', updateProfileSchema, { email: 'a@b.co', currentPassword: 'x' }, (d) => {
  assert.equal(d.currentPassword, 'x');
});
rejects('profile: avatar as a remote URL', updateProfileSchema, { avatar: 'https://example.com/me.png' }, 'PNG, JPG, WEBP or GIF');
rejects('profile: avatar over about 2.5 MB', updateProfileSchema, { avatar: 'data:image/png;base64,' + 'A'.repeat(3_500_001) }, 'too large');
rejects('profile: bad email', updateProfileSchema, { email: 'nope' }, 'valid email');
rejects('profile: bad username', updateProfileSchema, { username: 'no spaces' }, 'letters, numbers and underscores');
accepts('password change: valid', changePasswordSchema, { currentPassword: 'old', newPassword: 'newlongpass1' });
rejects('password change: new password too short', changePasswordSchema, { currentPassword: 'old', newPassword: 'short' }, 'at least 8');
