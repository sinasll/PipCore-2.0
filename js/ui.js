/* PipCore v2.0 — shared UI toolkit: formatting, toasts, sheets, segmented
   controls, switches, prompt/confirm dialogs, empty states. */
window.PC = window.PC || {};

PC.ui = (() => {
  const $ = (sel, root) => (root || document).querySelector(sel);
  const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));

  function esc(s) {
    return String(s === null || s === undefined ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function el(html) {
    const t = document.createElement('template');
    t.innerHTML = html.trim();
    return t.content.firstElementChild;
  }

  function icon(name, size) { return PC.icons.get(name, size); }

  /* ---------- formatting ---------- */
  function fmtPips(n, signed) {
    if (n === null || n === undefined || !Number.isFinite(n)) return '—';
    const abs = Math.abs(n);
    const dec = abs >= 1000 ? 0 : abs >= 100 ? 1 : abs >= 10 ? 1 : 2;
    const core = abs.toFixed(dec).replace(/\.0+$|(\.\d*?)0+$/, '$1');
    if (n > 0) return (signed ? '+' : '') + core;
    if (n < 0) return '-' + core;
    return '0';
  }

  function fmtPct(n, dec) {
    if (n === null || n === undefined || !Number.isFinite(n)) return '—';
    return n.toFixed(dec === undefined ? 1 : dec) + '%';
  }

  function fmtRatio(n, infLabel) {
    if (n === null || n === undefined) return '—';
    if (n === Infinity) return infLabel || 'MAX';
    if (!Number.isFinite(n)) return '—';
    return n.toFixed(2);
  }

  function fmtDate(dayKey, style) {
    const d = PC.stats.toDate(dayKey);
    if (!d) return dayKey;
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = PC.stats.MONTHS[d.getMonth()].toUpperCase();
    const wk = PC.stats.WEEKDAYS[(d.getDay() + 6) % 7].slice(0, 3).toUpperCase();
    if (style === 'long') return wk + ' ' + dd + ' ' + mm + ' ' + d.getFullYear();
    if (style === 'tiny') return dd + ' ' + mm;
    return dd + ' ' + mm + ' ' + d.getFullYear();
  }

  /* ---------- toast ---------- */
  function toast(msg, kind) {
    const host = $('#toasts') || document.body.appendChild(el('<div id="toasts"></div>'));
    while (host.children.length >= 3) host.removeChild(host.firstChild);
    const iconName = kind === 'success' ? 'check' : kind === 'error' ? 'alert' : 'info';
    const t = el('<div class="toast">' + icon(iconName, 13) + '<span>' + esc(msg) + '</span></div>');
    host.appendChild(t);
    setTimeout(() => {
      t.classList.add('toast--out');
      setTimeout(() => t.remove(), 260);
    }, 2400);
    if (kind === 'success') PC.tg.haptic('success');
    else if (kind === 'error') PC.tg.haptic('error');
    else PC.tg.haptic('light');
  }

  /* ---------- sheets ---------- */
  let backdrop = null;
  const sheetStack = [];

  function ensureBackdrop() {
    if (backdrop) return backdrop;
    backdrop = el('<div class="sheet-bk"></div>');
    backdrop.addEventListener('click', () => closeSheet());
    document.body.appendChild(backdrop);
    return backdrop;
  }

  function openSheet(node, opts) {
    opts = opts || {};
    ensureBackdrop();
    const sheet = el(
      '<div class="sheet" role="dialog" aria-modal="true">' +
        '<div class="sheet__grab"></div>' +
        (opts.title ? '<div class="sheet__head"><h3 class="sheet__title">' +
          (opts.icon ? icon(opts.icon, 15) : '') + '<span>' + esc(opts.title) + '</span></h3>' +
          '<button class="icon-btn" data-sheet-close aria-label="Close">' + icon('x', 16) + '</button></div>' : '') +
      '</div>'
    );
    const body = el('<div class="sheet__body"></div>');
    if (typeof node === 'string') body.innerHTML = node; else body.appendChild(node);
    sheet.appendChild(body);
    document.body.appendChild(sheet);

    sheet.querySelectorAll('[data-sheet-close]').forEach((b) => b.addEventListener('click', () => closeSheet(sheet)));
    backdrop.classList.add('is-open');
    requestAnimationFrame(() => sheet.classList.add('is-open'));
    sheetStack.push(sheet);
    PC.tg.backButton(true, () => closeSheet());
    PC.tg.haptic('light');
    return sheet;
  }

  function closeSheet(target) {
    const sheet = target || sheetStack[sheetStack.length - 1];
    const idx = sheetStack.indexOf(sheet);
    if (idx === -1) return;
    sheetStack.splice(idx, 1);
    sheet.classList.remove('is-open');
    setTimeout(() => sheet.remove(), 340);
    if (!sheetStack.length) {
      if (backdrop) backdrop.classList.remove('is-open');
      PC.tg.backButton(false);
    }
  }

  /* ---------- confirm dialog ---------- */
  function confirm(opts) {
    return new Promise((resolve) => {
      const wrap = el(
        '<div>' +
          '<p class="t-sm" style="line-height:2">' + (opts.text || '') + '</p>' +
          '<div class="btn-row mt-4">' +
            '<button class="btn btn--ghost" data-no>Cancel</button>' +
            '<button class="btn ' + (opts.danger ? 'btn--danger" data-armed="true' : '') + '" data-yes>' + esc(opts.confirmLabel || 'Confirm') + '</button>' +
          '</div>' +
        '</div>'
      );
      const sheet = openSheet(wrap, { title: opts.title || 'Are you sure?', icon: opts.danger ? 'alert' : 'info' });
      wrap.querySelector('[data-no]').addEventListener('click', () => { closeSheet(sheet); resolve(false); });
      wrap.querySelector('[data-yes]').addEventListener('click', () => { closeSheet(sheet); resolve(true); });
    });
  }

  /* ---------- prompt dialog ---------- */
  function prompt(title, value, opts) {
    opts = opts || {};
    return new Promise((resolve) => {
      const wrap = el(
        '<div class="form-stack">' +
          '<div class="field"><label>' + esc(opts.label || 'Name') + '</label>' +
          '<input class="input" type="text" maxlength="40" value="' + esc(value || '') + '" placeholder="' + esc(opts.placeholder || '') + '"></div>' +
          '<div class="btn-row">' +
            '<button class="btn btn--ghost" data-no>Cancel</button>' +
            '<button class="btn" data-yes>Save</button>' +
          '</div>' +
        '</div>'
      );
      const input = wrap.querySelector('input');
      const sheet = openSheet(wrap, { title, icon: 'pencil' });
      setTimeout(() => { try { input.focus(); input.select(); } catch (e) {} }, 380);
      wrap.querySelector('[data-no]').addEventListener('click', () => { closeSheet(sheet); resolve(null); });
      const done = () => { const v = input.value.trim(); closeSheet(sheet); resolve(v || null); };
      wrap.querySelector('[data-yes]').addEventListener('click', done);
      input.addEventListener('keydown', (e) => { if (e.key === 'Enter') done(); });
    });
  }

  /* ---------- builders ---------- */
  function segment(options, current, onChange, block) {
    const seg = el('<div class="seg' + (block ? ' seg--block' : '') + '" role="tablist"></div>');
    options.forEach((o) => {
      const b = el('<button type="button" class="seg__opt" role="tab" aria-selected="' + (o.value === current) + '">' + esc(o.label) + '</button>');
      b.addEventListener('click', () => {
        seg.querySelectorAll('.seg__opt').forEach((x) => x.setAttribute('aria-selected', 'false'));
        b.setAttribute('aria-selected', 'true');
        PC.tg.haptic('select');
        onChange(o.value);
      });
      seg.appendChild(b);
    });
    return seg;
  }

  function switchControl(checked, onChange, label) {
    const sw = el('<button type="button" class="switch" role="switch" aria-checked="' + !!checked + '"' + (label ? ' aria-label="' + esc(label) + '"' : '') + '></button>');
    sw.addEventListener('click', () => {
      const next = sw.getAttribute('aria-checked') !== 'true';
      sw.setAttribute('aria-checked', next);
      PC.tg.haptic('light');
      onChange(next);
    });
    return sw;
  }

  function emptyState(iconName, title, desc, ctaHtml) {
    return el(
      '<div class="empty">' +
        '<div class="empty__icon">' + icon(iconName, 22) + '</div>' +
        '<div class="empty__title">' + esc(title) + '</div>' +
        (desc ? '<div class="empty__desc">' + esc(desc) + '</div>' : '') +
        (ctaHtml || '') +
      '</div>'
    );
  }

  /* ---------- file download ---------- */
  function mimeFromFilename(filename) {
    const ext = String(filename || '').toLowerCase().split('.').pop();
    if (ext === 'csv') return 'text/csv';
    if (ext === 'json') return 'application/json';
    if (ext === 'pdf') return 'application/pdf';
    if (ext === 'txt') return 'text/plain';
    return 'application/octet-stream';
  }

  function inTelegramMiniApp() {
    const tg = window.Telegram && window.Telegram.WebApp;
    return !!(tg || window.TelegramWebviewProxy || window.parent !== window);
  }

  async function shareFile(file) {
    if (!file || !navigator.share) return null;
    try {
      await navigator.share({ files: [file] });
      return true;
    } catch (e) {
      if (e && e.name === 'AbortError') return false;
    }
    try {
      if (!navigator.canShare || navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file] });
        return true;
      }
    } catch (e) {
      if (e && e.name === 'AbortError') return false;
    }
    return null;
  }

  async function download(blob, filename) {
    const type = (blob && blob.type) || mimeFromFilename(filename);
    const ext = '.' + String(filename || 'file').split('.').pop();
    const acceptType = type || 'application/octet-stream';
    const outBlob = blob instanceof Blob ? blob : new Blob([blob], { type: acceptType });
    const file = typeof File !== 'undefined'
      ? new File([outBlob], filename, { type: acceptType, lastModified: Date.now() })
      : null;

    if (inTelegramMiniApp()) {
      const shared = await shareFile(file);
      if (shared !== null) return shared;
    }

    if (window.showSaveFilePicker) {
      try {
        const handle = await window.showSaveFilePicker({
          suggestedName: filename,
          types: [{ description: 'Exported file', accept: { [acceptType]: [ext] } }]
        });
        const writable = await handle.createWritable();
        await writable.write(outBlob);
        await writable.close();
        return true;
      } catch (e) {
        if (e && e.name === 'AbortError') return false;
      }
    }

    if (file) {
      const shared = await shareFile(file);
      if (shared !== null) return shared;
    }

    try {
      const url = URL.createObjectURL(outBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.rel = 'noopener';
      a.target = '_blank';
      a.style.display = 'none';
      document.body.appendChild(a);
      a.click();
      setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 1200);
      return true;
    } catch (e) {}

    try {
      const dataUrl = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(outBlob);
      });
      const a = document.createElement('a');
      a.href = dataUrl;
      a.download = filename;
      a.rel = 'noopener';
      a.target = '_blank';
      a.style.display = 'none';
      document.body.appendChild(a);
      a.click();
      setTimeout(() => a.remove(), 800);
      return true;
    } catch (e) {
      return false;
    }
  }

  return { $, $$, esc, el, icon, fmtPips, fmtPct, fmtRatio, fmtDate, toast, openSheet, closeSheet, confirm, prompt, segment, switchControl, emptyState, download };
})();
