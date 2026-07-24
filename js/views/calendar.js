/* PipCore v2.0 — Calendar tab: real month grid with per-day stats inside
   each box, swipe + button navigation, month picker, day detail sheet. */
window.PC = window.PC || {};
PC.views = PC.views || {};

PC.views.calendar = (() => {
  const { $, $$, el, esc, icon, fmtPips, fmtPct, fmtDate, toast } = PC.ui;

  let root;
  let cursor;          // Date pinned to the 1st of the visible month
  let dayMap = new Map();
  let touchX = null;

  const now0 = new Date();
  cursor = new Date(now0.getFullYear(), now0.getMonth(), 1);

  function monthLabel(d) {
    return PC.stats.MONTHS[d.getMonth()].toUpperCase() + ' ' + d.getFullYear();
  }

  function init() {
    root = $('#view-calendar .view__inner');
    root.innerHTML = [
      '<div class="card cal-card">',
        '<div class="cal-head">',
          '<button class="icon-btn" id="calPrev" aria-label="Previous month">' + icon('chev-l', 16) + '</button>',
          '<button class="cal-title" id="calTitle" aria-label="Pick month"></button>',
          '<div class="flex">',
            '<button class="icon-btn" id="calToday" aria-label="Jump to today">' + icon('target', 15) + '</button>',
            '<button class="icon-btn" id="calNext" aria-label="Next month">' + icon('chev-r', 16) + '</button>',
          '</div>',
        '</div>',
        '<div class="cal-week" id="calWeek"></div>',
        '<div class="cal-grid" id="calGrid" aria-label="Month grid"></div>',
        '<div class="cal-legend">',
          '<span><i class="lg lg--pos"></i>PROFIT DAY</span>',
          '<span><i class="lg lg--neg"></i>LOSS DAY</span>',
          '<span><i class="lg lg--today"></i>TODAY</span>',
        '</div>',
      '</div>',
      '<div class="section">',
        '<div class="section__head"><h3 class="section__title">' + icon('chart', 14) + '<span id="calMonthTitle">MONTH</span></h3><span class="section__meta" id="calMonthMeta"></span></div>',
        '<div class="stat-grid" id="calMonthStats"></div>',
      '</div>',
      '<div class="section">',
        '<div class="section__head"><h3 class="section__title">' + icon('trend-up', 14) + '<span>MONTH PACE</span></h3><span class="section__meta">DAILY CUMULATIVE</span></div>',
        '<div class="card chart-wrap"><canvas id="calPace" height="150"></canvas><div class="chart-cap"><span id="calPaceStart"></span><span id="calPaceEnd"></span></div></div>',
      '</div>'
    ].join('');

    $('#calPrev', root).addEventListener('click', () => shiftMonth(-1));
    $('#calNext', root).addEventListener('click', () => shiftMonth(1));
    $('#calToday', root).addEventListener('click', () => {
      const n = new Date();
      cursor = new Date(n.getFullYear(), n.getMonth(), 1);
      PC.tg.haptic('light');
      render();
    });
    $('#calTitle', root).addEventListener('click', openPicker);

    // swipe navigation (horizontal only)
    const grid = $('#calGrid', root);
    grid.addEventListener('touchstart', (e) => { touchX = e.touches[0].clientX; }, { passive: true });
    grid.addEventListener('touchend', (e) => {
      if (touchX === null) return;
      const dx = e.changedTouches[0].clientX - touchX;
      touchX = null;
      if (Math.abs(dx) > 48) shiftMonth(dx < 0 ? 1 : -1);
    }, { passive: true });
  }

  function shiftMonth(d) {
    cursor = new Date(cursor.getFullYear(), cursor.getMonth() + d, 1);
    PC.tg.haptic('light');
    render();
  }

  /* ---------- grid ---------- */
  function render() {
    if (!root) return;
    dayMap = PC.stats.computeDayMap(PC.store.getTrades());
    const weekStart = PC.store.getSettings().weekStart;
    const firstDayMonday = weekStart !== 'sun';

    const title = $('#calTitle', root);
    title.innerHTML = monthLabel(cursor) + icon('chev-d', 11);

    const wk = $('#calWeek', root);
    const wd = firstDayMonday
      ? ['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU']
      : ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];
    wk.innerHTML = wd.map((d) => '<span>' + d + '</span>').join('');

    const grid = $('#calGrid', root);
    grid.innerHTML = '';

    const y = cursor.getFullYear(), m = cursor.getMonth();
    const dim = new Date(y, m + 1, 0).getDate();
    const lead = firstDayMonday
      ? (new Date(y, m, 1).getDay() + 6) % 7   // Monday-aligned
      : new Date(y, m, 1).getDay();            // Sunday-aligned
    const totalCells = Math.ceil((lead + dim) / 7) * 7;
    const prevDim = new Date(y, m, 0).getDate();
    const todayKey = PC.store.todayKey();

    for (let i = 0; i < totalCells; i++) {
      const cellIndex = i - lead + 1;
      let dayNum, key, muted = false;
      if (cellIndex < 1) {
        dayNum = prevDim + cellIndex;
        const d = new Date(y, m - 1, dayNum);
        key = PC.store.todayKey(d);
        muted = true;
      } else if (cellIndex > dim) {
        dayNum = cellIndex - dim;
        const d = new Date(y, m + 1, dayNum);
        key = PC.store.todayKey(d);
        muted = true;
      } else {
        dayNum = cellIndex;
        key = y + '-' + String(m + 1).padStart(2, '0') + '-' + String(dayNum).padStart(2, '0');
      }

      const info = dayMap.get(key);
      const btn = el('<button type="button" class="cal-day"><span class="cal-day__num">' + dayNum + '</span></button>');

      if (info && info.count > 0) {
        const net = info.net;
        const wr = (info.wins + info.losses) ? Math.round((info.wins / (info.wins + info.losses)) * 100) : null;
        btn.classList.add('cal-day--has');
        btn.classList.add(net > 0 ? 'cal-day--pos' : net < 0 ? 'cal-day--neg' : 'cal-day--flat');
        btn.innerHTML =
          '<span class="cal-day__bar"></span>' +
          '<span class="cal-day__num' + (key === todayKey ? '' : '') + '">' + dayNum + '</span>' +
          '<span class="cal-day__net">' + fmtPips(net, true) + '</span>' +
          '<span class="cal-day__meta">' + info.count + 'T' + (wr !== null ? ' ' + wr + '%' : '') + '</span>';
        btn.setAttribute('aria-label',
          fmtDate(key, 'long') + ': ' + info.count + ' trades, net ' + fmtPips(net, true) + ' pips');
      } else {
        btn.classList.add('cal-day--empty');
      }
      if (muted) btn.classList.add('cal-day--muted');
      if (key === todayKey) btn.classList.add('cal-day--today');
      btn.dataset.day = key;
      btn.addEventListener('click', () => openDay(key));
      grid.appendChild(btn);
    }

    renderMonthStats();
  }

  /* ---------- month summary ---------- */
  function renderMonthStats() {
    const y = cursor.getFullYear(), m = cursor.getMonth();
    const trades = PC.store.getTrades().filter((t) => {
      const d = PC.stats.toDate(t.date);
      return d && d.getFullYear() === y && d.getMonth() === m;
    });
    const s = PC.stats.compute(trades);

    $('#calMonthTitle', root).textContent = monthLabel(cursor);
    $('#calMonthMeta', root).textContent = s.count ? s.count + ' TRADES' : 'NO TRADES';

    const host = $('#calMonthStats', root);
    host.innerHTML = '';
    if (!s.count) {
      const empty = PC.ui.emptyState('calendar', 'Quiet Month', 'No trades recorded in ' + monthLabel(cursor) + '. Swipe to another month or log one in the Journal.', '');
      empty.style.gridColumn = '1 / -1';
      empty.style.padding = '20px 8px';
      host.appendChild(empty);
      const pace = $('#calPace', root);
      if (pace) PC.charts.equity(pace, []);
      $('#calPaceStart', root).textContent = '';
      $('#calPaceEnd', root).textContent = '';
      return;
    }
    host.innerHTML = [
      tile('Net Pips', fmtPips(s.netPips, true), s.netPips > 0 ? 't-pos' : s.netPips < 0 ? 't-neg' : ''),
      tile('Win Rate', fmtPct(s.winRate, 0), ''),
      tile('Trades', s.count, ''),
      tile('Green Days', s.greenDays + '/' + s.dayCount, ''),
      tile('Best Day', s.bestDay ? fmtPips(s.bestDay.net, true) : '—', 't-pos', s.bestDay ? fmtDate(s.bestDay.key, 'tiny') : ''),
      tile('Worst Day', s.worstDay ? fmtPips(s.worstDay.net, true) : '—', 't-neg', s.worstDay ? fmtDate(s.worstDay.key, 'tiny') : '')
    ].join('');

    // month pace: equity is already cumulative within this subset
    const pacePts = s.equity;
    const pace = $('#calPace', root);
    if (pace) PC.charts.equity(pace, pacePts);
    $('#calPaceStart', root).textContent = pacePts.length ? fmtDate(pacePts[0].x, 'tiny') : '';
    $('#calPaceEnd', root).textContent = pacePts.length ? fmtDate(pacePts[pacePts.length - 1].x, 'tiny') : '';
  }

  function tile(label, value, cls, sub) {
    return '<div class="stat"><span class="stat__label">' + label.toUpperCase() + '</span>' +
      '<span class="stat__value ' + (cls || '') + '">' + esc(String(value)) + '</span>' +
      (sub ? '<span class="stat__sub">' + esc(sub) + '</span>' : '') + '</div>';
  }

  /* ---------- day sheet ---------- */
  function openDay(key) {
    $$('.cal-day--picked', root).forEach((c) => c.classList.remove('cal-day--picked'));
    const cell = root.querySelector('.cal-day[data-day="' + key + '"]');
    if (cell) cell.classList.add('cal-day--picked');

    const trades = PC.store.getTrades()
      .filter((t) => t.date === key)
      .sort((a, b) => (a.time < b.time ? -1 : 1));

    const info = dayMap.get(key);

    let body;
    if (!trades.length) {
      body = PC.ui.emptyState('calendar', 'No Trades', 'Nothing logged on ' + fmtDate(key, 'long') + '.',
        '<button class="btn btn--sm mt-2" data-add>' + icon('plus', 13) + 'Log A Trade</button>');
    } else {
      const wr = (info.wins + info.losses) ? (info.wins / (info.wins + info.losses)) * 100 : null;
      const rowsHtml = trades.map((t) => {
        const signed = PC.store.signedPips(t);
        return (
          '<div class="trade-row" style="cursor:default">' +
            '<span class="trade-row__dir ' + (t.buySell === 'Buy' ? 'trade-row__dir--buy' : '') + '">' + icon(t.buySell === 'Buy' ? 'arrow-long-up' : 'arrow-long-down', 14) + '</span>' +
            '<span class="trade-row__main">' +
              '<span class="trade-row__pair">' + esc(t.pair) + '</span>' +
              '<span class="trade-row__sub">' + esc(t.time) + ' · ' + esc(t.session) + ' · ' + esc(t.setup) + '</span>' +
            '</span>' +
            '<span class="trade-row__end">' +
              '<span class="trade-row__pips ' + (signed > 0 ? 't-pos' : signed < 0 ? 't-neg' : '') + '">' + fmtPips(signed, true) + '</span>' +
              '<span class="trade-row__when">' + esc(t.outcome.toUpperCase()) + '</span>' +
            '</span>' +
          '</div>'
        );
      }).join('');

      body = el(
        '<div>' +
          '<div class="stat-grid stat-grid--3">' +
            tile('Trades', info.count, '', '') +
            tile('Net Pips', fmtPips(info.net, true), info.net > 0 ? 't-pos' : info.net < 0 ? 't-neg' : '', '') +
            tile('Win Rate', wr === null ? '—' : fmtPct(wr, 0), '', '') +
            tile('Wins', info.wins, '', '') +
            tile('Losses', info.losses, '', '') +
            tile('BE', info.bes, '', '') +
          '</div>' +
          '<hr class="divider">' +
          '<div>' + rowsHtml + '</div>' +
          '<div class="btn-row mt-4">' +
            '<button class="btn btn--sm" data-add>' + icon('plus', 13) + 'Add On This Day</button>' +
            '<button class="btn btn--ghost btn--sm" data-journal>' + icon('book', 13) + 'Open Journal</button>' +
          '</div>' +
        '</div>'
      );
    }

    const sheet = PC.ui.openSheet(body, { title: fmtDate(key, 'long'), icon: 'calendar' });
    if (!body.querySelector) return;
    const addBtn = body.querySelector('[data-add]');
    const jBtn = body.querySelector('[data-journal]');
    if (addBtn) addBtn.addEventListener('click', () => { PC.ui.closeSheet(sheet); setTimeout(() => PC.app.go('journal', { prefill: key }), 280); });
    if (jBtn) jBtn.addEventListener('click', () => { PC.ui.closeSheet(sheet); setTimeout(() => PC.app.go('journal'), 280); });
  }

  /* ---------- month picker ---------- */
  function openPicker() {
    const y = cursor.getFullYear();
    let tempYear = y;
    const wrap = el('<div class="form-stack"><div class="flex--between"><button class="icon-btn" data-y="-1">' + icon('chev-l', 16) + '</button><span class="h-2" data-ylabel>' + y + '</span><button class="icon-btn" data-y="1">' + icon('chev-r', 16) + '</button></div><div class="month-pick" data-mgrid></div></div>');
    const sheet = PC.ui.openSheet(wrap, { title: 'Jump To Month', icon: 'calendar' });
    const grid = wrap.querySelector('[data-mgrid]');
    const ylab = wrap.querySelector('[data-ylabel]');

    function paint() {
      ylab.textContent = tempYear;
      grid.innerHTML = '';
      PC.stats.MONTHS.forEach((mn, idx) => {
        const b = el('<button class="chip" style="justify-content:center;padding:12px 6px" aria-selected="' + (tempYear === cursor.getFullYear() && idx === cursor.getMonth()) + '">' + mn.toUpperCase() + '</button>');
        b.addEventListener('click', () => {
          cursor = new Date(tempYear, idx, 1);
          PC.ui.closeSheet(sheet);
          render();
        });
        grid.appendChild(b);
      });
    }
    paint();
    wrap.querySelectorAll('[data-y]').forEach((b) => b.addEventListener('click', () => { tempYear += Number(b.dataset.y); paint(); }));
  }

  return { init, render, onShow: render };
})();
