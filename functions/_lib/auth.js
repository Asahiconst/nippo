import { newToken } from './hash.js';

const SESSION_DAYS = 14;
const COOKIE_NAME = 'session';

export function getCookie(request, name) {
  const header = request.headers.get('Cookie') || '';
  const m = header.match(new RegExp('(?:^|;\\s*)' + name + '=([^;]+)'));
  return m ? decodeURIComponent(m[1]) : null;
}

export function sessionCookie(token, maxAgeSeconds) {
  return `${COOKIE_NAME}=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAgeSeconds}`;
}

export function clearCookie() {
  return `${COOKIE_NAME}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;
}

export async function createSession(env, userId) {
  const token = newToken();
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 86400000).toISOString();
  await env.DB.prepare('INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)')
    .bind(token, userId, expiresAt).run();
  return { token, maxAge: SESSION_DAYS * 86400 };
}

export async function destroySession(env, token) {
  if (!token) return;
  await env.DB.prepare('DELETE FROM sessions WHERE token = ?').bind(token).run();
}

// 現在のログインユーザーを取得（未ログインならnull）
export async function getCurrentUser(request, env) {
  const token = getCookie(request, COOKIE_NAME);
  if (!token) return null;
  const session = await env.DB.prepare('SELECT user_id, expires_at FROM sessions WHERE token = ?')
    .bind(token).first();
  if (!session) return null;
  if (new Date(session.expires_at).getTime() < Date.now()) {
    await destroySession(env, token);
    return null;
  }
  const user = await env.DB.prepare('SELECT id, role, name, busho FROM users WHERE id = ?')
    .bind(session.user_id).first();
  return user || null;
}

export function json(data, init) {
  return new Response(JSON.stringify(data), {
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    ...init
  });
}

export function unauthorized() {
  return json({ success: false, message: 'ログインが必要です。' }, { status: 401 });
}

export function forbidden() {
  return json({ success: false, message: '権限がありません。' }, { status: 403 });
}
