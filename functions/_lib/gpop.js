import { toDateLabel } from './dateutil.js';

function rowToGpop(r) {
  return {
    empId: r.emp_id, dateKey: r.date_key, dateLabel: toDateLabel(r.date_key),
    name: r.name || '', busho: r.busho || '',
    goal: r.goal || '', pre: r.pre || '', on: r.on_field || '', post: r.post || '', nextPre: r.next_pre || ''
  };
}

export async function getDates(env, empId) {
  const { results } = await env.DB.prepare(
    'SELECT date_key FROM gpop_reports WHERE emp_id = ? ORDER BY date_key DESC LIMIT 30'
  ).bind(empId).all();
  return results.map(r => ({ dateKey: r.date_key, dateLabel: toDateLabel(r.date_key) }));
}

export async function getByDateAll(env, dateKey) {
  const { results } = await env.DB.prepare(
    'SELECT * FROM gpop_reports WHERE date_key = ? ORDER BY busho, name'
  ).bind(dateKey).all();
  return results.map(rowToGpop);
}

export async function getMyByDate(env, empId, dateKey) {
  const r = await env.DB.prepare('SELECT * FROM gpop_reports WHERE emp_id = ? AND date_key = ?')
    .bind(empId, dateKey).first();
  return r ? rowToGpop(r) : null;
}

export async function getDaysInMonth(env, year, month) {
  const prefix = `${year}-${String(month).padStart(2, '0')}-`;
  const { results } = await env.DB.prepare(
    "SELECT DISTINCT date_key FROM gpop_reports WHERE date_key LIKE ? || '%'"
  ).bind(prefix).all();
  return results.map(r => parseInt(r.date_key.slice(-2), 10));
}

export async function remove(env, empId, dateKey) {
  await env.DB.prepare('DELETE FROM gpop_reports WHERE emp_id = ? AND date_key = ?').bind(empId, dateKey).run();
  return { success: true };
}

export async function save(env, empId, name, busho, dateKey, fields) {
  fields = fields || {};
  await env.DB.prepare(
    `INSERT INTO gpop_reports (emp_id, date_key, name, busho, goal, pre, on_field, post, next_pre)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(emp_id, date_key) DO UPDATE SET
       name=excluded.name, busho=excluded.busho, goal=excluded.goal, pre=excluded.pre,
       on_field=excluded.on_field, post=excluded.post, next_pre=excluded.next_pre`
  ).bind(empId, dateKey, name, busho, fields.goal || '', fields.pre || '', fields.on || '', fields.post || '', fields.nextPre || '').run();
  return { success: true };
}
