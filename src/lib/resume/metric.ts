/* =========================================================================
   KPI EXTRACTION
   Importing every bullet as "No number yet" throws away the work the user
   already did. A bullet reading "lifted demo requests 41%" arrives quantified
   and should stay quantified.

   The one thing this must not do is claim provenance. A number found in a
   resume is the user's claim, not an audited fact, so nothing here is ever
   graded Proven. It lands on "My estimate" with a note asking where the number
   came from, and the user promotes it.
   ========================================================================= */
import type { MetricType } from "@/types";
import { BULLET_RE } from "./text";

/* Numbers that are not results. Years, dates, phone fragments, version and
   product names, and ordinary "24/7" style figures. */
const NOT_A_METRIC = [
  /\b(19|20)\d{2}\b/,
  /\b\d{1,2}\/\d{1,2}(\/\d{2,4})?\b/,
  /\b(ga|http|covid|iso|sect(ion)?|v)\s?-?\s?\d/i,
  /\bwindows|office|excel\s+\d/i,
];
const MONTHS = /\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s*$/i;

/* Ranked strongest first. An outcome beats a duration in the same sentence.
   The percent alternative deliberately has no trailing \b: "41%" followed by a
   space has no word boundary after the sign, so \b silently killed every
   percentage in the file, which is the most common resume metric there is. */
