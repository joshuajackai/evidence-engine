/* =========================================================================
   ROLE FAMILIES
   Literal token matching misses that "Growth Marketing Manager", "Demand
   Generation Lead" and "Performance Marketing Manager" are one job. Each line
   below is a family: match any member and you match the family. This runs with
   no model connected, so every user gets it.
   ========================================================================= */
import { escapeRe } from "@/lib/util";
import { S } from "@/store/state";
import { STOP } from "@/lib/jd/vocab";
import type { Listing } from "@/types";
import { levelOf, myLevel } from "@/lib/resume/profile";

export const FAMILIES: string[][] = [
  ["growth marketing", "demand generation", "demand gen", "performance marketing", "user acquisition",
   "paid acquisition", "growth", "acquisition marketing", "paid media", "media buying", "paid social",
   "performance media", "digital marketing", "online marketing"],
  ["web designer", "web design", "ui designer", "ui design", "digital designer", "interface designer",
   "product designer", "visual designer", "interaction designer", "ux designer", "ux/ui", "front end designer"],
  ["brand designer", "brand design", "graphic designer", "visual identity", "art director", "creative director",
   "brand identity", "creative lead", "design lead"],
  ["content marketing", "content strategy", "content strategist", "editorial", "copywriter", "copywriting",
   "content design", "seo content", "content manager"],
  ["seo", "search engine optimization", "organic search", "organic growth", "aeo", "geo",
   "answer engine optimization", "generative engine optimization", "search optimization"],
  ["operations analyst", "business analyst", "data analyst", "business operations", "process analyst",
   "operations manager", "business intelligence", "analytics", "reporting analyst", "revenue operations",
   "marketing operations", "sales operations"],
  ["project manager", "program manager", "delivery manager", "scrum master", "project coordinator",
   "program lead", "technical program manager"],
  ["product manager", "product owner", "product lead", "product marketing"],
  ["software engineer", "developer", "programmer", "full stack", "backend", "front end", "frontend",
   "web developer", "application developer", "software developer"],
  ["data engineer", "analytics engineer", "etl", "data pipeline", "data platform"],
  ["data scientist", "machine learning", "ml engineer", "ai engineer", "applied scientist"],
  ["customer success", "account manager", "client services", "customer experience", "client partner",
   "relationship manager", "account executive", "customer support"],
  ["recruiter", "talent acquisition", "talent partner", "sourcer", "people operations", "human resources",
   "hr", "people partner", "talent"],
  ["finance", "accountant", "accounting", "controller", "fp&a", "financial analyst", "bookkeeping", "treasury"],
  ["social media", "community manager", "social media manager", "influencer marketing", "community"],
  ["email marketing", "lifecycle marketing", "crm marketing", "retention marketing", "marketing automation"],
  ["video editor", "motion designer", "videographer", "video producer", "post production", "animator"],
  ["supply chain", "logistics", "procurement", "vendor management", "inventory", "fulfilment", "fulfillment"],
  ["quality assurance", "qa", "test engineer", "sdet", "quality engineer"],
  ["security", "cybersecurity", "infosec", "application security", "security engineer", "appsec"],
  ["devops", "site reliability", "sre", "platform engineer", "infrastructure", "cloud engineer"],
  ["teacher", "instructor", "educator", "trainer", "curriculum", "learning and development", "training"],
  ["nurse", "clinical", "registered nurse", "patient care", "healthcare", "medical assistant"],
  ["sales", "business development", "partnerships", "revenue", "enterprise sales", "inside sales"],
  ["stakeholder management", "cross functional", "cross-functional", "collaboration", "people leadership",
   "team leadership", "stakeholder", "partner management", "people management"],
];

const FAM_INDEX: Record<string, number[]> = (() => {
  const idx: Record<string, number[]> = {};
  FAMILIES.forEach((fam, i) => {
    fam.forEach((term) => {
      (idx[term] = idx[term] || []).push(i);
    });
  });
  return idx;
})();

