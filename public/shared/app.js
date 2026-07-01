// 共通ユーティリティ（全ページで読み込み）
window.App = (function () {
  let currentUser = null;

  async function api(path, opts) {
    opts = opts || {};
    const res = await fetch('/api/' + path, {
      method: opts.method || 'GET',
      credentials: 'include',
      headers: opts.body ? { 'Content-Type': 'application/json' } : undefined,
      body: opts.body ? JSON.stringify(opts.body) : undefined
    });
    if (res.status === 401) {
      const onLoginPage = /\/(index\.html)?$/.test(location.pathname);
      if (!onLoginPage) location.href = '/index.html';
      throw new Error('unauthorized');
    }
    const ct = res.headers.get('Content-Type') || '';
    return ct.indexOf('application/json') >= 0 ? res.json() : res.text();
  }

  function loading(show) {
    const el = document.getElementById('loading');
    if (el) el.classList.toggle('show', !!show);
  }

  function toast(msg) {
    let el = document.getElementById('toast');
    if (!el) {
      el = document.createElement('div');
      el.id = 'toast';
      el.className = 'toast';
      document.body.appendChild(el);
    }
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(el._t);
    el._t = setTimeout(() => el.classList.remove('show'), 2200);
  }

  function escapeHtml(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
  }

  function nl2br(s) {
    return escapeHtml(s).replace(/\n/g, '<br>');
  }

  function getParam(name) {
    return new URLSearchParams(location.search).get(name);
  }

  function pad2(n) { return String(n).padStart(2, '0'); }

  function todayKey() {
    const d = new Date();
    return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
  }

  const NAV_ITEMS = [
    { key: 'top', label: 'トップ', href: '/top.html' },
    { key: 'gyoumu', label: '業務改善日報', href: '/calendar.html?type=gyoumu' },
    { key: 'genba', label: '現場管理日報', href: '/calendar.html?type=genba' },
    { key: 'gpop', label: 'G-POP', href: '/calendar.html?type=gpop' },
    { key: 'shukkan', label: '出勤簿', href: '/shukkan.html' },
    { key: 'unten', label: '運転日報', href: '/unten.html' },
    { key: 'employees', label: '社員リスト', href: '/employees.html' }
  ];

  function renderHeader(activeKey) {
    const header = document.getElementById('header-area');
    if (!header || !currentUser) return;
    const items = NAV_ITEMS.slice();
    if (currentUser.role === '管理者') items.push({ key: 'admin', label: '管理者専用', href: '/admin.html' });
    items.push({ key: 'password', label: 'パスワード変更', href: '/password.html' });

    const navHtml = items.map(it =>
      `<li class="${it.key === activeKey ? 'active' : ''}"><a href="${it.href}">${escapeHtml(it.label)}</a></li>`
    ).join('') + `<li><a href="#" id="logout-link">ログアウト</a></li>`;

    header.innerHTML = `
      <div class="logo-container"><a class="logo" href="/top.html">旭建設株式会社 日報システム</a></div>
      <nav class="main-nav"><ul>${navHtml}</ul></nav>
      <div class="user-bar"><b>${escapeHtml(currentUser.name)}</b>（${escapeHtml(currentUser.busho)} / ${escapeHtml(currentUser.role)}）</div>
    `;
    const logoutLink = document.getElementById('logout-link');
    if (logoutLink) logoutLink.addEventListener('click', async (e) => {
      e.preventDefault();
      await api('logout', { method: 'POST' });
      location.href = '/index.html';
    });
  }

  // 各ページ冒頭で呼ぶ：ログイン確認→ヘッダー描画→お知らせ表示
  async function requireAuth(activeKey, opts) {
    opts = opts || {};
    loading(true);
    try {
      const res = await api('me');
      currentUser = res.user;
      if (opts.adminOnly && currentUser.role !== '管理者') {
        alert('権限がありません。');
        location.href = '/top.html';
        return null;
      }
      renderHeader(activeKey);
      renderMessageBanner();
      return currentUser;
    } finally {
      loading(false);
    }
  }

  async function renderMessageBanner() {
    const targets = document.querySelectorAll('.msg-banner');
    if (!targets.length) return;
    try {
      const res = await api('settings/message');
      targets.forEach(el => { el.innerHTML = res.message || ''; });
    } catch (e) { /* ignore */ }
  }

  function getCurrentUser() { return currentUser; }

  function autoGrow(el) {
    const resize = () => { el.style.height = 'auto'; el.style.height = (el.scrollHeight + 2) + 'px'; };
    el.addEventListener('input', resize);
    resize();
  }

  return {
    api, loading, toast, escapeHtml, nl2br, getParam, pad2, todayKey,
    requireAuth, getCurrentUser, autoGrow, renderHeader
  };
})();
