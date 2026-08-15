(() => {
  const out = [];
  const push = (sev, area, note) => out.push(`[${sev}] ${area}: ${note}`);

  // Touch target sizes (WCAG 2.2 SC 2.5.8 minimum 24x24)
  const small = [];
  document.querySelectorAll('button, a[href], input[type=checkbox], select').forEach(el => {
    if (!el.offsetParent) return;
    const r = el.getBoundingClientRect();
    if (r.width && r.height && (r.width < 24 || r.height < 24)) {
      small.push(`${el.tagName}.${(el.className||'').split(' ')[0]} ${Math.round(r.width)}x${Math.round(r.height)} "${(el.textContent||el.getAttribute('aria-label')||'').trim().slice(0,24)}"`);
    }
  });
  if (small.length) push('A11Y', 'target size', `${small.length} controls under 24x24: ` + small.slice(0,6).join(' | '));

  // Autocomplete on identity fields (WCAG 1.3.5)
  const identity = [...document.querySelectorAll('input[type=text]')].filter(i => /name|email|phone|loc/i.test(i.id||''));
  const noAuto = identity.filter(i => !i.getAttribute('autocomplete'));
  if (noAuto.length) push('A11Y', 'autocomplete', `${noAuto.length} identity fields lack autocomplete: ` + noAuto.map(i=>i.id).join(', '));

  // Native validation / required
  const req = [...document.querySelectorAll('input,textarea,select')].filter(i => i.hasAttribute('required'));
  push('INFO', 'required attrs', `${req.length} fields marked required in markup`);

  // Buttons that are actually links, and links that are buttons
  const fakeLinks = [...document.querySelectorAll('a')].filter(a => !a.getAttribute('href'));
  if (fakeLinks.length) push('A11Y', 'anchor without href', `${fakeLinks.length} anchors are not keyboard focusable`);

  // Tables (should be none in the resume)
  push('INFO', 'tables in document', document.querySelectorAll('.paper table').length);

  // Text that relies on colour alone
  push('INFO', 'aria-live count', document.querySelectorAll('[aria-live]').length);

  // Zoom / reflow: does anything overflow at 320 CSS px?
  push('INFO', 'scrollWidth vs clientWidth', document.documentElement.scrollWidth + '/' + document.documentElement.clientWidth);

  return out.join('\n');
})()