/** Expand a set of terms into every family member they touch. */
export function expandTerms(terms: string[]): string[] {
  const out: Record<string, 1> = {};
  const fams: Record<number, 1> = {};
  terms.forEach((raw) => {
    const t = String(raw || "").toLowerCase().trim();
    if (!t) return;
    out[t] = 1;
    Object.keys(FAM_INDEX).forEach((key) => {
      if (t === key || t.indexOf(key) > -1 || key.indexOf(t) > -1) {
        if (key.length > 3 || t === key)
          FAM_INDEX[key].forEach((i) => {
            fams[i] = 1;
          });
      }
    });
  });
  Object.keys(fams).forEach((i) => {
    FAMILIES[Number(i)].forEach((m) => {
      out[m] = 1;
    });
  });
  return Object.keys(out);
}

export interface ProfileTerms {
  tags: string[];
  titles: string[];
  /** Everything the profile means, not only what it literally says. */
  wide: string[];
}

export function profileTerms(extra: string): ProfileTerms {
  const tags: Record<string, 1> = {};
  const titles: Record<string, 1> = {};
  S.units.forEach((u) => {
    (u.tags || []).forEach((x) => {
      const v = String(x).toLowerCase().trim();
      if (v.length > 2) tags[v] = 1;
    });
    if (u.role) titles[String(u.role).toLowerCase()] = 1;
  });
  (extra || "").split(",").forEach((raw) => {
    const s = raw.trim().toLowerCase();
    if (s.length > 2) tags[s] = 1;
  });
  const rawTags = Object.keys(tags);
  const rawTitles = Object.keys(titles);
  return { tags: rawTags, titles: rawTitles, wide: expandTerms(rawTags.concat(rawTitles)) };
}

/* Cheap and deliberately conservative. Only fires on markers that essentially
   never appear in an English-language job title. */
const FOREIGN =
  /\b(m\/w\/d|w\/m\/d|h\/f|mitarbeiter|fachkraft|vertrieb|einkauf|leiter|leitung|kaufmann|kauffrau|praktikum|ausbildung|stellvertretende|betreuung|entwickler|berater|referent|sachbearbeiter|responsable|chargé|chargée|développeur|ingénieur|stagiaire|alternance|responsabile|sviluppatore|desarrollador|ingeniero|comercial|prácticas|medewerker|adviseur|ontwikkelaar|stagiair)\b/i;

export function foreignLanguage(title: string): boolean {
  const t = String(title || "");
  if (FOREIGN.test(t)) return true;
  if (/[äöüßàâçéèêëîïôùûœñãõ]/i.test(t) && !/\b(cafe|resume|role)\b/i.test(t)) return true;
  return false;
}

/**
 * Score a listing against the user's own graded evidence.
 *
 * Scoring a LISTING is not the same problem as scoring a full job description.
 * A board's list endpoint gives a title and a location, nothing else, so this
 * is a pre-screen and the UI says so. Two signals only, both absolute rather
 * than relative to the best row in the batch: an early version normalised
 * against the top scorer and happily showed 100% for a German Werkstudent role
 * that shared exactly one word with the profile.
 */
