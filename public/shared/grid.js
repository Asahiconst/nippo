// 出勤簿・運転日報・管理者レビュー用：スプレッドシート風グリッド編集の共通ロジック
// （セル選択・矢印/Enter移動・Ctrl+C/V・Delete・Ctrl+Z・右下ドラッグでの下方向コピー）
window.GridUtil = (function () {
  function daysOfMonth(ym) {
    const [y, m] = ym.split('-').map(Number);
    const last = new Date(y, m, 0).getDate();
    const out = [];
    for (let d = 1; d <= last; d++) out.push(`${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`);
    return out;
  }
  function wdClass(dateKey) {
    const [y, m, d] = dateKey.split('-').map(Number);
    const wd = new Date(y, m - 1, d).getDay();
    return wd === 0 ? 'sun' : wd === 6 ? 'sat' : '';
  }
  function wdLabel(dateKey) {
    const [y, m, d] = dateKey.split('-').map(Number);
    return ['日', '月', '火', '水', '木', '金', '土'][new Date(y, m - 1, d).getDay()];
  }

  let activeInput = null, activeBody = null, clip = '';
  let anchor = null, range = null, shiftNav = false, undoStack = [];
  let dragging = false, src = null, handleEl = null, globalBound = false;
  const bound = {};

  function ensureGlobal() {
    if (globalBound) return;
    handleEl = document.createElement('div');
    handleEl.id = 'fill-handle';
    document.body.appendChild(handleEl);
    handleEl.addEventListener('mousedown', fillStart);
    document.addEventListener('mousedown', (e) => {
      if (dragging || e.target === handleEl) return;
      if (e.target.tagName === 'INPUT' && e.target.closest && e.target.closest('.grid')) return;
      hideHandle();
    });
    window.addEventListener('scroll', () => { if (activeInput) posHandle(activeInput); }, true);
    window.addEventListener('resize', () => { if (activeInput) posHandle(activeInput); });
    document.addEventListener('mousemove', fillMove);
    document.addEventListener('mouseup', fillEnd);
    globalBound = true;
  }

  function init(bodyId) {
    ensureGlobal();
    const body = document.getElementById(bodyId);
    if (!body) return;
    body.classList.add('grid');
    if (bound[bodyId]) return;
    body.addEventListener('focusin', (e) => {
      if (e.target.tagName !== 'INPUT') return;
      activeInput = e.target; activeBody = body;
      e.target._undoPrev = e.target.value;
      body.querySelectorAll('td.me-selected').forEach(td => td.classList.remove('me-selected'));
      if (e.target.parentElement) e.target.parentElement.classList.add('me-selected');
      if (!shiftNav) { clearRange(); anchor = null; }
      posHandle(e.target);
    });
    body.addEventListener('focusout', (e) => {
      if (e.target.tagName !== 'INPUT') return;
      if (e.target._undoPrev != null && e.target.value !== e.target._undoPrev) undoPush([{ input: e.target, prev: e.target._undoPrev }]);
      exitEdit(e.target);
    });
    body.addEventListener('dblclick', (e) => { if (e.target.tagName === 'INPUT') { enterEdit(e.target, false); try { e.target.select(); } catch (_) {} } });
    body.addEventListener('keydown', (e) => { keydown(e); });
    bound[bodyId] = true;
  }

  function lock(body) { if (!body) return; body.querySelectorAll('input').forEach(i => { i.readOnly = true; i.classList.remove('editing'); }); }
  function enterEdit(input, clear) {
    input.readOnly = false; input.classList.add('editing');
    if (clear) input.value = '';
    if (document.activeElement !== input) input.focus();
    if (!clear) { try { const n = (input.value || '').length; input.setSelectionRange(n, n); } catch (e) {} }
  }
  function exitEdit(input) {
    if (input.classList.contains('km-field')) {
      const v = (input.value || '').trim();
      if (/^\d+(\.\d+)?$/.test(v)) { input.value = v + 'km'; input.dispatchEvent(new Event('input')); }
    }
    input.readOnly = true; input.classList.remove('editing');
  }

  const ARROW = { ArrowDown: [1, 0], ArrowUp: [-1, 0], ArrowRight: [0, 1], ArrowLeft: [0, -1] };

  function keydown(e) {
    const t = e.target; if (t.tagName !== 'INPUT') return;
    const editing = !t.readOnly;
    if (e.ctrlKey || e.metaKey) {
      if (e.key === 'z' || e.key === 'Z') { if (!editing) { e.preventDefault(); doUndo(); } return; }
      if (e.key === 'c' || e.key === 'C') { e.preventDefault(); copy(t); return; }
      if (e.key === 'v' || e.key === 'V') { e.preventDefault(); paste(t); return; }
      if (e.key === 'a' || e.key === 'A') return;
      return;
    }
    if (!editing) {
      if (e.shiftKey && ARROW[e.key]) { e.preventDefault(); extendRange(t, ARROW[e.key][0], ARROW[e.key][1]); return; }
      if (e.key === 'Enter' || e.key === 'ArrowDown') { e.preventDefault(); move(t, 1, 0); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); move(t, -1, 0); }
      else if (e.key === 'ArrowRight') { e.preventDefault(); move(t, 0, 1); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); move(t, 0, -1); }
      else if (e.key === 'F2') { e.preventDefault(); enterEdit(t, false); }
      else if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); clearCells(); }
      else if (e.key && e.key.length === 1) { enterEdit(t, true); }
    } else {
      if (e.key === 'Enter') { e.preventDefault(); exitEdit(t); move(t, 1, 0); }
      else if (e.key === 'Escape') { e.preventDefault(); exitEdit(t); }
    }
  }

  function cellCoord(input) {
    const body = input.closest('tbody'); if (!body) return null;
    const rows = Array.prototype.slice.call(body.querySelectorAll('tr'));
    const tr = input.closest('tr'); const r = rows.indexOf(tr);
    const c = Array.prototype.slice.call(tr.querySelectorAll('input')).indexOf(input);
    return { body, rows, r, c };
  }
  function inputAt(rows, r, c) { if (r < 0 || r >= rows.length) return null; const ins = rows[r].querySelectorAll('input'); if (c < 0 || c >= ins.length) return null; return ins[c]; }

  function move(input, dr, dc) {
    const co = cellCoord(input); if (!co) return;
    const nr = Math.max(0, Math.min(co.rows.length - 1, co.r + dr));
    let nc = co.c + dc;
    const tgtIns = co.rows[nr].querySelectorAll('input'); if (!tgtIns.length) return;
    if (nc < 0) nc = 0; if (nc >= tgtIns.length) nc = tgtIns.length - 1;
    const tgt = tgtIns[nc];
    if (tgt) { clearRange(); anchor = null; tgt.focus(); try { tgt.select(); } catch (_) {} }
  }

  function extendRange(input, dr, dc) {
    const co = cellCoord(input); if (!co) return;
    if (!anchor) anchor = { r: co.r, c: co.c };
    const nr = Math.max(0, Math.min(co.rows.length - 1, co.r + dr));
    let nc = co.c + dc;
    const maxc = co.rows[nr].querySelectorAll('input').length - 1;
    if (nc < 0) nc = 0; if (nc > maxc) nc = maxc;
    const tgt = inputAt(co.rows, nr, nc); if (!tgt) return;
    shiftNav = true; tgt.focus(); shiftNav = false;
    setRange(co.body, anchor.r, anchor.c, nr, nc);
  }
  function clearRange() { if (activeBody) activeBody.querySelectorAll('input.range-sel').forEach(i => i.classList.remove('range-sel')); range = null; }
  function setRange(body, r1, c1, r2, c2) {
    clearRange();
    const rows = Array.prototype.slice.call(body.querySelectorAll('tr'));
    const rmin = Math.min(r1, r2), rmax = Math.max(r1, r2), cmin = Math.min(c1, c2), cmax = Math.max(c1, c2);
    for (let r = rmin; r <= rmax; r++) for (let c = cmin; c <= cmax; c++) { const ip = inputAt(rows, r, c); if (ip) ip.classList.add('range-sel'); }
    range = { body, rows, r1: rmin, c1: cmin, r2: rmax, c2: cmax };
  }

  function copy(t) {
    if (range) {
      const lines = [];
      for (let r = range.r1; r <= range.r2; r++) { const cells = []; for (let c = range.c1; c <= range.c2; c++) { const ip = inputAt(range.rows, r, c); cells.push(ip ? ip.value : ''); } lines.push(cells.join('\t')); }
      clip = lines.join('\n');
    } else { clip = t.value; }
    try { if (navigator.clipboard) navigator.clipboard.writeText(clip); } catch (_) {}
  }
  function paste(t) {
    const co = cellCoord(t); if (!co) return;
    const changes = [];
    if (clip.indexOf('\t') >= 0 || clip.indexOf('\n') >= 0) {
      const rowsData = clip.replace(/\r/g, '').split('\n');
      rowsData.forEach((line, i) => {
        line.split('\t').forEach((val, j) => {
          const ip = inputAt(co.rows, co.r + i, co.c + j);
          if (ip) { changes.push({ input: ip, prev: ip.value }); ip.value = val; ip.dispatchEvent(new Event('input')); }
        });
      });
    } else {
      changes.push({ input: t, prev: t.value }); t.value = clip; t.dispatchEvent(new Event('input'));
    }
    if (changes.length) undoPush(changes);
  }
  function clearCells() {
    const ins = range ? activeBody.querySelectorAll('input.range-sel') : (activeInput ? [activeInput] : []);
    const changes = [];
    Array.prototype.forEach.call(ins, ip => { if (ip.value !== '') { changes.push({ input: ip, prev: ip.value }); ip.value = ''; ip.dispatchEvent(new Event('input')); } });
    if (changes.length) undoPush(changes);
  }
  function undoPush(changes) { undoStack.push(changes); if (undoStack.length > 100) undoStack.shift(); }
  function doUndo() {
    const act = undoStack.pop(); if (!act) return;
    act.forEach(ch => { ch.input.value = ch.prev; ch.input.dispatchEvent(new Event('input')); });
    if (act[0] && act[0].input) { try { act[0].input.focus(); } catch (_) {} }
  }

  function posHandle(input) {
    if (!handleEl) return;
    const r = input.getBoundingClientRect();
    handleEl.style.left = (r.right - 5) + 'px';
    handleEl.style.top = (r.bottom - 5) + 'px';
    handleEl.style.display = 'block';
  }
  function hideHandle() { if (handleEl) handleEl.style.display = 'none'; activeInput = null; }
  function colInputs(body, col) { return Array.prototype.slice.call(body.querySelectorAll(`input[data-col="${col}"]`)); }
  function fillStart(e) {
    if (!activeInput) return;
    const scope = activeInput.closest('tbody'); if (!scope) return;
    e.preventDefault(); dragging = true;
    src = { body: scope, col: activeInput.getAttribute('data-col'), row: parseInt(activeInput.getAttribute('data-row'), 10), value: activeInput.value };
  }
  function fillMove(e) {
    if (!dragging) return;
    const inputs = colInputs(src.body, src.col);
    let target = src.row;
    inputs.forEach(inp => { if (e.clientY >= inp.getBoundingClientRect().top) target = parseInt(inp.getAttribute('data-row'), 10); });
    if (target < src.row) target = src.row;
    inputs.forEach(inp => { const rw = parseInt(inp.getAttribute('data-row'), 10); inp.classList.toggle('fill-target', rw > src.row && rw <= target); });
  }
  function fillEnd() {
    if (!dragging) return;
    dragging = false;
    const changes = [];
    colInputs(src.body, src.col).forEach(inp => {
      if (inp.classList.contains('fill-target')) { changes.push({ input: inp, prev: inp.value }); inp.value = src.value; inp.classList.remove('fill-target'); inp.dispatchEvent(new Event('input')); }
    });
    if (changes.length) undoPush(changes);
  }

  return { daysOfMonth, wdClass, wdLabel, init, lock };
})();
