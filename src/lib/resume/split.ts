/* =========================================================================
   THE SPLITTER
   Deliberately dumb and deliberately transparent. It splits text into entries
   and fills in what it can see. It never assigns a grade and never writes a
   claim, because both of those are the user's job and guessing at them is the
   exact failure this product exists to avoid.
   ========================================================================= */
import type { Unit } from "@/types";
import { escapeRe } from "@/lib/util";
import { BULLET_RE, DATE_RE, looksLikeSkillList, sectionOf, stripMd, unitKey } from "./text";
import { extractMetric } from "./metric";

const SKILLS =
  ("sql python javascript excel figma photoshop illustrator indesign canva wordpress shopify webflow " +
    "framer hubspot salesforce klaviyo zendesk jira asana notion tableau powerbi looker ga4 analytics seo sem " +
    "copywriting content social media email marketing paid ads meta tiktok linkedin google branding design ux ui " +
    "research testing onboarding training recruiting payroll budgeting forecasting reporting automation crm erp " +
    "logistics inventory procurement negotiation compliance auditing bookkeeping quickbooks xero photography video " +
    "editing premiere aftereffects illustration animation react node php html css").split(" ");

/* "Senior Web Designer - Demand Designer" and "Demand Designer - Senior Web
   Designer" are the same header written by two different people, and position
   alone cannot tell them apart. Score both sides instead. Seniority words are
   the strongest signal available, because a company is rarely called "Senior
   anything" while a title very often is. */
const ROLE_WORDS =
  /\b(designer|engineer|developer|manager|director|analyst|specialist|coordinator|consultant|architect|writer|copywriter|strategist|marketer|scientist|researcher|administrator|producer|editor|recruiter|accountant|nurse|teacher|technician|officer|associate|assistant|intern|lead|head|president|founder|partner|illustrator|animator|photographer|videographer|artist|buyer|planner|supervisor|representative|advisor|controller|auditor|generalist|operator|programmer|tester|trainer|curator|advocate|liaison|steward|clerk|agent)\b/i;
const SENIORITY =
  /\b(senior|junior|lead|principal|staff|chief|head\s+of|vp|vice\s+president|director\s+of|sr\.?|jr\.?|associate|assistant|entry|mid|executive|global|regional|deputy|interim|freelance|contract)\b/i;
/* "marketing", "digital" and "creative" are deliberately absent. They appear in
   job titles far more often than they identify a company, and including them
   made "Marketing Designer" score as an employer. */
const ORG_WORDS =
  /\b(inc|llc|ltd|l\.l\.c|corp|gmbh|plc|pty|s\.a|agency|studio|group|labs?|media|partners|solutions|technologies|systems|consulting|university|college|hospital|bank|foundation|institute|school|ventures|capital|works|collective)\b\.?/i;

function scoreAsRole(s: string): number {
  let n = 0;
  /* Leading seniority is near proof of a title. Trailing is much weaker,
     because "Copy Chief" is a company and "Chief" is the last word in it. */
  if (SENIORITY.test(s))
    n +=
      /^\s*(?:the\s+)?(?:senior|junior|lead|principal|staff|chief|head\s+of|vp|vice\s+president|director\s+of|sr\.?|jr\.?|associate|assistant|executive|global|regional|deputy|interim|freelance|contract)\b/i.test(
        s,
      )
        ? 3
        : 1;
  if (ROLE_WORDS.test(s)) n += 2;
  if (/\bof\b/i.test(s)) n += 1;
  if (ORG_WORDS.test(s)) n -= 3;
  return n;
}

/** Returns [company, role]. */
function orderRoleOrg(a: string, b: string): [string, string] {
  if (!b) return [a || "", ""];
  const ra = scoreAsRole(a);
  const rb = scoreAsRole(b);
  if (rb > ra) return [a, b]; // second half is the title, so first is the company
  if (ra > rb) return [b, a]; // first half is the title
  return [a, b]; // tie, keep the order as written
}

interface RawJob {
  org: string;
  role: string;
  dates: string;
  bullets: string[];
}

