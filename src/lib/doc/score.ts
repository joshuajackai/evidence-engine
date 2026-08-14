/* =========================================================================
   SCORING A WRITTEN DOCUMENT
   Same shape as the evidence matcher so the numbers mean the same thing
   everywhere: how much of the posting's vocabulary the text actually contains.

   A term the job TITLE names is what the first keyword screen filters on, so it
   counts three times. A term the posting repeats counts twice. Flat counting
   was letting a document skip the title skill and still read 90%+, which is
   exactly the miss a real screen punishes hardest.
   ========================================================================= */
import type { Job, WrittenDoc } from "@/types";
import { S } from "@/store/state";
import { GRADE, bullet, escapeRe } from "@/lib/util";
import { scoreUnit } from "@/lib/jd/match";
import { AI_STATE } from "@/lib/ai/client";

export function jdRequired(j: Job): string[] {
  return (j.kw || []).map((k) => k.k);
}

export function kwWeightFor(j: Job, term: string): number {
  try {
    const t = String(term).toLowerCase();
    if (String(j.title || "").toLowerCase().indexOf(t) >= 0) return 3;
    const pat = escapeRe(t);
    const m = String(j.text || "")
      .toLowerCase()
      .match(new RegExp("(?:^|[^a-z0-9+#/-])" + pat + "(?:s|es|ed|ing)?(?:$|[^a-z0-9+#/-])", "g"));
    if (m && m.length >= 2) return 2;
  } catch {
    /* a term that will not compile is simply worth one */
  }
  return 1;
}

