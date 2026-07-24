/* PipCore v2.0 — Stats tab: professional analytics dashboard. */
window.PC = window.PC || {};
PC.views = PC.views || {};

PC.views.stats = (() => {
  const { $, $$, el, esc, icon, fmtPips, fmtPct, fmtRatio, fmtDate } = PC.ui;

  const PERIODS = [
    { value: 'all', label: 'All Time' },
    { value: 'month', label: 'This Month' },
    { value: 'lastMonth', label: 'Last Month' },
    { value: '30d', label: 'Last 30D' },
    { value: '7d', label: 'Last 7D' }
  ];
  const BREAKTABS = [
    { value: 'session', label: 'Session' },
    { value: 'pair', label: 'Pair' },
    { value: 'setup', label: 'Setup' },
    { value: 'entry', label: 'Entry' },
    { value: 'timeframe', label: 'Timeframe' },
    { value: 'direction', label: 'Side' },
    { value: 'weekday', label: 'Weekday' },
    { value: 'monthly', label: 'Monthly' }
  ];

  let period = 'all';
  let breakTab = 'session';
  let root;

  function init() {
    root = $('#view-stats .view__inner');
    root.innerHTML = [
      '<div class="section" style="margin-top:0">',
        '<div class="section__head"><h3 class="section__title">' + icon('filter', 14) + '<span>PERIOD</span></h3></div>',
        '<div id="periodSeg"></div>',
      '</div>',
      '<div id="statsHost"></div>'
    ].join('');

    $('#periodSeg', root).appendChild(PC.ui.segment(PERIODS, period, (v) => { period = v; render(); }, false));
  }

  function ring(pct) {
    const r = 30, c = 2 * Math.PI * r;
    const p = pct === null || !Number.isFinite(pct) ? 0 : Math.max(0, Math.min(100, pct));
    return (
      '<div class="ring">' +
        '<svg width="76" height="76" viewBox="0 0 76 76">' +
          '<circle class="ring__track" cx="38" cy="38" r="' + r + '" fill="none" stroke-width="6"/>' +
          '<circle class="ring__val" cx="38" cy="38" r="' + r + '" fill="none" stroke-width="6" stroke-dasharray="' + c.toFixed(1) + '" stroke-dashoffset="' + (c * (1 - p / 100)).toFixed(1) + '"/>' +
        '</svg>' +
        '<div class="ring__center"><span class="ring__num">' + (Number.isFinite(pct) ? fmtPct(pct, 0) : '—') + '</span><span class="ring__cap">WIN RATE</span></div>' +
      '</div>'
    );
  }

  function statTile(label, value, opts) {
    opts = opts || {};
    return (
      '<div class="stat">' +
        '<span class="stat__label">' + (opts.icon ? icon(opts.icon, 11) : '') + esc(label) + '</span>' +
        '<span class="stat__value ' + (opts.cls || '') + '">' + esc(value) + '</span>' +
        (opts.sub ? '<span class="stat__sub">' + esc(opts.sub) + '</span>' : '') +
      '</div>'
    );
  }

  function streakText(s) {
    if (!s.type || !s.n) return '—';
    return s.n + (s.type === 'Win' ? ' W' : ' L');
  }

  function render() {
    const host = $('#statsHost', root);
    if (!host) return;
    // honor the selected period by filtering on parsed dates, recompute cleanly
    const enriched = PC.store.getTrades().map((t) => Object.assign({ _dt: PC.stats.toDate(t.date, t.time) }, t));
    const inPeriod = PC.stats.filterPeriod(enriched, period).map((t) => {
      const copy = Object.assign({}, t);
      delete copy._dt;
      return copy;
    });
    const s = PC.stats.compute(inPeriod);

    if (!s.count) {
      host.innerHTML = '';
      host.appendChild(PC.ui.emptyState(
        'chart',
        'No Data Yet',
        'Log your first trade in the Journal tab and this dashboard turns into your full performance cockpit.',
        '<button class="btn btn--sm mt-2" data-goto-journal>' + icon('plus', 13) + 'Log First Trade</button>'
      ));
      const b = host.querySelector('[data-goto-journal]');
      if (b) b.addEventListener('click', () => PC.app.go('journal'));
      return;
    }

    const signCls = (v) => (v > 0 ? 't-pos' : v < 0 ? 't-neg' : '');

    host.innerHTML = [
      // --- hero ---
      '<div class="card card--pad-lg">',
        '<div class="flex" style="gap:18px">',
          ring(s.winRate),
          '<div style="flex:1;min-width:0">',
            '<div class="t-label">NET PERFORMANCE</div>',
            '<div class="h-hero ' + signCls(s.netPips) + '" style="margin-top:6px">' + fmtPips(s.netPips, true) + '</div>',
            '<div class="t-xs t-dim" style="margin-top:6px">PIPS · ' + s.count + ' TRADES · ' + s.dayCount + ' DAYS</div>',
          '</div>',
        '</div>',
        '<hr class="divider">',
        '<div class="stat-grid stat-grid--3">',
          statTile('Wins', s.wins, { icon: 'check' }),
          statTile('Losses', s.losses, { icon: 'x' }),
          statTile('Break Even', s.bes, { icon: 'minus' }),
        '</div>',
      '</div>',

      // --- core performance ---
      '<div class="section">',
        '<div class="section__head"><h3 class="section__title">' + icon('chart', 14) + '<span>PERFORMANCE</span></h3></div>',
        '<div class="stat-grid">',
          statTile('Profit Factor', fmtRatio(s.profitFactor), { icon: 'layers', sub: 'GROSS WIN / GROSS LOSS' }),
          statTile('Expectancy', fmtPips(s.expectancy, true), { icon: 'target', cls: signCls(s.expectancy), sub: 'AVG PIPS / TRADE' }),
          statTile('Avg Win', s.avgWin === null ? '—' : fmtPips(s.avgWin, true), { icon: 'arrow-long-up' }),
          statTile('Avg Loss', s.avgLoss === null ? '—' : '-' + fmtPips(s.avgLoss), { icon: 'arrow-long-down' }),
          statTile('Payoff Ratio', s.payoff === null ? '—' : s.payoff.toFixed(2) + ' R', { icon: 'activity', sub: 'REWARD : RISK' }),
          statTile('Clean Win Rate', s.cleanWinRate === null ? '—' : fmtPct(s.cleanWinRate), { icon: 'trophy', sub: 'BE EXCLUDED' }),
        '</div>',
      '</div>',

      // --- risk ---
      '<div class="section">',
        '<div class="section__head"><h3 class="section__title">' + icon('shield', 14) + '<span>RISK & DISCIPLINE</span></h3></div>',
        '<div class="stat-grid">',
          statTile('Max Drawdown', '-' + fmtPips(s.maxDD), { icon: 'arrow-long-down', cls: 't-neg' }),
          statTile('Recovery Factor', s.recovery === null ? '—' : s.recovery.toFixed(2), { icon: 'refresh' }),
          statTile('Consistency', fmtPct(s.consistency, 0), { icon: 'calendar', sub: s.greenDays + ' GREEN / ' + s.redDays + ' RED DAYS' }),
          statTile('Kelly Criterion', s.kelly === null ? '—' : s.kelly.toFixed(1) + '%', { icon: 'target', sub: 'OPTIMAL SIZE / TRADE' }),
          statTile('Std Deviation', s.std === null ? '—' : fmtPips(s.std), { icon: 'activity' }),
          statTile('Sharpe (Per Trade)', s.sharpe === null ? '—' : s.sharpe.toFixed(2), { icon: 'trend-up' }),
        '</div>',
      '</div>',

      // --- streaks & extremes ---
      '<div class="section">',
        '<div class="section__head"><h3 class="section__title">' + icon('zap', 14) + '<span>STREAKS & EXTREMES</span></h3></div>',
        '<div class="stat-grid">',
          statTile('Current Streak', streakText(s.streak), { icon: s.streak.type === 'Lose' ? 'trend-down' : 'trend-up' }),
          statTile('Best W-Streak', String(s.bestWinStreak), { icon: 'flame' }),
          statTile('Worst L-Streak', String(s.bestLoseStreak), { icon: 'trend-down' }),
          statTile('Best Trade', s.bestTrade ? fmtPips(s.bestTrade._signed ?? PC.store.signedPips(s.bestTrade), true) : '—', { icon: 'trophy', sub: s.bestTrade ? (s.bestTrade.pair + ' · ' + fmtDate(s.bestTrade.date, 'tiny')) : '' }),
          statTile('Worst Trade', s.worstTrade ? fmtPips(s.worstTrade._signed ?? PC.store.signedPips(s.worstTrade), true) : '—', { icon: 'trend-down', sub: s.worstTrade ? (s.worstTrade.pair + ' · ' + fmtDate(s.worstTrade.date, 'tiny')) : '' }),
          statTile('Best Day', s.bestDay ? fmtPips(s.bestDay.net, true) : '—', { icon: 'calendar', sub: s.bestDay ? fmtDate(s.bestDay.key, 'tiny') : '' }),
        '</div>',
      '</div>',

      // --- rhythm ---
      '<div class="section">',
        '<div class="section__head"><h3 class="section__title">' + icon('clock', 14) + '<span>RHYTHM</span></h3></div>',
        '<div class="stat-grid stat-grid--3">',
          statTile('Trading Days', s.dayCount, {}),
          statTile('Trades / Day', s.tradesPerDay.toFixed(1), {}),
          statTile('Avg Pips / Day', s.dayCount ? fmtPips(s.netPips / s.dayCount, true) : '—', {}),
        '</div>',
      '</div>',

      // --- equity curve ---
      '<div class="section">',
        '<div class="section__head"><h3 class="section__title">' + icon('trend-up', 14) + '<span>EQUITY CURVE</span></h3><span class="section__meta">CUMULATIVE PIPS</span></div>',
        '<div class="card chart-wrap">',
          '<canvas id="equityChart" height="180"></canvas>',
          '<div class="chart-cap"><span>' + esc(s.equity.length ? PC.ui.fmtDate(s.equity[0].x, 'tiny') : '') + '</span><span>' + esc(s.equity.length ? PC.ui.fmtDate(s.equity[s.equity.length - 1].x, 'tiny') : '') + '</span></div>',
        '</div>',
      '</div>',

      // --- breakdowns ---
      '<div class="section">',
        '<div class="section__head"><h3 class="section__title">' + icon('grid', 14) + '<span>BREAKDOWNS</span></h3></div>',
        '<div class="chip-row" id="breakChips"></div>',
        '<div class="card card--flat" id="breakHost" style="margin-top:10px"></div>',
      '</div>'
    ].join('');

    // breakdown chips
    const chips = $('#breakChips', host);
    BREAKTABS.forEach((t) => {
      const c = el('<button class="chip" aria-selected="' + (t.value === breakTab) + '">' + esc(t.label) + '</button>');
      c.addEventListener('click', () => {
        breakTab = t.value;
        $$('#breakChips .chip', host).forEach((x) => x.setAttribute('aria-selected', 'false'));
        c.setAttribute('aria-selected', 'true');
        PC.tg.haptic('select');
        renderBreak(host, s);
      });
      chips.appendChild(c);
    });
    renderBreak(host, s);

    // chart
    const canvas = $('#equityChart', host);
    if (canvas) PC.charts.equity(canvas, s.equity);
  }

  function renderBreak(host, s) {
    const box = $('#breakHost', host);
    if (!box) return;
    if (breakTab === 'monthly') {
      const rows = s.monthly.slice(-8).reverse();
      if (!rows.length) { box.innerHTML = ''; box.appendChild(PC.ui.emptyState('calendar', 'No Monthly Data', 'Monthly totals appear once you log trades.')); return; }
      box.innerHTML = rows.map((m) => (
        '<div class="bd-row">' +
          '<span class="bd-row__name">' + esc(m.label) + '</span>' +
          '<span class="bd-row__mid"><span class="bar"><span class="bar__fill" style="width:' + Math.min(100, Math.max(4, m.winRate)) + '%"></span></span></span>' +
          '<span class="bd-row__pct">' + fmtPct(m.winRate, 0) + '</span>' +
          '<span class="bd-row__meta"><b class="' + (m.net >= 0 ? 't-pos' : 't-neg') + '">' + fmtPips(m.net, true) + '</b>' + m.count + ' TRADES</span>' +
        '</div>'
      )).join('');
      return;
    }
    const rows = s.groups[breakTab].filter((r) => r.count > 0);
    if (!rows.length) {
      box.innerHTML = '';
      box.appendChild(PC.ui.emptyState('grid', 'No Data', 'This period has no trades for the ' + breakTab + ' breakdown.'));
      return;
    }
    box.innerHTML = rows.map((r) => {
      const pct = r.cleanWinRate === null ? r.winRate : r.cleanWinRate;
      return (
        '<div class="bd-row">' +
          '<span class="bd-row__name" title="' + esc(r.key) + '">' + esc(r.key) + '</span>' +
          '<span class="bd-row__mid"><span class="bar"><span class="bar__fill" style="width:' + Math.min(100, Math.max(3, pct)) + '%"></span></span></span>' +
          '<span class="bd-row__pct">' + fmtPct(pct, 0) + '</span>' +
          '<span class="bd-row__meta"><b class="' + (r.net >= 0 ? 't-pos' : 't-neg') + '">' + fmtPips(r.net, true) + '</b>' + r.count + ' TRADES</span>' +
        '</div>'
      );
    }).join('');
  }

  return { init, render, onShow: render };
})();
