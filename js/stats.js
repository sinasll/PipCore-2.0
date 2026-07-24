/* PipCore v2.0 — Statistics engine.
   Pure functions over the trade list. Handles breakevens correctly:
   - signed pips: Win +|pips|, Lose -|pips|, Breakeven 0
   - "clean win rate" excludes breakevens
   - drawdown / streaks computed on the chronological equity curve */
window.PC = window.PC || {};

PC.stats = (() => {
  const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  /* parse 'YYYY-MM-DD' (and optional 'HH:MM') as LOCAL time to avoid TZ drift */
  function toDate(dateStr, timeStr) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr || '')) return null;
    const [y, m, d] = dateStr.split('-').map(Number);
    let hh = 0, mm = 0;
    if (/^\d{2}:\d{2}/.test(timeStr || '')) { hh = Number(timeStr.slice(0, 2)); mm = Number(timeStr.slice(3, 5)); }
    return new Date(y, m - 1, d, hh, mm, 0, 0);
  }

  function dayKey(d) {
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }

  function enrich(trades) {
    return trades.map((t) => {
      const dt = toDate(t.date, t.time) || new Date(0);
      return Object.assign({}, t, {
        _dt: dt,
        _day: dayKey(dt),
        _signed: PC.store.signedPips(t),
        // weekday 0 = Monday
        _wd: (dt.getDay() + 6) % 7
      });
    }).sort((a, b) => a._dt - b._dt);
  }

  /* period filter */
  function filterPeriod(trades, period) {
    if (!period || period === 'all') return trades;
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    let from = null, to = null;
    if (period === '7d') from = new Date(startOfToday.getTime() - 6 * 864e5);
    else if (period === '30d') from = new Date(startOfToday.getTime() - 29 * 864e5);
    else if (period === 'month') { from = new Date(now.getFullYear(), now.getMonth(), 1); to = now; }
    else if (period === 'lastMonth') {
      from = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      to = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
    }
    return trades.filter((t) => {
      if (!t._dt) return false;
      if (from && t._dt < from) return false;
      if (to && t._dt > to) return false;
      return true;
    });
  }

  function groupStats(trades, keyFn, orderList) {
    const map = new Map();
    trades.forEach((t) => {
      const key = keyFn(t) || 'Other';
      if (!map.has(key)) map.set(key, { key, count: 0, wins: 0, losses: 0, bes: 0, net: 0 });
      const g = map.get(key);
      g.count += 1;
      if (t.outcome === 'Win') g.wins += 1;
      else if (t.outcome === 'Lose') g.losses += 1;
      else g.bes += 1;
      g.net += t._signed;
    });
    const rows = Array.from(map.values()).map((g) => Object.assign(g, {
      winRate: g.count ? (g.wins / g.count) * 100 : 0,
      cleanWinRate: (g.wins + g.losses) ? (g.wins / (g.wins + g.losses)) * 100 : null
    }));
    if (orderList) {
      const order = new Map(orderList.map((k, i) => [k, i]));
      rows.sort((a, b) => {
        const ai = order.has(a.key) ? order.get(a.key) : 999;
        const bi = order.has(b.key) ? order.get(b.key) : 999;
        return ai - bi || b.count - a.count;
      });
    } else {
      rows.sort((a, b) => b.count - a.count || Math.abs(b.net) - Math.abs(a.net));
    }
    return rows;
  }

  function compute(tradesRaw) {
    const trades = enrich(tradesRaw);
    const count = trades.length;
    const wins = trades.filter((t) => t.outcome === 'Win');
    const losses = trades.filter((t) => t.outcome === 'Lose');
    const bes = trades.filter((t) => t.outcome === 'Breakeven');

    const sum = (arr) => arr.reduce((a, b) => a + b, 0);
    const winPips = wins.map((t) => Math.abs(t.pips));
    const lossPips = losses.map((t) => Math.abs(t.pips));
    const grossWin = sum(winPips);
    const grossLoss = sum(lossPips);
    const netPips = sum(trades.map((t) => t._signed));

    const winRate = count ? (wins.length / count) * 100 : 0;
    const cleanWinRate = (wins.length + losses.length) ? (wins.length / (wins.length + losses.length)) * 100 : null;
    const avgPips = count ? netPips / count : 0;
    const avgWin = wins.length ? grossWin / wins.length : null;
    const avgLoss = losses.length ? grossLoss / losses.length : null;
    const profitFactor = losses.length ? (grossLoss > 0 ? grossWin / grossLoss : null) : (grossWin > 0 ? Infinity : null);
    const payoff = (avgWin !== null && avgLoss && avgLoss > 0) ? avgWin / avgLoss : null;

    /* expectancy per trade */
    const expectancy = count ? netPips / count : 0;

    /* dispersion (sample std dev of signed pips) */
    let std = null, sharpe = null;
    if (count > 1) {
      const mean = netPips / count;
      const v = sum(trades.map((t) => Math.pow(t._signed - mean, 2))) / (count - 1);
      std = Math.sqrt(v);
      sharpe = std > 0 ? mean / std : null;
    }

    /* equity curve, peak, max drawdown (in pips) */
    let cum = 0, peak = 0, maxDD = 0;
    const equity = trades.map((t) => {
      cum += t._signed;
      if (cum > peak) peak = cum;
      const dd = peak - cum;
      if (dd > maxDD) maxDD = dd;
      return { x: t._day, y: Math.round(cum * 100) / 100 };
    });
    const recovery = maxDD > 0 ? netPips / maxDD : null;

    /* streaks (chronological; breakeven does not break a streak) */
    let curType = null, curN = 0, bestWin = 0, bestLose = 0;
    let runType = null, runN = 0;
    trades.forEach((t) => {
      if (t.outcome === 'Breakeven') return;
      const type = t.outcome; // Win | Lose
      if (type === runType) runN += 1;
      else { runType = type; runN = 1; }
      if (type === 'Win') bestWin = Math.max(bestWin, runN);
      else bestLose = Math.max(bestLose, runN);
    });
    curType = runType; curN = runN;

    /* day-based consistency */
    const byDay = new Map();
    trades.forEach((t) => {
      if (!byDay.has(t._day)) byDay.set(t._day, { key: t._day, count: 0, net: 0, wins: 0, losses: 0, bes: 0, best: null, worst: null });
      const d = byDay.get(t._day);
      d.count += 1; d.net += t._signed;
      if (t.outcome === 'Win') d.wins += 1; else if (t.outcome === 'Lose') d.losses += 1; else d.bes += 1;
      if (d.best === null || t._signed > d.best) d.best = t._signed;
      if (d.worst === null || t._signed < d.worst) d.worst = t._signed;
    });
    const days = Array.from(byDay.values()).sort((a, b) => a.key < b.key ? -1 : 1);
    const dayCount = days.length;
    const greenDays = days.filter((d) => d.net > 0).length;
    const redDays = days.filter((d) => d.net < 0).length;
    const flatDays = dayCount - greenDays - redDays;
    const consistency = dayCount ? (greenDays / dayCount) * 100 : 0;
    const bestDay = dayCount ? days.reduce((a, b) => (b.net > a.net ? b : a)) : null;
    const worstDay = dayCount ? days.reduce((a, b) => (b.net < a.net ? b : a)) : null;

    /* Kelly criterion (based on clean win rate + payoff) */
    let kelly = null;
    if (cleanWinRate !== null && payoff && payoff > 0) {
      const W = cleanWinRate / 100;
      kelly = (W - (1 - W) / payoff) * 100;
      if (!Number.isFinite(kelly)) kelly = null;
      else kelly = Math.max(-100, Math.min(100, kelly));
    }

    /* best / worst single trades */
    let bestTrade = null, worstTrade = null;
    trades.forEach((t) => {
      if (bestTrade === null || t._signed > bestTrade._signed) bestTrade = t;
      if (worstTrade === null || t._signed < worstTrade._signed) worstTrade = t;
    });

    /* monthly series (chronological) */
    const monthlyMap = new Map();
    trades.forEach((t) => {
      const mk = t._day.slice(0, 7);
      if (!monthlyMap.has(mk)) monthlyMap.set(mk, { key: mk, count: 0, net: 0, wins: 0, losses: 0 });
      const m = monthlyMap.get(mk);
      m.count += 1; m.net += t._signed;
      if (t.outcome === 'Win') m.wins += 1; else if (t.outcome === 'Lose') m.losses += 1;
    });
    const monthly = Array.from(monthlyMap.values())
      .sort((a, b) => a.key < b.key ? -1 : 1)
      .map((m) => {
        const [y, mo] = m.key.split('-');
        return Object.assign(m, {
          label: MONTHS[Number(mo) - 1] + ' ' + y.slice(2),
          winRate: m.count ? (m.wins / m.count) * 100 : 0
        });
      });

    const S = PC.store;
    return {
      count, wins: wins.length, losses: losses.length, bes: bes.length,
      netPips, grossWin, grossLoss,
      winRate, cleanWinRate, avgPips, avgWin, avgLoss,
      profitFactor, payoff, expectancy, std, sharpe, kelly,
      maxDD, recovery, equity,
      streak: { type: curType, n: curN }, bestWinStreak: bestWin, bestLoseStreak: bestLose,
      dayCount, greenDays, redDays, flatDays, consistency, bestDay, worstDay,
      tradesPerDay: dayCount ? count / dayCount : 0,
      bestTrade, worstTrade, monthly,
      groups: {
        session: groupStats(trades, (t) => t.session, S.getList('sessions')),
        pair: groupStats(trades, (t) => t.pair, S.getList('pairs')),
        setup: groupStats(trades, (t) => t.setup, S.getList('setups')),
        entry: groupStats(trades, (t) => t.entry, S.getList('entries')),
        timeframe: groupStats(trades, (t) => t.timeframe, S.getList('timeframes')),
        direction: groupStats(trades, (t) => t.buySell, ['Buy', 'Sell']),
        weekday: groupStats(trades, (t) => WEEKDAYS[t._wd], WEEKDAYS)
      },
      days
    };
  }

  /* per-day map for the calendar: dayKey -> {count, wins, losses, bes, net} */
  function computeDayMap(tradesRaw) {
    const trades = enrich(tradesRaw);
    const map = new Map();
    trades.forEach((t) => {
      if (!map.has(t._day)) map.set(t._day, { key: t._day, count: 0, wins: 0, losses: 0, bes: 0, net: 0 });
      const d = map.get(t._day);
      d.count += 1; d.net += t._signed;
      if (t.outcome === 'Win') d.wins += 1; else if (t.outcome === 'Lose') d.losses += 1; else d.bes += 1;
    });
    return map;
  }

  return { compute, computeDayMap, filterPeriod, toDate, dayKey, WEEKDAYS, MONTHS };
})();