export function splitResume(raw: string): Unit[] {
  const lines = raw.split(/\r?\n/).map((l) => l.replace(/\s+$/, ""));
  const jobs: RawJob[] = [];
  let cur: RawJob | null = null;
  let section: string | null = null;
  const skillPool: string[] = [];

  lines.forEach((line) => {
    const t0 = line.trim();
    if (!t0) return;
    const isBullet = BULLET_RE.test(line);
    const t = stripMd(t0);
    if (!t) return;

    if (!isBullet) {
      const sec = sectionOf(t);
      if (sec) {
        section = sec;
        cur = null;
        return;
      }
    }
    if (section === "skill") {
      t.split(/[,;|•·]/).forEach((s) => {
        const v = s.trim().toLowerCase();
        if (v.length > 1 && v.length < 34) skillPool.push(v);
      });
      return;
    }
    /* Once a resume has shown an EXPERIENCE heading, anything under a different
       heading is not a job. Before that, be permissive: plenty of resumes have
       no headings at all. */
    if (section === "other") return;
    /* A comma-separated line that carries a four-digit year is a JOB HEADER,
       not a skill list. This single test was the biggest source of bad
       organisation names in the original parser. */
    if (!isBullet && looksLikeSkillList(t) && !DATE_RE.test(t)) {
      t.split(",").forEach((s) => {
        const v = s.trim().toLowerCase();
        if (v.length > 1 && v.length < 34) skillPool.push(v);
      });
      return;
    }

    const clean = stripMd(t0.replace(BULLET_RE, "")).trim();
    if (isBullet && cur) {
      cur.bullets.push(clean);
      return;
    }
    // A header is a short line, not a bullet, usually carrying a date or a separator.
    const looksHeader =
      !isBullet &&
      t.length <= 90 &&
      (DATE_RE.test(t) || /[|·•]|\s[-–—]\s/.test(t) || /^[A-Z][^.!?]*$/.test(t));
    if (looksHeader) {
      let dates = "";
      let rest = t;
      /* Cut at an optional month word plus a four digit year, and take
         everything after it as the date range. Anchoring on the year alone
         left "March" behind and it became the job title. */
      const dm = t.match(
        /((jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+)?(19|20)\d{2}\b[\s\S]*$/i,
      );
      if (dm) {
        dates = dm[0].trim();
        rest = t.slice(0, dm.index).replace(/[|·,\-–—\s]+$/, "").trim();
      }
      /* Comma is a separator in "Lead Product Designer, Bright Labs" and part
         of the name in "Acme, Inc". Split on it only when what follows is not
         a legal suffix. */
      const sepd = rest.replace(/,\s+(?!(inc|llc|ltd|co|corp|gmbh|plc|pty|s\.a|l\.p)\b\.?)/i, " | ");
      const parts = sepd.split(/\s*[|·•‖]\s*|\s+[-–—]\s+|\s+\/\s+|\s+\bat\b\s+/i).filter(Boolean);
      /* Stacked headers put the company on one line and the role on the next,
         with no separator and no date on either. The date-or-separator guard
         exists to stop the NAME at the top of a resume swallowing the first
         company, so relax it only once we are inside an experience section. */
      const looksRoleLine = !!dates || /[|·•]|\s[-–—]\s/.test(rest) || section === "exp";
      if (cur && (cur as RawJob).bullets.length === 0 && !(cur as RawJob).role && !(cur as RawJob).dates && looksRoleLine) {
        const c = cur as RawJob;
        const pair = orderRoleOrg(parts[0] || "", parts[1] || "");
        c.role = pair[1] || pair[0] || "";
        if (pair[1]) c.org = c.org || pair[0];
        if (dates) c.dates = dates;
        if (c.role || c.dates) return;
      }
      if (!rest && dates && cur) {
        const c = cur as RawJob;
        c.dates = c.dates || dates;
        return;
      }
      const ord = orderRoleOrg(parts[0] || rest, parts[1] || "");
      cur = { org: ord[0] || rest, role: ord[1] || "", dates, bullets: [] };
      jobs.push(cur);
      return;
    }
    if (cur) (cur as RawJob).bullets.push(clean);
    else {
      cur = { org: clean, role: "", dates: "", bullets: [] };
      jobs.push(cur);
    }
  });

  const units: Unit[] = [];
  let id = Date.now();
  const seenUnit: Record<string, 1> = {};
  const pool = [...new Set(skillPool)];
  /* Contact lines, addresses and URL soup are not achievements. */
  const JUNK =
    /^(https?:|www\.|linkedin\.com|github\.com|[\w.+-]+@[\w-]+\.)|^\+?\d[\d\s().-]{7,}$|^[A-Z][a-z]+,\s*[A-Z]{2}$/i;

  jobs.forEach((j) => {
    j.bullets.forEach((b) => {
      if (b.length < 12) return;
      if (JUNK.test(b)) return;
      if (looksLikeSkillList(b)) return;
      if ((b.match(/[|·]/g) || []).length >= 2) return; // contact or meta line
      /* Word boundaries, not substrings. "Rebuilt" contains "ui" and was
         tagging every bullet as a UI skill. */
      const tags = SKILLS.filter((s) => new RegExp("\\b" + escapeRe(s) + "\\b", "i").test(b));
      /* Skills harvested from the resume's own SKILLS section count too, when
         the bullet actually mentions them. */
      pool.forEach((s) => {
        if (tags.length > 7) return;
        if (tags.indexOf(s) > -1) return;
        if (new RegExp("\\b" + escapeRe(s) + "\\b", "i").test(b)) tags.push(s);
      });
      const finalTags = tags.slice(0, 7);
      /* The same sentence twice is one achievement, not two. A resume that
         repeats a line, or a PDF that emits a block twice, produced a duplicate
         row for every repeat. */
      const dk = unitKey({ action: b });
      if (dk && seenUnit[dk]) return;
      if (dk) seenUnit[dk] = 1;
      const kpi = extractMetric(b);
      units.push({
        id: id++,
        org: j.org || "Untitled",
        role: j.role || "",
        dates: j.dates || "",
        action: b,
        metricType: kpi.type,
        metric: kpi.metric,
        constraint: kpi.constraint,
        evidence:
          kpi.type === "none"
            ? ""
            : "Pulled from your resume on import. Confirm where this number came from, then move it up to Proven.",
        benchmark: "",
        tags: finalTags,
      });
    });
  });
  return units;
}
