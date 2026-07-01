export async function getSetting(env, key) {
  const r = await env.DB.prepare('SELECT value FROM app_settings WHERE key = ?').bind(key).first();
  return r ? r.value : '';
}
export async function setSetting(env, key, value) {
  await env.DB.prepare(
    'INSERT INTO app_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value'
  ).bind(key, value || '').run();
  return { success: true };
}

export async function getSpecialDays(env) {
  const { results } = await env.DB.prepare('SELECT date_key, type, name FROM special_days ORDER BY date_key').all();
  return results.map(r => ({ date: r.date_key, type: r.type, name: r.name || '' }));
}
export async function addSpecialDay(env, date, type, name) {
  await env.DB.prepare(
    `INSERT INTO special_days (date_key, type, name) VALUES (?,?,?)
     ON CONFLICT(date_key) DO UPDATE SET type=excluded.type, name=excluded.name`
  ).bind(date, type === 'pto' ? 'pto' : 'holiday', name || '').run();
  return { success: true };
}
export async function deleteSpecialDay(env, date) {
  await env.DB.prepare('DELETE FROM special_days WHERE date_key = ?').bind(date).run();
  return { success: true };
}

export async function getMgmtSelection(env, type) {
  const v = await getSetting(env, 'mgmtSel_' + type);
  return v ? JSON.parse(v) : null;
}
export async function saveMgmtSelection(env, type, ids) {
  return setSetting(env, 'mgmtSel_' + type, JSON.stringify(ids || []));
}
