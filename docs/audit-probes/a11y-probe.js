(() => {
  const out = {};
  const q = (s) => [...document.querySelectorAll(s)];

  // 1. Focusable elements and their accessible names
  const focusables = q('a[href], button, input, select, textarea, [tabindex]:not([tabindex="-1"])')
    .filter(e => !e.disabled && e.offsetParent !== null);
  out.focusableCount = focusables.length;

  // 2. Controls with no accessible name at all
  const nameOf = (el) => (
    el.getAttribute('aria-label') ||
    (el.getAttribute('aria-labelledby') && document.getElementById(el.getAttribute('aria-labelledby'))?.textContent) ||
    (el.labels && el.labels[0] && el.labels[0].textContent) ||
    el.textContent || el.getAttribute('title') || el.getAttribute('placeholder') || ''
  ).trim();
  out.unnamed = focusables.filter(e => !nameOf(e)).map(e => e.tagName + '.' + (e.className || '') + '#' + (e.id || ''));

  // 3. Accessible names longer than 80 chars (hint text swallowed into the label)
  out.bloatedNames = focusables
    .map(e => ({ tag: e.tagName, id: e.id, n: nameOf(e).length, name: nameOf(e).slice(0, 60) }))
    .filter(x => x.n > 80);

  // 4. Inputs with no associated label element
  out.inputsNoLabel = q('input, select, textarea')
    .filter(e => e.type !== 'hidden' && !(e.labels && e.labels.length) && !e.getAttribute('aria-label') && !e.getAttribute('aria-labelledby'))
    .map(e => (e.id || e.name || e.placeholder || e.tagName));

  // 5. Heading order
  out.headings = q('h1,h2,h3,h4,h5,h6').map(h => h.tagName + ': ' + h.textContent.trim().slice(0, 42));

  // 6. Landmarks
  out.landmarks = {
    main: q('main').length, nav: q('nav').length, header: q('header').length,
    footer: q('footer').length, banner: q('[role=banner]').length,
  };

  // 7. Live regions
  out.liveRegions = q('[aria-live], [role=status], [role=alert]').map(e => e.tagName + ' ' + (e.className || ''));

  // 8. Dialogs
  out.dialogs = q('.veil, [role=dialog]').map(e => ({
    cls: e.className, role: e.getAttribute('role'), modal: e.getAttribute('aria-modal'),
    labelled: e.getAttribute('aria-label') || e.getAttribute('aria-labelledby'),
  }));

  // 9. lang
  out.lang = document.documentElement.lang;
  out.dir = document.documentElement.dir || '(not set)';

  // 10. Images without alt
  out.imgNoAlt = q('img').filter(i => !i.hasAttribute('alt')).length;
  out.svgNoTitle = q('svg').filter(s => !s.getAttribute('aria-hidden') && !s.querySelector('title') && !s.getAttribute('aria-label')).length;

  return JSON.stringify(out, null, 1);
})()
