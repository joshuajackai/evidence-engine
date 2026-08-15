(() => {
  const out = {};
  const veil = document.querySelector('.veil.on');
  out.modalOpen = !!veil;
  out.activeElementOnOpen = document.activeElement
    ? document.activeElement.tagName + '.' + (document.activeElement.className || '') + ' "' + (document.activeElement.textContent || '').trim().slice(0, 30) + '"'
    : 'none';
  out.activeIsBody = document.activeElement === document.body;

  // Can focus reach content BEHIND the open modal? (focus trap check)
  const all = [...document.querySelectorAll('a[href], button, input, select, textarea, [tabindex]:not([tabindex="-1"])')]
    .filter(e => !e.disabled && e.offsetParent !== null);
  const inModal = all.filter(e => veil && veil.contains(e));
  const outsideModal = all.filter(e => !veil || !veil.contains(e));
  out.focusableInsideModal = inModal.length;
  out.focusableOutsideModalStillReachable = outsideModal.length;
  out.focusTrapPresent = outsideModal.length === 0;

  // Is the background inert / aria-hidden?
  const main = document.querySelector('main');
  out.backgroundInert = !!(main && (main.hasAttribute('inert') || main.getAttribute('aria-hidden') === 'true'));

  // Focus-visible styling present anywhere?
  out.focusVisibleRules = [...document.styleSheets].flatMap(ss => {
    try { return [...ss.cssRules].map(r => r.selectorText || ''); } catch (e) { return []; }
  }).filter(s => s && (s.includes(':focus-visible') || s.includes(':focus'))).slice(0, 8);

  // prefers-reduced-motion honoured?
  out.reducedMotionRules = [...document.styleSheets].flatMap(ss => {
    try { return [...ss.cssRules].filter(r => r.conditionText).map(r => r.conditionText); } catch (e) { return []; }
  }).filter(c => c.includes('reduced-motion'));

  return JSON.stringify(out, null, 1);
})()
