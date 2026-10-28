// Integration test (needs the API running and a real Supabase + Cloudinary project).
// Walks the whole app through the API: accounts, posts, search, claims, chat (REST and
// Socket.IO), settings, image uploads, validation, body limits. Creates three throwaway users and
// deletes them at the end. Uploads 2 tiny test images to Cloudinary (lofu/posts, lofu/avatars).
// Uses 6 of the 10 registrations per hour that the register rate limit allows per IP.
// Run: node tests/integration/smoke.mjs     Set API_URL to test another server.

import { createRequire } from 'module';
import crypto from 'crypto';

const require = createRequire(new URL('../../../client/package.json', import.meta.url));
const { io } = require('socket.io-client');

const BASE = process.env.API_URL ?? 'http://localhost:5000';
const API = BASE + '/api';
const tag = 'smoke' + crypto.randomBytes(3).toString('hex');
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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

const users = {};
async function makeUser(key) {
  const password = 'Tt-' + crypto.randomUUID();
  const u = { key, username: `${tag}_${key}`, email: `${tag}_${key}@example.test`, fullName: `Smoke ${key.toUpperCase()}`, password };
  const r = await call('POST', '/auth/register', null,
    { fullName: u.fullName, username: u.username, email: u.email, password });
  u.reg = r;
  u.token = r.body?.token;
  u.id = r.body?.user?.id;
  users[key] = u;
  return u;
}

function once(socket, event, ms = 4000) {
  return new Promise((resolve) => {
    const t = setTimeout(() => resolve(null), ms);
    socket.once(event, (d) => { clearTimeout(t); resolve(d ?? true); });
  });
}

