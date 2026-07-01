/**
 * 旭建設株式会社 - 日報システム（業務改善日報）
 * サーバー側ロジック
 *
 * ■ シート構成
 *  「ユーザー」      … A:社員ID  B:パスワード  C:役割  D:氏名  E:所属
 *  「業務改善日報」  … A:社員ID  B:記録日  C:記録者  D:所属  E〜O:各記入項目（11項目）
 *
 * ※ 初回のみ initializeSheets() を手動実行してシート・見出し・サンプルユーザーを作成してください。
 */

// ===== シート名・列定義 =====================================================
var USER_SHEET    = 'ユーザー';
var GYOUMU_SHEET  = '業務改善日報';
var GPOP_SHEET    = 'G-POP';
var SHUKKAN_SHEET = '出勤簿';
var UNTEN_SHEET   = '運転日報';
var GENBA_SHEET   = '現場管理日報';

// 業務改善日報の記入項目（列の順番と一致させること）。key はクライアントと共通。
var GYOUMU_FIELDS = [
  '本日の主な業務',
  '実績（数字）',
  '本日の成果',
  '成果達成に使った時間',
  'どのように成果を達成したか',
  '緊急で重要',
  '緊急でなく重要',
  '報・連・相事項（5W1H）',
  '一番頑張ったこと',
  '他社からもらったありがとう',
  '所感'
];
// クライアント側の項目key（描画用）。GYOUMU_FIELDS と同じ並び。
var GYOUMU_KEYS = [
  'mainWork', 'results', 'achievement', 'timeUsed', 'howAchieved',
  'urgentImportant', 'notUrgentImportant', 'horenso', 'bestEffort', 'thanks', 'impression'
];

// ===== 権限承認用（初回・スコープ追加時に手動で1度実行） ===================
// エディタでこの関数を選んで実行 → Drive と スプレッドシートのアクセスを許可。
// その後「デプロイを管理 → 新バージョンでデプロイ」すると画像保存が有効になります。
function grantPermissions() {
  SpreadsheetApp.getActiveSpreadsheet().getName();
  DriveApp.getRootFolder().getName();
  return '権限を承認しました。デプロイを新バージョンで更新してください。';
}

// ===== エントリポイント =====================================================
function doGet() {
  return HtmlService.createHtmlOutputFromFile('Index')
      .setTitle('旭建設株式会社 - 日報システム')
      .addMetaTag('viewport', 'width=device-width, initial-scale=1')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

// ===== 初期セットアップ（初回のみ手動実行） =================================
function initializeSheets() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();

  // --- ユーザーシート ---
  var us = ss.getSheetByName(USER_SHEET);
  if (!us) us = ss.insertSheet(USER_SHEET);
  if (us.getLastRow() < 1) {
    us.getRange(1, 1, 1, 5).setValues([['社員ID', 'パスワード', '役割', '氏名', '所属']]);
    us.appendRow(['admin', 'admin', '管理者', '管理者', '本社']);
    us.appendRow(['1001', '1001', '管理者', '隈江通寛', '経営幹部']);
    us.appendRow(['1002', '1002', '一般ユーザー', '山田太郎', '現場部']);
    us.appendRow(['1003', '1003', '一般ユーザー', '佐藤花子', '総務部']);
  }

  // --- 業務改善日報シート ---
  var gs = ss.getSheetByName(GYOUMU_SHEET);
  if (!gs) gs = ss.insertSheet(GYOUMU_SHEET);
  var header = ['社員ID', '記録日', '記録者', '所属'].concat(GYOUMU_FIELDS);
  gs.getRange(1, 1, 1, header.length).setValues([header]);
  gs.setFrozenRows(1);

  return 'セットアップ完了：ユーザーシートと業務改善日報シートの見出しを作成しました。';
}

// ===== 認証 =================================================================
function checkLogin(id, pass) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(USER_SHEET);
  if (!sheet) return { success: false, message: 'ユーザーシートがありません。initializeSheets を実行してください。' };

  var data = sheet.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][0]) === String(id) && String(data[i][1]) === String(pass)) {
      return {
        success: true,
        id:    String(data[i][0]),
        role:  data[i][2] ? String(data[i][2]) : '一般',
        name:  data[i][3] ? String(data[i][3]) : String(id),
        busho: data[i][4] ? String(data[i][4]) : ''
      };
    }
  }
  return { success: false, message: 'IDまたはパスワードが間違っています。' };
}

function changePassword(id, oldPass, newPass) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(USER_SHEET);
  var data = sheet.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][0]) === String(id) && String(data[i][1]) === String(oldPass)) {
      sheet.getRange(i + 1, 2).setValue(newPass);
      return { success: true };
    }
  }
  return { success: false, message: '現在のパスワードが間違っています。' };
}

