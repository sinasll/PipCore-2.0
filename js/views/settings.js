/* PipCore v2.0 — Settings tab: appearance, trade option manager,
   backup/restore, danger zone, about & community. */
window.PC = window.PC || {};
PC.views = PC.views || {};

PC.views.settings = (() => {
  const { $, $$, el, esc, icon, toast } = PC.ui;

  const LISTS = [
    { type: 'setups', label: 'Setups', icon: 'layers', desc: 'Your trade setups' },
    { type: 'entries', label: 'Entries', icon: 'target', desc: 'How you enter trades' },
    { type: 'timeframes', label: 'Timeframes', icon: 'clock', desc: 'Your chart timeframes' },
    { type: 'pairs', label: 'Pairs', icon: 'trend-up', desc: 'Markets you trade' },
    { type: 'sessions', label: 'Sessions', icon: 'globe', desc: 'Your trading sessions' }
  ];

  let root;
  let openPanels = {};
  let optionDrafts = {};

  function init() {
    root = $('#view-settings .view__inner');
    root.innerHTML = [
      /* ---------- appearance ---------- */
      '<div class="section" style="margin-top:0">',
        '<div class="section__head"><h3 class="section__title">' + icon('sliders', 14) + '<span>APP</span></h3></div>',
        '<div class="card"><div class="rows" id="prefRows"></div></div>',
      '</div>',

      /* ---------- options ---------- */
      '<div class="section">',
        '<div class="section__head"><h3 class="section__title">' + icon('grid', 14) + '<span>TRADE LISTS</span></h3><span class="section__meta" id="optMeta"></span></div>',
        '<div id="listsHost"></div>',
      '</div>',

      /* ---------- data ---------- */
      '<div class="section">',
        '<div class="section__head"><h3 class="section__title">' + icon('database', 14) + '<span>BACKUP</span></h3></div>',
        '<div class="card">',
          '<div class="rows">',
            '<div class="row"><div class="row__main"><div class="row__title">Export backup</div><div class="row__desc">Save trades, lists and settings in one file.</div></div><button class="btn--sm btn btn--ghost" id="backupBtn">' + icon('download', 13) + 'Export</button></div>',
            '<div class="row"><div class="row__main"><div class="row__title">Import backup</div><div class="row__desc">Load a backup file and merge or replace.</div></div><button class="btn--sm btn btn--ghost" id="restoreBtn">' + icon('upload', 13) + 'Import</button></div>',
          '</div>',
          '<input type="file" id="restoreFile" accept=".json,application/json" class="hidden">',
        '</div>',
      '</div>',

      /* ---------- danger ---------- */
      '<div class="section">',
        '<div class="section__head"><h3 class="section__title">' + icon('alert', 14) + '<span>RESET</span></h3></div>',
        '<div class="card danger-card">',
          '<div class="rows">',
            '<div class="row"><div class="row__main"><div class="row__title">Reset trade lists</div><div class="row__desc">Bring your setups, entries, timeframes, pairs and sessions back to default.</div></div><button class="btn--sm btn btn--danger" id="resetOptsBtn">Reset</button></div>',
            '<div class="row"><div class="row__main"><div class="row__title">Delete all trades</div><div class="row__desc">Clear your journal from this device.</div></div><button class="btn--sm btn btn--danger" id="wipeBtn">' + icon('trash', 13) + 'Delete</button></div>',
          '</div>',
        '</div>',
      '</div>',

      /* ---------- about ---------- */
      '<div class="section">',
        '<div class="section__head"><h3 class="section__title">' + icon('info', 14) + '<span>ABOUT</span></h3></div>',
        '<div class="card t-c card--pad-lg">',
          '<img src="assets/mark.png" alt="PipCore" style="width:64px;height:64px;border-radius:16px;border:1px solid var(--line-strong);margin:0 auto 14px;display:block">',
          '<div class="h-2">PIPCORE</div>',
          '<p class="t-xs t-dim" style="margin-top:16px;line-height:2">A simple trading journal to help you stay sharp and consistent.</p>',
        '</div>',
      '</div>',

      '<div class="section">',
        '<div class="section__head" style="justify-content:center;text-align:center"><h3 class="section__title" style="margin:0 auto">' + icon('globe', 14) + '<span>COMMUNITY</span></h3></div>',
        '<div class="social-grid" id="socialGrid" style="display:flex;justify-content:center;align-items:center;flex-wrap:wrap;gap:12px"></div>',
      '</div>',

      '<p class="footer-note">Built for traders<br>© 2026 PipCore</p>'
    ].join('');

    buildPrefs();
    buildLists();
    buildSocials();
    wireData();
  }

  /* ---------- preferences ---------- */
  function buildPrefs() {
    const host = $('#prefRows', root);
    if (!host) return;
    host.innerHTML = '';
    const s = PC.store.getSettings();

    // theme
    const themeRow = el(
      '<div class="row">' +
        '<div class="row__main"><div class="row__title">Theme</div><div class="row__desc">Pick dark or gold.</div></div>' +
        '<div class="row__end"></div>' +
      '</div>'
    );
    themeRow.querySelector('.row__end').appendChild(PC.ui.segment(
      [{ value: 'dark', label: 'Night' }, { value: 'light', label: 'Gold' }],
      s.theme,
      (v) => { PC.app.applyTheme(v); PC.bus.emit('repaint'); },
      false
    ));
    host.appendChild(themeRow);

    // week start
    const wkRow = el(
      '<div class="row">' +
        '<div class="row__main"><div class="row__title">Week starts</div><div class="row__desc">Choose the first day.</div></div>' +
        '<div class="row__end"></div>' +
      '</div>'
    );
    wkRow.querySelector('.row__end').appendChild(PC.ui.segment(
      [{ value: 'mon', label: 'Mon' }, { value: 'sun', label: 'Sun' }],
      s.weekStart,
      (v) => { PC.store.updateSettings({ weekStart: v }); PC.bus.emit('repaint'); },
      false
    ));
    host.appendChild(wkRow);

    // haptics
    const hRow = el(
      '<div class="row">' +
        '<div class="row__main"><div class="row__title">Haptics</div><div class="row__desc">Small vibration on taps.</div></div>' +
        '<div class="row__end"></div>' +
      '</div>'
    );
    hRow.querySelector('.row__end').appendChild(PC.ui.switchControl(s.haptics, (v) => {
      PC.store.updateSettings({ haptics: v });
      if (v) PC.tg.haptic('medium');
    }, 'Haptic feedback'));
    host.appendChild(hRow);
  }

  /* ---------- option list management ---------- */
  function buildLists() {
    const host = $('#listsHost', root);
    if (!host) return;
    host.innerHTML = '';
    let total = 0;

    // precompute per-option usage counts in one pass (O(trades * fields))
    const trades = PC.store.getTrades();
    const usage = {};
    LISTS.forEach((L) => { usage[L.type] = {}; });
    trades.forEach((t) => {
      usage.setups[t.setup] = (usage.setups[t.setup] || 0) + 1;
      usage.entries[t.entry] = (usage.entries[t.entry] || 0) + 1;
      usage.timeframes[t.timeframe] = (usage.timeframes[t.timeframe] || 0) + 1;
      usage.pairs[t.pair] = (usage.pairs[t.pair] || 0) + 1;
      usage.sessions[t.session] = (usage.sessions[t.session] || 0) + 1;
    });

    LISTS.forEach((L) => {
      const items = PC.store.getList(L.type);
      total += items.length;
      const open = !!openPanels[L.type];

      const card = el(
        '<div class="card acc" style="margin-bottom:12px">' +
          '<button class="task card-head" style="border:0;background:transparent;padding:0;width:100%;text-align:left" data-acc-head>' +
            '<span class="card-head__title">' + icon(L.icon, 14) + '<span>' + esc(L.label.toUpperCase()) + '</span></span>' +
            '<span class="card-head__meta">' + items.length + ' ' + icon(open ? 'chev-u' : 'chev-d', 12) + '</span>' +
          '</button>' +
          '<div data-acc-body class="' + (open ? '' : 'hidden') + '">' +
            '<div class="acc__list" data-rows></div>' +
            '<div class="flex mt-3">' +
              '<input class="input" data-add-input placeholder="NEW ' + esc(L.label.toUpperCase().slice(0, -1)) + '..." maxlength="40" style="flex:1" value="' + esc(optionDrafts[L.type] || '') + '">' +
              '<button class="icon-btn" data-add-btn aria-label="Add">' + icon('plus', 15) + '</button>' +
            '</div>' +
            '<div class="flex--between mt-3">' +
              '<span class="t-xs t-faint">' + esc(L.desc) + '</span>' +
              '<button class="chip" data-reset>DEFAULTS</button>' +
            '</div>' +
          '</div>' +
        '</div>'
      );

      card.querySelector('[data-acc-head]').addEventListener('click', () => {
        openPanels[L.type] = !openPanels[L.type];
        PC.tg.haptic('light');
        buildLists();
      });

      const rows = card.querySelector('[data-rows]');
      if (!items.length) {
        rows.appendChild(el('<p class="t-xs t-dim" style="padding:10px 2px">No items yet. Add one below.</p>'));
      }
      items.forEach((name, idx) => {
        const usedBy = usage[L.type][name] || 0;
        const row = el(
          '<div class="opt-row">' +
            '<span class="opt-row__name">' + esc(name) + (usedBy ? ' <span class="t-faint t-xs">(' + usedBy + ')</span>' : '') + '</span>' +
            '<button class="icon-btn" data-up aria-label="Move up" ' + (idx === 0 ? 'disabled' : '') + '>' + icon('chev-u', 13) + '</button>' +
            '<button class="icon-btn" data-down aria-label="Move down" ' + (idx === items.length - 1 ? 'disabled' : '') + '>' + icon('chev-d', 13) + '</button>' +
            '<button class="icon-btn" data-rename aria-label="Rename">' + icon('pencil', 13) + '</button>' +
            '<button class="icon-btn" data-del aria-label="Delete">' + icon('trash', 13) + '</button>' +
          '</div>'
        );
        row.querySelector('[data-up]').addEventListener('click', () => { PC.store.moveOption(L.type, idx, -1); buildLists(); });
        row.querySelector('[data-down]').addEventListener('click', () => { PC.store.moveOption(L.type, idx, 1); buildLists(); });
        row.querySelector('[data-rename]').addEventListener('click', async () => {
          const next = await PC.ui.prompt('Rename ' + L.label.slice(0, -1), name, { placeholder: 'New name' });
          if (next && next !== name) { PC.store.renameOption(L.type, idx, next); buildLists(); toast('Renamed to ' + next, 'success'); }
        });
        row.querySelector('[data-del]').addEventListener('click', async () => {
          const ok = await PC.ui.confirm({
            title: 'Delete Option',
            text: '"' + name + '" will be removed from ' + L.label.toLowerCase() + '.' + (usedBy ? ' ' + usedBy + ' logged trades keep their saved value.' : ''),
            confirmLabel: 'Delete',
            danger: true
          });
          if (ok) { PC.store.removeOption(L.type, idx); buildLists(); toast('Option removed'); }
        });
        rows.appendChild(row);
      });

      const addInput = card.querySelector('[data-add-input]');
      addInput.addEventListener('input', () => { optionDrafts[L.type] = addInput.value; });
      const doAdd = () => {
        const res = PC.store.addOption(L.type, addInput.value);
        if (!res.ok) {
          toast(res.reason === 'duplicate' ? 'Already in the list' : 'Type a name first', 'error');
          return;
        }
        optionDrafts[L.type] = '';
        addInput.value = '';
        buildLists();
        toast('Added to ' + L.label.toLowerCase(), 'success');
      };
      card.querySelector('[data-add-btn]').addEventListener('click', doAdd);
      addInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') doAdd(); });

      card.querySelector('[data-reset]').addEventListener('click', async () => {
        const ok = await PC.ui.confirm({
          title: 'Reset ' + L.label,
          text: 'This brings the default ' + L.label.toLowerCase() + ' back. Your trades stay safe.',
          confirmLabel: 'Reset',
          danger: false
        });
        if (ok) { PC.store.resetOptions(L.type); buildLists(); toast(L.label + ' reset'); }
      });

      host.appendChild(card);
    });

    const meta = $('#optMeta', root);
    if (meta) meta.textContent = total + ' OPTIONS';
  }

  /* ---------- socials ---------- */
  function buildSocials() {
    const grid = $('#socialGrid', root);
    if (!grid) return;
    const SOCIALS = [
      { label: 'Telegram', icon: 'telegram', url: 'https://t.me/pipcore' },
      { label: 'YouTube', icon: 'youtube', url: 'https://youtube.com/@pipcore' },
      { label: 'Discord', icon: 'discord', url: 'https://discord.gg/UFqRkZGf' }
    ];
    SOCIALS.forEach((s) => {
      const b = el('<button class="social-btn">' + icon(s.icon, 18) + '<span>' + esc(s.label) + '</span></button>');
      b.addEventListener('click', () => { PC.tg.haptic('medium'); PC.tg.open(s.url); });
      grid.appendChild(b);
    });
  }

  /* ---------- data wiring ---------- */
  function wireData() {
    $('#backupBtn', root).addEventListener('click', async () => {
      const data = PC.store.backup();
      const fname = 'pipcore_backup_' + PC.store.todayKey().replace(/-/g, '') + '.json';
      const ok = await PC.ui.download(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json;charset=utf-8' }), fname);
      if (!ok) return;
      PC.tg.haptic('medium');
      toast('Backup file ready to save', 'success');
    });

    $('#restoreBtn', root).addEventListener('click', () => $('#restoreFile', root).click());
    $('#restoreFile', root).addEventListener('change', (e) => {
      const file = e.target.files && e.target.files[0];
      e.target.value = '';
      if (!file) return;
      const reader = new FileReader();
      reader.onload = async () => {
        let json = null;
        try { json = JSON.parse(reader.result); } catch (err) {}
        if (!PC.store.isValidBackup(json)) { toast('This backup file is not valid', 'error'); return; }
        const tradeCount = Array.isArray(json.trades) ? json.trades.length : 0;
        const hasSettings = !!(json.settings && typeof json.settings === 'object');
        const body = el(
          '<div>' +
            '<p class="t-sm" style="line-height:2">Found a backup with ' + tradeCount + ' trades' + (hasSettings ? ' and your app settings' : '') + '. What do you want to do?</p>' +
            '<div class="btn-row mt-4">' +
              '<button class="btn btn--ghost" data-mode="merge">' + icon('plus', 13) + 'Merge</button>' +
              '<button class="btn btn--danger" data-mode="replace" data-armed="true">' + icon('refresh', 13) + 'Replace</button>' +
            '</div>' +
            '<p class="t-xs t-faint mt-3" style="line-height:2">Merge adds what is missing. Replace overwrites your current data.</p>' +
          '</div>'
        );
        const sheet = PC.ui.openSheet(body, { title: 'Import backup', icon: 'upload' });
        body.querySelectorAll('[data-mode]').forEach((b) => b.addEventListener('click', () => {
          PC.ui.closeSheet(sheet);
          const res = PC.store.restore(json, b.dataset.mode);
          toast(res.ok ? 'Backup imported' : 'Import failed', res.ok ? 'success' : 'error');
          if (res.ok) {
            PC.app.applyTheme(PC.store.getSettings().theme, true);
            buildPrefs();
            buildLists();
            PC.bus.emit('repaint');
          }
        }));
      };
      reader.readAsText(file);
    });

    $('#resetOptsBtn', root).addEventListener('click', async () => {
      const ok = await PC.ui.confirm({
        title: 'Reset all lists',
        text: 'This resets setups, entries, timeframes, pairs and sessions. Your trades stay safe.',
        confirmLabel: 'Reset all',
        danger: true
      });
      if (ok) {
        PC.store.LIST_KEYS.forEach((k) => PC.store.resetOptions(k));
        buildLists();
        toast('Trade lists reset', 'success');
      }
    });

    $('#wipeBtn', root).addEventListener('click', async () => {
      const count = PC.store.getTrades().length;
      if (!count) { toast('Journal is already empty'); return; }
      const first = await PC.ui.confirm({
        title: 'Delete all trades',
        text: 'This will remove ' + count + ' trades from this device. Make a backup first if you may need them later.',
        confirmLabel: 'Continue',
        danger: true
      });
      if (!first) return;
      const second = await PC.ui.confirm({
        title: 'Final check',
        text: 'Last chance. This will permanently delete every trade.',
        confirmLabel: 'Delete all',
        danger: true
      });
      if (second) { PC.store.clearTrades(); toast('Journal wiped'); }
    });
  }

  function render() {
    const active = document.activeElement;
    const isEditingSettingsInput = !!(
      active && root && root.contains(active) && (
        active.matches('[data-add-input]') ||
        active.matches('input, textarea, select') ||
        active.isContentEditable
      )
    );

    if (isEditingSettingsInput) return;
    buildPrefs();
    buildLists();
  }

  return { init, render, onShow: render };
})();
