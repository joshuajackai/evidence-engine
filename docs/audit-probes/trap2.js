(() => {
  const out = {};
  const veil = document.querySelector('.veil.on');
  out.modalOpen = !!veil;
  out.activeInModal = veil ? veil.contains(document.activeElement) : false;

  // aria-hidden: the dialog must NOT be hidden, its siblings MUST be.
  const root = veil?.parentElement;
  out.dialogHidden = veil ? veil.closest('[aria-hidden="true"]') !== null : null;
  out.hiddenSiblings = root ? [...root.children].filter(el => el !== veil && el.getAttribute('aria-hidden') === 'true').length : 0;
  out.totalSiblings = root ? root.children.length - 1 : 0;

  // Behavioural tab-trap test: dispatch Tab from the last focusable in the
  // dialog and see where focus lands.
  const focusable = [...veil.querySelectorAll('button, a[href], input, select, textarea')].filter(e => e.offsetParent);
  const last = focusable[focusable.length - 1];
  last.focus();
  const ev = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true });
  document.dispatchEvent(ev);
  out.tabFromLastPrevented = ev.defaultPrevented;
  out.focusAfterTab = (document.activeElement.textContent || '').trim().slice(0, 30);
  out.focusStillInModal = veil.contains(document.activeElement);
  return JSON.stringify(out, null, 1);
})()