// ===== 社員一覧 =============================================================
function getAllUsers() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(USER_SHEET);
  var data = sheet.getDataRange().getValues();
  var users = [];
  for (var i = 1; i < data.length; i++) {
    if (data[i][0]) {
      users.push({
        id:    String(data[i][0]),
        name:  data[i][3] ? String(data[i][3]) : String(data[i][0]),
        busho: data[i][4] ? String(data[i][4]) : ''
      });
    }
  }
  return users;
}

// ===== 日付ユーティリティ ===================================================
function toDateKey_(v) {
  if (v instanceof Date) return Utilities.formatDate(v, 'JST', 'yyyy-MM-dd');
  if (!v) return '';
  var d = new Date(v);
  if (!isNaN(d.getTime())) return Utilities.formatDate(d, 'JST', 'yyyy-MM-dd');
  return String(v);
}
function toDateLabel_(v) {
  var d = (v instanceof Date) ? v : new Date(v);
  if (isNaN(d.getTime())) return String(v);
  return Utilities.formatDate(d, 'JST', 'yyyy年M月d日');
}
// 同一(社員ID, 記録日)の既存行を削除（最新版のみ残すために保存前に呼ぶ）
function deleteRowsByEmpDate_(sheet, empColIdx0, dateColIdx0, empId, dateKey) {
  var data = sheet.getDataRange().getValues();
  for (var i = data.length - 1; i >= 1; i--) {
    if (String(data[i][empColIdx0]) === String(empId) && toDateKey_(data[i][dateColIdx0]) === dateKey) {
      sheet.deleteRow(i + 1);
    }
  }
}

// 対象月の正規化：文字列 'yyyy-MM' でも、日付として解釈された値でも 'yyyy-MM' に揃える
function toYmKey_(v) {
  if (v instanceof Date) return Utilities.formatDate(v, 'JST', 'yyyy-MM');
  var s = String(v || '');
  var m = s.match(/(\d{4})\D(\d{1,2})/);
  if (m) return m[1] + '-' + ('0' + m[2]).slice(-2);
  return s;
}

// 1行（配列）→ 表示用オブジェクトに変換
function rowToReport_(row) {
  var obj = {
    empId:     String(row[0]),
    dateKey:   toDateKey_(row[1]),
    dateLabel: toDateLabel_(row[1]),
    name:      row[2] ? String(row[2]) : '',
    busho:     row[3] ? String(row[3]) : ''
  };
  for (var k = 0; k < GYOUMU_KEYS.length; k++) {
    var v = row[4 + k];
    obj[GYOUMU_KEYS[k]] = (v === null || v === undefined) ? '' : String(v);
  }
  return obj;
}

// ===== 業務改善日報：取得系 =================================================

// トップページ用：自分が記入した日報の「日付一覧」（新しい順・重複日まとめ・最大30件）
function getMyReportDates(empId) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(GYOUMU_SHEET);
  if (!sheet || sheet.getLastRow() < 2) return [];

  var data = sheet.getRange(2, 1, sheet.getLastRow() - 1, 4).getValues();
  var seen = {};
  var list = [];
  for (var i = 0; i < data.length; i++) {
    if (String(data[i][0]) !== String(empId)) continue;
    var key = toDateKey_(data[i][1]);
    if (!key || seen[key]) continue;
    seen[key] = true;
    list.push({ dateKey: key, dateLabel: toDateLabel_(data[i][1]) });
  }
  list.sort(function (a, b) { return a.dateKey < b.dateKey ? 1 : -1; }); // 新しい順
  return list.slice(0, 30);
}

// トップの日付クリック用：自分の、その日の日報（複数可）
function getMyReportByDate(empId, dateKey) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(GYOUMU_SHEET);
  if (!sheet || sheet.getLastRow() < 2) return [];

  var data = sheet.getRange(2, 1, sheet.getLastRow() - 1, 15).getValues();
  var out = [];
  for (var i = 0; i < data.length; i++) {
    if (String(data[i][0]) === String(empId) && toDateKey_(data[i][1]) === dateKey) {
      out.push(rowToReport_(data[i]));
    }
  }
  return out;
}

// カレンダー日付クリック用：その日の「全社員」の日報
function getReportsByDate(dateKey) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(GYOUMU_SHEET);
  if (!sheet || sheet.getLastRow() < 2) return [];

  var data = sheet.getRange(2, 1, sheet.getLastRow() - 1, 15).getValues();
  var out = [];
  for (var i = 0; i < data.length; i++) {
    if (toDateKey_(data[i][1]) === dateKey) out.push(rowToReport_(data[i]));
  }
  // 所属→氏名 で並べる
  out.sort(function (a, b) {
    if (a.busho !== b.busho) return a.busho < b.busho ? -1 : 1;
    return a.name < b.name ? -1 : 1;
  });
  return out;
}