async function main() {
  // ── health + registration ───────────────────────────────────────
  const health = await call('GET', '/health');
  check('health endpoint', health.status === 200, health);

  const A = await makeUser('a');
  const B = await makeUser('b');
  const C = await makeUser('c');
  check('register A -> 201 + token + uuid id', A.reg.status === 201 && !!A.token && UUID.test(A.id), A.reg);
  check('register B and C', B.reg.status === 201 && C.reg.status === 201, [B.reg.status, C.reg.status]);

  const dupEmail = await call('POST', '/auth/register', null,
    { fullName: 'Dup', username: tag + '_dupe', email: A.email, password: 'whatever1' });
  check('duplicate email -> 409', dupEmail.status === 409, dupEmail);
  const dupUser = await call('POST', '/auth/register', null,
    { fullName: 'Dup', username: A.username, email: tag + '_dupe@example.test', password: 'whatever1' });
  check('duplicate username -> 409', dupUser.status === 409, dupUser);
  const shortName = await call('POST', '/auth/register', null,
    { fullName: 'X', username: tag + '_s', email: tag + '_s@example.test', password: 'whatever1' });
  check('too-short full name -> 400', shortName.status === 400, shortName);

  // ── login ───────────────────────────────────────────────────────
  const loginEmail = await call('POST', '/auth/login', null, { emailOrUsername: A.email, password: A.password });
  check('login by email', loginEmail.status === 200 && !!loginEmail.body?.token, loginEmail);
  const loginName = await call('POST', '/auth/login', null, { emailOrUsername: A.username, password: A.password });
  check('login by username', loginName.status === 200, loginName);
  const loginBad = await call('POST', '/auth/login', null, { emailOrUsername: A.email, password: 'nope-nope' });
  check('wrong password -> 401', loginBad.status === 401, loginBad);
  const me = await call('GET', '/auth/me', A.token);
  check('/auth/me returns A, no password leaked', me.status === 200 && me.body?.user?.username === A.username
    && !JSON.stringify(me.body).includes('password'), me);
  const noTok = await call('GET', '/auth/me');
  check('no token -> 401', noTok.status === 401, noTok);
  const oldTok = await call('GET', '/auth/me', 'not.a.jwt');
  check('garbage token -> 401', oldTok.status === 401, oldTok);

  // ── posts ───────────────────────────────────────────────────────
  const postBody = {
    type: 'Lost', itemName: `${tag} wallet`, category: 'Bags & Wallets', description: 'Brown leather, 100% real',
    landmark: 'Test Plaza', dateLostOrFound: new Date().toISOString(), incidentTimeApprox: 'Morning',
    rewardOffered: 'PHP 100', color: 'Brown',
  };
  const created = await call('POST', '/posts', A.token, postBody);
  const post = created.body?.post;
  check('create post -> 201 with camelCase + _id', created.status === 201 && UUID.test(post?._id)
    && post.itemName === postBody.itemName && post.status === 'Active' && post.rewardOffered === 'PHP 100', created);
  check('create post: author is the id string', post?.author === A.id, post?.author);

  const badType = await call('POST', '/posts', A.token, { ...postBody, type: 'Nope' });
  check('invalid type -> 400', badType.status === 400, badType);
  const badDate = await call('POST', '/posts', A.token, { ...postBody, dateLostOrFound: 'not-a-date' });
  check('invalid date -> 400', badDate.status === 400, badDate);
  const noAuthPost = await call('POST', '/posts', null, postBody);
  check('create post without login -> 401', noAuthPost.status === 401, noAuthPost);

  const feed = await call('GET', `/posts?search=${encodeURIComponent(tag)}`);
  const found = feed.body?.posts?.find((p) => p._id === post?._id);
  check('feed search finds the post', feed.status === 200 && !!found, feed);
  check('feed populates author {_id, fullName, username, avatar}',
    found?.author?._id === A.id && found.author.fullName === A.fullName && 'avatar' in found.author, found?.author);
  check('feed pagination + counts shape', feed.body?.pagination?.total >= 1 && typeof feed.body?.counts?.lost === 'number', feed.body);
  const nasty = await call('GET', '/posts?search=' + encodeURIComponent('a,b)(%_\\"x'));
  check('search with commas/quotes/%/_ does not 500', nasty.status === 200, nasty);
  const foundOnly = await call('GET', `/posts?type=Found&search=${encodeURIComponent(tag)}`);
  check('type=Found filter excludes a Lost post', foundOnly.status === 200 && foundOnly.body.posts.length === 0, foundOnly.body);
  const pageFar = await call('GET', '/posts?page=9999');
  check('page far beyond the end -> 200 empty', pageFar.status === 200 && pageFar.body.posts.length === 0, pageFar);
  const pageNaN = await call('GET', '/posts?page=abc&limit=xyz');
  check('garbage page/limit -> 200', pageNaN.status === 200, pageNaN);

  const one = await call('GET', `/posts/${post._id}`);
  check('get post by id (author populated)', one.status === 200 && one.body.post.author?.username === A.username, one);
  const badId = await call('GET', '/posts/not-a-uuid');
  check('malformed post id -> 404', badId.status === 404, badId);
  const missing = await call('GET', `/posts/${crypto.randomUUID()}`);
  check('unknown post id -> 404', missing.status === 404, missing);

  // ── claims ──────────────────────────────────────────────────────
  const claimBody = { postId: post._id, message: 'That is mine', proofDetails: 'Has my ID inside', contactInfo: 'x' };
  const own = await call('POST', '/claims', A.token, claimBody);
  check('claiming your own post -> 403', own.status === 403, own);
  const claim = await call('POST', '/claims', B.token, claimBody);
  const claimId = claim.body?.claim?._id;
  check('B claims -> 201', claim.status === 201 && UUID.test(claimId) && claim.body.claim.status === 'Pending', claim);
  const claimDup = await call('POST', '/claims', B.token, claimBody);
  check('duplicate claim -> 409', claimDup.status === 409, claimDup);
  const claimBadPost = await call('POST', '/claims', B.token, { ...claimBody, postId: 'nope' });
  check('claim on malformed post id -> 400', claimBadPost.status === 400, claimBadPost);

  const afterClaim = await call('GET', `/posts/${post._id}`);
  check('post status -> Claim Pending', afterClaim.body?.post?.status === 'Claim Pending', afterClaim.body?.post?.status);

  const incoming = await call('GET', '/claims/incoming', A.token);
  const inc = incoming.body?.claims?.find((c) => c._id === claimId);
  check('A sees incoming claim with post + claimant populated',
    !!inc && inc.post?.itemName === postBody.itemName && inc.claimant?.fullName === B.fullName
    && inc.proofDetails === 'Has my ID inside', incoming.body);
  const mine = await call('GET', '/claims/my', B.token);
  const my = mine.body?.claims?.find((c) => c._id === claimId);
  check('B sees own claim with post.landmark', !!my && my.post?.landmark === 'Test Plaza', mine.body);
  const incomingC = await call('GET', '/claims/incoming', C.token);
  check('C (no posts) -> empty incoming list', incomingC.status === 200 && incomingC.body.claims.length === 0, incomingC.body);

  const notOwner = await call('PATCH', `/claims/${claimId}/approve`, B.token);
  check('non-owner approve -> 403', notOwner.status === 403, notOwner);
  const approveBad = await call('PATCH', '/claims/nope/approve', A.token);
  check('approve malformed id -> 404', approveBad.status === 404, approveBad);
  const approve = await call('PATCH', `/claims/${claimId}/approve`, A.token);
  check('A approves -> 200', approve.status === 200, approve);

  const afterApprove = await call('GET', `/posts/${post._id}`);
  check('post status -> Resolved, approvedClaimId set',
    afterApprove.body?.post?.status === 'Resolved' && afterApprove.body.post.approvedClaimId === claimId, afterApprove.body?.post);
  const feedAfter = await call('GET', `/posts?search=${encodeURIComponent(tag)}`);
  check('resolved post hidden from public feed', feedAfter.body?.posts?.length === 0, feedAfter.body?.posts?.length);

  // ── conversations ───────────────────────────────────────────────
  const convA = await call('GET', '/conversations', A.token);
  const conv = convA.body?.conversations?.[0];
  check('A has exactly 1 conversation', convA.status === 200 && convA.body.conversations.length === 1, convA.body);
  check('conversation shape: 2 participants w/ names, post.itemName, lastMessage',
    conv?.participants?.length === 2 && conv.participants.some((p) => p.fullName === B.fullName)
    && conv.post?.itemName === postBody.itemName && /Claim approved/.test(conv.lastMessage || ''), conv);
  const convB = await call('GET', '/conversations', B.token);
  check('B sees the same conversation', convB.body?.conversations?.[0]?._id === conv?._id, convB.body);
  const convC = await call('GET', '/conversations', C.token);
  check('C sees no conversations', convC.body?.conversations?.length === 0, convC.body);

  const convId = conv._id;
  const msgs = await call('GET', `/conversations/${convId}/messages`, A.token);
  check('opening auto-message exists with populated sender',
    msgs.body?.messages?.length === 1 && msgs.body.messages[0].sender?.fullName === A.fullName, msgs.body);
  const msgsC = await call('GET', `/conversations/${convId}/messages`, C.token);
  check('outsider reading messages -> 403', msgsC.status === 403, msgsC);
  const msgsBad = await call('GET', '/conversations/nope/messages', A.token);
  check('malformed conversation id -> 404', msgsBad.status === 404, msgsBad);

  const send = await call('POST', `/conversations/${convId}/messages`, B.token, { content: '  hi from B  ' });
  check('B sends REST message -> 201, trimmed, sender populated',
    send.status === 201 && send.body.message.content === 'hi from B' && send.body.message.sender?.fullName === B.fullName, send);
  const sendEmpty = await call('POST', `/conversations/${convId}/messages`, B.token, { content: '   ' });
  check('empty message -> 400', sendEmpty.status === 400, sendEmpty);
  const sendC = await call('POST', `/conversations/${convId}/messages`, C.token, { content: 'let me in' });
  check('outsider sending -> 403', sendC.status === 403, sendC);
  const msgs2 = await call('GET', `/conversations/${convId}/messages`, A.token);
  check('messages ordered oldest-first (2 total)',
    msgs2.body?.messages?.length === 2 && msgs2.body.messages[1].content === 'hi from B', msgs2.body?.messages?.map((m) => m.content));
  const convA2 = await call('GET', '/conversations', A.token);
  check('lastMessage preview updated', convA2.body?.conversations?.[0]?.lastMessage === 'hi from B', convA2.body?.conversations?.[0]?.lastMessage);

  // ── Socket.IO chat ──────────────────────────────────────────────
  const sA = io(BASE, { transports: ['websocket'] });
  const sB = io(BASE, { transports: ['websocket'] });
  const sC = io(BASE, { transports: ['websocket'] });
  await Promise.all([once(sA, 'connect'), once(sB, 'connect'), once(sC, 'connect')]);
  check('3 sockets connect', sA.connected && sB.connected && sC.connected);
  sA.emit('join_conversation', convId); sB.emit('join_conversation', convId);
  await new Promise((r) => setTimeout(r, 300));
  const gotB = once(sB, 'new_message');
  sA.emit('send_message', { conversationId: convId, senderId: A.id, content: 'hello via socket' });
  const ev = await gotB;
  check('socket message broadcast to B with DB-sourced sender',
    ev?.content === 'hello via socket' && ev.sender?.fullName === A.fullName && UUID.test(ev._id), ev);
  const errC = once(sC, 'message_error');
  sC.emit('send_message', { conversationId: convId, senderId: C.id, content: 'sneaky' });
  check('socket send by non-participant -> message_error', (await errC) !== null);
  const errBad = once(sA, 'message_error');
  sA.emit('send_message', { conversationId: 'nope', senderId: A.id, content: 'x' });
  check('socket send with bad ids -> message_error', (await errBad) !== null);
  const msgs3 = await call('GET', `/conversations/${convId}/messages`, A.token);
  check('socket message persisted (3 total, no sneaky one)',
    msgs3.body?.messages?.length === 3 && !msgs3.body.messages.some((m) => m.content === 'sneaky'), msgs3.body?.messages?.map((m) => m.content));
  sA.close(); sB.close(); sC.close();

  // ── reject path on a second post ────────────────────────────────
  const p2 = (await call('POST', '/posts', A.token, { ...postBody, itemName: `${tag} keys`, type: 'Found', rewardOffered: 'ignored' })).body?.post;
  check('Found post drops rewardOffered', p2 && p2.rewardOffered === undefined, p2);
  const c2 = (await call('POST', '/claims', C.token, { postId: p2._id, message: 'm', proofDetails: 'p' })).body?.claim;
  const rej = await call('PATCH', `/claims/${c2._id}/reject`, A.token);
  const afterRej = await call('GET', `/posts/${p2._id}`);
  check('reject -> 200 and post back to Active', rej.status === 200 && afterRej.body?.post?.status === 'Active', [rej.status, afterRej.body?.post?.status]);

  // ── users / settings ────────────────────────────────────────────
  const myPosts = await call('GET', '/users/me/posts', A.token);
  check('/users/me/posts lists both posts', myPosts.body?.posts?.length === 2, myPosts.body);
  const prof = await call('GET', `/users/${A.id}`);
  check('public profile: email hidden by default, resolved post excluded',
    prof.status === 200 && prof.body.user.email === null && prof.body.user.isPrivate === false
    && prof.body.posts.length === 1 && prof.body.posts[0]._id === p2._id, prof.body);
  const showMail = await call('PATCH', '/users/me/privacy', A.token, { profileVisible: true, showEmail: true });
  const prof2 = await call('GET', `/users/${A.id}`);
  check('showEmail=true reveals email', showMail.status === 200 && prof2.body?.user?.email === A.email, prof2.body?.user);
  await call('PATCH', '/users/me/privacy', A.token, { profileVisible: false, showEmail: false });
  const prof3 = await call('GET', `/users/${A.id}`);
  check('profileVisible=false -> isPrivate, no posts', prof3.body?.user?.isPrivate === true && prof3.body.posts.length === 0, prof3.body);
  const profBad = await call('GET', '/users/nope');
  check('malformed user id -> 404', profBad.status === 404, profBad);

  const upd = await call('PATCH', '/users/me', A.token, { fullName: 'Smoke Renamed' });
  check('update profile', upd.status === 200 && upd.body.user.fullName === 'Smoke Renamed' && upd.body.user._id === A.id, upd);
  const takenName = await call('PATCH', '/users/me', A.token, { username: B.username });
  check('update to taken username -> 409', takenName.status === 409, takenName);
  const noPwMail = await call('PATCH', '/users/me', A.token, { email: B.email });
  check('changing email without the current password -> 400', noPwMail.status === 400, noPwMail);
  const takenMail = await call('PATCH', '/users/me', A.token, { email: B.email, currentPassword: A.password });
  check('update to taken email -> 409', takenMail.status === 409, takenMail);
  const noop = await call('PATCH', '/users/me', A.token, {});
  check('empty update -> 200', noop.status === 200, noop);

  const pwBad = await call('PATCH', '/users/me/password', A.token, { currentPassword: 'wrong-wrong', newPassword: 'abcdef12' });
  check('password change with wrong current -> 401', pwBad.status === 401, pwBad);
  const pwShort = await call('PATCH', '/users/me/password', A.token, { currentPassword: A.password, newPassword: 'abc' });
  check('password change too short -> 400', pwShort.status === 400, pwShort);
  const newPw = 'Nn-' + crypto.randomUUID();
  const pwOk = await call('PATCH', '/users/me/password', A.token, { currentPassword: A.password, newPassword: newPw });
  const relogin = await call('POST', '/auth/login', null, { emailOrUsername: A.email, password: newPw });
  const oldLogin = await call('POST', '/auth/login', null, { emailOrUsername: A.email, password: A.password });
  check('password changed: new works, old rejected', pwOk.status === 200 && relogin.status === 200 && oldLogin.status === 401, [pwOk.status, relogin.status, oldLogin.status]);

  const delPost = await call('DELETE', `/users/me/posts/${p2._id}`, A.token);
  const delPostAgain = await call('DELETE', `/users/me/posts/${p2._id}`, A.token);
  const delOthers = await call('DELETE', `/users/me/posts/${post._id}`, B.token);
  check('delete own post 200, again 404, another user post 404',
    delPost.status === 200 && delPostAgain.status === 404 && delOthers.status === 404, [delPost.status, delPostAgain.status, delOthers.status]);

  // chat history survives deleting the resolved post (SET NULL), like the Mongo version
  const delResolved = await call('DELETE', `/users/me/posts/${post._id}`, A.token);
  const convAfterDel = await call('GET', '/conversations', B.token);
  check('deleting the resolved post keeps the chat (post -> null)',
    delResolved.status === 200 && convAfterDel.body?.conversations?.length === 1 && convAfterDel.body.conversations[0].post === null,
    convAfterDel.body);

  // ── Batch 1: validation, image handling, limits ─────────────────
  const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
  const goodPost = { ...postBody, category: 'Bags & Wallets', itemName: `${tag} validated` };
  const tryPost = async (name, overrides, expected = 400) => {
    const r = await call('POST', '/posts', A.token, { ...goodPost, ...overrides });
    check(name, r.status === expected, r);
    return r;
  };

  await tryPost('post: description over 500 chars -> 400', { description: 'x'.repeat(501) });
  await tryPost('post: item name over 100 chars -> 400', { itemName: 'x'.repeat(101) });
  await tryPost('post: whitespace-only item name -> 400', { itemName: '   ' });
  await tryPost('post: unknown category -> 400', { category: 'Spaceships' });
  await tryPost('post: invalid time of day -> 400', { incidentTimeApprox: 'Midnight' });
  await tryPost('post: date 30 days in the future -> 400', { dateLostOrFound: new Date(Date.now() + 30 * 864e5).toISOString() });
  await tryPost('post: 5 images -> 400', { images: Array(5).fill(PNG) });
  await tryPost('post: remote https URL as image -> 400', { images: ['https://example.com/x.png'] });
  await tryPost('post: html data URL as image -> 400', { images: ['data:text/html;base64,PGgxPmhpPC9oMT4='] });
  await tryPost('post: valid-looking data URL that is not an image -> 400', { images: ['data:image/png;base64,AAAA'] }, 400);

  const okPost = await tryPost('post: valid post with 1 image -> 201', { images: [PNG] }, 201);
  const hosted = okPost.body?.post?.images?.[0];
  check('post image is hosted on Cloudinary', typeof hosted === 'string' && hosted.startsWith('https://res.cloudinary.com/'), hosted);

  const mass = await call('POST', '/posts', A.token, {
    ...goodPost, itemName: `${tag} mass`, status: 'Resolved', author: B.id, approvedClaimId: crypto.randomUUID(),
  });
  check('post: client cannot set status/author/approvedClaimId (mass assignment)',
    mass.status === 201 && mass.body.post.status === 'Active' && mass.body.post.author === A.id && mass.body.post.approvedClaimId === null,
    mass.body?.post);

  // ── avatar goes to Cloudinary; the database stores a URL, not base64 ──
  const av = await call('PATCH', '/users/me', A.token, { avatar: PNG });
  const avatarUrl = av.body?.user?.avatar;
  check('avatar upload -> Cloudinary URL stored (not base64)',
    av.status === 200 && typeof avatarUrl === 'string' && avatarUrl.startsWith('https://res.cloudinary.com/'), av);
  const avFeed = await call('GET', `/posts?search=${encodeURIComponent(tag + ' validated')}`);
  const feedPost = avFeed.body?.posts?.find((p) => p._id === okPost.body?.post?._id);
  check('feed shows the author avatar as a short URL', feedPost?.author?.avatar === avatarUrl && JSON.stringify(avFeed.body).length < 5000,
    JSON.stringify(avFeed.body).length);
  const avRemote = await call('PATCH', '/users/me', A.token, { avatar: 'https://example.com/me.png' });
  check('avatar as a remote URL -> 400', avRemote.status === 400, avRemote);
  const avClear = await call('PATCH', '/users/me', A.token, { avatar: '' });
  check('avatar "" removes it', avClear.status === 200 && avClear.body.user.avatar === '', avClear);

  const roleTry = await call('PATCH', '/users/me', A.token, { fullName: 'Still Normal', role: 'admin' });
  const meNow = await call('GET', '/auth/me', A.token);
  check('profile: client cannot promote itself to admin',
    roleTry.status === 200 && meNow.body?.user?.role === 'user', meNow.body?.user);

  // ── claim / chat length limits ──
  const claimLong = await call('POST', '/claims', B.token, { postId: okPost.body.post._id, message: 'x'.repeat(1001), proofDetails: 'p' });
  check('claim message over 1000 chars -> 400', claimLong.status === 400, claimLong);
  const msgLong = await call('POST', `/conversations/${convId}/messages`, B.token, { content: 'x'.repeat(2001) });
  check('chat message over 2000 chars -> 400', msgLong.status === 400, msgLong);

  // ── body size limits ──
  const bigBody = await call('POST', '/claims', B.token, { postId: okPost.body.post._id, message: 'x'.repeat(150_000), proofDetails: 'p' });
  check('150 KB body on a normal route -> 413 as JSON', bigBody.status === 413 && bigBody.body?.success === false, bigBody);
  const bigProfile = await call('PATCH', '/users/me', A.token, { fullName: 'x'.repeat(150_000) });
  check('PATCH /users/me allows larger bodies (fails validation, not 413)', bigProfile.status === 400, bigProfile.status);

  // ── JSON errors and limiter wiring ──
  const unknown = await call('GET', '/definitely-not-a-route');
  check('unknown /api route -> JSON 404', unknown.status === 404 && unknown.body?.success === false, unknown);
  const rawBad = await fetch(API + '/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{oops' });
  check('malformed JSON -> 400 JSON (no stack trace)', rawBad.status === 400 && (await rawBad.json()).success === false);
  const loginRes = await fetch(API + '/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ emailOrUsername: A.email, password: newPw }),
  });
  check('login carries its 10-per-15-minutes limit policy', loginRes.status === 200 && /^10;w=900/.test(loginRes.headers.get('ratelimit-policy') || ''),
    loginRes.headers.get('ratelimit-policy'));

  // (the per-account message limit is tested by limiter.mjs, with a concurrent burst)

}

try {
  await main();
} catch (e) {
  fail++;
  console.log('SCRIPT ERROR', e);
} finally {
  // cleanup: delete accounts (cascades everything they own)
  for (const u of Object.values(users)) {
    if (!u.token) continue;
    const r = await call('DELETE', '/users/me', u.token);
    console.log('cleanup', u.key, r.status);
  }
  const gone = await call('POST', '/auth/login', null, { emailOrUsername: users.a?.email ?? 'x', password: 'x' });
  console.log('accounts gone (login now 401):', gone.status === 401);
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}
