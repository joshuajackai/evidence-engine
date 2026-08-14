/* =========================================================================
   MATCHING

   Substring matching was giving free points for accidents: "web" matched
   "webinar", "ui" matched "build" and "guide", "art" matched "started". Same
   defect class as the location filter. Terms now match on word boundaries,
   with light suffix stemming so "designing" still finds "design".
   ========================================================================= */
import type { Job, Keyword, Unit } from "@/types";
import { escapeRe } from "@/lib/util";
import { S } from "@/store/state";
import { coreKw, kwWeight } from "./keywords";

const reCache: Record<string, RegExp> = {};

export function kwRegex(k: string): RegExp {
  if (reCache[k]) return reCache[k];
  /* allow a plural or a common verb ending on the resume side */
  const re = new RegExp("(^|[^a-z0-9])" + escapeRe(k) + "(s|es|ed|ing|er|ers)?([^a-z0-9]|$)", "i");
  reCache[k] = re;
  return re;
}

function haystack(u: Unit): string {
  return (
    " " +
    ((u.action || "") + " " + (u.role || "") + " " + (u.tags || []).join(" ") + " " +
      (u.org || "") + " " + (u.metric || "")).toLowerCase() +
    " "
  );
}

export interface UnitScore {
  s: number;
  hits: string[];
}

export function scoreUnit(u: Unit, kw: Keyword[]): UnitScore {
  const hay = haystack(u);
  let s = 0;
  const hits: string[] = [];
  (kw || []).forEach((o) => {
    if (!o || !o.k) return;
    if (kwRegex(o.k).test(hay)) {
      s += kwWeight(o) * 10;
      hits.push(o.k);
    }
  });
  s += ({ audited: 14, estimated: 9, activity: 5, none: 0 } as Record<string, number>)[u.metricType] || 0;
  return { s: Math.round(s), hits };
}

/**
 * Absolute fit, 0 to 100: how much of what the posting actually asks for does
 * this one entry carry. The old percentage divided by the top-scoring row, so
 * the best entry always read 100 no matter how poor the fit really was.
 */
export function unitFitPct(u: Unit, kw: Keyword[]): number {
  const core = coreKw(kw || []);
  if (!core.length) return 0;
  let total = 0;
  let got = 0;
  core.forEach((o) => {
    total += kwWeight(o);
  });
  const hay = haystack(u);
  core.forEach((o) => {
    if (kwRegex(o.k).test(hay)) got += kwWeight(o);
  });
  return total ? Math.min(100, Math.round((got / total) * 100)) : 0;
}

/**
 * Coverage for a job: how many of the CORE terms are answered by at least one
 * selected entry. Measured against the terms that actually matter, not against
 * all thirty, so 100% is reachable and therefore worth aiming at.
 */
export function coverageFor(j: Job): number {
  if (!j || !j.kw || !j.kw.length || !S.units.length) return 0;
  const covered: Record<string, 1> = {};
  S.units.forEach((u) => {
    if (j.picked[u.id] === false) return;
    scoreUnit(u, j.kw).hits.forEach((h) => {
      covered[h] = 1;
    });
  });
  const core = coreKw(j.kw);
  if (!core.length) return 0;
  const hitCore = core.filter((o) => covered[o.k]).length;
  return Math.round((hitCore / core.length) * 100);
}

export interface MatchRow {
  u: Unit;
  s: number;
  hits: string[];
  pct: number;
}

/** Rank every entry against the active posting. */
export function rankUnits(kw: Keyword[]): MatchRow[] {
  return S.units
    .map((u) => {
      const r = scoreUnit(u, kw);
      return { u, s: r.s, hits: r.hits, pct: unitFitPct(u, kw) };
    })
    .sort((a, b) => b.s - a.s);
}

/**
 * The entries the writer should see, best first, capped and then put back into
 * resume order so the model writes a chronology rather than a ranking.
 */
export function topUnits(n: number): Unit[] {
  const j = S.jobs.filter((x) => x.id === S.activeJob)[0] || S.jobs[0] || null;
  const kw = (j && j.kw) || [];
  const list = S.units.filter((u) => !j || j.picked[u.id] !== false);
  return list
    .map((u) => ({
      u,
      s:
        scoreUnit(u, kw).s +
        (({ audited: 9, estimated: 6, activity: 3, none: 0 } as Record<string, number>)[u.metricType] || 0),
    }))
    .sort((a, b) => b.s - a.s)
    .slice(0, n || 3)
    .map((x) => x.u);
}
