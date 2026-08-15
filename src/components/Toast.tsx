import type { ReactNode } from "react";

/**
 * The toast.
 *
 * `role="status"` with `aria-live="polite"` because the audit measured zero live
 * regions on every step: the toast is how this tool confirms an entry saved and
 * reports what the importer changed, and none of it reached a screen reader.
 * Polite rather than assertive so it waits for the user to finish typing.
 */
export function Toast({ text, on }: { text: string; on: boolean }) {
  return (
    <div className={"toast" + (on ? " on" : "")} role="status" aria-live="polite" aria-atomic="true">
      {text}
    </div>
  );
}

/**
 * The inline status line used throughout the app.
 *
 * An error interrupts, because it is the answer to something the user just did
 * and the next thing they do depends on it. Everything else is polite.
 */
export function Msg({
  kind,
  children,
  id,
}: {
  kind?: "" | "good" | "bad" | "warn";
  children?: ReactNode;
  id?: string;
}) {
  if (!children) return null;
  const isError = kind === "bad";
  return (
    <div
      id={id}
      className={"msg on" + (kind ? " " + kind : "")}
      role={isError ? "alert" : "status"}
      aria-live={isError ? "assertive" : "polite"}
    >
      {children}
    </div>
  );
}

/**
 * The spinner is decorative: every place that shows one also shows text saying
 * what is happening, and that text is what a screen reader should read.
 */
export function Spinner() {
  return <span className="spin" aria-hidden="true" />;
}

/** Visually hidden text, for names a sighted user gets from position or icon. */
export function SrOnly({ children }: { children: ReactNode }) {
  return <span className="sr-only">{children}</span>;
}
