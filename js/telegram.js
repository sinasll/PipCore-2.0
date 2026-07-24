/* PipCore v2.0 — Telegram Mini App integration.
   Correct usage of the WebApp SDK:
   - ready() + expand() on boot
   - header/background colors synced with the app theme
   - vertical swipes disabled (prevents accidental minimize) when supported
   - closing confirmation enabled while the app is open
   - proper openTelegramLink() for t.me URLs, openLink() for external
   - unified haptics with settings toggle + version guards
   - BackButton wired to sheets/modals
   - profile resolution: @username -> falls back to full name -> guest */
window.PC = window.PC || {};

PC.tg = (() => {
  function sdk() { return (window.Telegram && window.Telegram.WebApp) ? window.Telegram.WebApp : null; }

  function init() {
    const tg = sdk();
    if (!tg) return;
    try { tg.ready(); } catch (e) {}
    try { tg.expand(); } catch (e) {}
    try { if (isAtLeast('6.1') && tg.enableClosingConfirmation) tg.enableClosingConfirmation(); } catch (e) {}
    try { if (isAtLeast('7.4') && tg.disableVerticalSwipes) tg.disableVerticalSwipes(); } catch (e) {}
    applyTheme(currentTheme());
  }

  function isAtLeast(v) {
    const tg = sdk();
    try { return !!(tg && tg.isVersionAtLeast && tg.isVersionAtLeast(v)); } catch (e) { return false; }
  }

  function currentTheme() {
    try { return PC.store.getSettings().theme; } catch (e) { return 'dark'; }
  }

  function applyTheme(theme) {
    const tg = sdk();
    if (!tg) return;
    const bg = theme === 'light' ? '#E6B33C' : '#000000';
    try { if (tg.setBackgroundColor) tg.setBackgroundColor(bg); } catch (e) {}
    try { if (tg.setHeaderColor) tg.setHeaderColor(bg); } catch (e) {}
  }

  /* ------- profile ------- */
  function user() {
    const tg = sdk();
    return (tg && tg.initDataUnsafe && tg.initDataUnsafe.user) ? tg.initDataUnsafe.user : null;
  }

  function profile() {
    const u = user();
    if (!u) {
      return {
        id: null, username: null,
        firstName: 'Guest Trader', lastName: '',
        fullName: 'Guest Trader', handle: '@guest',
        avatar: null, initials: 'G'
      };
    }
    const fullName = [u.first_name, u.last_name].filter(Boolean).join(' ') || 'Trader';
    const handle = u.username ? '@' + u.username : fullName;
    let initials = 'PT';
    if (u.username) initials = u.username.slice(0, 2).toUpperCase();
    else if (u.first_name) initials = (u.first_name[0] + (u.last_name ? u.last_name[0] : '')).toUpperCase();
    return {
      id: u.id || null,
      username: u.username || null,
      firstName: u.first_name || 'Trader',
      lastName: u.last_name || '',
      fullName, handle,
      avatar: u.photo_url || null,
      initials
    };
  }

  /* ------- haptics ------- */
  function haptic(kind) {
    try { if (!PC.store.getSettings().haptics) return; } catch (e) {}
    const tg = sdk();
    const H = tg && tg.HapticFeedback;
    if (!H) return;
    try {
      switch (kind) {
        case 'light': H.impactOccurred('light'); break;
        case 'medium': H.impactOccurred('medium'); break;
        case 'heavy': H.impactOccurred('heavy'); break;
        case 'select': H.selectionChanged(); break;
        case 'success': H.notificationOccurred('success'); break;
        case 'warning': H.notificationOccurred('warning'); break;
        case 'error': H.notificationOccurred('error'); break;
        default: H.impactOccurred('light');
      }
    } catch (e) {}
  }

  /* ------- links ------- */
  const TG_LINK = /^https?:\/\/(t\.me|telegram\.me|telegram\.dog)\//i;

  function open(url) {
    const tg = sdk();
    if (tg) {
      if (TG_LINK.test(url) && tg.openTelegramLink) {
        try { tg.openTelegramLink(url); return; } catch (e) {}
      }
      if (tg.openLink) {
        try { tg.openLink(url, { try_instant_view: false }); return; } catch (e) {}
      }
    }
    try { window.open(url, '_blank', 'noopener'); } catch (e) { location.href = url; }
  }

  /* ------- back button ------- */
  let backHandler = null;
  function backButton(show, cb) {
    const tg = sdk();
    if (!tg || !tg.BackButton) return;
    try {
      if (backHandler && tg.BackButton.offClick) tg.BackButton.offClick(backHandler);
      backHandler = null;
      tg.BackButton.hide();
      if (show && cb && tg.BackButton.onClick) {
        backHandler = cb;
        tg.BackButton.onClick(backHandler);
        tg.BackButton.show();
      }
    } catch (e) {}
  }

  /* ------- share / clipboard ------- */
  function shareToTelegram(url, text) {
    const shareUrl = 'https://t.me/share/url?url=' + encodeURIComponent(url) + (text ? '&text=' + encodeURIComponent(text) : '');
    open(shareUrl);
  }

  function copyText(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text).then(() => true).catch(() => legacyCopy(text));
    }
    return Promise.resolve(legacyCopy(text));
  }
  function legacyCopy(text) {
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      return true;
    } catch (e) { return false; }
  }

  return { init, sdk, isAtLeast, applyTheme, profile, user, haptic, open, backButton, shareToTelegram, copyText };
})();
