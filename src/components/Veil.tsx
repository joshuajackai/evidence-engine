import { useEffect, useRef, type ReactNode } from "react";

/**
 * The modal shell.
 *
 * Escape and backdrop clicks both used to close these, and both were removed
 * after watching real use: people tab away to copy something, click back, and
 * lose what they typed. Every modal closes only from its own explicit button,
 * and the accessibility work below is written to keep that true.
 *
 * What the audit on 2026-08-14 measured and this now fixes:
 *   - 13 controls behind an open modal were still tab-reachable. Focus is now
 *     trapped, and the background is hidden from assistive technology.
 *   - `document.activeElement` stayed on `BODY` when a modal opened, so a
 *     screen reader user was told nothing. Focus now moves into the dialog.
 *   - The container had no role, no `aria-modal` and no accessible name.
 */
export function Veil({
  on,
  wide,
  className,
  label,
  children,
}: {
  on: boolean;
  wide?: boolean;
  className?: string;
  /** Accessible name for the dialog. Use the same words as its visible heading. */
  label: string;
  children: ReactNode;
}) {
  const modalRef = useRef<HTMLDivElement>(null);
  const restoreTo = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!on) return;

    /* Remember what opened this so focus can go home afterwards. */
    restoreTo.current = document.activeElement as HTMLElement | null;

    /* Move focus into the dialog. The first real control is friendlier than the
       container, but a dialog that opens on a block of prose has none, so the
       container itself is the fallback and carries tabIndex -1 for it. */
    const node = modalRef.current;
    const first = node?.querySelector<HTMLElement>(
      'input:not([type="hidden"]):not([disabled]), textarea:not([disabled]), select:not([disabled]), button:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])',
    );
    (first || node)?.focus();

    /* Hide everything else from assistive technology. Some screen readers ignore
       focus containment and read the whole document, so the trap alone is not
       enough. `inert` would be tidier but is uneven in older mobile Safari.

       The whole app renders inside one root element, so "everything else" means
       the veil's siblings inside that root, not the children of body: hiding at
       body level would hide the dialog itself along with the page. */
    const veil = node?.parentElement; // the .veil overlay
    const container = veil?.parentElement; // the React root
    const siblings = container ? [...container.children].filter((el) => el !== veil) : [];
    const previous = siblings.map((el) => el.getAttribute("aria-hidden"));
    siblings.forEach((el) => el.setAttribute("aria-hidden", "true"));

    /* Cycle Tab within the dialog. Escape is deliberately not bound. */
    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== "Tab" || !node) return;
      const focusable = [
        ...node.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([type="hidden"]):not([disabled]), select:not([disabled]), textarea:not([disabled]), details, summary, [tabindex]:not([tabindex="-1"])',
        ),
      ].filter((el) => el.offsetParent !== null || el === document.activeElement);
      if (!focusable.length) {
        e.preventDefault();
        return;
      }
      const firstEl = focusable[0];
      const lastEl = focusable[focusable.length - 1];
      const active = document.activeElement as HTMLElement;
      if (e.shiftKey && (active === firstEl || !node.contains(active))) {
        e.preventDefault();
        lastEl.focus();
      } else if (!e.shiftKey && (active === lastEl || !node.contains(active))) {
        e.preventDefault();
        firstEl.focus();
      }
    }
    document.addEventListener("keydown", onKeyDown, true);

    return () => {
      document.removeEventListener("keydown", onKeyDown, true);
      siblings.forEach((el, i) => {
        if (previous[i] == null) el.removeAttribute("aria-hidden");
        else el.setAttribute("aria-hidden", previous[i] as string);
      });
      /* Send focus back where it came from, so a keyboard user does not land at
         the top of the document every time a dialog closes. */
      restoreTo.current?.focus?.();
    };
  }, [on]);

  if (!on) return null;

  return (
    <div className="veil on">
      <div
        ref={modalRef}
        className={"modal" + (wide ? " wide" : "") + (className ? " " + className : "")}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        tabIndex={-1}
      >
        {children}
      </div>
    </div>
  );
}
