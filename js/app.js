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

  /* ---------- typography ---------- */
  // The first option preserves PipCore's existing pixel look. The other two
  // stacks intentionally include dependable system fallbacks if a webfont is
  // unavailable (for example, in an offline Telegram webview).
  const FONT_STACKS = {
    pixel: '"Press Start 2P", "Courier New", monospace',
    inter: 'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    jetbrains: '"JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace'
  };
  let baseRootFontSize = null;

  function clampFontSize(value) {
    const min = PC.store.FONT_SIZE_MIN || 10;
    const max = PC.store.FONT_SIZE_MAX || 150;
    const number = Number(value);
    if (!Number.isFinite(number)) return 100;
    return Math.min(max, Math.max(min, Math.round(number)));
  }

  function ensureTypographyFonts() {
    if (document.getElementById('pc-typography-fonts')) return;
    const link = document.createElement('link');
    link.id = 'pc-typography-fonts';
    link.rel = 'stylesheet';
    link.href = 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600;700&display=swap';
    // Canvas text needs a repaint after the async webfont stylesheet arrives.
    link.addEventListener('load', () => { if (PC.bus) PC.bus.emit('repaint'); });
    document.head.appendChild(link);
  }

  function ensureTypographyStyles() {
    ensureTypographyFonts();
    if (document.getElementById('pc-typography-style')) return;
    const style = document.createElement('style');
    style.id = 'pc-typography-style';
    style.textContent =
      'body, body * { font-family: var(--pc-font-family, "Press Start 2P", monospace) !important; }';
    document.head.appendChild(style);
  }

  function applyTypography(font, fontSize, silent) {
    const saved = PC.store.getSettings();
    const selectedFont = FONT_STACKS[font] ? font : (FONT_STACKS[saved.font] ? saved.font : 'pixel');
    const selectedSize = clampFontSize(fontSize === undefined || fontSize === null ? saved.fontSize : fontSize);
    const root = document.documentElement;

    ensureTypographyStyles();
    root.style.setProperty('--pc-font-family', FONT_STACKS[selectedFont]);
    root.style.setProperty('--pc-font-scale', String(selectedSize / 100));
    root.setAttribute('data-font', selectedFont);
    if (document.body) document.body.setAttribute('data-font', selectedFont);

    // Scale the root from its original computed size. This keeps 100% visually
    // identical to the existing app while letting rem/em typography follow the
    // user-selected 10%–150% range.
    if (baseRootFontSize === null) {
      const measured = parseFloat(window.getComputedStyle(root).fontSize);
      baseRootFontSize = Number.isFinite(measured) && measured > 0 ? measured : 16;
    }
    root.style.fontSize = (baseRootFontSize * selectedSize / 100).toFixed(3) + 'px';

    if (!silent) {
      PC.store.updateSettings({ font: selectedFont, fontSize: selectedSize });
      PC.tg.haptic('light');
    }
  }

  function getFontStack(font) {
    return FONT_STACKS[font] || FONT_STACKS.pixel;
  }

  /* ---------- theme ---------- */
  function paintThemeToggle(theme) {
    const btn = PC.ui.$('#themeToggle');
    if (!btn) return;
    btn.innerHTML = '<span aria-hidden="true" style="display:flex;align-items:center;justify-content:center;pointer-events:none">' + PC.ui.icon(theme === 'dark' ? 'sun' : 'moon', 17) + '</span>';
    btn.setAttribute('aria-label', theme === 'dark' ? 'Switch to gold theme' : 'Switch to night theme');
    btn.style.color = 'var(--fg)';
    btn.style.opacity = '1';
    const svg = btn.querySelector('svg');
    if (svg) {
      svg.style.display = 'block';
      svg.style.opacity = '1';
      svg.style.visibility = 'visible';
      svg.style.pointerEvents = 'none';
    }
  }

  function applyTheme(theme, silent) {
    document.documentElement.setAttribute('data-theme', theme);
    document.body.setAttribute('data-theme', theme); // legacy hook
    paintThemeToggle(theme);
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
        '</span>' +
      '</div>' +
      '<div class="header__actions">' +
        '<button class="icon-btn" id="themeToggle" type="button" aria-label="Toggle theme"></button>' +
      '</div>';
    PC.ui.$('#themeToggle').addEventListener('click', toggleTheme);
    paintThemeToggle(PC.store.getSettings().theme);

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
    const settings = PC.store.getSettings();
    applyTheme(settings.theme, true);
    applyTypography(settings.font, settings.fontSize, true);

    buildShell();

    Object.keys(PC.views).forEach((k) => {
      if (PC.views[k] && PC.views[k].init) {
        try { PC.views[k].init(); } catch (e) { console.error('init ' + k, e); }
      }
    });

    PC.bus.on('trades', repaint);
    PC.bus.on('options', repaint);
    PC.bus.on('repaint', repaint);
    PC.bus.on('settings', (settings) => {
      // Settings can also arrive through a restored backup, so keep type and
      // size live even when they were not changed from the Settings screen.
      if (settings) applyTypography(settings.font, settings.fontSize, true);
    });

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

  return { go, toggleTheme, applyTheme, applyTypography, getFontStack, currentTab, TABS };
})();
