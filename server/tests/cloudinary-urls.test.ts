// Tests for the code that decides which Cloudinary images may be deleted. It must only ever
// touch images this app uploaded, never an arbitrary URL.
// Run: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';

// cloudinary.ts reads its settings from env.ts, which needs no real values for these tests
import { publicIdFromUrl } from '../src/config/cloudinary';

test('post image URL -> public id', () => {
  assert.equal(
    publicIdFromUrl('https://res.cloudinary.com/demo/image/upload/v1730000000/lofu/posts/abc123.jpg'),
    'lofu/posts/abc123'
  );
});

test('avatar URL -> public id', () => {
  assert.equal(
    publicIdFromUrl('https://res.cloudinary.com/demo/image/upload/v1/lofu/avatars/Xy_9-z.png'),
    'lofu/avatars/Xy_9-z'
  );
});

test('URL without a version segment still works', () => {
  assert.equal(
    publicIdFromUrl('https://res.cloudinary.com/demo/image/upload/lofu/posts/abc123.webp'),
    'lofu/posts/abc123'
  );
});

test('images outside the lofu/ folders are never touched', () => {
  assert.equal(publicIdFromUrl('https://res.cloudinary.com/demo/image/upload/v1/other/folder/abc.jpg'), null);
  assert.equal(publicIdFromUrl('https://res.cloudinary.com/demo/image/upload/v1/lofu/secrets/abc.jpg'), null);
});

test('other hosts and non-URLs are ignored', () => {
  assert.equal(publicIdFromUrl('https://example.com/image/upload/v1/lofu/posts/abc.jpg'), null);
  assert.equal(publicIdFromUrl('data:image/png;base64,AAAA'), null);
  assert.equal(publicIdFromUrl(''), null);
});

test('path traversal in the id is rejected', () => {
  assert.equal(publicIdFromUrl('https://res.cloudinary.com/demo/image/upload/v1/lofu/posts/../avatars/x.jpg'), null);
});
