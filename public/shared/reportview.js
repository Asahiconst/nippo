// 日報の読み取り専用表示ロジック（詳細画面で共有）
window.ReportView = (function () {
  const esc = App.escapeHtml;
  function rov(rec, key) { return (rec && rec[key]) ? esc(rec[key]) : ''; }
  function genbaImgUrl(key) { return key ? `/api/images/${key}` : ''; }

  function gyoumuFormReadonly(rec) {
    const box = k => `<div class="ro-box">${rov(rec, k)}</div>`;
    const col1 = '<table class="kz-tbl ro-kz">'
      + `<tr><td class="lbl">業務・実績</td><td class="val"><div class="kz-two">`
      + `<div class="wide"><p class="kz-sub">本日の主な業務</p>${box('mainWork')}</div>`
      + `<div class="narrow"><p class="kz-sub">実績（数字）</p>${box('results')}</div></div></td></tr>`
      + `<tr><td class="lbl">本日の成果</td><td class="val"><div class="kz-two">`
      + `<div class="wide"><p class="kz-sub">本日の成果</p>${box('achievement')}</div>`
      + `<div class="narrow"><p class="kz-sub">成果達成に使った時間</p>${box('timeUsed')}</div></div></td></tr>`
      + `<tr><td class="lbl">成果達成のために<br>何をしたか</td><td class="val">${box('howAchieved')}</td></tr>`
      + `<tr><td class="lbl">緊急で重要</td><td class="val">${box('urgentImportant')}</td></tr>`
      + `<tr><td class="lbl">緊急でなく重要</td><td class="val">${box('notUrgentImportant')}</td></tr>`
      + '</table>';
    const col2 = '<table class="kz-tbl ro-kz">'
      + `<tr><td class="lbl">報・連・相事項<br>(5W1H)</td><td class="val">${box('horenso')}</td></tr>`
      + `<tr><td class="lbl">自己効力感<br>一番頑張ったこと</td><td class="val">${box('bestEffort')}</td></tr>`
      + `<tr><td class="lbl">自己肯定感<br>ありがとう</td><td class="val">${box('thanks')}</td></tr>`
      + `<tr><td class="lbl">所感</td><td class="val">${box('impression')}</td></tr>`
      + '</table>';
    return `<div class="kz-2col"><div class="kz-col">${col1}</div><div class="kz-col">${col2}</div></div>`;
  }

  function gpopFormReadonly(rec) {
    const plain = k => `<div class="ro-plain">${rov(rec, k)}</div>`;
    return '<div class="gpop-container" style="margin-top:6px;">'
      + '<div class="gpop-goal-head">Goal（ゴール）</div>'
      + `<div class="gpop-goal-body">${plain('goal')}</div>`
      + '<div class="gpop-grid">'
      + `<div class="gpop-card"><div class="gpop-card-head"><div class="t">Pre</div><div class="s">（Goal実現のための計画）</div></div><div style="padding:14px;">${plain('pre')}</div></div>`
      + `<div class="gpop-card"><div class="gpop-card-head"><div class="t">On</div><div class="s">（Preの実施結果・評価）</div></div><div style="padding:14px;">${plain('on')}</div></div>`
      + `<div class="gpop-card"><div class="gpop-card-head"><div class="t">Post</div><div class="s">（振り返り・Onからの学び）</div></div><div style="padding:14px;">${plain('post')}</div></div>`
      + `<div class="gpop-card"><div class="gpop-card-head"><div class="t">Next Pre</div><div class="s">（次のアクション・次回のPre）</div></div><div style="padding:14px;">${plain('nextPre')}</div></div>`
      + '</div></div>';
  }

  function genbaFormReadonly(rec) {
    const box = k => `<div class="ro-box">${rov(rec, k)}</div>`;
    const FIELDS = [['現場名', 'genbamei'], ['施工管理', 'sekou'], ['概要', 'gaiyou'], ['作業内容', 'sagyou'],
      ['雨天時の対応', 'uten'], ['進捗度', 'shinchoku'], ['労務管理', 'roumu'], ['資材及び数量', 'shizai'],
      ['使用機械', 'kikai'], ['外注', 'gaichu'], ['フロー図', 'flow'], ['完成予定', 'kansei'], ['検査日', 'kensa'],
      ['バッファ色', 'buffer'], ['余裕日数', 'yoyuDays'], ['余裕率', 'yoyuRate'], ['残作業日数', 'zan'], ['稼働日数', 'kadou']];
    const rows = FIELDS.map(f => `<tr><td class="lbl">${f[0]}</td><td class="val">${box(f[1])}</td></tr>`).join('');
    const imgs = ((rec && rec.images) || []).filter(x => x).map(x =>
      `<a href="${genbaImgUrl(x)}" target="_blank"><img src="${genbaImgUrl(x)}" style="width:120px;height:90px;object-fit:cover;border:1px solid #ccc;border-radius:4px;margin:4px;"></a>`
    ).join('');
    const imgRow = imgs ? `<tr><td class="lbl">画像</td><td class="val">${imgs}</td></tr>` : '';
    const CATS = ['資材', '労務', '機械', '外注', '経費', '工事原価'];
    const mrows = CATS.map(cat => {
      const m = (rec && rec.money && rec.money[cat]) || {};
      return `<tr><td class="row-lbl">${cat}</td><td>${esc(m.h || '0')}</td><td>${esc(m.r || '0')}</td><td>${esc(m.y || '0')}</td></tr>`;
    }).join('');
    const moneyRow = `<tr><td class="lbl">昨日の<br>金の動き</td><td class="val">`
      + `<table class="money" style="max-width:480px;"><thead><tr><th></th><th>昨日発生額</th><th>出来高累計</th><th>予算額</th></tr></thead><tbody>${mrows}</tbody></table></td></tr>`;
    return `<table class="kz-tbl ro-kz">${rows}${imgRow}${moneyRow}</table>`;
  }

  function recordCardHtml(type, name, busho, dateLabel, rec) {
    const head = `<div class="rc-head">${esc(name || '')} 氏${busho ? `（${esc(busho)}）` : ''}${dateLabel ? `　${esc(dateLabel)}` : ''}</div>`;
    const inner = type === 'gyoumu' ? gyoumuFormReadonly(rec) : type === 'gpop' ? gpopFormReadonly(rec) : genbaFormReadonly(rec);
    return `<div class="report-card detail-card">${head}${inner}</div>`;
  }

  function glYen(v) { const n = Number(v); return (isNaN(n) ? 0 : n).toLocaleString() + ' 円'; }
  function glSect(label, v) { return `<div class="gl-lbl">[${label}]</div><div class="gl-val">${v ? esc(v) : 'なし'}</div>`; }

  function genbaListRow(r, idx) {
    const c1 = `<div class="gl-site gl-site-link" title="クリックでこの現場をコピーして新規作成" onclick="ReportView.copyGenbaFromList(${idx})">${esc(r.genbamei || '（現場名なし）')}</div>`
      + (r.gaiyou ? `<div class="gl-gaiyou">${esc(r.gaiyou)}</div>` : '')
      + `<div class="gl-bar">フロー図</div><div class="gl-flow">${r.flow ? esc(r.flow) : ''}</div>`;
    const c2 = `<div class="gl-rec">記録者：${esc(r.name || '')}　[進捗度：${esc(r.shinchoku || '')}]</div>`
      + glSect('施工管理', r.sekou) + glSect('作業内容', r.sagyou)
      + `<div class="gl-lbl">[雨天時の対応]</div><div class="gl-uten">${r.uten ? esc(r.uten) : ''}</div>`
      + glSect('資材及び数量', r.shizai) + glSect('労務管理', r.roumu) + glSect('使用機械', r.kikai) + glSect('外注', r.gaichu);
    const bufBg = { '緑': '#43a047', '黄': '#f2c200', '赤': '#e53935' }[r.buffer] || '';
    const bufStyle = bufBg ? ` style="background:${bufBg};color:#fff;font-weight:bold;"` : '';
    const kr = (l, v) => `<tr><td class="kl">${l}</td><td class="kv">${v ? esc(v) : ''}</td></tr>`;
    const c3 = '<table class="gl-koutei">'
      + kr('完成予定', r.kansei) + kr('検査日', r.kensa)
      + `<tr><td class="kl">バッファ色</td><td class="kv"${bufStyle}>${esc(r.buffer || '')}</td></tr>`
      + kr('余裕日数', r.yoyuDays) + kr('余裕率', r.yoyuRate) + kr('残作業日数', r.zan) + kr('稼働日数', r.kadou)
      + '</table>';
    const CATS = ['資材', '労務', '機械', '外注', '経費', '工事原価'];
    const mrows = CATS.map(cat => {
      const m = (r.money && r.money[cat]) || {};
      return `<tr><td class="ml">${cat}</td><td>${glYen(m.h)}</td><td>${glYen(m.r)}</td><td>${glYen(m.y)}</td></tr>`;
    }).join('');
    const imgs = (r.images || []).filter(x => x).map(x =>
      `<a href="${genbaImgUrl(x)}" target="_blank"><img class="gl-img" src="${genbaImgUrl(x)}"></a>`
    ).join('');
    const c4 = `<table class="gl-money"><thead><tr><th></th><th>昨日発生額</th><th>出来高累計</th><th>予算額</th></tr></thead><tbody>${mrows}</tbody></table>`
      + `<div class="gl-imglbl">[画像]</div><div class="gl-imgs">${imgs}</div>`;
    return `<tr><td>${c1}</td><td>${c2}</td><td>${c3}</td><td>${c4}</td></tr>`;
  }

  let genbaListRecords = [];
  function renderGenbaList(container, label, records) {
    genbaListRecords = records || [];
    let html = `<div class="gl-title">作業日報-${esc(label)}分 一覧表示</div>`;
    if (!records || !records.length) {
      html += '<p style="color:#999;">この日に登録された現場管理日報はありません。</p>';
    } else {
      html += '<div class="gl-wrap"><table class="gl-table"><thead><tr>'
        + '<th style="width:23%">現場名</th>'
        + '<th style="width:34%">作業内容／労務管理／資材及び数量／使用機械／外注</th>'
        + '<th style="width:18%">工程</th>'
        + '<th style="width:25%">昨日の金の動き</th>'
        + '</tr></thead><tbody>' + records.map((r, i) => genbaListRow(r, i)).join('') + '</tbody></table></div>';
    }
    container.innerHTML = html;
  }

  function copyGenbaFromList(idx) {
    const r = genbaListRecords[idx];
    if (!r) return;
    sessionStorage.setItem('copyGenbaRecord', JSON.stringify(r));
    location.href = '/report-genba.html?copyFromSession=1';
  }

  return { gyoumuFormReadonly, gpopFormReadonly, genbaFormReadonly, recordCardHtml, renderGenbaList, copyGenbaFromList, genbaImgUrl };
})();