const METRIC_PATTERNS: { k: string; re: RegExp }[] = [
  { k: "pct", re: /\b\d[\d,]*(\.\d+)?\s?(?:%|percentage points?|percent\b|\bpp\b)/i },
  { k: "mult", re: /\b\d[\d,]*(\.\d+)?\s?x\b(?!\s?\d)/i },
  { k: "money", re: /[$£€]\s?\d[\d,]*(\.\d+)?\s?(k|m|bn|b|million|billion|mm)?\b/i },
  { k: "money", re: /\b(six|seven|eight|nine)[- ]figures?\b/i },
  { k: "money", re: /\b\d[\d,]*(\.\d+)?\s?(k|m|million|billion)\s+(in|of)\s+\w+/i },
  { k: "delta", re: /\bfrom\s+[\d.,]+\s?\w{0,4}\s+to\s+[\d.,]+\s?\w{0,4}/i },
  { k: "rank", re: /\b(?:top|no\.?|#|position|rank(?:ed)?)\s?\d+\b/i },
  { k: "count", re: /\b\d[\d,]{0,8}\+?[-\s]+(?=[a-z])/ },
];

/* "with no change to ad spend" is the most valuable half of a resume bullet and
   it belongs in the held-flat field, not buried in the sentence. */
const CONSTRAINT_RE = [
  /\b(?:with|at|on|and)\s+(?:no|zero)\s+(?:change|increase|additional|extra|added|new)\b[^.;]*/i,
  /\bwithout\s+(?:increasing|adding|raising|changing|any)\b[^.;]*/i,
  /\b(?:on\s+)?the\s+same\s+(?:budget|spend|headcount|team|staff|traffic|audience|price|pricing|product|store|licen[cs]e|resources?)\b[^.;]*/i,
  /\b(?:budget|spend|headcount|pricing|traffic|team)\s+(?:(?:stayed|remained|was|kept|held)\s+)?(?:flat|unchanged|the same)\b[^.;]*/i,
  /\bno\s+(?:extra|additional|new)\s+(?:spend|budget|headcount|hires?|tools?)\b[^.;]*/i,
];

export interface ExtractedMetric {
  type: MetricType;
  metric: string;
  constraint: string;
}

export function extractMetric(text: string): ExtractedMetric {
  const s = String(text || "").trim();
  const out: ExtractedMetric = { type: "none", metric: "", constraint: "" };
  if (!s) return out;

  CONSTRAINT_RE.some((re) => {
    const m = s.match(re);
    if (m) {
      out.constraint = tidyClause(m[0]);
      return true;
    }
    return false;
  });

  let hit: { kind: string; at: number; len: number } | null = null;
  for (let i = 0; i < METRIC_PATTERNS.length && !hit; i++) {
    const p = METRIC_PATTERNS[i];
    const re = new RegExp(p.re.source, "gi");
    let m: RegExpExecArray | null;
    while ((m = re.exec(s))) {
      if (!plausibleNumber(s, m)) continue;
      hit = { kind: p.k, at: m.index, len: m[0].length };
      break;
    }
  }
  if (!hit) return out;

  out.metric = tidyClause(clauseAround(s, hit.at, hit.len));
  if (!out.metric) return out;

  /* A count of things produced is volume, which the ladder ranks below a
     result. Everything else here is an outcome. */
  out.type = hit.kind === "count" ? "activity" : "estimated";
  return out;
}

function plausibleNumber(s: string, m: RegExpExecArray): boolean {
  const frag = m[0];
  for (let i = 0; i < NOT_A_METRIC.length; i++) if (NOT_A_METRIC[i].test(frag)) return false;
  /* "Jan 2023" and "Q3 2024" are dates wearing a number's clothes. */
  if (MONTHS.test(s.slice(Math.max(0, m.index - 6), m.index))) return false;
  /* A bare count needs a noun worth counting, not a duration or a team size. */
  if (/^\s*\d[\d,]*\+?[-\s]+$/.test(frag)) {
    const after = s.slice(m.index + frag.length, m.index + frag.length + 22).toLowerCase();
    if (/^(year|month|week|day|hour|minute|quarter|time|person|people|member|other|of\b)/.test(after))
      return false;
    /* Counting things that are not deliverables is not an achievement.
       "Worked across 4 departments" and "Attended 12 conferences" were both
       graded VOLUME, which tells a reader this candidate counts meetings. */
    if (
      /^(department|team|stakeholder|conference|event|meeting|call|client|colleague|report|direct|manager|office|location|country|region|market|language|award|certification|course|module|sprint|round|interview)/.test(
        after,
      )
    )
      return false;
    /* "a team of 5 designers" describes the room, not the result. */
    if (/\b(team|group|staff|crew|squad|department)\s+of\s+$/i.test(s.slice(Math.max(0, m.index - 16), m.index)))
      return false;
  }
  return true;
}

/**
 * Widen from the number to the clause that gives it meaning, and no further.
 * "41%" on its own is not a metric.
 */
function clauseAround(s: string, at: number, len: number): string {
  const lefts = [0];
  const rights = [s.length];
  [". ", "; ", ", ", ": "].forEach((d) => {
    const L = s.lastIndexOf(d, at);
    if (L > -1) lefts.push(L + d.length);
    const R = s.indexOf(d, at + len);
    if (R > -1) rights.push(R);
  });
  const start = Math.max(...lefts);
  const end = Math.min(...rights);
  let clause = s.slice(start, end);

  /* If the number sits after an "and", the first half is a different claim. */
  let rel = at - start;
  const andAt = clause.toLowerCase().lastIndexOf(" and ", rel);
  if (andAt > 0) {
    clause = clause.slice(andAt + 5);
    rel -= andAt + 5;
  }

  /* Everything after "by replacing..." is method, not result. Cut it. */
  const numEnd = rel + len;
  const lc = clause.toLowerCase();
  let cut = clause.length;
  [" by ", " while ", " after ", " through ", " using ", " via ", " thanks to ", " despite "].forEach((w) => {
    const k = lc.indexOf(w, numEnd);
    if (k < 0 || k >= cut) return;
    /* "adopted by 4 squads" carries a second quantity. Cutting there throws
       away half the metric and leaves a dangling participle. */
    if (/\d/.test(clause.slice(k, k + 34))) return;
    cut = k;
  });
  clause = clause.slice(0, cut);

  if (clause.length > 96) {
    const trimmed = clause.slice(0, 96);
    clause = trimmed.slice(0, Math.max(trimmed.lastIndexOf(" "), 60));
  }
  return clause;
}

export function tidyClause(c: string): string {
  const out = String(c || "")
    .replace(BULLET_RE, "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^(?:and|that|which|while|with|by|to|for|in)\s+/i, "")
    .replace(/[,;:]+$/, "")
    .trim();
  if (out.length < 4) return "";
  return out.charAt(0).toUpperCase() + out.slice(1);
}
