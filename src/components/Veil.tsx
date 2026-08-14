import type { ReactNode } from "react";

/**
 * The modal shell.
 *
 * Escape and backdrop clicks both used to close these. Both were removed after
 * watching real use: people tab away to copy something, click back, and lose
 * what they typed. Every modal now closes only from its own explicit button.
 */
export function Veil({
  on,
  wide,
  className,
  children,
}: {
  on: boolean;
  wide?: boolean;
  className?: string;
  children: ReactNode;
}) {
  if (!on) return null;
  return (
    <div className="veil on">
      <div className={"modal" + (wide ? " wide" : "") + (className ? " " + className : "")}>{children}</div>
    </div>
  );
}
