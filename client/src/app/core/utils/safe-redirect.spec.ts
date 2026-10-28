import { safeReturnUrl } from './safe-redirect';

describe('safeReturnUrl', () => {
  it('allows in-app paths, including query strings', () => {
    expect(safeReturnUrl('/post-item')).toBe('/post-item');
    expect(safeReturnUrl('/posts/abc?x=1')).toBe('/posts/abc?x=1');
  });

  it('rejects anything that could leave the site', () => {
    expect(safeReturnUrl('https://evil.example')).toBeNull();
    expect(safeReturnUrl('//evil.example')).toBeNull();
    expect(safeReturnUrl('/\\evil.example')).toBeNull();
    expect(safeReturnUrl('javascript:alert(1)')).toBeNull();
  });

  it('never sends people back to the login or register page', () => {
    expect(safeReturnUrl('/login')).toBeNull();
    expect(safeReturnUrl('/login?returnUrl=%2Fhome')).toBeNull();
    expect(safeReturnUrl('/register')).toBeNull();
  });

  it('treats empty values as no destination', () => {
    expect(safeReturnUrl(null)).toBeNull();
    expect(safeReturnUrl(undefined)).toBeNull();
    expect(safeReturnUrl('')).toBeNull();
  });
});
