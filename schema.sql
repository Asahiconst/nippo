-- 旭建設株式会社 日報システム D1スキーマ

CREATE TABLE IF NOT EXISTS users (
  id            TEXT PRIMARY KEY,
  password_hash TEXT NOT NULL,
  role          TEXT NOT NULL DEFAULT '一般ユーザー',
  name          TEXT NOT NULL DEFAULT '',
  busho         TEXT NOT NULL DEFAULT '',
  sort_order    INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS sessions (
  token      TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL,
  expires_at TEXT NOT NULL
);

-- 業務改善日報（社員×記録日で最新版のみ保持）
CREATE TABLE IF NOT EXISTS gyoumu_reports (
  id                   INTEGER PRIMARY KEY AUTOINCREMENT,
  emp_id               TEXT NOT NULL,
  date_key             TEXT NOT NULL,
  name                 TEXT DEFAULT '',
  busho                TEXT DEFAULT '',
  main_work            TEXT DEFAULT '',
  results              TEXT DEFAULT '',
  achievement          TEXT DEFAULT '',
  time_used            TEXT DEFAULT '',
  how_achieved         TEXT DEFAULT '',
  urgent_important     TEXT DEFAULT '',
  not_urgent_important TEXT DEFAULT '',
  horenso              TEXT DEFAULT '',
  best_effort          TEXT DEFAULT '',
  thanks               TEXT DEFAULT '',
  impression           TEXT DEFAULT '',
  created_at           TEXT DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(emp_id, date_key)
);

-- G-POP（社員×記録日で最新版のみ保持）
CREATE TABLE IF NOT EXISTS gpop_reports (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  emp_id     TEXT NOT NULL,
  date_key   TEXT NOT NULL,
  name       TEXT DEFAULT '',
  busho      TEXT DEFAULT '',
  goal       TEXT DEFAULT '',
  pre        TEXT DEFAULT '',
  on_field   TEXT DEFAULT '',
  post       TEXT DEFAULT '',
  next_pre   TEXT DEFAULT '',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(emp_id, date_key)
);

-- 現場管理日報（同一日に複数件可・削除しない）
CREATE TABLE IF NOT EXISTS genba_reports (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  emp_id      TEXT NOT NULL,
  date_key    TEXT NOT NULL,
  name        TEXT DEFAULT '',
  busho       TEXT DEFAULT '',
  genbamei    TEXT DEFAULT '',
  sekou       TEXT DEFAULT '',
  gaiyou      TEXT DEFAULT '',
  sagyou      TEXT DEFAULT '',
  uten        TEXT DEFAULT '',
  shinchoku   TEXT DEFAULT '',
  roumu       TEXT DEFAULT '',
  shizai      TEXT DEFAULT '',
  kikai       TEXT DEFAULT '',
  gaichu      TEXT DEFAULT '',
  flow        TEXT DEFAULT '',
  image1      TEXT DEFAULT '',
  image2      TEXT DEFAULT '',
  image3      TEXT DEFAULT '',
  image4      TEXT DEFAULT '',
  image5      TEXT DEFAULT '',
  image6      TEXT DEFAULT '',
  image7      TEXT DEFAULT '',
  image8      TEXT DEFAULT '',
  kansei      TEXT DEFAULT '',
  kensa       TEXT DEFAULT '',
  buffer      TEXT DEFAULT '',
  yoyu_days   TEXT DEFAULT '',
  yoyu_rate   TEXT DEFAULT '',
  zan         TEXT DEFAULT '',
  kadou       TEXT DEFAULT '',
  money_json  TEXT DEFAULT '{}',
  created_at  TEXT DEFAULT CURRENT_TIMESTAMP
);

-- 出勤簿（社員×日付で1行・対象月単位で上書き保存）
CREATE TABLE IF NOT EXISTS shukkan_entries (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  emp_id     TEXT NOT NULL,
  name       TEXT DEFAULT '',
  year_month TEXT NOT NULL,
  date_key   TEXT NOT NULL,
  time       TEXT DEFAULT '',
  hours      TEXT DEFAULT '',
  genba      TEXT DEFAULT '',
  zangyo     TEXT DEFAULT '',
  shinya     TEXT DEFAULT '',
  car        TEXT DEFAULT '',
  dist       TEXT DEFAULT '',
  biko       TEXT DEFAULT '',
  UNIQUE(emp_id, date_key)
);

-- 運転日報（社員×日付で1行・対象月単位で上書き保存）
CREATE TABLE IF NOT EXISTS unten_entries (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  emp_id     TEXT NOT NULL,
  name       TEXT DEFAULT '',
  year_month TEXT NOT NULL,
  date_key   TEXT NOT NULL,
  memo       TEXT DEFAULT '',
  distance   TEXT DEFAULT '',
  remarks    TEXT DEFAULT '',
  UNIQUE(emp_id, date_key)
);

-- 共通設定（お知らせメッセージ、管理者選択状態の記憶など）
CREATE TABLE IF NOT EXISTS app_settings (
  key   TEXT PRIMARY KEY,
  value TEXT DEFAULT ''
);

-- 特別日（社内独自の休日／有給取得奨励日）
CREATE TABLE IF NOT EXISTS special_days (
  date_key TEXT PRIMARY KEY,
  type     TEXT NOT NULL,
  name     TEXT DEFAULT ''
);

CREATE INDEX IF NOT EXISTS idx_gyoumu_emp ON gyoumu_reports(emp_id);
CREATE INDEX IF NOT EXISTS idx_gyoumu_date ON gyoumu_reports(date_key);
CREATE INDEX IF NOT EXISTS idx_gpop_emp ON gpop_reports(emp_id);
CREATE INDEX IF NOT EXISTS idx_gpop_date ON gpop_reports(date_key);
CREATE INDEX IF NOT EXISTS idx_genba_emp ON genba_reports(emp_id);
CREATE INDEX IF NOT EXISTS idx_genba_date ON genba_reports(date_key);
CREATE INDEX IF NOT EXISTS idx_shukkan_emp_ym ON shukkan_entries(emp_id, year_month);
CREATE INDEX IF NOT EXISTS idx_unten_emp_ym ON unten_entries(emp_id, year_month);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
