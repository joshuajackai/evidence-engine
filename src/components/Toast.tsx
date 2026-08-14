export function Toast({ text, on }: { text: string; on: boolean }) {
  return <div className={"toast" + (on ? " on" : "")}>{text}</div>;
}

/** The small inline status line used all over the app. */
export function Msg({
  kind,
  children,
}: {
  kind?: "" | "good" | "bad" | "warn";
  children?: React.ReactNode;
}) {
  if (!children) return null;
  return <div className={"msg on" + (kind ? " " + kind : "")}>{children}</div>;
}

export function Spinner() {
  return <span className="spin" />;
}
