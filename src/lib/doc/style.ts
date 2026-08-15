/* =========================================================================
   THE BULLET STYLE CONTRACT

   Ported 2026-08-14 from the autopacket pipeline's bullet-style.json v1.1.0,
   the single source of truth that pipeline's linter, prompts and human docs
   all read. The same discipline applies here: these lists exist ONCE, and the
   writer prompts, the deterministic lint and the on-page suggestions all call
   this module. Re-typing a rule in two places is how the source pipeline once
   deleted three correct job boards, so do not.

   The doctrine, in one line: a bullet earns its place by being falsifiable.
   Verb, object, mechanism, number. If a hiring manager cannot ask a follow-up
   question about it, delete it.

   The defect this prevents: outcome without mechanism. A generator that knows
   the result but not how it happened fills the gap with adjectives, and that
   is what reads as AI.
   ========================================================================= */

/* ---------- the discipline-verb rule ----------
   The lead verb names the DISCIPLINE that was deployed, never the act of
   making. "Built", "Made", "Created" and "Delivered" all say that a thing came
   to exist and hide which skill produced it.

   The test: read the verb phrase alone, with the object removed. A recruiter
   should be able to name the job title it came from. "Built the landing pages"
   could be a designer, a developer, a PM or a founder. "Front-end developed
   the WordPress landing pages" can only be one of them.

   Why it costs money: a generic verb averages several disciplines into "makes
   things", which is the profile of a generalist and prices like one. */

export const DISCIPLINE_VERB_RULE =
  "The lead verb of every bullet names the DISCIPLINE deployed, never the act of making. " +
  "Built, Made, Created, Delivered, Developed and Implemented all say a thing came to exist " +
  "and hide which skill produced it. Write the verb a recruiter could name a job title from: " +
  "Conducted user research, Designed the wireframes, Front-end developed the landing pages, " +
  "Copywrote, Art-directed, Configured, Media-bought, Diagnosed. A vague verb is rescued only " +
  "by a qualifier that restores the discipline, and the qualifier leads the bullet: " +
  "Front-end developed, Back-end developed, Full-stack developed, Business developed.";

/** Hard-banned bullet openers. Merges the contract's banned_lead with the
    vague_lead_hard list from the verb-precision rule; deduplicated. */
export const BANNED_LEAD_VERBS: string[] = [
  "Actively", "Assisted", "Build", "Built", "Championed", "Collaborated", "Consistently",
  "Create", "Created", "Deliver", "Delivered", "Develop", "Developed", "Did", "Drove",
  "Effectively", "Empowered", "Engaged", "Enhanced", "Executed", "Facilitated", "Fostered",
  "Handled", "Helped", "Implement", "Implemented", "Leveraged", "Liaised", "Made", "Make",
  "Optimised", "Optimized", "Orchestrated", "Oversaw", "Owned", "Participated", "Proactively",
  "Produce", "Produced", "Responsibilities", "Responsible", "Spearheaded", "Strategically",
  "Streamlined", "Successfully", "Supported", "Tasked", "Utilised", "Utilized", "Worked",
];

/** Weak openers worth flagging but not failing. From vague_lead_warn. */
export const WARN_LEAD_VERBS: string[] = [
  "Ran", "Managed", "Led", "Handled", "Set", "Put", "Performed", "Applied",
  "Contributed", "Took", "Moved", "Kept", "Turned",
];

/** A representative slice of the contract's 174 approved leads, for prompts.
    Chosen to span disciplines rather than to be complete; the full authority
    stays in the source contract. */
export const APPROVED_LEAD_SAMPLE: string[] = [
  "Conducted", "Designed", "Wireframed", "Prototyped", "Front-end developed", "Back-end developed",
  "Coded", "Refactored", "Migrated", "Rebuilt", "Configured", "Automated", "Diagnosed", "Traced",
  "Copywrote", "Rewrote", "Edited", "Art-directed", "Storyboarded", "Illustrated",
  "Media-bought", "A/B tested", "Segmented", "Retargeted", "Negotiated", "Closed", "Recruited",
  "Interviewed", "Usability-tested", "Benchmarked", "Audited", "Documented", "Trained", "Mentored",
];

/**
 * The exception the contract carves out: "Produced" passes only where
 * production is literally the discipline. These nouns are the evidence.
 */
export const PRODUCED_NOUNS = /\b(video|film|shoot|episode|spot|broadcast|print run|podcast|commercial|documentary)\b/i;

/* ---------- banned phrases, by group ----------
   From the contract's banned_phrases. Grouped because the lint message should
   say WHY a phrase is banned, not just that it is. */

export const HEDGES: string[] = [
  "responsible for", "helped to", "assisted with", "worked on", "worked with", "involved in",
  "part of a team", "contributed to the success", "played a key role", "tasked with",
  "duties included", "in charge of", "supported the",
];

