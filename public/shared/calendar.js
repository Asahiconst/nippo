// カレンダー描画共通ロジック（業務改善日報・現場管理日報・G-POP共通）
window.CalUtil = (function () {
  const WD = ['日', '月', '火', '水', '木', '金', '土'];

  // hasData: 現場管理日報は {day:[現場名,...]}、それ以外は {day:true}
  function render(container, year, month, hasData, specialMap, opts) {
    opts = opts || {};
    hasData = hasData || {};
    specialMap = specialMap || {};
    const firstDow = new Date(year, month - 1, 1).getDay();
    const daysInMonth = new Date(year, month, 0).getDate();

    let html = '<table class="calendar"><thead><tr>';
    for (let i = 0; i < 7; i++) {
      html += `<th class="${i === 0 ? 'sun' : i === 6 ? 'sat' : ''}">${WD[i]}</th>`;
    }
    html += '</tr></thead><tbody><tr>';
    for (let i = 0; i < firstDow; i++) html += '<td class="empty"></td>';

    let col = firstDow;
    for (let d = 1; d <= daysInMonth; d++) {
      const dow = new Date(year, month - 1, d).getDay();
      const key = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const hol = HolidayUtil.isHoliday(key, specialMap);
      const pto = HolidayUtil.isPto(key, specialMap);
      let cls = (dow === 0 || hol) ? 'sun' : (dow === 6 ? 'sat' : '');
      if (pto) cls += ' cal-pto';
      const holName = HolidayUtil.name(key, specialMap);
      const holHtml = holName ? `<div class="${pto ? 'cal-pto-name' : 'cal-holiday'}">${App.escapeHtml(holName)}</div>` : '';
      const cell = hasData[d];
      if (cell) {
        cls += ' has-data';
        let mark;
        if (Array.isArray(cell)) {
          mark = '<ul class="cal-sites">' + cell.map(s => `<li>・${App.escapeHtml(s)}</li>`).join('') + '</ul>';
        } else {
          mark = '<span class="cal-badge">日報あり</span>';
        }
        html += `<td class="${cls}" data-date="${key}"><div class="cal-daynum">${d}</div>${holHtml}${mark}</td>`;
      } else {
        html += `<td class="${cls}"><div class="cal-daynum">${d}</div>${holHtml}</td>`;
      }
      col++;
      if (col === 7 && d < daysInMonth) { html += '</tr><tr>'; col = 0; }
    }
    while (col < 7 && col !== 0) { html += '<td class="empty"></td>'; col++; }
    html += '</tr></tbody></table>';
    container.innerHTML = html;

    if (opts.onDayClick) {
      container.querySelectorAll('td.has-data').forEach(td => {
        td.addEventListener('click', () => opts.onDayClick(td.getAttribute('data-date')));
      });
    }
  }

  return { render };
})();
