const WEEK = ['日', '月', '火', '水', '木', '金', '土'];

export function toDateLabel(dateKey) {
  const [y, m, d] = String(dateKey).split('-').map(Number);
  if (!y || !m || !d) return String(dateKey);
  const wd = WEEK[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
  return `${y}年${m}月${d}日(${wd})`;
}

export function ymLabel(ym) {
  const [y, m] = String(ym).split('-');
  return `${y}年${parseInt(m, 10) || ''}月分`;
}

export function isValidDateKey(v) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(v || ''));
}

export function isValidYm(v) {
  return /^\d{4}-\d{2}$/.test(String(v || ''));
}
