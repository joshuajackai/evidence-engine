/* Primitives shared by the cleaner and the splitter. They live here rather
   than in either one because both need them and neither owns them. */

export const DATE_RE =
  /(19|20)\d{2}|present|current|jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec/i;
export const BULLET_RE = /^\s*[•·▪◦‣*\-–—]\s+/;

/**
 * Markdown resumes are common, and the syntax has to come off before anything
 * else runs. Underscores are left alone on purpose: snake_case appears in real
 * resumes far more often than underscore italics do.
 */
export function stripMd(s: string): string {
  return String(s || "")
    .replace(/^\s{0,3}#{1,6}\s+/, "")
    .replace(/^\s*>\s?/, "")
    .replace(/^\s*[-*]{3,}\s*$/, "")
    .replace(/\*\*([^*\n]+)\*\*/g, "$1")
    .replace(/\*([^*\n]+)\*/g, "$1")
    .replace(/`([^`\n]+)`/g, "$1")
    .replace(/!?\[([^\]]*)\]\([^)\s]*\)/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

/* Resumes have sections, and ignoring that was the single worst bug in the
   original parser. A SKILLS heading became a company and every comma-separated
   skill line became an achievement. Only experience sections yield entries. */
const SEC_EXP =
  /^(work|professional|relevant|employment)?\s*(experience|history|employment|positions?)\b|^career\b/i;
const SEC_SKILL =
  /^(technical\s+)?(skills?|competencies|capabilities|technologies|tools|expertise|proficienc)/i;
const SEC_OTHER =
  /^(summary|profile|objective|about|education|certification|certificate|award|honou?rs|publication|volunteer|interest|hobb|reference|language|project|portfolio|contact)/i;

export type Section = "exp" | "skill" | "other";

export function sectionOf(line: string): Section | null {
  const t = line.replace(/[:\s]+$/, "").trim();
  if (t.length > 44) return null; // headings are short
  if (t.split(/\s+/).length > 4) return null;
  const upperish = t === t.toUpperCase() || /^[A-Z]/.test(t);
  if (!upperish) return null;
  if (SEC_EXP.test(t)) return "exp";
  if (SEC_SKILL.test(t)) return "skill";
  if (SEC_OTHER.test(t)) return "other";
  return null;
}

/** A comma list with no verb is a skills line, not an achievement. */
export function looksLikeSkillList(s: string): boolean {
  const commas = (s.match(/,/g) || []).length;
  if (commas < 2) return false;
  const parts = s.split(",").map((p) => p.trim()).filter(Boolean);
  const shortParts = parts.filter((p) => p.split(/\s+/).length <= 4).length;
  return shortParts / parts.length > 0.75;
}

/**
 * Two entries are the same entry when their text is the same once case,
 * punctuation and spacing are set aside. Used both inside one import and
 * across repeat imports.
 */
export function unitKey(u: { action?: string; bullet?: string } | null | undefined): string {
  return String((u && (u.action || u.bullet)) || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .slice(0, 140);
}
