import { ymLabel } from './dateutil.js';

export async function get(env, empId, ym) {
  const { results } = await env.DB.prepare(
    'SELECT * FROM unten_entries WHERE emp_id = ? AND year_month = ? ORDER BY date_key'
  ).bind(empId, ym).all();
  return results.map(r => ({ date: r.date_key, memo: r.memo || '', distance: r.distance || '', remarks: r.remarks || '' }));
}

export async function remove(env, empId, yearMonth) {
  await env.DB.prepare('DELETE FROM unten_entries WHERE emp_id = ? AND year_month = ?').bind(empId, yearMonth).run();
  return { success: true };
}

export async function save(env, empId, name, yearMonth, rows) {
  const stmts = [env.DB.prepare('DELETE FROM unten_entries WHERE emp_id = ? AND year_month = ?').bind(empId, yearMonth)];
  (rows || []).forEach(r => {
    stmts.push(env.DB.prepare(
      'INSERT INTO unten_entries (emp_id, name, year_month, date_key, memo, distance, remarks) VALUES (?,?,?,?,?,?,?)'
    ).bind(empId, name, yearMonth, r.date, r.memo || '', r.distance || '', r.remarks || ''));
  });
  await env.DB.batch(stmts);
  return { success: true };
}

export async function getMonths(env, empId) {
  const { results } = await env.DB.prepare(
    'SELECT year_month, distance FROM unten_entries WHERE emp_id = ?'
  ).bind(empId).all();
  const map = {};
  results.forEach(r => {
    if (!map[r.year_month]) map[r.year_month] = 0;
    const d = parseFloat(r.distance);
    if (!isNaN(d)) map[r.year_month] += d;
  });
  return Object.keys(map).sort().reverse().map(ym => ({
    ym, label: ymLabel(ym), km: Math.round(map[ym] * 100) / 100
  }));
}

export async function getMonthAll(env, ym) {
  const { results } = await env.DB.prepare(
    'SELECT * FROM unten_entries WHERE year_month = ? ORDER BY emp_id, date_key'
  ).bind(ym).all();
  return results.map(r => ({
    empId: r.emp_id, name: r.name || '', date: r.date_key,
    memo: r.memo || '', distance: r.distance || '', remarks: r.remarks || ''
  }));
}
