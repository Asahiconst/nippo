// 日報システム.xlsx → D1移行用SQLを生成する
// 使い方: node scripts/migrate.mjs
// 出力: migration.sql （wrangler d1 execute nippo-db --remote --file=migration.sql で投入）
import XLSX from 'xlsx';
import { writeFileSync } from 'node:fs';
import { hashPassword } from '../functions/_lib/hash.js';

const SRC = '日報システム.xlsx';
const wb = XLSX.readFile(SRC, { cellDates: true });

function sheet(name) {
  const ws = wb.Sheets[name];
  if (!ws) throw new Error(`シートが見つかりません: ${name}`);
  return XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
}

function esc(v) {
  if (v === null || v === undefined) return "''";
  return `'${String(v).replace(/'/g, "''")}'`;
}

function dateKey(v) {
  if (v instanceof Date) {
    const y = v.getFullYear(), m = String(v.getMonth() + 1).padStart(2, '0'), d = String(v.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  const s = String(v || '').trim();
  const m = s.match(/(\d{4})\D+(\d{1,2})\D+(\d{1,2})/);
  if (m) return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
  return s;
}

function ymKey(v) {
  if (v instanceof Date) return `${v.getFullYear()}-${String(v.getMonth() + 1).padStart(2, '0')}`;
  const s = String(v || '');
  const m = s.match(/(\d{4})\D(\d{1,2})/);
  return m ? `${m[1]}-${m[2].padStart(2, '0')}` : s;
}

const out = [];

// ===== ユーザー =====
const users = sheet('ユーザー').slice(1).filter(r => r[0] !== '' && r[0] != null);
let userCount = 0;
for (let i = 0; i < users.length; i++) {
  const [id, pass, role, name, busho] = users[i];
  const hash = await hashPassword(String(pass));
  out.push(
    `INSERT OR REPLACE INTO users (id, password_hash, role, name, busho, sort_order) VALUES (${esc(id)}, ${esc(hash)}, ${esc(role || '一般ユーザー')}, ${esc(name || '')}, ${esc(busho || '')}, ${i});`
  );
  userCount++;
}

// ===== 業務改善日報 =====
const gyoumu = sheet('業務改善日報').slice(1).filter(r => r[0] !== '' && r[0] != null);
const GYOUMU_COLS = ['main_work', 'results', 'achievement', 'time_used', 'how_achieved', 'urgent_important', 'not_urgent_important', 'horenso', 'best_effort', 'thanks', 'impression'];
for (const r of gyoumu) {
  const [empId, date, name, busho, ...fields] = r;
  const cols = ['emp_id', 'date_key', 'name', 'busho', ...GYOUMU_COLS];
  const vals = [esc(empId), esc(dateKey(date)), esc(name || ''), esc(busho || ''), ...GYOUMU_COLS.map((c, i) => esc(fields[i] ?? ''))];
  out.push(`INSERT OR REPLACE INTO gyoumu_reports (${cols.join(',')}) VALUES (${vals.join(',')});`);
}

// ===== G-POP =====
const gpop = sheet('G-POP').slice(1).filter(r => r[0] !== '' && r[0] != null);
for (const r of gpop) {
  const [empId, date, name, busho, goal, pre, on_, post, nextPre] = r;
  out.push(
    `INSERT OR REPLACE INTO gpop_reports (emp_id, date_key, name, busho, goal, pre, on_field, post, next_pre) VALUES (${esc(empId)}, ${esc(dateKey(date))}, ${esc(name || '')}, ${esc(busho || '')}, ${esc(goal || '')}, ${esc(pre || '')}, ${esc(on_ || '')}, ${esc(post || '')}, ${esc(nextPre || '')});`
  );
}

// ===== 現場管理日報 =====
const genba = sheet('現場管理日報').slice(1).filter(r => r[0] !== '' && r[0] != null);
const MONEY_CATS = ['資材', '労務', '機械', '外注', '経費', '工事原価'];
for (const r of genba) {
  const empId = r[0], date = r[1], name = r[2], busho = r[3];
  const [genbamei, sekou, gaiyou, sagyou, uten, shinchoku, roumu, shizai, kikai, gaichu, flow] = r.slice(4, 15);
  const images = r.slice(15, 23);
  const [kansei, kensa, buffer, yoyuDays, yoyuRate, zan, kadou] = r.slice(23, 30);
  const money = {};
  MONEY_CATS.forEach((cat, idx) => {
    const base = 30 + idx * 3;
    money[cat] = { h: r[base] ?? '', r: r[base + 1] ?? '', y: r[base + 2] ?? '' };
  });
  const cols = ['emp_id', 'date_key', 'name', 'busho', 'genbamei', 'sekou', 'gaiyou', 'sagyou', 'uten', 'shinchoku',
    'roumu', 'shizai', 'kikai', 'gaichu', 'flow',
    'image1', 'image2', 'image3', 'image4', 'image5', 'image6', 'image7', 'image8',
    'kansei', 'kensa', 'buffer', 'yoyu_days', 'yoyu_rate', 'zan', 'kadou', 'money_json'];
  const vals = [esc(empId), esc(dateKey(date)), esc(name || ''), esc(busho || ''),
    esc(genbamei || ''), esc(sekou || ''), esc(gaiyou || ''), esc(sagyou || ''), esc(uten || ''), esc(shinchoku || ''),
    esc(roumu || ''), esc(shizai || ''), esc(kikai || ''), esc(gaichu || ''), esc(flow || ''),
    ...images.map(v => esc(v || '')),
    esc(kansei || ''), esc(kensa || ''), esc(buffer || ''), esc(yoyuDays || ''), esc(yoyuRate || ''), esc(zan || ''), esc(kadou || ''),
    esc(JSON.stringify(money))];
  out.push(`INSERT INTO genba_reports (${cols.join(',')}) VALUES (${vals.join(',')});`);
}

// ===== 出勤簿 =====
const shukkan = sheet('出勤簿').slice(1).filter(r => r[0] !== '' && r[0] != null);
for (const r of shukkan) {
  const [empId, name, ym, date, time, hours, genba_, zan, shinya, car, dist, biko] = r;
  out.push(
    `INSERT OR REPLACE INTO shukkan_entries (emp_id, name, year_month, date_key, time, hours, genba, zangyo, shinya, car, dist, biko) VALUES (${esc(empId)}, ${esc(name || '')}, ${esc(ymKey(ym))}, ${esc(dateKey(date))}, ${esc(time || '')}, ${esc(hours || '')}, ${esc(genba_ || '')}, ${esc(zan || '')}, ${esc(shinya || '')}, ${esc(car || '')}, ${esc(dist || '')}, ${esc(biko || '')});`
  );
}

// ===== 運転日報 =====
const unten = sheet('運転日報').slice(1).filter(r => r[0] !== '' && r[0] != null);
for (const r of unten) {
  const [empId, name, ym, date, memo, distance, remarks] = r;
  out.push(
    `INSERT OR REPLACE INTO unten_entries (emp_id, name, year_month, date_key, memo, distance, remarks) VALUES (${esc(empId)}, ${esc(name || '')}, ${esc(ymKey(ym))}, ${esc(dateKey(date))}, ${esc(memo || '')}, ${esc(distance || '')}, ${esc(remarks || '')});`
  );
}

writeFileSync('migration.sql', out.join('\n') + '\n', 'utf-8');
console.log(`migration.sql を生成しました。`);
console.log(`  ユーザー: ${userCount}`);
console.log(`  業務改善日報: ${gyoumu.length}`);
console.log(`  G-POP: ${gpop.length}`);
console.log(`  現場管理日報: ${genba.length}`);
console.log(`  出勤簿: ${shukkan.length}`);
console.log(`  運転日報: ${unten.length}`);
