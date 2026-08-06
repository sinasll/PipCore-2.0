/* PipCore v2.0 — Local-first data layer.
   Storage keys are identical to v1 (tradeEntries / setups / entries /
   timeframes / pairs / theme) so existing users keep all data. */
window.PC = window.PC || {};

PC.bus = {
  _h: {},
  on(ev, fn) {
    (this._h[ev] = this._h[ev] || []).push(fn);
    return () => { this._h[ev] = (this._h[ev] || []).filter((f) => f !== fn); };
  },
  emit(ev, data) {
    (this._h[ev] || []).slice().forEach((fn) => { try { fn(data); } catch (e) { console.error(e); } });
  }
};

PC.store = (() => {
  const K = {
    trades: 'tradeEntries',
    setups: 'setups',
    entries: 'entries',
    timeframes: 'timeframes',
    pairs: 'pairs',
    sessions: 'sessions',
    theme: 'theme',
    settings: 'pipcore.settings.v2'
  };
  const LIST_KEYS = ['setups', 'entries', 'timeframes', 'pairs', 'sessions'];

  const DEFAULTS = {
    setups: ['Setup 1', 'Setup 2', 'Setup 3'],
    entries: ['Entry 1', 'Entry 2', 'Entry 3', 'Entry 4', 'Entry 5'],
    timeframes: ['5min', '15min', '30min', '1hr', '4hr'],
    pairs: ['EURUSD', 'GBPUSD', 'USDJPY', 'GBPJPY', 'XAUUSD', 'XAGUSD', 'US30', 'NAS100', 'SPX500'],
    sessions: ['Asia', 'Pre London', 'London', 'Pre New York', 'New York']
  };

  const OUTCOME_FIX = {
    win: 'Win', wins: 'Win', w: 'Win',
    lose: 'Lose', loss: 'Lose', losses: 'Lose', l: 'Lose',
    breakeven: 'Breakeven', 'break even': 'Breakeven', be: 'Breakeven', b: 'Breakeven'
  };

  /* ---------- low-level ---------- */
  function read(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      if (raw === null || raw === undefined) return fallback;
      return JSON.parse(raw);
    } catch (e) { return fallback; }
  }
  function write(key, val) {
    try { localStorage.setItem(key, JSON.stringify(val)); } catch (e) { console.error('write failed', e); }
  }
  function uid() {
    return 't' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  /* ---------- trades ---------- */
  function normalizeTrade(t) {
    if (!t || typeof t !== 'object') return null;
    const o = String(t.outcome || 'Win').trim();
    const outcome = OUTCOME_FIX[o.toLowerCase()] || (o.charAt(0).toUpperCase() + o.slice(1));
    let pips = parseFloat(t.pips);
    if (!Number.isFinite(pips)) pips = 0;
    pips = Math.abs(pips);
    const date = /^\d{4}-\d{2}-\d{2}$/.test(t.date) ? t.date : todayKey();
    const time = /^\d{2}:\d{2}/.test(t.time || '') ? String(t.time).slice(0, 5) : '00:00';
    return {
      id: typeof t.id === 'string' && t.id ? t.id : uid(),
      date, time,
      session: String(t.session || ''),
      pair: String(t.pair || ''),
      setup: String(t.setup || ''),
      entry: String(t.entry || ''),
      timeframe: String(t.timeframe || ''),
      buySell: String(t.buySell || 'Buy').toLowerCase() === 'sell' ? 'Sell' : 'Buy',
      pips,
      outcome
    };
  }

  function getTrades() {
    const raw = read(K.trades, []);
    if (!Array.isArray(raw)) return [];
    return raw.map(normalizeTrade).filter(Boolean);
  }

  function saveTrades(list, silent) {
    write(K.trades, list.map(normalizeTrade).filter(Boolean));
    if (!silent) PC.bus.emit('trades');
  }

  function addTrade(trade) {
    const list = getTrades();
    const clean = normalizeTrade(trade);
    list.push(clean);
    saveTrades(list, true);
    PC.bus.emit('trades');
    return clean;
  }

  function updateTrade(id, patch) {
    const list = getTrades();
    const i = list.findIndex((t) => t.id === id);
    if (i === -1) return null;
    const merged = normalizeTrade(Object.assign({}, list[i], patch, { id }));
    list[i] = merged;
    saveTrades(list, true);
    PC.bus.emit('trades');
    return merged;
  }

  function deleteTrade(id) {
    saveTrades(getTrades().filter((t) => t.id !== id), true);
    PC.bus.emit('trades');
  }

  function duplicateTrade(id) {
    const src = getTrades().find((t) => t.id === id);
    if (!src) return null;
    const copy = normalizeTrade(Object.assign({}, src, { id: uid() }));
    saveTrades(getTrades().concat([copy]), true);
    PC.bus.emit('trades');
    return copy;
  }

  function clearTrades() { saveTrades([], true); PC.bus.emit('trades'); }

  /* ---------- option lists ---------- */
  function getList(type) {
    if (!LIST_KEYS.includes(type)) return [];
    const v = read(K[type], null);
    return Array.isArray(v) ? v.filter((x) => typeof x === 'string') : DEFAULTS[type].slice();
  }
  function saveList(type, arr, silent) {
    write(K[type], arr);
    if (!silent) PC.bus.emit('options', { type });
  }
  function addOption(type, name) {
    const list = getList(type);
    const clean = String(name || '').trim();
    if (!clean) return { ok: false, reason: 'empty' };
    if (list.some((x) => x.toLowerCase() === clean.toLowerCase())) return { ok: false, reason: 'duplicate' };
    list.push(clean);
    saveList(type, list, true);
    PC.bus.emit('options', { type });
    return { ok: true };
  }
  function renameOption(type, index, name) {
    const list = getList(type);
    const clean = String(name || '').trim();
    if (!clean || index < 0 || index >= list.length) return { ok: false };
    list[index] = clean;
    saveList(type, list, true);
    PC.bus.emit('options', { type });
    return { ok: true };
  }
  function removeOption(type, index) {
    const list = getList(type);
    if (index < 0 || index >= list.length) return { ok: false };
    list.splice(index, 1);
    saveList(type, list, true);
    PC.bus.emit('options', { type });
    return { ok: true };
  }
  function moveOption(type, index, dir) {
    const list = getList(type);
    const j = index + dir;
    if (index < 0 || j < 0 || j >= list.length) return;
    const tmp = list[index]; list[index] = list[j]; list[j] = tmp;
    saveList(type, list, true);
    PC.bus.emit('options', { type });
  }
  function resetOptions(type) {
    saveList(type, DEFAULTS[type].slice(), true);
    PC.bus.emit('options', { type });
  }

  /* ---------- settings ---------- */
  // Keep the keys compact so they are easy to include in backups, while the
  // labels/stacks live in the UI layer. The original pixel font remains the
  // default and the two additional choices are available to every install.
  const FONT_OPTIONS = [
    { value: 'pixel', label: 'Press Start 2P' },
    { value: 'inter', label: 'Inter' },
    { value: 'jetbrains', label: 'JetBrains Mono' }
  ];
  const FONT_SIZE_MIN = 10;
  const FONT_SIZE_MAX = 150;
  const SETTING_DEFAULTS = {
    theme: 'dark',
    weekStart: 'mon',
    haptics: true,
    font: 'pixel',
    fontSize: 100
  };

  function normalizeSettings(input) {
    const next = Object.assign({}, SETTING_DEFAULTS, input && typeof input === 'object' ? input : {});
    next.theme = next.theme === 'light' ? 'light' : 'dark';
    next.weekStart = next.weekStart === 'sun' ? 'sun' : 'mon';
    next.haptics = !!next.haptics;
    next.font = FONT_OPTIONS.some((option) => option.value === next.font) ? next.font : SETTING_DEFAULTS.font;
    const requestedSize = Number(next.fontSize);
    next.fontSize = Number.isFinite(requestedSize)
      ? Math.min(FONT_SIZE_MAX, Math.max(FONT_SIZE_MIN, Math.round(requestedSize)))
      : SETTING_DEFAULTS.fontSize;
    return next;
  }
  function getSettings() {
    const s = normalizeSettings(read(K.settings, {}));
    // migrate legacy standalone theme key
    let theme = read(K.theme, null);
    if (theme !== 'light' && theme !== 'dark') theme = null;
    return normalizeSettings(Object.assign({}, s, theme ? { theme } : {}));
  }
  function updateSettings(patch) {
    const next = normalizeSettings(Object.assign(getSettings(), patch));
    write(K.settings, next);
    if (patch && Object.prototype.hasOwnProperty.call(patch, 'theme')) {
      try { localStorage.setItem(K.theme, JSON.stringify(next.theme)); } catch (e) {}
      PC.bus.emit('theme', next.theme);
    }
    PC.bus.emit('settings', next);
    return next;
  }

  /* ---------- backup / restore ---------- */
  function backup() {
    return {
      app: 'PipCore',
      version: 2,
      exportedAt: new Date().toISOString(),
      trades: getTrades(),
      options: {
        setups: getList('setups'),
        entries: getList('entries'),
        timeframes: getList('timeframes'),
        pairs: getList('pairs'),
        sessions: getList('sessions')
      },
      settings: getSettings()
    };
  }

  function isValidBackup(json) {
    return !!json && typeof json === 'object' &&
      (Array.isArray(json.trades) || (json.options && typeof json.options === 'object'));
  }

  function restore(json, mode) {
    if (!isValidBackup(json)) return { ok: false, reason: 'invalid' };
    if (Array.isArray(json.trades)) {
      const incoming = json.trades.map(normalizeTrade).filter(Boolean);
      if (mode === 'merge') {
        const existing = getTrades();
        const seen = new Set(existing.map((t) => t.id + '|' + t.date + t.time + t.pair + t.pips + t.outcome));
        const fresh = incoming.filter((t) => !seen.has(t.id + '|' + t.date + t.time + t.pair + t.pips + t.outcome));
        saveTrades(existing.concat(fresh), true);
      } else {
        saveTrades(incoming, true);
      }
    }
    if (json.options && typeof json.options === 'object') {
      LIST_KEYS.forEach((k) => {
        if (Array.isArray(json.options[k])) write(K[k], json.options[k].filter((x) => typeof x === 'string'));
      });
    }
    if (json.settings && typeof json.settings === 'object') {
      const nextSettings = normalizeSettings(json.settings);
      write(K.settings, nextSettings);
      try { localStorage.setItem(K.theme, JSON.stringify(nextSettings.theme)); } catch (e) {}
      PC.bus.emit('theme', nextSettings.theme);
      PC.bus.emit('settings', nextSettings);
    }
    PC.bus.emit('trades');
    PC.bus.emit('options', {});
    return { ok: true };
  }

  /* ---------- one-time migration ---------- */
  function migrate() {
    // seed lists if the app was never run
    LIST_KEYS.forEach((k) => {
      if (read(K[k], null) === null) write(K[k], DEFAULTS[k].slice());
    });
    // normalize legacy trades (adds ids, normalizes outcomes) in-place
    const raw = read(K.trades, []);
    if (Array.isArray(raw)) {
      const clean = raw.map(normalizeTrade).filter(Boolean);
      if (JSON.stringify(raw) !== JSON.stringify(clean)) write(K.trades, clean);
    }
    const theme = read(K.theme, 'dark');
    if (theme !== 'light' && theme !== 'dark') write(K.theme, 'dark');
    if (!read(K.settings, null)) write(K.settings, Object.assign({}, SETTING_DEFAULTS, { theme: read(K.theme, 'dark') }));
  }

  /* ---------- derived helpers ---------- */
  function signedPips(t) {
    if (t.outcome === 'Win') return Math.abs(t.pips);
    if (t.outcome === 'Lose') return -Math.abs(t.pips);
    return 0; // breakeven never distorts the curve
  }

  function todayKey(d) {
    const dt = d || new Date();
    return dt.getFullYear() + '-' + String(dt.getMonth() + 1).padStart(2, '0') + '-' + String(dt.getDate()).padStart(2, '0');
  }

  return {
    K, DEFAULTS, LIST_KEYS, FONT_OPTIONS, FONT_SIZE_MIN, FONT_SIZE_MAX,
    migrate,
    getTrades, saveTrades, addTrade, updateTrade, deleteTrade, duplicateTrade, clearTrades,
    getList, addOption, renameOption, removeOption, moveOption, resetOptions,
    getSettings, updateSettings,
    backup, restore, isValidBackup,
    signedPips, todayKey
  };
})();