// カレンダー描画用：指定月で日報が存在する「日(1〜31)」の一覧（ハイライト用・全社員対象）
function getReportDaysInMonth(year, month) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(GYOUMU_SHEET);
  if (!sheet || sheet.getLastRow() < 2) return [];

  var prefix = year + '-' + ('0' + month).slice(-2) + '-'; // yyyy-MM-
  var data = sheet.getRange(2, 2, sheet.getLastRow() - 1, 1).getValues(); // 記録日列のみ
  var days = {};
  for (var i = 0; i < data.length; i++) {
    var key = toDateKey_(data[i][0]);
    if (key.indexOf(prefix) === 0) days[parseInt(key.slice(-2), 10)] = true;
  }
  return Object.keys(days).map(Number);
}

// ===== 業務改善日報：保存系 =================================================
function saveBusinessReport(empId, name, busho, dateKey, fields) {
  var lock = LockService.getScriptLock();
  try { lock.waitLock(30000); } catch (e) {
    return { success: false, message: 'システムが混み合っています。再度お試しください。' };
  }
  try {
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(GYOUMU_SHEET);
    if (!sheet) return { success: false, message: '業務改善日報シートがありません。' };

    var parts = String(dateKey).split('-');
    var dateObj = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));

    // 同一(社員ID, 記録日)の既存行を削除（最新版のみ残す）
    deleteRowsByEmpDate_(sheet, 0, 1, empId, dateKey);

    var row = [empId, dateObj, name, busho];
    for (var k = 0; k < GYOUMU_KEYS.length; k++) {
      row.push(fields[GYOUMU_KEYS[k]] || '');
    }
    sheet.appendRow(row);
    return { success: true };
  } catch (err) {
    return { success: false, message: String(err) };
  } finally {
    lock.releaseLock();
  }
}

// ===========================================================================
// G-POP
//  列: A社員ID B記録日 C記録者 D所属 E:Goal F:Pre G:On H:Post I:Next Pre
// ===========================================================================
function saveGpop(empId, name, busho, dateKey, fields) {
  var lock = LockService.getScriptLock();
  try { lock.waitLock(30000); } catch (e) {
    return { success: false, message: 'システムが混み合っています。再度お試しください。' };
  }
  try {
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(GPOP_SHEET);
    if (!sheet) return { success: false, message: 'G-POPシートがありません。' };
    var p = String(dateKey).split('-');
    var dateObj = new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]));
    deleteRowsByEmpDate_(sheet, 0, 1, empId, dateKey); // 同一人・同日は最新版のみ
    sheet.appendRow([empId, dateObj, name, busho,
      fields.goal || '', fields.pre || '', fields.on || '', fields.post || '', fields.nextPre || '']);
    return { success: true };
  } catch (err) {
    return { success: false, message: String(err) };
  } finally {
    lock.releaseLock();
  }
}

// カレンダー用：指定月でG-POPが存在する日（1〜31）
function getGpopDaysInMonth(year, month) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(GPOP_SHEET);
  if (!sheet || sheet.getLastRow() < 2) return [];
  var prefix = year + '-' + ('0' + month).slice(-2) + '-';
  var data = sheet.getRange(2, 2, sheet.getLastRow() - 1, 1).getValues(); // 記録日列
  var days = {};
  for (var i = 0; i < data.length; i++) {
    var key = toDateKey_(data[i][0]);
    if (key.indexOf(prefix) === 0) days[parseInt(key.slice(-2), 10)] = true;
  }
  return Object.keys(days).map(Number);
}

// カレンダー日付クリック用：その日の全社員のG-POP
function getGpopByDate(dateKey) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(GPOP_SHEET);
  if (!sheet || sheet.getLastRow() < 2) return [];
  var data = sheet.getRange(2, 1, sheet.getLastRow() - 1, 9).getValues();
  var out = [];
  for (var i = 0; i < data.length; i++) {
    if (toDateKey_(data[i][1]) !== dateKey) continue;
    out.push({
      empId: String(data[i][0]), dateLabel: toDateLabel_(data[i][1]),
      name: data[i][2] ? String(data[i][2]) : '', busho: data[i][3] ? String(data[i][3]) : '',
      goal: String(data[i][4] || ''), pre: String(data[i][5] || ''),
      on: String(data[i][6] || ''), post: String(data[i][7] || ''), nextPre: String(data[i][8] || '')
    });
  }
  out.sort(function (a, b) { return (a.busho + a.name) < (b.busho + b.name) ? -1 : 1; });
  return out;
}