/** Whole-word keyword presence. Substring matching pollutes the score. */
export function kwHitInText(text: string, kw: string): boolean {
  const low =
    " " + String(text || "").toLowerCase().replace(/[^a-z0-9+#./ -]/g, " ").replace(/\s+/g, " ") + " ";
  const pat = kw.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp("(?:^| |[^a-z0-9+#/-])" + pat + "(?:$| |[^a-z0-9+#/-])").test(low);
}

export function docText(doc: WrittenDoc | null | undefined): string {
  if (!doc) return "";
  return [
    doc.summary || "",
    (doc.skills || []).join(" "),
    (doc.roles || [])
      .map(
        (r) =>
          [r.org, r.role, r.dates].join(" ") + " " +
          (r.bullets || []).map((b) => (typeof b === "string" ? b : b.text)).join(" "),
      )
      .join(" "),
  ].join(" ");
}

export interface DocScore {
  pct: number;
  covered: string[];
  missing: string[];
}

export function scoreDoc(doc: WrittenDoc | null, j: Job): DocScore {
  const req = jdRequired(j);
  if (!req.length) return { pct: 0, covered: [], missing: [] };
  const hay = docText(doc);
  const covered: string[] = [];
  const missing: string[] = [];
  let tot = 0;
  let got = 0;
  req.forEach((t) => {
    const w = kwWeightFor(j, t);
    tot += w;
    if (kwHitInText(hay, t)) {
      covered.push(t);
      got += w;
    } else missing.push(t);
  });
  let pct = Math.round((got / Math.max(1, tot)) * 100);
  if (pct === 99 && !missing.length) pct = 100;
  return { pct, covered, missing };
}

/** Weighted match for a plain-text document, such as the generated Markdown. */
export function docMatchWeighted(text: string, j: Job): { pct: number; missing: string[] } {
  const req = jdRequired(j);
  if (!req.length) return { pct: 0, missing: [] };
  let tot = 0;
  let got = 0;
  const miss: string[] = [];
  req.forEach((t) => {
    const w = kwWeightFor(j, t);
    tot += w;
    if (kwHitInText(text || "", t)) got += w;
    else miss.push(t);
  });
  let pct = Math.round((got / Math.max(1, tot)) * 100);
  if (pct === 99 && !miss.length) pct = 100;
  return { pct, missing: miss };
}

/**
 * Close whatever the model left open. A resume cut off inside its last bullet
 * still contains most of a usable document, and throwing it away costs the user
 * a slow, paid call for nothing.
 */
function salvageJson(s: string): WrittenDoc | null {
  for (let cut = s.length; cut > 20; cut -= Math.max(1, Math.floor(cut / 400))) {
    const frag = s.slice(0, cut).replace(/,\s*$/, "");
    let st = false;
    let es = false;
    const stack: string[] = [];
    for (let k = 0; k < frag.length; k++) {
      const ch = frag[k];
      if (es) {
        es = false;
        continue;
      }
      if (ch === "\\") {
        es = true;
        continue;
      }
      if (ch === '"') {
        st = !st;
        continue;
      }
      if (st) continue;
      if (ch === "{") stack.push("}");
      else if (ch === "[") stack.push("]");
      else if (ch === "}" || ch === "]") stack.pop();
    }
    if (st) continue; // ended mid-string, back up further
    const closed = frag + stack.reverse().join("");
    try {
      const o = JSON.parse(closed);
      if (o && o.roles) return o as WrittenDoc;
    } catch {
      /* keep walking back */
    }
  }
  return null;
}

export function parseDocJson(txt: string): WrittenDoc {
  let s = String(txt || "").trim();
  s = s.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "");
  const a = s.indexOf("{");
  if (a < 0) throw new Error("The model replied with prose instead of JSON. Try a different model.");
  s = s.slice(a);

  let o: WrittenDoc | null = null;
  try {
    const b = s.lastIndexOf("}");
    if (b > 0) o = JSON.parse(s.slice(0, b + 1));
  } catch {
    /* fall through to the salvage pass */
  }
  if (!o) o = salvageJson(s);
  if (!o)
    throw new Error(
      "The reply was cut off before it could be read" +
        (AI_STATE.truncated
          ? " (the model hit its output limit even after the budget was raised). Try a model with a larger output limit, or trim your evidence list."
          : ". Try again."),
    );

  if (!o.roles || !o.roles.length) throw new Error("The reply contained no experience section.");
  o.roles.forEach((r) => {
    r.bullets = (r.bullets || [])
      .map((b) => (typeof b === "string" ? { text: b as unknown as string } : b))
      .filter((b) => b && b.text);
  });
  o.roles = o.roles.filter((r) => r.bullets.length || r.org);
  return o;
}

/**
 * The failing request carried 40,838 characters, most of it evidence that had
 * nothing to do with the posting. That is slow, expensive, and it dilutes the
 * model's attention across entries it should be ignoring. Send the entries that
 * actually bear on this job, ordered by relevance, and keep the numbering
 * stable so the `from` field still points somewhere real.
 */
export function writerDigest(j: Job | null): string {
  const kw = (j && j.kw) || [];
  const ranked = S.units.map((u, i) => ({ u, i: i + 1, s: kw.length ? scoreUnit(u, kw).s : 0 }));
  if (kw.length) ranked.sort((a, b) => b.s - a.s);
  const keep = ranked.slice(0, 45);
  /* Back to resume order so the model writes a chronology, not a ranking. */
  keep.sort((a, b) => a.i - b.i);
  let txt = keep
    .map((x) => {
      const u = x.u;
      return (
        x.i + ". [" + GRADE[u.metricType][2] + "] " + u.org + (u.role ? ", " + u.role : "") +
        (u.dates ? " (" + u.dates + ")" : "") + "\n   " + (u.action || "") +
        (u.metric ? "\n   Number: " + u.metric : "") +
        (u.constraint ? "\n   Held flat: " + u.constraint : "")
      );
    })
    .join("\n");
  if (ranked.length > keep.length)
    txt += "\n\n(" + (ranked.length - keep.length) + " further entries were omitted as unrelated to this posting.)";
  return txt;
}

export function evidenceDigest(): string {
  if (!S.units.length) return "(the user has not added any entries yet)";
  return S.units
    .map((u, i) =>
      i + 1 + ". [" + GRADE[u.metricType][2] + "] " + u.org + (u.role ? ", " + u.role : "") + "\n   " +
      (u.action || "") +
      (u.metric ? "\n   Number: " + u.metric : "") +
      (u.constraint ? "\n   Held flat: " + u.constraint : "") +
      (u.evidence ? "\n   Source: " + u.evidence : ""),
    )
    .join("\n");
}

/** The plain-text form of the current selection, for the text editor. */
export function resumeToText(): string {
  const h = S.hdr;
  const L: string[] = [];
  L.push(h.name || "Your Name");
  if (h.title) L.push(h.title);
  L.push([h.loc, h.phone, h.email].filter(Boolean).join(" | "));
  if (h.link) L.push("Portfolio: " + h.link);
  L.push("");
  if (h.summary) {
    L.push("# Summary");
    L.push(h.summary);
    L.push("");
  }
  const chosen = S.units.filter((u) => S.picked[u.id] !== false);
  if (S.jd.kw && S.jd.kw.length)
    chosen.sort((a, b) => scoreUnit(b, S.jd.kw).s - scoreUnit(a, S.jd.kw).s);
  const sk: Record<string, 1> = {};
  chosen.forEach((u) => (u.tags || []).forEach((t) => (sk[t] = 1)));
  if (Object.keys(sk).length) {
    L.push("# Skills");
    L.push(Object.keys(sk).join(", "));
    L.push("");
  }
  const by: Record<string, typeof chosen> = {};
  const ord: string[] = [];
  chosen.forEach((u) => {
    const k = u.org + "||" + (u.role || "");
    if (!by[k]) {
      by[k] = [];
      ord.push(k);
    }
    by[k].push(u);
  });
  if (ord.length) {
    L.push("# Experience");
    ord.forEach((k) => {
      const us = by[k];
      const f = us[0];
      L.push(f.org + (f.dates ? "  ::  " + f.dates : ""));
      if (f.role) L.push(f.role);
      us.forEach((u) => L.push("- " + bullet(u)));
      L.push("");
    });
  }
  return L.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}
