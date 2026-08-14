import type { MetricType, Unit } from "@/types";

/* Plain labels. The rigour is unchanged, the insider vocabulary is not. A job
   seeker does not know what "audited" means in this context and will not ask. */
export const GRADE: Record<MetricType, [cls: string, badge: string, label: string]> = {
  audited: ["a", "g-audited", "Proven"],
  estimated: ["e", "g-estimated", "My estimate"],
  activity: ["c", "g-activity", "Volume"],
  none: ["n", "g-none", "No number yet"],
};

export const GRADE_ORDER: MetricType[] = ["audited", "estimated", "activity", "none"];

export const GRADE_COLOUR: Record<MetricType, string> = {
  audited: "var(--audited)",
  estimated: "var(--estimated)",
  activity: "var(--activity)",
  none: "var(--none)",
};

/**
 * The metric and the constraint are often lifted out of the action sentence on
 * import, so appending them blindly printed the same clause twice. Append only
 * what the sentence does not already say.
 */
export function saysAlready(hay: string, needle: string): boolean {
  const flat = (s: string) =>
    String(s || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  const h = flat(hay);
  const n = flat(needle);
  return !n || h.indexOf(n) > -1;
}

/** Compose a bullet only from user-authored fields. Never generate. */
export function bullet(u: Unit): string {
  let out = (u.action || "").trim().replace(/\.+$/, "");
  if (u.metric && u.metricType !== "none" && !saysAlready(out, u.metric))
    out += ". " + u.metric.trim().replace(/\.+$/, "");
  if (u.constraint && !saysAlready(out, u.constraint))
    out += ". " + u.constraint.trim().replace(/\.+$/, "");
  return out ? out + "." : "";
}

export function appKey(url: string): string {
  return String(url || "").replace(/[?#].*$/, "").replace(/\/$/, "").toLowerCase();
}

export function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export function escapeRe(s: string): string {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function copyText(v: string): void {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(v).catch(() => fallbackCopy(v));
  } else fallbackCopy(v);
}

function fallbackCopy(v: string): void {
  const t = document.createElement("textarea");
  t.value = v;
  t.style.position = "fixed";
  t.style.opacity = "0";
  document.body.appendChild(t);
  t.select();
  try {
    document.execCommand("copy");
  } catch {
    /* nothing else to try */
  }
  document.body.removeChild(t);
}

export function downloadBlob(name: string, mime: string, body: string): void {
  const b = new Blob([body], { type: mime });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(b);
  a.download = name;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    URL.revokeObjectURL(a.href);
    a.remove();
  }, 400);
}

/** Escape for the few places a string still has to reach innerHTML. */
export function esc(s: unknown): string {
  return String(s == null ? "" : s).replace(/[&<>"']/g, (c) => {
    const map: Record<string, string> = {
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
    };
    return map[c];
  });
}

/** Decode the HTML entities boards escape their payloads with. */
export function decodeEntities(s: string): string {
  const t = document.createElement("textarea");
  t.innerHTML = String(s || "");
  return t.value;
}

/**
 * Greenhouse and several other boards return `content` as HTML-ESCAPED HTML,
 * so the payload literally reads &lt;p&gt;. Assigning that to innerHTML decodes
 * the entities into VISIBLE angle brackets, and innerText then hands the tags
 * back as ordinary words. Measured on a live posting: the two highest-frequency
 * "skills" the parser extracted were "/li" at 48 and "/strong" at 38.
 */
export function stripHtml(h: string): string {
  let t = String(h || "");
  if (/&lt;|&gt;|&amp;/.test(t)) {
    const probe = document.createElement("textarea");
    probe.innerHTML = t;
    t = probe.value;
  }
  const d = document.createElement("div");
  d.innerHTML = t;
  d.querySelectorAll("li").forEach((li) => {
    li.textContent = "• " + li.textContent;
  });
  d.querySelectorAll("p,li,div,br,h1,h2,h3,h4").forEach((el) => {
    el.insertAdjacentText("beforeend", "\n");
  });
  return (d.textContent || "").replace(/\n{3,}/g, "\n\n").trim();
}

export function relativeAge(ts: number | null | undefined): string {
  if (!ts) return "date unknown";
  const age = Math.round((Date.now() - ts) / 3600000);
  if (age < 1) return "under an hour ago";
  if (age < 24) return age + "h ago";
  return Math.round(age / 24) + "d ago";
}
