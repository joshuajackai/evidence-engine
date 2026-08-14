/* =========================================================================
   KEYWORD EXTRACTION AND WEIGHTING

   The first version counted every non-stopword token and used raw frequency as
   importance: score += frequency * 2. Measured on a live Senior Marketing
   Manager posting, the top fifteen "skills" it produced were:

     /li 48, /strong 38, webflow 17, marketing 14, /ul 10, web 9,
     webflow.com 9, /em 9, growth 8, pipeline 8, href 8, site 8,
     aeo 7, https 7, without 6

   Eight of the top fifteen were HTML markup or the employer's own name. "/li"
   was worth 96 points per hit and no resume will ever contain it. "aeo", the
   single most important requirement in that posting, sat thirteenth.

   Three things were wrong and all three are fixed here.

   1. THE EMPLOYER'S NAME IS NOT A SKILL. It was scored, and reported as a gap,
      so a candidate was docked for not having previously worked at the company
      they are applying to.
   2. FREQUENCY IS NOT IMPORTANCE, it is close to the opposite. A requirement is
      usually stated once. Boilerplate repeats.
   3. MARKUP AND URLS ARE NOT WORDS.
   ========================================================================= */
import type { Keyword } from "@/types";
import {
  FILLERSET, PHRASE, REQ_HEAD, SKILLSET, SOFT_HEAD, STOP, TITLEGENERIC,
} from "./vocab";

export interface JdContext {
  co?: string;
  title?: string;
  url?: string;
}

interface JdSection {
  head: string;
  req: boolean;
  body: string[];
}

/**
 * Split a posting into sections and mark which ones state requirements. The
 * same word means different things in "About Us" and in "What you'll own".
 */
export function jdSections(text: string): JdSection[] {
  const lines = String(text || "").split(/\n+/);
  const secs: JdSection[] = [];
  let cur: JdSection = { head: "", req: true, body: [] };
  lines.forEach((ln) => {
    const t = ln.trim();
    if (!t) return;
    const isHead = t.length < 90 && (REQ_HEAD.test(t) || SOFT_HEAD.test(t));
    if (isHead) {
      if (cur.body.length) secs.push(cur);
      cur = { head: t, req: !SOFT_HEAD.test(t), body: [] };
    } else cur.body.push(t);
  });
  if (cur.body.length) secs.push(cur);
  if (!secs.length) return [{ head: "", req: true, body: [String(text || "")] }];
  return secs;
}