// ===========================================================================
// 出勤簿（1日1行・対象月単位で上書き保存）
//  列: A社員ID B記録者 C対象月 D日付 E出勤時間 F労働時間 G現場名
//      H残業時間 I深夜残業 J通勤車両 K自宅から現場までの距離 L備考
// ===========================================================================
function saveShukkan(empId, name, yearMonth, rows) {
  var lock = LockService.getScriptLock();
  try { lock.waitLock(30000); } catch (e) {
    return { success: false, message: 'システムが混み合っています。再度お試しください。' };
  }
  try {
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHUKKAN_SHEET);
    if (!sheet) return { success: false, message: '出勤簿シートがありません。' };
    var WID = 12;
    var data = sheet.getDataRange().getValues();
    var keep = [padRow_(data.length ? data[0] : ['社員ID','記録者','対象月','日付','出勤時間','労働時間','現場名','残業時間','深夜残業','通勤車両','自宅から現場までの距離','備考'], WID)];
    for (var i = 1; i < data.length; i++) {
      if (!(String(data[i][0]) === String(empId) && toYmKey_(data[i][2]) === String(yearMonth))) {
        keep.push(padRow_(data[i], WID));
      }
    }
    (rows || []).forEach(function (r) {
      var p = String(r.date).split('-');
      var dateObj = new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]));
      keep.push([empId, name, yearMonth, dateObj, r.time || '', r.hours || '', r.genba || '',
        r.zan || '', r.shinya || '', r.car || '', r.dist || '', r.biko || '']);
    });
    sheet.clearContents();
    sheet.getRange(1, 1, keep.length, WID).setValues(keep);
    return { success: true };
  } catch (err) {
    return { success: false, message: String(err) };
  } finally {
    lock.releaseLock();
  }
}

function getShukkan(empId, yearMonth) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHUKKAN_SHEET);
  if (!sheet || sheet.getLastRow() < 2) return [];
  var data = sheet.getRange(2, 1, sheet.getLastRow() - 1, 12).getValues();
  var out = [];
  for (var i = 0; i < data.length; i++) {
    if (String(data[i][0]) === String(empId) && toYmKey_(data[i][2]) === String(yearMonth)) {
      out.push({
        date: toDateKey_(data[i][3]),
        time: String(data[i][4] || ''), hours: String(data[i][5] || ''), genba: String(data[i][6] || ''),
        zan: String(data[i][7] || ''), shinya: String(data[i][8] || ''), car: String(data[i][9] || ''),
        dist: String(data[i][10] || ''), biko: String(data[i][11] || '')
      });
    }
  }
  return out;
}

// ===========================================================================
// 運転日報（1日1行・対象月単位で上書き保存）
//  列: A社員ID B記録者 C対象月 D日付 E行先・運転記録 F距離(km) G備考
// ===========================================================================
function saveUnten(empId, name, yearMonth, rows) {
  var lock = LockService.getScriptLock();
  try { lock.waitLock(30000); } catch (e) {
    return { success: false, message: 'システムが混み合っています。再度お試しください。' };
  }
  try {
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(UNTEN_SHEET);
    if (!sheet) return { success: false, message: '運転日報シートがありません。' };
    var WID = 7;
    var data = sheet.getDataRange().getValues();
    var keep = [padRow_(data.length ? data[0] : ['社員ID','記録者','対象月','日付','行先・運転記録','距離(km)','備考'], WID)];
    for (var i = 1; i < data.length; i++) {
      if (!(String(data[i][0]) === String(empId) && toYmKey_(data[i][2]) === String(yearMonth))) {
        keep.push(padRow_(data[i], WID));
      }
    }
    (rows || []).forEach(function (r) {
      var p = String(r.date).split('-');
      var dateObj = new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]));
      keep.push([empId, name, yearMonth, dateObj, r.memo || '', r.distance || '', r.remarks || '']);
    });
    sheet.clearContents();
    sheet.getRange(1, 1, keep.length, WID).setValues(keep);
    return { success: true };
  } catch (err) {
    return { success: false, message: String(err) };
  } finally {
    lock.releaseLock();
  }
}

function getUnten(empId, yearMonth) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(UNTEN_SHEET);
  if (!sheet || sheet.getLastRow() < 2) return [];
  var data = sheet.getRange(2, 1, sheet.getLastRow() - 1, 7).getValues();
  var out = [];
  for (var i = 0; i < data.length; i++) {
    if (String(data[i][0]) === String(empId) && toYmKey_(data[i][2]) === String(yearMonth)) {
      out.push({
        date: toDateKey_(data[i][3]),
        memo: String(data[i][4] || ''), distance: String(data[i][5] || ''), remarks: String(data[i][6] || '')
      });
    }
  }
  return out;
}

