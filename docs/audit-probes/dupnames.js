(() => {
  const nameOf = (el) => (el.getAttribute('aria-label') || (el.labels && el.labels[0] && el.labels[0].textContent) || el.textContent || el.title || '').trim();
  const focusables = [...document.querySelectorAll('button, a[href], input, select, textarea')].filter(e => e.offsetParent);
  const counts = {};
  focusables.forEach(e => { const n = nameOf(e); counts[n] = (counts[n] || 0) + 1; });
  const dupes = Object.entries(counts).filter(([n, c]) => c > 1 && n).sort((a, b) => b[1] - a[1]);
  return 'Ambiguous repeated control names (a screen reader hears these identically):\n' +
    dupes.slice(0, 8).map(([n, c]) => `  ${c}x  "${n.slice(0, 60)}"`).join('\n');
})()