export function scoreListing(job: Listing, prof: ProfileTerms): { pct: number; hits: string[] } {
  const hay = (job.title + " " + job.loc).toLowerCase();
  const hits = prof.tags.filter((t) => new RegExp("\\b" + escapeRe(t), "i").test(hay));
  /* Family matches: the listing uses a different word for the same job. These
     are what turn a literal miss into a real match. */
  const famHits = prof.wide.filter((t) => hits.indexOf(t) < 0 && t.length > 3 && hay.indexOf(t) > -1);
  /* Title affinity: how much of one of the user's own role titles appears in
     the listing title. This is what stops a single shared generic word scoring
     high. */
  const tw = job.title
    .toLowerCase()
    .split(/[^a-z0-9+#]+/)
    .filter((w) => w.length > 3 && STOP.indexOf(w) < 0);
  let best = 0;
  prof.titles.forEach((rt) => {
    const rw = rt.split(/[^a-z0-9+#]+/).filter((w) => w.length > 3 && STOP.indexOf(w) < 0);
    if (!rw.length) return;
    let o = rw.filter((w) => tw.indexOf(w) > -1).length / rw.length;
    if (rw.length === 1) o = o * 0.5; // a one-word title match is weak evidence
    best = Math.max(best, o);
  });
  /* How much of the LISTING title the profile explains, as well as how much of
     the profile the listing reflects. One-directional matching made a two-word
     title score the same as a six-word one. */
  const vocab: Record<string, 1> = {};
  prof.wide.forEach((t) =>
    t.split(/\s+/).forEach((w) => {
      if (w.length > 3 && STOP.indexOf(w) < 0) vocab[w] = 1;
    }),
  );
  const inter = tw.filter((w) => vocab[w]);
  const cover = tw.length ? inter.length / tw.length : 0;
  const denom = Math.max(3, Math.min(prof.tags.length, 8));
  const tagPart = prof.tags.length ? Math.min(1, (hits.length + famHits.length * 0.7) / denom) : 0;
  const famPart = Math.min(1, famHits.length / 3);
  let pct = Math.round(Math.min(1, tagPart * 0.34 + best * 0.26 + cover * 0.22 + famPart * 0.18) * 100);

  /* Two floors, both added after watching real results.
     A listing with no direct skill hit at all is not a strong fit however well
     its title happens to rhyme with the user's. And a posting written in a
     language the user's resume is not in is noise, not a near miss. */
  if (!hits.length) pct = Math.min(pct, 40);
  if (foreignLanguage(job.title)) pct = Math.min(pct, 20);

  return { pct, hits: hits.concat(famHits.slice(0, 4)) };
}

export function band(p: number): [label: string, cls: string] {
  if (p >= 50) return ["Strong", "hi"];
  if (p >= 28) return ["Possible", ""];
  return ["Weak", ""];
}

/** Collapse the same job posted under slightly different titles on three boards. */
export function dedupeKey(j: Listing): string {
  const t = (j.title || "")
    .toLowerCase()
    .replace(/\(.*?\)|\[.*?\]/g, " ") // (Remote), [Contract]
    .replace(/\b(?:req|requisition|job|id)[\s#:-]*\w*\d\w*/g, " ")
    .replace(/\b(i{1,3}|iv|v|1|2|3|4)\b/g, " ") // levels: Engineer II
    /* Boards append the work mode and the city after a dash or comma. Same
       role, different suffix, and without this it counts as two. */
    .replace(
      /[-–—,|]\s*(remote|hybrid|on ?site|in ?office|us|usa|united states|uk|canada|emea|apac|anywhere|full[\s-]?time|part[\s-]?time|contract|temporary|permanent|w2|1099)\b.*$/g,
      " ",
    )
    .replace(/\b(remote|hybrid|onsite|on site)\b/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
  return (j.co || "").toLowerCase().replace(/[^a-z0-9]/g, "") + "|" + t;
}

/**
 * A percentage tells the user nothing they can act on. A sentence naming the
 * overlap does, and it costs one line on the card instead of a click.
 */
export function whyMatched(j: Listing): string {
  const hits = j.hits || [];
  const n = hits.length;
  if (!n) return "Matched on the role title only.";
  const lvl = levelOf(j.title);
  const mine = myLevel();
  const same = lvl && mine >= 0 && lvl.n === mine;
  const head = n >= 5 ? "Strong overlap: " : n >= 3 ? "Overlaps on " : "Some overlap: ";
  const list = hits.slice(0, 3).join(", ") + (n > 3 ? " and " + (n - 3) + " more" : "");
  return head + list + (same ? ", and it is pitched at your level." : ".");
}
