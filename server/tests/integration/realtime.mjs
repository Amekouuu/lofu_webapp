// Integration test: live chat over Socket.IO. Creates three throwaway users (3 registrations),
// one post and one claim, and deletes the users at the end.
// Run: node tests/integration/realtime.mjs     Set API_URL to test another server.
//
// Covers: sockets need a valid login token; only chat participants can listen to a chat; messages
// reach the other person instantly; the old "send_message" socket event (which trusted a sender id
// from the browser) no longer exists; claim approval pings both people.
import crypto from 'crypto';
import { createRequire } from 'module';

// socket.io-client is a dependency of the Angular client, not of the server.
const { io } = createRequire(new URL('../../../client/package.json', import.meta.url))('socket.io-client');

const ORIGIN = process.env.API_URL ?? 'http://localhost:5000';
const API = ORIGIN + '/api';
const tag = 'rt' + crypto.randomBytes(3).toString('hex');
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

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function until(fn, ms = 3000) {
  const end = Date.now() + ms;
  while (Date.now() < end) { if (fn()) return true; await sleep(25); }
  return fn();
}

const created = [];
async function makeUser(key) {
  const password = 'Tt-' + crypto.randomUUID();
  const r = await call('POST', '/auth/register', null, {
    fullName: `Rt ${key.toUpperCase()}`, username: `${tag}_${key}`, email: `${tag}_${key}@example.test`, password,
  });
  const user = { key, token: r.body?.token, id: r.body?.user?.id, status: r.status };
  if (user.token) created.push(user);
  return user;
}

const sockets = [];
// Connects and records every event it receives, so a check can look at them after the fact.
function connect(token) {
  const socket = io(ORIGIN, { auth: { token }, reconnection: false, transports: ['websocket'] });
  const inbox = [];
  socket.onAny((event, payload) => inbox.push({ event, payload }));
  sockets.push(socket);
  return { socket, inbox, count: (event) => inbox.filter((e) => e.event === event).length };
}

const waitConnected = (c) => until(() => c.socket.connected, 4000);
const join = (c, id) => new Promise((resolve) => {
  const timer = setTimeout(() => resolve('timeout'), 3000);
  c.socket.emit('join_conversation', id, (ok) => { clearTimeout(timer); resolve(ok); });
});

// A syntactically valid JWT signed with a secret the server does not know.
function jwtLike(userId) {
  const enc = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
  const body = `${enc({ alg: 'HS256', typ: 'JWT' })}.${enc({ userId })}`;
  const sig = crypto.createHmac('sha256', 'not-the-server-secret').update(body).digest('base64url');
  return `${body}.${sig}`;
}

try {
  const A = await makeUser('a');   // owner of the post
  const B = await makeUser('b');   // claimant
  const C = await makeUser('c');   // outsider
  check('three test users registered', A.status === 201 && B.status === 201 && C.status === 201, [A.status, B.status, C.status]);

  // ---- who may connect ----
  const anon = connect(undefined);
  const forged = connect('not-a-real-token');
  const wrongSecret = connect(jwtLike(A.id));
  await sleep(1500);
  check('no token: connection refused', !anon.socket.connected, anon.inbox);
  check('garbage token: connection refused', !forged.socket.connected);
  check('token signed with the wrong secret: connection refused', !wrongSecret.socket.connected);

  const a = connect(A.token), b = connect(B.token), c = connect(C.token);
  const a2 = connect(A.token);   // same person, second tab, not listening to the chat
  check('valid tokens connect', (await Promise.all([a, b, c, a2].map(waitConnected))).every(Boolean));

  // ---- claim approval pings both people ----
  const post = await call('POST', '/posts', A.token, {
    type: 'Found', itemName: `${tag} wallet`, category: 'Keys', description: 'realtime test',
    landmark: 'Test Plaza', dateLostOrFound: new Date().toISOString(),
  });
  const claim = await call('POST', '/claims', B.token, { postId: post.body?.post?._id, message: 'mine', proofDetails: 'proof' });
  const approve = await call('PATCH', `/claims/${claim.body?.claim?._id}/approve`, A.token);
  check('post -> claim -> approve worked', post.status === 201 && claim.status === 201 && approve.status === 200, [post.status, claim.status, approve.status]);

  check('owner is told the conversation list changed', await until(() => a.count('conversations_changed') >= 1));
  check('claimant is told the conversation list changed', await until(() => b.count('conversations_changed') >= 1));
  await sleep(300);
  check('an outsider is not told', c.count('conversations_changed') === 0, c.inbox);

  const convs = await call('GET', '/conversations', B.token);
  const convId = convs.body?.conversations?.[0]?._id;
  check('conversation exists', !!convId, convs.body);

  // ---- who may listen to a chat ----
  check('outsider cannot join the chat', (await join(c, convId)) === false);
  check('a non-uuid chat id is refused', (await join(c, 'not-a-uuid')) === false);
  check('owner can join', (await join(a, convId)) === true);
  check('claimant can join', (await join(b, convId)) === true);

  // ---- delivery ----
  const sent = await call('POST', `/conversations/${convId}/messages`, B.token, { content: 'hello over the wire' });
  check('REST send still works', sent.status === 201, sent);

  check('owner (in the chat) receives the message live', await until(() => a.count('new_message') === 1));
  const got = a.inbox.find((e) => e.event === 'new_message')?.payload;
  check('payload carries conversation id, text and sender',
    got?.conversationId === convId && got?.message?.content === 'hello over the wire' && got?.message?.sender?._id === B.id, got);
  check('claimant (sender, in the chat) also receives it', await until(() => b.count('new_message') === 1));
  check('owner second tab (not in the chat) gets the list refresh, not the message',
    await until(() => a2.count('conversations_changed') >= 2) && a2.count('new_message') === 0, a2.inbox.map((e) => e.event));
  await sleep(300);
  check('outsider receives nothing about it', c.count('new_message') === 0 && c.count('conversations_changed') === 0, c.inbox);

  // ---- the old trusting event is gone ----
  const before = (await call('GET', `/conversations/${convId}/messages`, A.token)).body?.messages?.length;
  c.socket.emit('send_message', { conversationId: convId, senderId: B.id, content: 'forged as B' });
  a.socket.emit('send_message', { conversationId: convId, senderId: B.id, content: 'forged as B by A' });
  await sleep(800);
  const after = (await call('GET', `/conversations/${convId}/messages`, A.token)).body?.messages?.length;
  check('socket send_message creates nothing (no impersonation)', before === after, [before, after]);
  check('...and nothing was broadcast', a.count('new_message') === 1 && b.count('new_message') === 1);

  // ---- leaving ----
  a.socket.emit('leave_conversation', convId);
  await sleep(300);
  await call('POST', `/conversations/${convId}/messages`, B.token, { content: 'second' });
  check('after leaving, the owner no longer gets that chat live', await until(() => b.count('new_message') === 2) && a.count('new_message') === 1,
    [a.count('new_message'), b.count('new_message')]);
} catch (e) {
  fail++;
  console.log('SCRIPT ERROR', e);
} finally {
  for (const s of sockets) s.disconnect();
  for (const u of created) {
    const r = await call('DELETE', '/users/me', u.token);
    console.log('cleanup', u.key, r.status);
  }
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}