// 行を指定幅に揃える（不足分は空文字で埋める）
function padRow_(row, width) {
  var r = row.slice(0, width);
  while (r.length < width) r.push('');
  return r;
}

// ===========================================================================
// 現場管理日報（画像はGoogleドライブに保存し、シートにはファイルIDを記録）
//  列(48): A社員ID B記録日 C記録者 D所属 / E現場名 F施工管理 G概要 H作業内容
//   I雨天時の対応 J進捗度 K労務管理 L資材及び数量 M使用機械 N外注 Oフロー図
//   P〜W 画像1〜8 / X完成予定 Y検査日 Zバッファ色 AA余裕日数 AB余裕率
//   AC残作業日数 AD稼働日数 / AE〜 昨日の金の動き(資材→工事原価 ×3列=18列)
// ===========================================================================
var GENBA_MONEY_CATS = ['資材', '労務', '機械', '外注', '経費', '工事原価'];
var GENBA_IMG_FOLDER = '日報システム_現場画像';

function getGenbaFolder_() {
  var it = DriveApp.getFoldersByName(GENBA_IMG_FOLDER);
  return it.hasNext() ? it.next() : DriveApp.createFolder(GENBA_IMG_FOLDER);
}

// 画像（base64）をドライブに保存しファイルIDを返す。既存ID/空はそのまま返す。
function saveGenbaImage_(folder, img) {
  if (!img) return '';
  if (typeof img === 'string') return img;            // 既存のファイルID/URLはそのまま
  if (!img.data) return '';
  var blob = Utilities.newBlob(Utilities.base64Decode(img.data), img.mimeType || 'image/jpeg', img.name || 'genba_image');
  var file = folder.createFile(blob);
  try { file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW); } catch (e) {}
  return file.getId();
}

function saveGenba(empId, name, busho, dateKey, data, money, images) {
  var lock = LockService.getScriptLock();
  try { lock.waitLock(30000); } catch (e) {
    return { success: false, message: 'システムが混み合っています。再度お試しください。' };
  }
  try {
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(GENBA_SHEET);
    if (!sheet) return { success: false, message: '現場管理日報シートがありません。' };

    var p = String(dateKey).split('-');
    var dateObj = new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]));

    // 画像をドライブへ
    var folder = getGenbaFolder_();
    var imgIds = [];
    for (var i = 0; i < 8; i++) imgIds.push(saveGenbaImage_(folder, (images || [])[i]));

    var row = [empId, dateObj, name, busho,
      data.genbamei || '', data.sekou || '', data.gaiyou || '', data.sagyou || '',
      data.uten || '', data.shinchoku || '', data.roumu || '', data.shizai || '',
      data.kikai || '', data.gaichu || '', data.flow || ''];
    row = row.concat(imgIds); // 画像1〜8
    row = row.concat([data.kansei || '', data.kensa || '', data.buffer || '',
      data.yoyuDays || '', data.yoyuRate || '', data.zan || '', data.kadou || '']);
    GENBA_MONEY_CATS.forEach(function (cat) {
      var mc = (money && money[cat]) || {};
      row.push(mc.h || '', mc.r || '', mc.y || '');
    });

    sheet.appendRow(row);
    return { success: true };
  } catch (err) {
    return { success: false, message: String(err) };
  } finally {
    lock.releaseLock();
  }
}

function getGenbaDaysInMonth(year, month) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(GENBA_SHEET);
  if (!sheet || sheet.getLastRow() < 2) return [];
  var prefix = year + '-' + ('0' + month).slice(-2) + '-';
  var data = sheet.getRange(2, 2, sheet.getLastRow() - 1, 1).getValues();
  var days = {};
  for (var i = 0; i < data.length; i++) {
    var key = toDateKey_(data[i][0]);
    if (key.indexOf(prefix) === 0) days[parseInt(key.slice(-2), 10)] = true;
  }
  return Object.keys(days).map(Number);
}

// カレンダー用：指定月の「日 → その日の現場名一覧」
function getGenbaSitesInMonth(year, month) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(GENBA_SHEET);
  if (!sheet || sheet.getLastRow() < 2) return {};
  var prefix = year + '-' + ('0' + month).slice(-2) + '-';
  var data = sheet.getRange(2, 2, sheet.getLastRow() - 1, 4).getValues(); // B記録日 〜 E現場名
  var map = {};
  for (var i = 0; i < data.length; i++) {
    var key = toDateKey_(data[i][0]);
    if (key.indexOf(prefix) !== 0) continue;
    var d = parseInt(key.slice(-2), 10);
    var site = String(data[i][3] || '（現場名なし）');
    if (!map[d]) map[d] = [];
    if (map[d].indexOf(site) < 0) map[d].push(site);
  }
  return map;
}

