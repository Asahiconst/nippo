import { toDateLabel } from './dateutil.js';

const KEYS = [
  'mainWork', 'results', 'achievement', 'timeUsed', 'howAchieved',
  'urgentImportant', 'notUrgentImportant', 'horenso', 'bestEffort', 'thanks', 'impression'
];
const COLS = [
  'main_work', 'results', 'achievement', 'time_used', 'how_achieved',
  'urgent_important', 'not_urgent_important', 'horenso', 'best_effort', 'thanks', 'impression'
];

function rowToReport(r) {
  const obj = { empId: r.emp_id, dateKey: r.date_key, dateLabel: toDateLabel(r.date_key), name: r.name || '', busho: r.busho || '' };
  KEYS.forEach((k, i) => { obj[k] = r[COLS[i]] || ''; });
  return obj;
}

export async function getDates(env, empId) {
  const { results } = await env.DB.prepare(
    'SELECT date_key FROM gyoumu_reports WHERE emp_id = ? ORDER BY date_key DESC LIMIT 30'
  ).bind(empId).all();
  return results.map(r => ({ dateKey: r.date_key, dateLabel: toDateLabel(r.date_key) }));
}

export async function getByDateForEmp(env, empId, dateKey) {
  const { results } = await env.DB.prepare(
    'SELECT * FROM gyoumu_reports WHERE emp_id = ? AND date_key = ?'
  ).bind(empId, dateKey).all();
  return results.map(rowToReport);
}

export async function getByDateAll(env, dateKey) {
  const { results } = await env.DB.prepare(
    'SELECT * FROM gyoumu_reports WHERE date_key = ? ORDER BY busho, name'
  ).bind(dateKey).all();
  return results.map(rowToReport);
}

export async function getDaysInMonth(env, year, month) {
  const prefix = `${year}-${String(month).padStart(2, '0')}-`;
  const { results } = await env.DB.prepare(
    "SELECT DISTINCT date_key FROM gyoumu_reports WHERE date_key LIKE ? || '%'"
  ).bind(prefix).all();
  return results.map(r => parseInt(r.date_key.slice(-2), 10));
}

export async function remove(env, empId, dateKey) {
  await env.DB.prepare('DELETE FROM gyoumu_reports WHERE emp_id = ? AND date_key = ?').bind(empId, dateKey).run();
  return { success: true };
}

export async function save(env, empId, name, busho, dateKey, fields) {
  const values = KEYS.map(k => (fields && fields[k]) || '');
  await env.DB.prepare(
    `INSERT INTO gyoumu_reports (emp_id, date_key, name, busho, ${COLS.join(',')})
     VALUES (?, ?, ?, ?, ${COLS.map(() => '?').join(',')})
     ON CONFLICT(emp_id, date_key) DO UPDATE SET
       name=excluded.name, busho=excluded.busho,
       ${COLS.map(c => `${c}=excluded.${c}`).join(', ')}`
  ).bind(empId, dateKey, name, busho, ...values).run();
  return { success: true };
}
