/* =========================================================================
   PROFILE INFERENCE
   The search form used to be five empty fields the user had to guess at before
   anything happened. Everything it needs is derivable from the evidence they
   just imported: what they have been called, how senior they are, and where
   they are. Inferred, shown, and editable, rather than demanded up front.
   ========================================================================= */
import { S } from "@/store/state";
import type { LevelKey, Profile } from "@/types";

export interface Level {
  k: LevelKey;
  n: number;
  re: RegExp;
}

export const LEVELS: Level[] = [
  { k: "intern", n: 0, re: /\b(intern|internship|trainee|apprentice)\b/i },
  { k: "junior", n: 1, re: /\b(junior|jr\.?|associate|entry[- ]level|assistant|coordinator|graduate)\b/i },
  { k: "mid", n: 2, re: /\b(specialist|analyst|designer|engineer|developer|manager|strategist|writer|producer)\b/i },
  { k: "senior", n: 3, re: /\b(senior|sr\.?|lead|principal|staff|architect|head\s+of)\b/i },
  { k: "exec", n: 4, re: /\b(director|vp|vice\s+president|chief|cto|cmo|ceo|coo|partner|founder|owner)\b/i },
];

export const LEVEL_LABEL: Record<string, string> = {
  intern: "Intern",
  junior: "Junior",
  mid: "Mid level",
  senior: "Senior",
  exec: "Director and above",
};

export function levelOf(title: string): Level | null {
  let best: Level | null = null;
  LEVELS.forEach((l) => {
    if (l.re.test(title || "") && (!best || l.n > best.n)) best = l;
  });
  return best;
}

export function inferProfile(): Profile {
  const p: Profile = {
    titles: [],
    level: "",
    loc: "",
    remote: true,
    minPay: S.profile.minPay || 0,
    ready: false,
  };
  if (!S.units.length) return p;

  /* Most recent first. The units arrive in resume order, which is already
     reverse chronological on essentially every resume ever written. */
  const titles: string[] = [];
  const seen: Record<string, 1> = {};
  S.units.forEach((u) => {
    const r = (u.role || "").trim();
    if (r && r.length < 52 && !seen[r.toLowerCase()]) {
      seen[r.toLowerCase()] = 1;
      titles.push(r);
    }
  });
  p.titles = titles.slice(0, 4);

  let lv: Level | null = null;
  titles.slice(0, 2).forEach((t) => {
    const l = levelOf(t);
    if (l && (!lv || l.n > lv.n)) lv = l;
  });
  p.level = lv ? (lv as Level).k : "";

  if (S.hdr && S.hdr.loc) p.loc = S.hdr.loc;
  p.ready = !!p.titles.length;
  return p;
}

/** The user's own level, as a number, for the seniority guard. */
export function myLevel(): number {
  const k = (S.profile && S.profile.level) || "";
  for (let i = 0; i < LEVELS.length; i++) if (LEVELS[i].k === k) return LEVELS[i].n;
  return -1;
}
