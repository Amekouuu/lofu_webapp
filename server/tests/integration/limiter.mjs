// Integration test: the per-account chat message limit (30 per minute). Sends 40 messages at the
// same moment so they land inside one window. Creates two throwaway users (2 registrations) and
// deletes them at the end.
// Run: node tests/integration/limiter.mjs     Set API_URL to test another server.

// Burst test for the per-account message limiter (30 per minute).
// Sends 40 messages at the same moment so they all land inside one window.
import crypto from 'crypto';

const API = (process.env.API_URL ?? 'http://localhost:5000') + '/api';
const tag = 'lim' + crypto.randomBytes(3).toString('hex');
let pass = 0, fail = 0;

function check(name, cond, extra) {
  if (cond) { pass++; console.log('PASS', name); }
  else { fail++; console.log('FAIL', name, extra === undefined ? '' : JSON.stringify(extra).slice(0, 400)); }
}

async function call(method, path, token, body) {
  const res = await fetch(API + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  let json = null;
  try { json = await res.json(); } catch { /* no body */ }
  return { status: res.status, body: json };
}

const created = [];
async function makeUser(key) {
  const password = 'Tt-' + crypto.randomUUID();
  const r = await call('POST', '/auth/register', null, {
    fullName: `Lim ${key.toUpperCase()}`, username: `${tag}_${key}`, email: `${tag}_${key}@example.test`, password,
  });
  const user = { key, token: r.body?.token, id: r.body?.user?.id, status: r.status };
  if (user.token) created.push(user);
  return user;
}

try {
  const A = await makeUser('a');
  const B = await makeUser('b');
  check('two test users registered', A.status === 201 && B.status === 201, [A.status, B.status]);

  const post = await call('POST', '/posts', A.token, {
    type: 'Found', itemName: `${tag} keys`, category: 'Keys', description: 'burst test',
    landmark: 'Test Plaza', dateLostOrFound: new Date().toISOString(),
  });
  const claim = await call('POST', '/claims', B.token, { postId: post.body?.post?._id, message: 'm', proofDetails: 'p' });
  const approve = await call('PATCH', `/claims/${claim.body?.claim?._id}/approve`, A.token);
  check('post -> claim -> approve worked', post.status === 201 && claim.status === 201 && approve.status === 200, [post.status, claim.status, approve.status]);

  const convs = await call('GET', '/conversations', B.token);
  const convId = convs.body?.conversations?.[0]?._id;
  check('conversation exists', !!convId, convs.body);

  const t0 = Date.now();
  const results = await Promise.all(
    Array.from({ length: 40 }, (_, i) => call('POST', `/conversations/${convId}/messages`, B.token, { content: `burst ${i}` }))
  );
  const ms = Date.now() - t0;
  const ok = results.filter((r) => r.status === 201).length;
  const limited = results.filter((r) => r.status === 429);
  console.log(`burst of 40 finished in ${ms} ms: ${ok} accepted, ${limited.length} limited`);

  check('exactly 30 accepted and 10 limited (limit is 30 per minute)', ok === 30 && limited.length === 10, results.map((r) => r.status));
  check('429 answers JSON with the friendly message',
    limited[0]?.body?.success === false && /too quickly/.test(limited[0]?.body?.message || ''), limited[0]);

  const aOk = await call('POST', `/conversations/${convId}/messages`, A.token, { content: 'A is not affected' });
  check('limit is per account: A can still send', aOk.status === 201, aOk);
} catch (e) {
  fail++;
  console.log('SCRIPT ERROR', e);
} finally {
  for (const u of created) {
    const r = await call('DELETE', '/users/me', u.token);
    console.log('cleanup', u.key, r.status);
  }
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}