function getGenbaByDate(dateKey) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(GENBA_SHEET);
  if (!sheet || sheet.getLastRow() < 2) return [];
  var data = sheet.getRange(2, 1, sheet.getLastRow() - 1, 48).getValues();
  var out = [];
  for (var i = 0; i < data.length; i++) {
    var r = data[i];
    if (toDateKey_(r[1]) !== dateKey) continue;
    var images = [];
    for (var k = 15; k <= 22; k++) images.push(String(r[k] || ''));
    var money = {};
    var base = 30;
    GENBA_MONEY_CATS.forEach(function (cat, idx) {
      money[cat] = { h: String(r[base + idx*3] || ''), r: String(r[base + idx*3 + 1] || ''), y: String(r[base + idx*3 + 2] || '') };
    });
    out.push({
      empId: String(r[0]), dateLabel: toDateLabel_(r[1]), name: String(r[2] || ''), busho: String(r[3] || ''),
      genbamei: String(r[4] || ''), sekou: String(r[5] || ''), gaiyou: String(r[6] || ''), sagyou: String(r[7] || ''),
      uten: String(r[8] || ''), shinchoku: String(r[9] || ''), roumu: String(r[10] || ''), shizai: String(r[11] || ''),
      kikai: String(r[12] || ''), gaichu: String(r[13] || ''), flow: String(r[14] || ''),
      images: images,
      kansei: String(r[23] || ''), kensa: String(r[24] || ''), buffer: String(r[25] || ''),
      yoyuDays: String(r[26] || ''), yoyuRate: String(r[27] || ''), zan: String(r[28] || ''), kadou: String(r[29] || ''),
      money: money
    });
  }
  out.sort(function (a, b) { return (a.busho + a.name) < (b.busho + b.name) ? -1 : 1; });
  return out;
}

// ===========================================================================
// トップページ用：自分の各日報の「日付一覧」と「コピー用の取得」
// ===========================================================================
function myDates_(sheetName, empId) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);
  if (!sheet || sheet.getLastRow() < 2) return [];
  var data = sheet.getRange(2, 1, sheet.getLastRow() - 1, 2).getValues(); // A:社員ID B:記録日
  var seen = {}, list = [];
  for (var i = 0; i < data.length; i++) {
    if (String(data[i][0]) !== String(empId)) continue;
    var key = toDateKey_(data[i][1]);
    if (!key || seen[key]) continue;
    seen[key] = true;
    list.push({ dateKey: key, dateLabel: toDateLabel_(data[i][1]) });
  }
  list.sort(function (a, b) { return a.dateKey < b.dateKey ? 1 : -1; });
  return list.slice(0, 30);
}
function getMyGpopDates(empId)  { return myDates_(GPOP_SHEET, empId); }
function getMyGenbaDates(empId) { return myDates_(GENBA_SHEET, empId); }

// トップページ用：自分が入力した出勤簿の対象月一覧（新しい順）
function getMyShukkanMonths(empId) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHUKKAN_SHEET);
  if (!sheet || sheet.getLastRow() < 2) return [];
  var data = sheet.getRange(2, 1, sheet.getLastRow() - 1, 3).getValues(); // A社員ID C対象月
  var seen = {}, list = [];
  for (var i = 0; i < data.length; i++) {
    if (String(data[i][0]) !== String(empId)) continue;
    var ym = toYmKey_(data[i][2]);
    if (!ym || seen[ym]) continue;
    seen[ym] = true;
    list.push({ ym: ym, label: ymLabel_(ym) });
  }
  list.sort(function (a, b) { return a.ym < b.ym ? 1 : -1; });
  return list;
}

// トップページ用：自分が入力した運転日報の対象月一覧（合計km付き・新しい順）
function getMyUntenMonths(empId) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(UNTEN_SHEET);
  if (!sheet || sheet.getLastRow() < 2) return [];
  var data = sheet.getRange(2, 1, sheet.getLastRow() - 1, 6).getValues(); // A社員ID C対象月 F距離
  var map = {};
  for (var i = 0; i < data.length; i++) {
    if (String(data[i][0]) !== String(empId)) continue;
    var ym = toYmKey_(data[i][2]);
    if (!ym) continue;
    if (!map[ym]) map[ym] = 0;
    var d = parseFloat(data[i][5]); if (!isNaN(d)) map[ym] += d;
  }
  return Object.keys(map).sort().reverse().map(function (ym) {
    return { ym: ym, label: ymLabel_(ym), km: Math.round(map[ym] * 100) / 100 };
  });
}

