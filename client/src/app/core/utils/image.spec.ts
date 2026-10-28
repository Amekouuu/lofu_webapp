import { validateImageFile } from './image';

function fileOf(name: string, type: string, bytes = 10): File {
  return new File([new Uint8Array(bytes)], name, { type });
}

describe('validateImageFile', () => {
  it('accepts JPG, PNG, WEBP and GIF', () => {
    for (const type of ['image/jpeg', 'image/png', 'image/webp', 'image/gif']) {
      expect(validateImageFile(fileOf('photo', type))).toBeNull();
    }
  });

  it('rejects formats the server will not take (SVG, PDF, text)', () => {
    expect(validateImageFile(fileOf('logo.svg', 'image/svg+xml'))).toMatch(/not a supported image/);
    expect(validateImageFile(fileOf('doc.pdf', 'application/pdf'))).toMatch(/not a supported image/);
    expect(validateImageFile(fileOf('notes.txt', 'text/plain'))).toMatch(/not a supported image/);
  });

  it('rejects files over 15 MB and names the file', () => {
    const problem = validateImageFile(fileOf('huge.jpg', 'image/jpeg', 15 * 1024 * 1024 + 1));
    expect(problem).toMatch(/too large/);
    expect(problem).toContain('huge.jpg');
  });
});
