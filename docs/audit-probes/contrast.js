(() => {
  const lum = (rgb) => {
    const [r, g, b] = rgb.map(v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const parse = (s) => { const m = s.match(/\d+(\.\d+)?/g); return m ? m.slice(0, 3).map(Number) : null; };
  const ratio = (a, b) => { const [L1, L2] = [lum(a), lum(b)].sort((x, y) => y - x); return (L1 + 0.05) / (L2 + 0.05); };

  const bgOf = (el) => {
    let e = el;
    while (e && e !== document.documentElement) {
      const c = getComputedStyle(e).backgroundColor;
      if (c && c !== 'rgba(0, 0, 0, 0)' && c !== 'transparent') return parse(c);
      e = e.parentElement;
    }
    return [255, 255, 255];
  };

  const seen = new Set();
  const rows = [];
  document.querySelectorAll('body *').forEach(el => {
    if (!el.offsetParent && el.tagName !== 'BODY') return;
    const txt = [...el.childNodes].filter(n => n.nodeType === 3).map(n => n.textContent.trim()).join('');
    if (!txt || txt.length < 2) return;
    const cs = getComputedStyle(el);
    const fg = parse(cs.color); const bg = bgOf(el);
    if (!fg || !bg) return;
    const size = parseFloat(cs.fontSize);
    const weight = parseInt(cs.fontWeight, 10) || 400;
    const large = size >= 24 || (size >= 18.66 && weight >= 700);
    const r = ratio(fg, bg);
    const need = large ? 3 : 4.5;
    const key = cs.color + '|' + bg.join(',') + '|' + Math.round(size);
    if (seen.has(key)) return; seen.add(key);
    if (r < need) rows.push(`FAIL ${r.toFixed(2)}:1 (need ${need}) ${Math.round(size)}px w${weight} "${txt.slice(0, 44)}" fg=${cs.color}`);
  });
  return rows.length ? rows.join('\n') : 'no contrast failures found on this view';
})()
