import { toDateLabel } from './dateutil.js';

export const MONEY_CATS = ['資材', '労務', '機械', '外注', '経費', '工事原価'];

function rowToGenba(r) {
  const images = [];
  for (let i = 1; i <= 8; i++) images.push(r['image' + i] || '');
  let money = {};
  try { money = JSON.parse(r.money_json || '{}'); } catch (e) { money = {}; }
  MONEY_CATS.forEach(cat => { if (!money[cat]) money[cat] = { h: '', r: '', y: '' }; });
  return {
    id: r.id, empId: r.emp_id, dateKey: r.date_key, dateLabel: toDateLabel(r.date_key),
    name: r.name || '', busho: r.busho || '',
    genbamei: r.genbamei || '', sekou: r.sekou || '', gaiyou: r.gaiyou || '', sagyou: r.sagyou || '',
    uten: r.uten || '', shinchoku: r.shinchoku || '', roumu: r.roumu || '', shizai: r.shizai || '',
    kikai: r.kikai || '', gaichu: r.gaichu || '', flow: r.flow || '',
    images,
    kansei: r.kansei || '', kensa: r.kensa || '', buffer: r.buffer || '',
    yoyuDays: r.yoyu_days || '', yoyuRate: r.yoyu_rate || '', zan: r.zan || '', kadou: r.kadou || '',
    money
  };
}

export async function getDates(env, empId) {
  const { results } = await env.DB.prepare(
    'SELECT DISTINCT date_key FROM genba_reports WHERE emp_id = ? ORDER BY date_key DESC LIMIT 30'
  ).bind(empId).all();
  return results.map(r => ({ dateKey: r.date_key, dateLabel: toDateLabel(r.date_key) }));
}

export async function getByDateAll(env, dateKey) {
  const { results } = await env.DB.prepare(
    'SELECT * FROM genba_reports WHERE date_key = ? ORDER BY busho, name'
  ).bind(dateKey).all();
  return results.map(rowToGenba);
}

export async function getMyByDate(env, empId, dateKey) {
  const r = await env.DB.prepare('SELECT * FROM genba_reports WHERE emp_id = ? AND date_key = ? ORDER BY id DESC LIMIT 1')
    .bind(empId, dateKey).first();
  return r ? rowToGenba(r) : null;
}

export async function getDaysInMonth(env, year, month) {
  const prefix = `${year}-${String(month).padStart(2, '0')}-`;
  const { results } = await env.DB.prepare(
    "SELECT DISTINCT date_key FROM genba_reports WHERE date_key LIKE ? || '%'"
  ).bind(prefix).all();
  return results.map(r => parseInt(r.date_key.slice(-2), 10));
}

export async function getSitesInMonth(env, year, month) {
  const prefix = `${year}-${String(month).padStart(2, '0')}-`;
  const { results } = await env.DB.prepare(
    "SELECT date_key, genbamei FROM genba_reports WHERE date_key LIKE ? || '%'"
  ).bind(prefix).all();
  const map = {};
  results.forEach(r => {
    const d = parseInt(r.date_key.slice(-2), 10);
    const site = r.genbamei || '（現場名なし）';
    if (!map[d]) map[d] = [];
    if (map[d].indexOf(site) < 0) map[d].push(site);
  });
  return map;
}

export async function remove(env, empId, dateKey) {
  await env.DB.prepare('DELETE FROM genba_reports WHERE emp_id = ? AND date_key = ?').bind(empId, dateKey).run();
  return { success: true };
}

export async function save(env, empId, name, busho, dateKey, data, money, images) {
  data = data || {};
  const imgCols = (images || []).slice(0, 8);
  while (imgCols.length < 8) imgCols.push('');
  const moneyObj = {};
  MONEY_CATS.forEach(cat => {
    const mc = (money && money[cat]) || {};
    moneyObj[cat] = { h: mc.h || '', r: mc.r || '', y: mc.y || '' };
  });
  await env.DB.prepare(
    `INSERT INTO genba_reports (
      emp_id, date_key, name, busho, genbamei, sekou, gaiyou, sagyou, uten, shinchoku,
      roumu, shizai, kikai, gaichu, flow,
      image1, image2, image3, image4, image5, image6, image7, image8,
      kansei, kensa, buffer, yoyu_days, yoyu_rate, zan, kadou, money_json
    ) VALUES (?,?,?,?,?,?,?,?,?,?, ?,?,?,?,?, ?,?,?,?,?,?,?,?, ?,?,?,?,?,?,?,?)`
  ).bind(
    empId, dateKey, name, busho,
    data.genbamei || '', data.sekou || '', data.gaiyou || '', data.sagyou || '',
    data.uten || '', data.shinchoku || '', data.roumu || '', data.shizai || '',
    data.kikai || '', data.gaichu || '', data.flow || '',
    ...imgCols,
    data.kansei || '', data.kensa || '', data.buffer || '',
    data.yoyuDays || '', data.yoyuRate || '', data.zan || '', data.kadou || '',
    JSON.stringify(moneyObj)
  ).run();
  return { success: true };
}

// 画像をR2に保存しキーを返す。既存キー（文字列でdata無し）はそのまま返す。
export async function saveImage(env, empId, dateKey, slot, img) {
  if (!img) return '';
  if (typeof img === 'string') return img; // 既存キーはそのまま
  if (!img.data) return '';
  const bytes = Uint8Array.from(atob(img.data), c => c.charCodeAt(0));
  const key = `genba/${empId}/${dateKey}/${slot}-${Date.now()}.jpg`;
  await env.IMAGES.put(key, bytes, { httpMetadata: { contentType: img.mimeType || 'image/jpeg' } });
  return key;
}