function ymLabel_(ym) {
  var p = String(ym).split('-');
  return p[0] + '年' + (parseInt(p[1], 10) || '') + '月分';
}

// コピー用：自分の、その日のG-POP（1件目）
function getMyGpopByDate(empId, dateKey) {
  var all = getGpopByDate(dateKey);
  for (var i = 0; i < all.length; i++) if (all[i].empId === String(empId)) return all[i];
  return null;
}
// コピー用：自分の、その日の現場管理日報（1件目）
function getMyGenbaByDate(empId, dateKey) {
  var all = getGenbaByDate(dateKey);
  for (var i = 0; i < all.length; i++) if (all[i].empId === String(empId)) return all[i];
  return null;
}

// ===========================================================================
// 管理者専用：ユーザー管理（追加・編集・削除）
//  ユーザー列: A社員ID B パスワード C 役割 D 氏名 E 所属
// ===========================================================================
function getUsersFull() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(USER_SHEET);
  if (!sheet || sheet.getLastRow() < 2) return [];
  var data = sheet.getRange(2, 1, sheet.getLastRow() - 1, 5).getValues();
  var out = [];
  for (var i = 0; i < data.length; i++) {
    if (data[i][0] === '' || data[i][0] == null) continue;
    out.push({ id: String(data[i][0]), role: String(data[i][2] || '一般ユーザー'),
      name: String(data[i][3] || ''), busho: String(data[i][4] || '') });
  }
  return out;
}

function findUserRow_(sheet, id) {
  var data = sheet.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) if (String(data[i][0]) === String(id)) return i + 1; // 1-based
  return -1;
}

function addUser(u) {
  var lock = LockService.getScriptLock();
  try { lock.waitLock(20000); } catch (e) { return { success: false, message: '混み合っています。' }; }
  try {
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(USER_SHEET);
    if (!u.id) return { success: false, message: '社員IDを入力してください。' };
    if (findUserRow_(sheet, u.id) !== -1) return { success: false, message: 'その社員IDは既に存在します。' };
    sheet.appendRow([u.id, u.password || '', u.role || '一般ユーザー', u.name || '', u.busho || '']);
    return { success: true };
  } finally { lock.releaseLock(); }
}

function updateUser(origId, u) {
  var lock = LockService.getScriptLock();
  try { lock.waitLock(20000); } catch (e) { return { success: false, message: '混み合っています。' }; }
  try {
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(USER_SHEET);
    var row = findUserRow_(sheet, origId);
    if (row === -1) return { success: false, message: '対象ユーザーが見つかりません。' };
    // ID変更時は重複チェック
    if (String(u.id) !== String(origId) && findUserRow_(sheet, u.id) !== -1) return { success: false, message: 'その社員IDは既に存在します。' };
    sheet.getRange(row, 1).setValue(u.id);
    if (u.password) sheet.getRange(row, 2).setValue(u.password); // 空ならパスワード据え置き
    sheet.getRange(row, 3).setValue(u.role || '一般ユーザー');
    sheet.getRange(row, 4).setValue(u.name || '');
    sheet.getRange(row, 5).setValue(u.busho || '');
    return { success: true };
  } finally { lock.releaseLock(); }
}

function deleteUser(id) {
  var lock = LockService.getScriptLock();
  try { lock.waitLock(20000); } catch (e) { return { success: false, message: '混み合っています。' }; }
  try {
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(USER_SHEET);
    var row = findUserRow_(sheet, id);
    if (row === -1) return { success: false, message: '対象ユーザーが見つかりません。' };
    sheet.deleteRow(row);
    return { success: true };
  } finally { lock.releaseLock(); }
}

// 並び順変更：dir = -1（上へ） / +1（下へ）。隣のユーザー行と入れ替える。
function moveUser(id, dir) {
  var lock = LockService.getScriptLock();
  try { lock.waitLock(20000); } catch (e) { return { success: false, message: '混み合っています。' }; }
  try {
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(USER_SHEET);
    var row = findUserRow_(sheet, id);
    if (row === -1) return { success: false, message: '対象ユーザーが見つかりません。' };
    var target = row + (dir < 0 ? -1 : 1);
    if (target < 2 || target > sheet.getLastRow()) return { success: true }; // 端なら何もしない
    var a = sheet.getRange(row, 1, 1, 5).getValues()[0];
    var b = sheet.getRange(target, 1, 1, 5).getValues()[0];
    sheet.getRange(row, 1, 1, 5).setValues([b]);
    sheet.getRange(target, 1, 1, 5).setValues([a]);
    return { success: true };
  } finally { lock.releaseLock(); }
}