export const VAGUE_QUANTITY: string[] = [
  "various", "several", "multiple", "numerous", "many", "a range of", "a variety of",
  "a number of", "countless", "significant", "substantial", "considerable", "dramatic",
  "massive", "huge", "major improvements",
];

export const ASSERTED_ADJECTIVES: string[] = [
  "results-driven", "results-oriented", "detail-oriented", "self-starter", "go-getter",
  "team player", "passionate", "motivated", "hard-working", "innovative", "creative thinker",
  "highly skilled", "seasoned", "world-class", "best-in-class", "top-tier", "expert-level",
  "proven track record", "dynamic professional",
];

/* ---------- structure ---------- */

/** Bullet length bounds from the contract. Words, not characters. */
export const BULLET_WORDS_MIN = 12;
export const BULLET_WORDS_MAX = 28;

/**
 * The six bullet frames, as prompt text. F1 is the default; the others exist
 * because not every true thing fits one shape.
 */
export const BULLET_FRAMES_PROMPT =
  "Shape every bullet on one of these frames, F1 by default:\n" +
  "F1 intervention: VERB + OBJECT + (by|using|via) MECHANISM; RESULT.\n" +
  "F2 constrained win: VERB + RESULT + (despite|while|without) COUNTERFORCE + (using|via) MECHANISM. " +
  "Use when the raw number looks small; the constraint is what makes it impressive.\n" +
  "F3 baseline delta: VERB + OBJECT + from BASELINE to AFTER + scope. A stated starting point is " +
  "the least fakeable thing on a resume.\n" +
  "F4 capability unlock: VERB + COMPONENT + to enable SPEC + while SECOND_EFFECT.\n" +
  "F5 defect elimination: VERB + DEFECT + and + VERB + RESTORED STATE + via MECHANISM.\n" +
  "F6 scope and scale: VERB + QUANTIFIED NOUN + OBJECT + using TOOLSET.\n" +
  "The mechanism and every numeral are RETRIEVED from the user's entries, never generated. " +
  "If the source does not hold a mechanism, write the outcome alone rather than inventing how.";

/** Mechanics and numerals, as prompt text. */
export const MECHANICS_PROMPT =
  "Bullet mechanics: no first person anywhere, no I, my, me, we, our. Past tense for finished " +
  "work; present tense only for a current role's ongoing duties. Drop leading articles: " +
  '"Rebuilt checkout flow", not "Rebuilt the entire checkout experience". Keep bullets between ' +
  BULLET_WORDS_MIN + " and " + BULLET_WORDS_MAX + " words. No lead verb repeats within one role. " +
  "Report every number exactly as the source holds it: 55.03x, not 55x, because precision is the " +
  "signal that a real measurement happened. Percent sign with no space. Currency symbol with scale " +
  "suffix, $900K. At most two results per bullet.";

/* ---------- helpers the lint and suggestions call ---------- */

const bannedLeadRe = new RegExp(
  "^(" + BANNED_LEAD_VERBS.map((v) => v.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|") + ")\\b",
  "i",
);
const warnLeadRe = new RegExp(
  "^(" + WARN_LEAD_VERBS.map((v) => v.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|") + ")\\b",
  "i",
);

export interface LeadVerbVerdict {
  level: "ok" | "warn" | "banned";
  verb: string;
}

/**
 * Judge the opening verb of one bullet. "Produced" is rescued when a
 * production noun appears in the sentence, per the contract's exception, and
 * a qualified form such as "Front-end developed" is checked before the bare
 * "Developed" inside it can fail.
 */
export function judgeLeadVerb(bullet: string): LeadVerbVerdict {
  const text = String(bullet || "").trim().replace(/^[-•*]\s*/, "");
  if (!text) return { level: "ok", verb: "" };
  /* Qualified forms lead with the qualifier, so they never match the banned
     regex, which is anchored at the start. "Front-end developed" begins with
     "Front-end", not "Developed". */
  const m = text.match(bannedLeadRe);
  if (m) {
    if (/^produced?\b/i.test(m[1]) && PRODUCED_NOUNS.test(text)) return { level: "ok", verb: m[1] };
    return { level: "banned", verb: m[1] };
  }
  const w = text.match(warnLeadRe);
  if (w) return { level: "warn", verb: w[1] };
  return { level: "ok", verb: "" };
}

/** Every bullet-like line of a Markdown document, for whole-document lint. */
export function bulletsOf(md: string): string[] {
  return String(md || "")
    .split(/\r?\n/)
    .filter((l) => /^\s*[-•*]\s+/.test(l))
    .map((l) => l.replace(/^\s*[-•*]\s+/, "").trim());
}
