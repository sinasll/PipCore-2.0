/* PipCore v2.0 — canvas charts (equity curve), DPR-aware, palette-locked. */
window.PC = window.PC || {};

PC.charts = (() => {
  function cssVar(name) {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  }

  function fit(canvas) {
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    const rect = canvas.getBoundingClientRect();
    const w = Math.max(1, Math.round(rect.width * dpr));
    const h = Math.max(1, Math.round(rect.height * dpr));
    if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
    return { dpr, w: rect.width, h: rect.height };
  }

  /* points: [{x: label, y: number}] */
  function equity(canvas, points) {
    if (!canvas || !canvas.getContext) return;
    let ctx = null;
    try { ctx = canvas.getContext('2d'); } catch (e) { return; }
    if (!ctx) return;
    const { dpr, w, h } = fit(canvas);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    const fg = cssVar('--accent') || '#E6B33C';
    const faint = cssVar('--line-faint') || 'rgba(230,179,60,.12)';
    const dim = cssVar('--fg-dim') || 'rgba(230,179,60,.6)';

    if (!points || points.length === 0) {
      ctx.strokeStyle = faint;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(0, h / 2);
      ctx.lineTo(w, h / 2);
      ctx.stroke();
      ctx.setLineDash([]);
      return;
    }

    const L = 8, R = 8, T = 12, B = 18;
    const iw = w - L - R, ih = h - T - B;

    let min = Math.min.apply(null, points.map((p) => p.y).concat([0]));
    let max = Math.max.apply(null, points.map((p) => p.y).concat([0]));
    if (min === max) { min -= 1; max += 1; }
    const pad = (max - min) * 0.08;
    min -= pad; max += pad;

    const nx = (i) => L + (points.length === 1 ? iw / 2 : (i / (points.length - 1)) * iw);
    const ny = (v) => T + (1 - (v - min) / (max - min)) * ih;

    /* grid lines */
    ctx.strokeStyle = faint;
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 5]);
    for (let g = 0; g <= 3; g++) {
      const y = T + (g / 3) * ih;
      ctx.beginPath();
      ctx.moveTo(L, y);
      ctx.lineTo(w - R, y);
      ctx.stroke();
    }
    ctx.setLineDash([]);

    /* zero baseline */
    if (min < 0 && max > 0) {
      ctx.strokeStyle = dim;
      ctx.setLineDash([2, 4]);
      ctx.beginPath();
      ctx.moveTo(L, ny(0));
      ctx.lineTo(w - R, ny(0));
      ctx.stroke();
      ctx.setLineDash([]);
    }

    /* area fill */
    const grad = ctx.createLinearGradient(0, T, 0, T + ih);
    grad.addColorStop(0, hexToRgba(fg, 0.28));
    grad.addColorStop(1, hexToRgba(fg, 0.0));
    ctx.beginPath();
    ctx.moveTo(nx(0), ny(points[0].y));
    for (let i = 1; i < points.length; i++) ctx.lineTo(nx(i), ny(points[i].y));
    ctx.lineTo(nx(points.length - 1), T + ih);
    ctx.lineTo(nx(0), T + ih);
    ctx.closePath();
    ctx.fillStyle = grad;
    ctx.fill();

    /* line */
    ctx.beginPath();
    ctx.moveTo(nx(0), ny(points[0].y));
    for (let i = 1; i < points.length; i++) ctx.lineTo(nx(i), ny(points[i].y));
    ctx.strokeStyle = fg;
    ctx.lineWidth = 2;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.stroke();

    /* endpoints */
    ctx.fillStyle = fg;
    ctx.beginPath();
    ctx.arc(nx(points.length - 1), ny(points[points.length - 1].y), 3.5, 0, Math.PI * 2);
    ctx.fill();

    /* min/max labels */
    try {
      ctx.font = '7px "Press Start 2P", monospace';
      ctx.fillStyle = dim;
      ctx.textAlign = 'left';
      ctx.fillText(PC.ui.fmtPips(max - pad), L, T - 3);
      ctx.fillText(PC.ui.fmtPips(min + pad), L, h - 4);
    } catch (e) {}
  }

  function hexToRgba(hex, a) {
    const m = String(hex).replace('#', '');
    if (!/^[0-9a-f]{6}$/i.test(m)) return hex;
    const r = parseInt(m.slice(0, 2), 16);
    const g = parseInt(m.slice(2, 4), 16);
    const b = parseInt(m.slice(4, 6), 16);
    return `rgba(${r},${g},${b},${a})`;
  }

  return { equity };
})();
