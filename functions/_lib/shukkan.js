import { ymLabel } from './dateutil.js';

export async function get(env, empId, ym) {
  const { results } = await env.DB.prepare(
    'SELECT * FROM shukkan_entries WHERE emp_id = ? AND year_month = ? ORDER BY date_key'
  ).bind(empId, ym).all();
  return results.map(r => ({
    date: r.date_key, time: r.time || '', hours: r.hours || '', genba: r.genba || '',
    zan: r.zangyo || '', shinya: r.shinya || '', car: r.car || '', dist: r.dist || '', biko: r.biko || ''
  }));
}

export async function remove(env, empId, yearMonth) {
  await env.DB.prepare('DELETE FROM shukkan_entries WHERE emp_id = ? AND year_month = ?').bind(empId, yearMonth).run();
  return { success: true };
}

export async function save(env, empId, name, yearMonth, rows) {
  const stmts = [env.DB.prepare('DELETE FROM shukkan_entries WHERE emp_id = ? AND year_month = ?').bind(empId, yearMonth)];
  (rows || []).forEach(r => {
    stmts.push(env.DB.prepare(
      `INSERT INTO shukkan_entries (emp_id, name, year_month, date_key, time, hours, genba, zangyo, shinya, car, dist, biko)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`
    ).bind(empId, name, yearMonth, r.date, r.time || '', r.hours || '', r.genba || '',
      r.zan || '', r.shinya || '', r.car || '', r.dist || '', r.biko || ''));
  });
  await env.DB.batch(stmts);
  return { success: true };
}

export async function getMonths(env, empId) {
  const { results } = await env.DB.prepare(
    'SELECT DISTINCT year_month FROM shukkan_entries WHERE emp_id = ? ORDER BY year_month DESC'
  ).bind(empId).all();
  return results.map(r => ({ ym: r.year_month, label: ymLabel(r.year_month) }));
}

export async function getMonthAll(env, ym) {
  const { results } = await env.DB.prepare(
    'SELECT * FROM shukkan_entries WHERE year_month = ? ORDER BY emp_id, date_key'
  ).bind(ym).all();
  return results.map(r => ({
    empId: r.emp_id, name: r.name || '', date: r.date_key,
    time: r.time || '', hours: r.hours || '', genba: r.genba || '',
    zan: r.zangyo || '', shinya: r.shinya || '', car: r.car || '', dist: r.dist || '', biko: r.biko || ''
  }));
}
