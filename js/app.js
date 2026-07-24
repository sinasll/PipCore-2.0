/* PipCore v2.0 — app shell: boot, theme, bottom-tab router. */
window.PC = window.PC || {};

PC.app = (() => {
  const TABS = [
    { id: 'home', label: 'Home', icon: 'user' },
    { id: 'stats', label: 'Stats', icon: 'chart' },
    { id: 'journal', label: 'Journal', icon: 'book' },
    { id: 'calendar', label: 'Calendar', icon: 'calendar' },
    { id: 'settings', label: 'Settings', icon: 'sliders' }
  ];
  let current = 'home';
  let pendingJournalPrefill = null;

  /* ---------- theme ---------- */
  function applyTheme(theme, silent) {
    document.documentElement.setAttribute('data-theme', theme);
    document.body.setAttribute('data-theme', theme); // legacy hook
    const btn = PC.ui.$('#themeToggle');
    if (btn) {
      btn.innerHTML = PC.ui.icon(theme === 'dark' ? 'sun' : 'moon', 17);
      btn.setAttribute('aria-label', theme === 'dark' ? 'Switch to gold theme' : 'Switch to night theme');
    }
    PC.tg.applyTheme(theme);
    if (!silent) {
      PC.store.updateSettings({ theme });
      PC.tg.haptic('light');
    }
  }

  function toggleTheme() {
    const next = PC.store.getSettings().theme === 'dark' ? 'light' : 'dark';
    applyTheme(next);
    PC.bus.emit('repaint');
  }

  /* ---------- router ---------- */
  function go(tab, opts) {
    if (tab === 'journal' && opts && opts.prefill) pendingJournalPrefill = opts.prefill;
    const valid = TABS.some((t) => t.id === tab) ? tab : 'home';
    current = valid;
    PC.ui.$$('.view').forEach((v) => v.classList.toggle('is-active', v.id === 'view-' + valid));
    PC.ui.$$('#tabbar .tab').forEach((b) => {
      const on = b.dataset.tab === valid;
      b.classList.toggle('is-active', on);
      b.setAttribute('aria-selected', on);
    });
    const view = PC.ui.$('#view-' + valid);
    if (view) view.scrollTop = 0;
    if (PC.views[valid] && PC.views[valid].onShow) {
      try { PC.views[valid].onShow(pendingJournalPrefill); } catch (e) { console.error(e); }
    }
    pendingJournalPrefill = null;
    PC.tg.haptic('select');
    try { history.replaceState(null, '', '#' + valid); } catch (e) {}
  }

  function currentTab() { return current; }

  /* ---------- build chrome ---------- */
  function buildShell() {
    const header = PC.ui.$('#appHeader');
    header.innerHTML =
      '<div class="brand">' +
        '<span class="brand__mark"><img src="assets/logo.png" alt="PipCore"></span>' +
        '<span>' +
          '<span class="brand__name">PIPCORE</span>' +
          '<span class="brand__tag">TRADE JOURNAL V2</span>' +
        '</span>' +
      '</div>' +
      '<div class="header__actions">' +
        '<button class="icon-btn" id="themeToggle" aria-label="Toggle theme"></button>' +
      '</div>';
    PC.ui.$('#themeToggle').addEventListener('click', toggleTheme);

    const bar = PC.ui.$('#tabbar');
    bar.innerHTML = '';
    TABS.forEach((t) => {
      const b = PC.ui.el(
        '<button class="tab" role="tab" data-tab="' + t.id + '" aria-selected="false" aria-label="' + t.label + '">' +
          PC.ui.icon(t.icon, 19) +
          '<span class="tab__label">' + t.label.toUpperCase() + '</span>' +
        '</button>'
      );
      b.addEventListener('click', () => go(t.id));
      bar.appendChild(b);
    });
  }

  /* ---------- global paint cycle ---------- */
  function repaint() {
    Object.keys(PC.views).forEach((k) => {
      if (PC.views[k] && PC.views[k].render) {
        try { PC.views[k].render(); } catch (e) { console.error('render ' + k, e); }
      }
    });
  }

  /* ---------- boot ---------- */
  function boot() {
    PC.store.migrate();
    applyTheme(PC.store.getSettings().theme, true);

    buildShell();

    Object.keys(PC.views).forEach((k) => {
      if (PC.views[k] && PC.views[k].init) {
        try { PC.views[k].init(); } catch (e) { console.error('init ' + k, e); }
      }
    });

    PC.bus.on('trades', repaint);
    PC.bus.on('options', repaint);
    PC.bus.on('repaint', repaint);
    PC.bus.on('settings', () => { /* live-theme already handled */ });

    repaint();

    let startTab = 'home';
    try {
      const h = (location.hash || '').replace('#', '');
      if (TABS.some((t) => t.id === h)) startTab = h;
    } catch (e) {}
    go(startTab);

    PC.tg.init();
    if (PC.views.home.heroProfile) PC.views.home.heroProfile();

    // redraw charts at the new viewport size (debounced)
    let resizeTimer = null;
    window.addEventListener('resize', () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        const v = PC.views[current];
        if (v && v.render) { try { v.render(); } catch (e) {} }
      }, 180);
    });
  }

  document.addEventListener('DOMContentLoaded', boot);

  return { go, toggleTheme, applyTheme, currentTab, TABS };
})();