/** Tokens belonging to the employer rather than to the job. */
function companyTokens(ctx: JdContext): Record<string, 1> {
  const out: Record<string, 1> = {};
  const add = (str: string | undefined) => {
    String(str || "")
      .toLowerCase()
      .replace(/[^a-z0-9. ]/g, " ")
      .split(/\s+/)
      .forEach((raw) => {
        const w = raw.replace(/^[.]+|[.]+$/g, "");
        if (w.length > 1) out[w] = 1;
        const bare = w.replace(/\.(com|io|co|ai|app|dev|net|org|inc|llc|ltd)$/, "");
        if (bare.length > 1) out[bare] = 1;
      });
  };
  add(ctx && ctx.co);
  if (ctx && ctx.url) {
    try {
      const h = String(ctx.url).replace(/^https?:\/\//, "").split("/")[0].replace(/^www\./, "");
      add(h);
      add(h.split(".")[0]);
    } catch {
      /* a malformed URL is not worth failing the whole read for */
    }
  }
  /* ATS hostnames are never the employer and never a skill. */
  [
    "greenhouse", "lever", "ashby", "ashbyhq", "workable", "smartrecruiters", "jobvite", "icims",
    "myworkdayjobs", "workday", "bamboohr", "recruitee", "teamtailor", "breezy", "jazzhr",
    "boards", "jobs", "careers", "apply", "job",
  ].forEach((w) => {
    out[w] = 1;
  });
  return out;
}

export function kwFromText(raw: string, ctx: JdContext = {}): Keyword[] {
  const co = companyTokens(ctx);
  const titleLow =
    " " +
    String(ctx.title || "").toLowerCase().replace(/[^a-z0-9+#./\- ]/g, " ").replace(/\s+/g, " ") +
    " ";
  const secs = jdSections(raw);
  const agg: Record<string, { n: number; req: number; soft: number; phrase: boolean }> = {};

  function note(term: string, inReq: boolean, isPhrase: boolean): void {
    if (!agg[term]) agg[term] = { n: 0, req: 0, soft: 0, phrase: !!isPhrase };
    agg[term].n++;
    if (inReq) agg[term].req++;
    else agg[term].soft++;
    if (isPhrase) agg[term].phrase = true;
  }

  secs.forEach((sec) => {
    const body =
      " " +
      sec.body
        .join(" ")
        .toLowerCase()
        /* kill URLs and mail addresses before tokenising, or href, https and
           the employer's own domain all become "skills" */
        .replace(/https?:\/\/\S+/g, " ")
        .replace(/\S+@\S+/g, " ")
        /* any markup that survived the strip */
        .replace(/<\/?[a-z][^>]*>/g, " ")
        .replace(/[^a-z0-9+#./\- ]/g, " ")
        .replace(/\s+/g, " ") +
      " ";
    const claimed: Record<string, 1> = {};
    PHRASE.forEach((ph) => {
      const c = body.split(" " + ph + " ").length - 1;
      for (let i = 0; i < c; i++) note(ph, sec.req, true);
      if (c)
        ph.split(" ").forEach((w) => {
          claimed[w] = 1;
        });
    });
    body.split(" ").forEach((rawWord) => {
      const w = rawWord.replace(/^[-./]+|[-./]+$/g, "");
      if (w.length < 3 || w.length > 22) return;
      if (STOP.indexOf(w) > -1) return;
      if (claimed[w]) return;
      if (/^\d+$/.test(w)) return;
      /* Test the bare stem too, or the employer's own domain survives as a
         term: "webflow" was excluded but "webflow.com" was not. */
      if (co[w] || co[w.replace(/\.(com|io|co|ai|app|dev|net|org|xyz|me)$/, "")]) return;
      if (/^(li|ul|ol|em|br|hr|div|span|href|src|alt|img|nbsp|amp|quot|https|http|www)$/.test(w)) return;
      note(w, sec.req, false);
    });
  });

  const out: Keyword[] = [];
  for (const k in agg) {
    const a = agg[k];
    /* Frequency contributes, but logarithmically. 48 mentions should beat 7 by
       a little, not by seven times. */
    let w = 1 + (Math.log(1 + a.n) / Math.LN2) * 0.6;
    if (a.req && !a.soft) w *= 2.0; /* stated only in a requirements section */
    else if (a.req) w *= 1.5;
    else w *= 0.6; /* only ever in About Us or Benefits */
    if (a.phrase) w *= 1.6;
    if (SKILLSET[k] || SKILLSET[k.replace(/[-.]/g, "")]) w *= 2.2;
    if (FILLERSET[k]) w *= 0.35;
    if (titleLow.indexOf(" " + k + " ") > -1) w *= 3.0; /* the title is the job */
    if (TITLEGENERIC[k]) w *= 0.12; /* applied last, beats the title bonus */
    out.push({ k, n: a.n, w: Math.round(w * 100) / 100, req: !!a.req });
  }
  out.sort((a, b) => (b.w || 0) - (a.w || 0) || b.n - a.n);
  return out.slice(0, 30);
}

/** Old saved files carry {k,n} with no weight. Fall back so they still score. */
export function kwWeight(o: Keyword | undefined | null): number {
  return o && typeof o.w === "number" ? o.w : (o && o.n) || 1;
}

/**
 * A term is CORE if it is worth chasing. Coverage is measured against these
 * only, so 100% is actually reachable and therefore worth aiming at.
 */
export function coreKw(kw: Keyword[]): Keyword[] {
  if (!kw.length) return [];
  const top = kwWeight(kw[0]);
  const core = kw.filter((o) => kwWeight(o) >= Math.max(1.4, top * 0.35));
  return core.length ? core : kw.slice(0, Math.min(10, kw.length));
}
