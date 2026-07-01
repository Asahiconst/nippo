import { hashPassword } from './hash.js';

export async function getAll(env) {
  const { results } = await env.DB.prepare(
    'SELECT id, name, busho FROM users ORDER BY sort_order, id'
  ).all();
  return results.map(r => ({ id: r.id, name: r.name || r.id, busho: r.busho || '' }));
}

export async function getFull(env) {
  const { results } = await env.DB.prepare(
    'SELECT id, role, name, busho FROM users ORDER BY sort_order, id'
  ).all();
  return results.map(r => ({ id: r.id, role: r.role || '一般ユーザー', name: r.name || '', busho: r.busho || '' }));
}

export async function add(env, u) {
  if (!u || !u.id) return { success: false, message: '社員IDを入力してください。' };
  const existing = await env.DB.prepare('SELECT id FROM users WHERE id = ?').bind(u.id).first();
  if (existing) return { success: false, message: 'その社員IDは既に存在します。' };
  const maxRow = await env.DB.prepare('SELECT MAX(sort_order) AS m FROM users').first();
  const sortOrder = (maxRow && maxRow.m != null ? maxRow.m : 0) + 1;
  const hash = await hashPassword(u.password || '');
  await env.DB.prepare(
    'INSERT INTO users (id, password_hash, role, name, busho, sort_order) VALUES (?,?,?,?,?,?)'
  ).bind(u.id, hash, u.role || '一般ユーザー', u.name || '', u.busho || '', sortOrder).run();
  return { success: true };
}

export async function update(env, origId, u) {
  const existing = await env.DB.prepare('SELECT id FROM users WHERE id = ?').bind(origId).first();
  if (!existing) return { success: false, message: '対象ユーザーが見つかりません。' };
  if (u.id !== origId) {
    const dup = await env.DB.prepare('SELECT id FROM users WHERE id = ?').bind(u.id).first();
    if (dup) return { success: false, message: 'その社員IDは既に存在します。' };
  }
  if (u.password) {
    const hash = await hashPassword(u.password);
    await env.DB.prepare('UPDATE users SET id=?, password_hash=?, role=?, name=?, busho=? WHERE id=?')
      .bind(u.id, hash, u.role || '一般ユーザー', u.name || '', u.busho || '', origId).run();
  } else {
    await env.DB.prepare('UPDATE users SET id=?, role=?, name=?, busho=? WHERE id=?')
      .bind(u.id, u.role || '一般ユーザー', u.name || '', u.busho || '', origId).run();
  }
  return { success: true };
}

export async function remove(env, id) {
  const existing = await env.DB.prepare('SELECT id FROM users WHERE id = ?').bind(id).first();
  if (!existing) return { success: false, message: '対象ユーザーが見つかりません。' };
  await env.DB.prepare('DELETE FROM users WHERE id = ?').bind(id).run();
  return { success: true };
}

export async function reorder(env, ids) {
  const stmts = (ids || []).map((id, i) =>
    env.DB.prepare('UPDATE users SET sort_order = ? WHERE id = ?').bind(i, id)
  );
  if (stmts.length) await env.DB.batch(stmts);
  return { success: true };
}
