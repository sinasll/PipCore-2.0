/* PipCore v2.0 — Home tab: profile, live snapshot, wallet, community, invite. */
window.PC = window.PC || {};
PC.views = PC.views || {};

PC.views.home = (() => {
  const { $, el, esc, icon, fmtPips, fmtPct, toast } = PC.ui;

  const INVITE_URL = 'https://t.me/pipcorebot';
  const INVITE_TEXT = 'Join PipCore and track your trading journey! PipCore is all you need.';

  const TASKS = [
    { title: 'Join The Channel', cta: 'JOIN', icon: 'telegram', fill: true, url: 'https://t.me/pipcore', tg: true },
    { title: 'Boost The Channel', cta: 'BOOST', icon: 'zap', url: 'https://t.me/boost/pipcore', tg: true },
    { title: 'Subscribe On YouTube', cta: 'SUBSCRIBE', icon: 'youtube', fill: true, url: 'https://youtube.com/@pipcore' },
    { title: 'Watch The Short', cta: 'WATCH', icon: 'play', url: 'https://youtube.com/shorts/kjeHpbrR-zw' },
    { title: 'App Tutorial', cta: 'TUTORIAL', icon: 'cap', url: 'https://youtube.com/shorts/j5P_K4MLNeo' }
  ];

  let root;
  let profileRefreshTimer = null;

  function profileLabel(p) {
    if (p && p.username) return '@' + String(p.username).replace(/^@+/, '');
    if (p && p.firstName) return p.firstName;
    if (p && p.fullName) return String(p.fullName).trim().split(/\s+/)[0] || 'Guest';
    return 'Guest';
  }

  function profileAvatarUrl(src) {
    if (!src) return '';
    try {
      const url = new URL(src, location.href);
      url.searchParams.set('_pc', String(Date.now()));
      return url.href;
    } catch (_) {
      const raw = String(src);
      return raw + (raw.includes('?') ? '&' : '?') + '_pc=' + Date.now();
    }
  }

  function heroProfile() {
    const p = PC.tg.profile();
    const avatar = $('#homeAvatar');
    if (!avatar) return;
    avatar.innerHTML = p.avatar
      ? '<img src="' + esc(profileAvatarUrl(p.avatar)) + '" alt="profile photo" referrerpolicy="no-referrer">'
      : '<span class="avatar__fallback" aria-hidden="true"></span>';
    $('#homeHandle').textContent = profileLabel(p);
  }

  function snapshot() {
    const stats = PC.stats.compute(PC.store.getTrades());
    const netEl = $('#snapNet');
    if (!netEl) return;
    netEl.textContent = fmtPips(stats.netPips, true);
    netEl.className = 'stat__value stat__value--lg ' + (stats.netPips > 0 ? 't-pos' : stats.netPips < 0 ? 't-neg' : '');
    $('#snapRate').textContent = stats.count ? fmtPct(stats.winRate, 0) : '—';
    $('#snapCount').textContent = String(stats.count);

    const todayKey = PC.store.todayKey();
    const today = stats.days.find((d) => d.key === todayKey);
    const tEl = $('#snapToday');
    if (today) {
      tEl.innerHTML =
        '<span class="pill pill--' + (today.net > 0 ? 'pos' : today.net < 0 ? 'neg' : '') + '">' +
        icon(today.net >= 0 ? 'arrow-long-up' : 'arrow-long-down', 10) + fmtPips(today.net, true) + ' PIPS' +
        '</span>' +
        '<span class="pill">' + today.count + ' TRADES TODAY</span>';
    } else {
      tEl.innerHTML = '<span class="pill">NO TRADES TODAY</span>';
    }
  }

  function init() {
    root = $('#view-home .view__inner');
    root.innerHTML = [
      '<div class="card card--pad-lg profile-card">',
        '<div class="avatar" id="homeAvatar"></div>',
        '<div class="profile-meta">',
          '<h2 id="homeHandle">@guest</h2>',
          '<div class="flex flex--wrap mt-2" id="snapToday"></div>',
        '</div>',
      '</div>',

      '<div class="hero-stats">',
        '<div class="stat stat--hero"><span class="stat__label">' + icon('trend-up', 11) + 'NET PIPS</span><span class="stat__value stat__value--lg" id="snapNet">0</span></div>',
        '<div class="stat"><span class="stat__label">' + icon('target', 11) + 'WIN RATE</span><span class="stat__value" id="snapRate">—</span></div>',
        '<div class="stat"><span class="stat__label">' + icon('activity', 11) + 'TRADES</span><span class="stat__value" id="snapCount">0</span></div>',
      '</div>',

'<div class="section" style="display:none;">',
  '<div class="section__head"><h3 class="section__title">' + icon('wallet', 14) + '<span>WALLET</span></h3></div>',
  '<div class="card t-c" id="walletCard">',
    '<p class="t-xs t-dim" style="margin-bottom:12px;letter-spacing:.12em">CONNECT A TON WALLET TO GET READY FOR ON-CHAIN PERKS</p>',
    '<div id="ton-connect-root"></div>',
  '</div>',
'</div>',

'<div class="section">',
  '<div class="section__head"><h3 class="section__title">' + icon('send', 14) + '<span>INVITE TRADERS</span></h3></div>',
  '<div class="card">',
    '<p class="t-xs t-dim" style="line-height:1.9">INVITE FRIENDS TO DISCOVER PIPCORE AND TRACK THEIR TRADES.</p>',
    '<div class="btn-row mt-3">',
      '<button class="btn" id="inviteShare">' + icon('telegram', 15) + 'Share</button>',
      '<button class="btn btn--ghost" id="inviteCopy">' + icon('copy', 15) + 'Copy Link</button>',
    '</div>',
  '</div>',
'</div>',

      '<div class="section">',
        '<div class="section__head"><h3 class="section__title">' + icon('globe', 14) + '<span>COMMUNITY</span></h3><span class="section__meta">' + TASKS.length + ' LINKS</span></div>',
        '<div class="task-list" id="taskList"></div>',
      '</div>',
    ].join('');

    const list = $('#taskList', root);
    TASKS.forEach((t) => {
      const b = el(
        '<button class="task" type="button">' +
          '<span class="task__icon">' + icon(t.icon, 17) + '</span>' +
          '<span class="task__main">' +
            '<span class="task__title">' + esc(t.title) + '</span>' +
            '<span class="task__desc">' + esc(t.desc) + '</span>' +
          '</span>' +
          '<span class="task__cta">' + esc(t.cta) + icon('external', 12) + '</span>' +
        '</button>'
      );
      b.addEventListener('click', () => { PC.tg.haptic('medium'); PC.tg.open(t.url); });
      list.appendChild(b);
    });

    $('#inviteShare', root).addEventListener('click', () => {
      PC.tg.haptic('medium');
      PC.tg.shareToTelegram(INVITE_URL, INVITE_TEXT);
    });
    $('#inviteCopy', root).addEventListener('click', async () => {
      const ok = await PC.tg.copyText(INVITE_TEXT + '\n\n' + INVITE_URL);
      toast(ok ? 'Invite link copied' : 'Copy failed', ok ? 'success' : 'error');
    });

    if (!init._profileRefreshBound) {
      init._profileRefreshBound = true;
      window.addEventListener('focus', heroProfile);
      document.addEventListener('visibilitychange', () => {
        if (!document.hidden) heroProfile();
      });
    }
    if (!profileRefreshTimer) {
      profileRefreshTimer = setInterval(() => {
        if (!document.hidden) heroProfile();
      }, 30000);
    }

    initTon();
  }

  let tonRetries = 0;
  function initTon() {
    const mount = document.getElementById('ton-connect-root');
    if (!mount) return;
    if (window.TON_CONNECT_UI && window.TON_CONNECT_UI.TonConnectUI) {
      try {
        if (initTon._instance) return;
        initTon._instance = new window.TON_CONNECT_UI.TonConnectUI({
          manifestUrl: new URL('tonconnect-manifest.json', location.href).href,
          buttonRootId: 'ton-connect-root'
        });
      } catch (e) { console.warn('TON init failed', e); }
    } else if (tonRetries < 10) {
      tonRetries += 1;
      setTimeout(initTon, 600);
    } else {
      mount.innerHTML = '<span class="pill">WALLET SDK OFFLINE</span>';
    }
  }

  function render() { heroProfile(); snapshot(); }

  return { init, render, heroProfile, onShow: render };
})();
