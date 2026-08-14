/* =========================================================================
   THE SEARCH RUN
   Firing 140 requests at once makes the browser queue them badly and some
   boards start refusing. Batches of 20 with a live counter keeps it steady and
   tells the user something is happening instead of a frozen button.
   ========================================================================= */
import type { Listing, PullResult, SearchForm, SearchState, SourceError } from "@/types";
import { S } from "@/store/state";
import { save } from "@/store/storage";
import { AGGREGATORS, QUICK_BOARD_COUNT, boardList } from "./sources";
import { pullAggregator, pullBoard, pullKeyed } from "./pull";
import { locMatches } from "./geo";
import { parsePay } from "./pay";
import { dedupeKey, profileTerms, scoreListing } from "./families";
import { levelOf, myLevel } from "@/lib/resume/profile";

export const emptySearchState = (): SearchState => ({
  results: [], all: [], strong: [], possible: [],
  lastRun: null, running: false, showAll: false, autoWide: false,
  freshCount: 0, bySource: {}, diag: null,
});

export interface SearchOutcome {
  state: SearchState;
  /** How many listings were read before any filter ran. */
  readCount: number;
  cutLevel: number;
  cutPay: number;
}

export interface RunSearchArgs {
  form: SearchForm;
  onProgress?: (msg: string) => void;
}

/** The seen map is the only thing here that grows without bound. */
function pruneSeen(): void {
  const keys = Object.keys(S.seen);
  if (keys.length < 4000) return;
  const cut = Date.now() - 45 * 24 * 3600 * 1000;
  const out: Record<string, number> = {};
  keys.forEach((k) => {
    if (S.seen[k] > cut) out[k] = S.seen[k];
  });
  S.seen = out;
}

export async function runSearch({ form, onProgress }: RunSearchArgs): Promise<SearchOutcome> {
  const win = parseInt(form.win, 10) || 0;
  const loc = form.loc.trim().toLowerCase();
  const extra = form.keywords.trim();
  const wantTypes = form.types;

  let boards = boardList();
  if (form.depth === "quick") boards = boards.slice(0, QUICK_BOARD_COUNT);

  const tasks: (() => Promise<PullResult>)[] = boards
    .map((b) => () => pullBoard(b))
    .concat(AGGREGATORS.map((a) => () => pullAggregator(a)))
    .concat([() => pullKeyed(loc, extra)]);

  let all: Listing[] = [];
  let done = 0;
  const total = tasks.length;
  const srcErrors: SourceError[] = [];
  let srcOk = 0;
  let srcEmpty = 0;

  for (let i = 0; i < tasks.length; i += 20) {
    const slice = tasks.slice(i, i + 20);
    const res: PullResult[] = await Promise.all(
      slice.map((f) =>
        Promise.resolve()
          .then(f)
          .catch(
            (err): PullResult => ({
              items: [],
              error: { code: err.code || err.name || "err", src: "unknown", msg: String(err.message || err) },
            }),
          ),
      ),
    );
    res.forEach((r) => {
      const items = (r && r.items) || [];
      all = all.concat(items);
      if (r && r.error) srcErrors.push(r.error);
      else if (r && r.errors && r.errors.length) {
        srcErrors.push(...r.errors);
        if (items.length) srcOk++;
      } else if (items.length) srcOk++;
      else srcEmpty++;
    });
    done += slice.length;
    onProgress?.(
      "Reading source " + done + " of " + total + ", " + all.length.toLocaleString() + " listings so far...",
    );
  }

  /* Which source produced what. A board that quietly returns nothing on every
     run is a blindspot, and nothing in the interface could reveal one before. */
  const bySource: Record<string, number> = {};
  all.forEach((x) => {
    const k = x.src || "unknown";
    bySource[k] = (bySource[k] || 0) + 1;
  });

  const now = Date.now();
  const cutoff = win ? now - win * 3600 * 1000 : 0;
  const minPay = parseInt(form.pay || "0", 10) || 0;
  const guard = form.level;
  const mine = myLevel();
  const seen: Record<string, 1> = {};
  const rows: Listing[] = [];
  let cutLevel = 0;
  let cutPay = 0;

  all.forEach((j) => {
    if (!j.title || !j.url) return;
    /* Same role, three boards, three cards. Normalising away seniority commas,
       parenthetical notes and requisition numbers collapses them into one. */
    const key = dedupeKey(j);
    if (seen[key]) return;
    seen[key] = 1;
    if (win && (!j.ts || j.ts < cutoff)) return;
    if (loc && !locMatches(j.loc, loc)) return;
    if (wantTypes.length && !wantTypes.every((t) => j.types.indexOf(t) >= 0)) return;

    j.pay = parsePay(j.title + " " + (j.loc || "") + " " + (j.raw || ""));
    if (minPay && j.pay && j.pay.annual < minPay) {
      cutPay++;
      return;
    }

    /* An intern posting is not a near miss for a director, it is noise, and it
       is the single biggest source of junk in a keyword-matched job list. */
    if (guard === "on" && mine >= 0) {
      const jl = levelOf(j.title);
      if (jl && Math.abs(jl.n - mine) >= 2) {
        cutLevel++;
        return;
      }
    }
    rows.push(j);
  });

  const prof = profileTerms(extra);
  rows.forEach((j) => {
    const r = scoreListing(j, prof);
    j.pct = r.pct;
    j.hits = r.hits;
  });
  rows.sort((a, b) => (b.pct || 0) - (a.pct || 0) || b.ts - a.ts);

  const strong = rows.filter((j) => (j.pct || 0) >= 50);
  const possible = rows.filter((j) => (j.pct || 0) >= 28 && (j.pct || 0) < 50);
  /* Strong-only is right when there are strong fits to show. When there are one
     or two, hiding forty near misses behind a toggle the user has to find is
     worse than showing them, so widen automatically and say why. */
  const autoWide = strong.length < 3 && possible.length > 0;
  const results = (autoWide ? rows.filter((j) => (j.pct || 0) >= 28) : strong).slice(0, 250);

  /* Anything not shown before is flagged. A returning user should be able to
     scan only what changed rather than re-reading yesterday's list. */
  let fresh = 0;
  rows.forEach((j) => {
    if (S.seen[j.id]) j.isNew = false;
    else {
      j.isNew = true;
      fresh++;
      S.seen[j.id] = now;
    }
  });
  pruneSeen();

  S.lastSearch = {
    win: form.win, depth: form.depth, loc: form.loc, kw: extra,
    pay: minPay, guard, types: wantTypes, at: now,
  };
  save();

  return {
    state: {
      results, all: rows, strong, possible,
      lastRun: now, running: false, showAll: false, autoWide,
      freshCount: fresh, bySource,
      diag: { ok: srcOk, empty: srcEmpty, failed: srcErrors.length, errors: srcErrors, total },
    },
    readCount: all.length,
    cutLevel,
    cutPay,
  };
}

/**
 * Toggle between strong-only and everything worth showing. Pressing the button
 * always means "give me the other view", including when the widening happened
 * automatically, which is why autoWide is cleared rather than respected here.
 */
export function toggleShowAll(state: SearchState): SearchState {
  const wide = state.showAll || state.autoWide;
  const showAll = wide ? false : true;
  const autoWide = wide ? false : state.autoWide;
  return {
    ...state,
    showAll,
    autoWide,
    results: (showAll || autoWide ? state.all.filter((j) => (j.pct || 0) >= 28) : state.strong).slice(0, 250),
  };
}