// ===========================================================================
// 管理者専用：出勤簿管理・運転日報管理（月次・対象社員の取得、対象社員の記憶）
// ===========================================================================
function getShukkanMonthAll(yearMonth) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHUKKAN_SHEET);
  if (!sheet || sheet.getLastRow() < 2) return [];
  var data = sheet.getRange(2, 1, sheet.getLastRow() - 1, 12).getValues();
  var out = [];
  for (var i = 0; i < data.length; i++) {
    if (toYmKey_(data[i][2]) !== String(yearMonth)) continue;
    out.push({ empId: String(data[i][0]), name: String(data[i][1] || ''), date: toDateKey_(data[i][3]),
      time: String(data[i][4] || ''), hours: String(data[i][5] || ''), genba: String(data[i][6] || ''),
      zan: String(data[i][7] || ''), shinya: String(data[i][8] || ''), car: String(data[i][9] || ''),
      dist: String(data[i][10] || ''), biko: String(data[i][11] || '') });
  }
  return out;
}

function getUntenMonthAll(yearMonth) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(UNTEN_SHEET);
  if (!sheet || sheet.getLastRow() < 2) return [];
  var data = sheet.getRange(2, 1, sheet.getLastRow() - 1, 7).getValues();
  var out = [];
  for (var i = 0; i < data.length; i++) {
    if (toYmKey_(data[i][2]) !== String(yearMonth)) continue;
    out.push({ empId: String(data[i][0]), name: String(data[i][1] || ''), date: toDateKey_(data[i][3]),
      memo: String(data[i][4] || ''), distance: String(data[i][5] || ''), remarks: String(data[i][6] || '') });
  }
  return out;
}

// 対象社員の選択状態の記憶（null=未保存＝全選択）
function getMgmtSelection(type) {
  var p = PropertiesService.getScriptProperties().getProperty('mgmtSel_' + type);
  return p ? JSON.parse(p) : null;
}
function saveMgmtSelection(type, ids) {
  PropertiesService.getScriptProperties().setProperty('mgmtSel_' + type, JSON.stringify(ids || []));
  return { success: true };
}

// ===========================================================================
// 共通メッセージ（トップ・カレンダー上部に表示。書式付きHTML）
// ===========================================================================
function getMessage() {
  return PropertiesService.getScriptProperties().getProperty('appMessage') || '';
}
function saveMessage(html) {
  PropertiesService.getScriptProperties().setProperty('appMessage', html || '');
  return { success: true };
}

// ===========================================================================
// ユーザー並び替え（ドラッグ＆ドロップで送られた順にシートを並べ替え）
// ===========================================================================
function reorderUsers(ids) {
  var lock = LockService.getScriptLock();
  try { lock.waitLock(20000); } catch (e) { return { success: false, message: '混み合っています。' }; }
  try {
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(USER_SHEET);
    var data = sheet.getDataRange().getValues();
    if (data.length < 2) return { success: true };
    var header = padRow_(data[0], 5);
    var byId = {};
    for (var i = 1; i < data.length; i++) byId[String(data[i][0])] = padRow_(data[i], 5);
    var newRows = [header];
    (ids || []).forEach(function (id) { if (byId[String(id)]) { newRows.push(byId[String(id)]); delete byId[String(id)]; } });
    Object.keys(byId).forEach(function (id) { newRows.push(byId[id]); }); // 念のため残りを末尾へ
    sheet.getRange(2, 1, sheet.getMaxRows() - 1, 5).clearContent();
    sheet.getRange(1, 1, newRows.length, 5).setValues(newRows);
    return { success: true };
  } finally { lock.releaseLock(); }
}

// ===========================================================================
// 特別日（社内独自の休日／有給取得奨励日）
//  保存形式：[{date:'yyyy-MM-dd', type:'holiday'|'pto', name:'...'}]
// ===========================================================================
function getSpecialDays() {
  var p = PropertiesService.getScriptProperties().getProperty('specialDays');
  return p ? JSON.parse(p) : [];
}
function addSpecialDay(date, type, name) {
  var arr = getSpecialDays().filter(function (x) { return x.date !== date; });
  arr.push({ date: date, type: (type === 'pto' ? 'pto' : 'holiday'), name: name || '' });
  arr.sort(function (a, b) { return a.date < b.date ? -1 : 1; });
  PropertiesService.getScriptProperties().setProperty('specialDays', JSON.stringify(arr));
  return { success: true };
}
function deleteSpecialDay(date) {
  var arr = getSpecialDays().filter(function (x) { return x.date !== date; });
  PropertiesService.getScriptProperties().setProperty('specialDays', JSON.stringify(arr));
  return { success: true };
}