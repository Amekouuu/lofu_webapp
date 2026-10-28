// Only same-site, in-app paths may be used as the "go here after login" destination. Anything
// else (https://evil.example, //evil.example, backslash tricks) would turn the login page
// into an open redirect.
export function safeReturnUrl(url: string | null | undefined): string | null {
  if (!url || !url.startsWith('/') || url.startsWith('//') || url.includes('\\')) return null;

  const isAuthPage = /^\/(login|register)(\?|#|$)/.test(url);
  return isAuthPage ? null : url;
}
