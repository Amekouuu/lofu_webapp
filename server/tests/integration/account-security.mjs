// Integration test (needs the API running and a real Supabase project). Creates one throwaway
// user, checks the password rules around email changes and the session-expiry marker, and
// deletes the user again.
// Run: npm run test:integration   (or: node tests/integration/account-security.mjs)
// Set API_URL to test another server (default http://localhost:5000).
const API = (process.env.API_URL ?? 'http://localhost:5000') + '/api';

const call = async (method, path, token, body) => {
  const res = await fetch(API + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  let json = null;
  try { json = await res.json(); } catch { /* no body */ }
  return { s: res.status, b: json };
};

const tag = 'sec' + Math.random().toString(36).slice(2, 8);
const password = 'Tt-' + crypto.randomUUID();
const newEmail = tag + '_new@example.test';
let token = null;
let failures = 0;

const check = (name, ok, extra) => {
  if (!ok) failures++;
  console.log(ok ? 'PASS' : 'FAIL', name, ok ? '' : JSON.stringify(extra).slice(0, 300));
};

try {
  const reg = await call('POST', '/auth/register', null, {
    fullName: 'Security Check', username: tag, email: tag + '@example.test', password,
  });
  token = reg.b?.token;
  check('registered', reg.s === 201, reg);

  const noPassword = await call('PATCH', '/users/me', token, { email: newEmail });
  check('email change without a password -> 400', noPassword.s === 400, noPassword);

  const wrongPassword = await call('PATCH', '/users/me', token, { email: newEmail, currentPassword: 'definitely-wrong' });
  check('email change with a wrong password -> 401', wrongPassword.s === 401, wrongPassword);
  check('...and that 401 does not carry the invalid_session code', wrongPassword.b?.code === undefined, wrongPassword.b);

  const rename = await call('PATCH', '/users/me', token, { fullName: 'Security Renamed' });
  check('other profile edits need no password', rename.s === 200, rename);

  const changed = await call('PATCH', '/users/me', token, { email: newEmail, currentPassword: password });
  check('email change with the right password -> 200', changed.s === 200 && changed.b.user.email === newEmail, changed);

  const relogin = await call('POST', '/auth/login', null, { emailOrUsername: newEmail, password });
  check('can log in with the new email', relogin.s === 200, relogin);

  const wrongCurrent = await call('PATCH', '/users/me/password', token, { currentPassword: 'wrong-wrong', newPassword: 'abcdefgh1' });
  check('password change with a wrong current password -> 401 without invalid_session',
    wrongCurrent.s === 401 && wrongCurrent.b?.code === undefined, wrongCurrent.b);

  for (const [label, tokenToUse] of [['garbage token', 'not.a.jwt'], ['missing token', null], ['tampered token', token ? token.slice(0, -3) + 'abc' : 'x']]) {
    const r = await call('GET', '/auth/me', tokenToUse);
    check(label + ' -> 401 with invalid_session', r.s === 401 && r.b?.code === 'invalid_session', r.b);
  }

  // usernames are unique regardless of case
  const other = await call('POST', '/auth/register', null, {
    fullName: 'Case Twin', username: tag.toUpperCase(), email: tag + '_twin@example.test', password,
  });
  check('username that differs only by case -> 409', other.s === 409, other);
  const caseLogin = await call('POST', '/auth/login', null, { emailOrUsername: tag.toUpperCase(), password });
  check('login by username ignores case', caseLogin.s === 200, caseLogin);
} finally {
  if (token) {
    const deleted = await call('DELETE', '/users/me', token);
    console.log('cleanup', deleted.s);
  }
  console.log(failures ? failures + ' FAILED' : 'all passed');
  process.exit(failures ? 1 : 0);
}
