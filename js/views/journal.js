/* PipCore v2.0 — Journal tab: fast trade logging, history, filters, export. */
window.PC = window.PC || {};
PC.views = PC.views || {};

PC.views.journal = (() => {
  const { $, $$, el, esc, icon, fmtPips, fmtDate, toast } = PC.ui;

  const FILTERS = [
    { value: 'all', label: 'All' },
    { value: 'today', label: 'Today' },
    { value: 'week', label: '7D' },
    { value: 'month', label: '30D' },
    { value: 'custom', label: 'Pick Day' }
  ];

  let root;
  let form;             // form controller for quick-add
  let historyFilter = 'all';
  let customDate = '';
  let searchText = '';
  let prefillDate = null;
  let formOptionSignature = '';

  /* ---------------------------------------------------------
     Trade form builder — shared by quick-add and edit sheet
  --------------------------------------------------------- */
  function buildForm(hostEl, trade, opts = {}) {
    const S = PC.store;
    const seed = trade || null;
    const isEdit = !!opts.isEdit;
    const now = new Date();
    const defDate = seed ? seed.date : (prefillDate || S.todayKey());
    const defTime = seed ? seed.time : String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0');

    function optionsHtml(list, sel) {
      return S.getList(list).map((v) =>
        '<option value="' + esc(v) + '"' + (v === sel ? ' selected' : '') + '>' + esc(v) + '</option>'
      ).join('');
    }

    hostEl.innerHTML = [
      '<div class="form-stack" id="fRoot">',
        '<div class="grid-2">',
          '<div class="field"><label>Date</label><input type="date" class="input" id="fDate" value="' + esc(defDate) + '"></div>',
          '<div class="field"><label>Time</label><input type="time" class="input" id="fTime" value="' + esc(defTime) + '"></div>',
        '</div>',
        '<div class="grid-2">',
          '<div class="field"><label>Session</label><div class="select-wrap"><select class="select" id="fSession">' + optionsHtml('sessions', seed ? seed.session : '') + '</select></div></div>',
          '<div class="field"><label>Pair</label><div class="select-wrap"><select class="select" id="fPair">' + optionsHtml('pairs', seed ? seed.pair : '') + '</select></div></div>',
        '</div>',
        '<div class="grid-2">',
          '<div class="field"><label>Setup</label><div class="select-wrap"><select class="select" id="fSetup">' + optionsHtml('setups', seed ? seed.setup : '') + '</select></div></div>',
          '<div class="field"><label>Entry</label><div class="select-wrap"><select class="select" id="fEntry">' + optionsHtml('entries', seed ? seed.entry : '') + '</select></div></div>',
        '</div>',
        '<div class="field"><label>Timeframe</label><div class="select-wrap"><select class="select" id="fTimeframe">' + optionsHtml('timeframes', seed ? seed.timeframe : '') + '</select></div></div>',
        '<div class="field"><label>Direction</label><div id="fDir"></div></div>',
        '<div class="field"><label>Pips</label>',
          '<div class="stepper">',
            '<button type="button" class="icon-btn" id="fMinus" aria-label="Decrease">' + icon('minus', 14) + '</button>',
            '<input type="text" class="input" id="fPips" inputmode="decimal" autocomplete="off" spellcheck="false" enterkeyhint="done" value="' + esc(seed ? String(seed.pips) : '0') + '">',
            '<button type="button" class="icon-btn" id="fPlus" aria-label="Increase">' + icon('plus', 14) + '</button>',
          '</div>',
        '</div>',
        '<div class="field"><label>Outcome</label><div id="fOutcome"></div></div>',
        '<button class="btn btn--block" id="fSubmit">' + icon('check', 15) + (isEdit ? 'Save Changes' : 'Log Trade') + '</button>',
      '</div>'
    ].join('');

    const state = {
      buySell: seed ? seed.buySell : 'Buy',
      outcome: seed ? seed.outcome : 'Win'
    };

    $('#fDir', hostEl).appendChild(PC.ui.segment(
      [{ value: 'Buy', label: 'BUY' }, { value: 'Sell', label: 'SELL' }],
      state.buySell, (v) => { state.buySell = v; }, true
    ));
    $('#fOutcome', hostEl).appendChild(PC.ui.segment(
      [{ value: 'Win', label: 'WIN' }, { value: 'Lose', label: 'LOSS' }, { value: 'Breakeven', label: 'BE' }],
      state.outcome, (v) => { state.outcome = v; }, true
    ));

    const pips = $('#fPips', hostEl);
    const normalizePipsText = (raw, { forBlur = false } = {}) => {
      let txt = String(raw == null ? '' : raw).replace(/,/g, '.').replace(/[^0-9.]/g, '');
      const dot = txt.indexOf('.');
      if (dot !== -1) txt = txt.slice(0, dot + 1) + txt.slice(dot + 1).replace(/\./g, '');
      if (txt.startsWith('.')) txt = '0' + txt;
      if (!forBlur && txt === '0') return txt;
      if (!forBlur && /\.$/.test(txt)) return txt;
      const v = parseFloat(txt);
      if (!Number.isFinite(v)) return forBlur ? '0' : txt;
      return String(Math.round(Math.max(0, v) * 100) / 100);
    };
    const step = (d) => {
      let v = parseFloat(normalizePipsText(pips.value, { forBlur: true }));
      if (!Number.isFinite(v)) v = 0;
      v = Math.max(0, Math.round((v + d) * 10) / 10);
      pips.value = String(v);
      PC.tg.haptic('light');
    };
    $('#fMinus', hostEl).addEventListener('click', () => step(-1));
    $('#fPlus', hostEl).addEventListener('click', () => step(1));

    pips.addEventListener('focus', () => { if (pips.value === '0') pips.value = ''; });
    pips.addEventListener('input', () => {
      const next = normalizePipsText(pips.value);
      if (next !== pips.value) pips.value = next;
    });
    pips.addEventListener('blur', () => {
      pips.value = normalizePipsText(pips.value, { forBlur: true });
    });
    pips.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); pips.blur(); } });

    return {
      fill(t) { /* used by edit flows if needed */ },
      read() {
        return {
          date: $('#fDate', hostEl).value || PC.store.todayKey(),
          time: $('#fTime', hostEl).value || '00:00',
          session: $('#fSession', hostEl).value,
          pair: $('#fPair', hostEl).value,
          setup: $('#fSetup', hostEl).value,
          entry: $('#fEntry', hostEl).value,
          timeframe: $('#fTimeframe', hostEl).value,
          buySell: state.buySell,
          pips: Math.max(0, parseFloat(pips.value) || 0),
          outcome: state.outcome
        };
      },
      onSubmit(cb) {
        $('#fSubmit', hostEl).addEventListener('click', (e) => {
          e.preventDefault();
          cb(this.read());
        });
      },
      resetSoft() {
        pips.value = '0';
        state.outcome = 'Win';
        $$('#fOutcome .seg__opt', hostEl).forEach((b, i) => b.setAttribute('aria-selected', i === 0 ? 'true' : 'false'));
        const now2 = new Date();
        $('#fTime', hostEl).value = String(now2.getHours()).padStart(2, '0') + ':' + String(now2.getMinutes()).padStart(2, '0');
        if (!prefillDate) $('#fDate', hostEl).value = PC.store.todayKey();
      },
      refreshOptions() { /* full rebuild keeps it simple */ }
    };
  }

  function getFormOptionSignature() {
    const S = PC.store;
    return JSON.stringify({
      sessions: S.getList('sessions'),
      pairs: S.getList('pairs'),
      setups: S.getList('setups'),
      entries: S.getList('entries'),
      timeframes: S.getList('timeframes')
    });
  }

  function wireQuickAddForm(seed) {
    formOptionSignature = getFormOptionSignature();
    form = buildForm($('#formHost', root), seed || null, { isEdit: false });
    form.onSubmit((vals) => {
      if (!Number.isFinite(vals.pips) || vals.pips < 0) { toast('Pips must be zero or more', 'error'); return; }
      PC.store.addTrade(vals);
      form.resetSoft();
      prefillDate = null;
      toast('Trade logged · ' + fmtPips(PC.store.signedPips(vals), true), 'success');
    });
  }

  /* ---------------------------------------------------------
     History helpers
  --------------------------------------------------------- */
  function filteredTrades() {
    const list = PC.store.getTrades().slice();
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const matchSearch = (t) => {
      if (!searchText) return true;
      const q = searchText.toLowerCase();
      return [t.pair, t.setup, t.entry, t.session, t.timeframe, t.outcome].some((f) => (f || '').toLowerCase().includes(q));
    };
    const matchDate = (t) => {
      const d = PC.stats.toDate(t.date, t.time);
      if (historyFilter === 'all') return true;
      if (historyFilter === 'today') return t.date === PC.store.todayKey();
      if (historyFilter === 'week') return d >= new Date(startOfToday.getTime() - 6 * 864e5);
      if (historyFilter === 'month') return d >= new Date(startOfToday.getTime() - 29 * 864e5);
      if (historyFilter === 'custom' && customDate) return t.date === customDate;
      return true;
    };
    return list.filter((t) => matchSearch(t) && matchDate(t))
      .sort((a, b) => {
        const da = PC.stats.toDate(a.date, a.time) || 0;
        const db = PC.stats.toDate(b.date, b.time) || 0;
        return db - da;
      });
  }

  function pillClass(outcome) {
    return outcome === 'Win' ? 'pill--pos' : outcome === 'Lose' ? 'pill--neg' : '';
  }

  function renderHistory() {
    const host = $('#historyList');
    if (!host) return;
    const trades = filteredTrades();
    const net = trades.reduce((a, t) => a + PC.store.signedPips(t), 0);
    $('#historyMeta').textContent = trades.length + ' TRADES · ' + fmtPips(net, true) + ' PIPS';

    if (!trades.length) {
      host.innerHTML = '';
      host.appendChild(PC.ui.emptyState('book', 'Nothing Here', PC.store.getTrades().length ? 'No trades match these filters.' : 'Log your first trade above — it takes five seconds.'));
      return;
    }

    host.innerHTML = '';
    trades.forEach((t) => {
      const signed = PC.store.signedPips(t);
      const row = el(
        '<button class="trade-row" type="button">' +
          '<span class="trade-row__dir ' + (t.buySell === 'Buy' ? 'trade-row__dir--buy' : '') + '">' + icon(t.buySell === 'Buy' ? 'arrow-long-up' : 'arrow-long-down', 15) + '</span>' +
          '<span class="trade-row__main">' +
            '<span class="trade-row__pair">' + esc(t.pair) + ' <span class="pill ' + pillClass(t.outcome) + '" style="margin-left:2px">' + esc(t.outcome.toUpperCase()) + '</span></span>' +
            '<span class="trade-row__sub">' + esc(t.setup) + (t.entry ? ' · ' + esc(t.entry) : '') + ' · ' + esc(t.timeframe) + ' · ' + esc(t.session) + '</span>' +
          '</span>' +
          '<span class="trade-row__end">' +
            '<span class="trade-row__pips ' + (signed > 0 ? 't-pos' : signed < 0 ? 't-neg' : '') + '">' + fmtPips(signed, true) + '</span>' +
            '<span class="trade-row__when">' + esc(fmtDate(t.date, 'tiny')) + ' ' + esc(t.time) + '</span>' +
          '</span>' +
        '</button>'
      );
      row.addEventListener('click', () => openTradeSheet(t.id));
      host.appendChild(row);
    });
  }

  /* ---------------------------------------------------------
     Trade detail sheet (view / edit / duplicate / delete / share)
  --------------------------------------------------------- */
  function openTradeSheet(id) {
    const t = PC.store.getTrades().find((x) => x.id === id);
    if (!t) return;
    const signed = PC.store.signedPips(t);

    const body = el(
      '<div>' +
        '<div class="flex--between">' +
          '<div>' +
            '<div class="h-1 ' + (signed > 0 ? 't-pos' : signed < 0 ? 't-neg' : '') + '">' + fmtPips(signed, true) + ' PIPS</div>' +
            '<div class="t-xs t-dim" style="margin-top:6px">' + esc(fmtDate(t.date, 'long')) + ' · ' + esc(t.time) + '</div>' +
          '</div>' +
          '<span class="pill ' + pillClass(t.outcome) + '">' + esc(t.outcome.toUpperCase()) + '</span>' +
        '</div>' +
        '<hr class="divider">' +
        '<div>' +
          kv('Pair', t.pair) + kv('Direction', t.buySell) + kv('Session', t.session) +
          kv('Setup', t.setup) + kv('Entry', t.entry) + kv('Timeframe', t.timeframe) +
          kv('Logged Pips', fmtPips(Math.abs(t.pips))) +
        '</div>' +
        '<div class="btn-row mt-4">' +
          '<button class="btn btn--sm" data-act="edit">' + icon('pencil', 13) + 'Edit</button>' +
          '<button class="btn btn--sm btn--ghost" data-act="dup">' + icon('copy', 13) + 'Copy</button>' +
        '</div>' +
        '<div class="btn-row mt-2">' +
          '<button class="btn btn--sm btn--ghost" data-act="share">' + icon('send', 13) + 'Share</button>' +
          '<button class="btn btn--sm btn--danger" data-act="del">' + icon('trash', 13) + 'Delete</button>' +
        '</div>' +
      '</div>'
    );

    const sheet = PC.ui.openSheet(body, { title: t.pair || 'Trade', icon: 'eye' });

    body.querySelector('[data-act="edit"]').addEventListener('click', () => {
      PC.ui.closeSheet(sheet);
      setTimeout(() => openEditSheet(id), 320);
    });
    body.querySelector('[data-act="dup"]').addEventListener('click', () => {
      PC.store.duplicateTrade(id);
      PC.ui.closeSheet(sheet);
      toast('Trade duplicated', 'success');
    });
    body.querySelector('[data-act="del"]').addEventListener('click', async () => {
      PC.ui.closeSheet(sheet);
      const ok = await PC.ui.confirm({
        title: 'Delete Trade',
        text: 'This trade will be permanently removed from your journal. This action cannot be undone.',
        confirmLabel: 'Delete',
        danger: true
      });
      if (ok) { PC.store.deleteTrade(id); toast('Trade deleted'); }
    });
    body.querySelector('[data-act="share"]').addEventListener('click', () => {
      const text = [
        'PIPCORE TRADE',
        fmtDate(t.date, 'long') + ' ' + t.time,
        t.pair + ' · ' + t.buySell.toUpperCase() + ' · ' + t.session,
        'Setup: ' + t.setup + (t.entry ? ' / ' + t.entry : '') + ' · ' + t.timeframe,
        'Result: ' + t.outcome.toUpperCase() + ' ' + fmtPips(signed, true) + ' pips'
      ].join('\n');
      if (navigator.share) {
        navigator.share({ title: 'PipCore Trade', text }).catch(() => {});
      } else {
        PC.tg.copyText(text).then((ok) => toast(ok ? 'Trade copied — paste anywhere' : 'Share not available', ok ? 'success' : 'error'));
      }
    });
  }

  function kv(k, v) {
    return '<div class="kv"><span>' + esc(k) + '</span><span>' + esc(v || '—') + '</span></div>';
  }

  function openEditSheet(id) {
    const t = PC.store.getTrades().find((x) => x.id === id);
    if (!t) return;
    const wrap = el('<div></div>');
    const f = buildForm(wrap, t, { isEdit: true });
    const sheet = PC.ui.openSheet(wrap, { title: 'Edit Trade', icon: 'pencil' });
    f.onSubmit((vals) => {
      PC.store.updateTrade(id, vals);
      PC.ui.closeSheet(sheet);
      toast('Trade updated', 'success');
    });
  }

  /* ---------------------------------------------------------
     Export
  --------------------------------------------------------- */
  async function exportTrades() {
    const trades = filteredTrades();
    if (!trades.length) { toast('No trades to export', 'error'); return; }
    const fmt = $('#exportFormat').value;
    const stamp = PC.store.todayKey().replace(/-/g, '');
    const headers = ['Date', 'Time', 'Pair', 'Direction', 'Session', 'Setup', 'Entry', 'Timeframe', 'Pips', 'Pips(Signed)', 'Outcome'];
    const rows = trades.map((t) => [t.date, t.time, t.pair, t.buySell, t.session, t.setup, t.entry, t.timeframe, String(t.pips), String(PC.store.signedPips(t)), t.outcome]);
    let ok = false;

    if (fmt === 'csv') {
      const line = (arr) => arr.map((c) => '"' + String(c).replace(/"/g, '""') + '"').join(',');
      const csv = [line(headers)].concat(rows.map(line)).join('\n');
      ok = await PC.ui.download(new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' }), 'pipcore_trades_' + stamp + '.csv');
    } else if (fmt === 'json') {
      ok = await PC.ui.download(new Blob([JSON.stringify({ app: 'PipCore', exportedAt: new Date().toISOString(), trades }, null, 2)], { type: 'application/json;charset=utf-8' }), 'pipcore_trades_' + stamp + '.json');
    } else if (fmt === 'pdf' && window.jspdf && window.jspdf.jsPDF) {
      try {
        const doc = new window.jspdf.jsPDF({ unit: 'pt', format: 'a4' });
        let y = 46;
        doc.setFontSize(14);
        doc.text('PipCore - Trade Export (' + trades.length + ' trades)', 40, y);
        doc.setFontSize(9);
        y += 24;
        rows.forEach((r) => {
          const lineTxt = r[0] + ' ' + r[1] + ' | ' + r[2] + ' ' + r[3] + ' | ' + r[10] + ' ' + r[9] + 'p | ' + r[5] + ' | ' + r[4] + ' | ' + r[7];
          if (y > 800) { doc.addPage(); y = 46; }
          doc.text(lineTxt, 40, y);
          y += 15;
        });
        ok = await PC.ui.download(doc.output('blob'), 'pipcore_trades_' + stamp + '.pdf');
      } catch (e) { toast('PDF failed — try CSV', 'error'); return; }
    } else {
      const txt = rows.map((r) => headers.map((h, i) => h + ': ' + r[i]).join('\n')).join('\n\n-----\n\n');
      ok = await PC.ui.download(new Blob([txt], { type: 'text/plain;charset=utf-8' }), 'pipcore_trades_' + stamp + '.txt');
    }
    if (ok) toast('File exported', 'success');
  }

  /* ---------------------------------------------------------
     Init
  --------------------------------------------------------- */
  function init() {
    root = $('#view-journal .view__inner');
    root.innerHTML = [
      '<div class="section" style="margin-top:0">',
        '<div class="section__head"><h3 class="section__title">' + icon('plus', 14) + '<span>LOG A TRADE</span></h3></div>',
        '<div class="card card--pad-lg" id="formHost"></div>',
      '</div>',

      '<div class="section">',
        '<div class="section__head">',
          '<h3 class="section__title">' + icon('book', 14) + '<span>HISTORY</span></h3>',
          '<span class="section__meta" id="historyMeta"></span>',
        '</div>',
        '<div class="card">',
          '<div class="field" style="position:relative">',
            '<div style="position:absolute;left:14px;top:50%;transform:translateY(-50%);color:var(--fg-faint)">' + icon('search', 14) + '</div>',
            '<input class="input" id="historySearch" type="search" placeholder="SEARCH PAIR, SETUP, SESSION..." style="padding-left:38px">',
          '</div>',
          '<div class="chip-row mt-3" id="filterChips"></div>',
          '<div class="grid-2 mt-2 hidden" id="customWrap">',
            '<div class="field"><label>Pick A Day</label><input type="date" class="input" id="customDate"></div>',
          '</div>',
          '<hr class="divider">',
          '<div class="flex--between flex--wrap" style="gap:10px">',
            '<div class="select-wrap" style="flex:1;min-width:130px"><select class="select" id="exportFormat">',
              '<option value="csv">CSV</option><option value="txt">TEXT</option><option value="json">JSON</option><option value="pdf">PDF</option>',
            '</select></div>',
            '<button class="btn btn--ghost btn--sm" id="exportBtn" style="min-width:130px">' + icon('download', 13) + 'Export</button>',
          '</div>',
        '</div>',
        '<div class="card mt-3"><div id="historyList"></div></div>',
      '</div>'
    ].join('');

    wireQuickAddForm();

    // filter chips
    const chips = $('#filterChips', root);
    FILTERS.forEach((f) => {
      const c = el('<button class="chip" aria-selected="' + (f.value === historyFilter) + '">' + esc(f.label) + '</button>');
      c.addEventListener('click', () => {
        historyFilter = f.value;
        $$('#filterChips .chip', root).forEach((x) => x.setAttribute('aria-selected', 'false'));
        c.setAttribute('aria-selected', 'true');
        $('#customWrap', root).classList.toggle('hidden', f.value !== 'custom');
        PC.tg.haptic('select');
        renderHistory();
      });
      chips.appendChild(c);
    });

    $('#customDate', root).addEventListener('change', (e) => { customDate = e.target.value; renderHistory(); });

    let searchTimer = null;
    $('#historySearch', root).addEventListener('input', (e) => {
      clearTimeout(searchTimer);
      searchTimer = setTimeout(() => {
        searchText = e.target.value.trim();
        renderHistory();
      }, 160);
    });

    $('#exportBtn', root).addEventListener('click', exportTrades);
  }

  function render() {
    const nextSig = getFormOptionSignature();
    const active = document.activeElement;
    const isEditingForm = !!(active && root && root.contains(active) && /^f(Date|Time|Session|Pair|Setup|Entry|Timeframe|Pips)$/.test(active.id));

    if (!form || !$('#fRoot', root)) {
      wireQuickAddForm();
    } else if (nextSig !== formOptionSignature && !isEditingForm) {
      const currentVals = form.read();
      wireQuickAddForm(currentVals);
    }

    renderHistory();
  }

  function onShow(prefill) {
    if (prefill && /^\d{4}-\d{2}-\d{2}$/.test(prefill)) {
      prefillDate = prefill;
      const d = $('#fDate');
      if (d) d.value = prefill;
      prefillDate = null;
      const fh = $('#formHost');
      if (fh) fh.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  return { init, render, onShow };
})();
