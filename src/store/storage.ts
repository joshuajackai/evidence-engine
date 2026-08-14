/* =========================================================================
   Persistence.

   Everything lives in one browser key, which is why the rolling snapshots
   underneath it exist: a stray clear, a bad import or a mistaken bulk delete
   would otherwise be the end of an hour's work with nothing to fall back on.
   ========================================================================= */
import { S, STORAGE_KEY, BACKUP_KEY, activeJob, syncActive, newJob, notify } from "./state";
import type { AppState, Job } from "@/types";

export interface Snapshot {
  t: number;
  n: number;
  j: number;
  d: string;
}

let lastBackupAt = 0;

/**
 * A rolling set of snapshots, throttled to one every two minutes, but never
 * skipped when there is nothing to fall back on. Without that second test a
 * restore or a cleared store left the user unprotected for two minutes.
 */
export function backup(): void {
  try {
    if (!S.units.length && !S.jobs.length) return;
    const now = Date.now();
    let b: Snapshot[] = JSON.parse(localStorage.getItem(BACKUP_KEY) || "[]");
    if (b.length && lastBackupAt && now - lastBackupAt < 120000) return;
    lastBackupAt = now;
    b.unshift({ t: now, n: S.units.length, j: S.jobs.length, d: JSON.stringify(S) });
    b = b.slice(0, 5);
    localStorage.setItem(BACKUP_KEY, JSON.stringify(b));
  } catch {
    /* quota, nothing to do about it and not worth interrupting for */
  }
}

export function backups(): Snapshot[] {
  try {
    return JSON.parse(localStorage.getItem(BACKUP_KEY) || "[]");
  } catch {
    return [];
  }
}

/** Persist, snapshot, then tell React. The only sanctioned way to mutate. */
export function save(): void {
  const j = activeJob();
  if (j) j.picked = S.picked;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(S));
  } catch {
    /* quota */
  }
  backup();
  notify();
}

/** Change state without writing to disk. For pure view state kept on S. */
export function touch(): void {
  notify();
}

export function load(): void {
  try {
    const r = localStorage.getItem(STORAGE_KEY);
    if (!r) return;
    const d = JSON.parse(r) as Partial<AppState>;

    if (Array.isArray(d.units)) S.units = d.units;
    if (d.hdr) S.hdr = { ...S.hdr, ...d.hdr };
    if (d.type) S.type = { ...S.type, ...d.type };

    if (d.profile && typeof d.profile === "object") S.profile = { ...S.profile, ...d.profile };
    if (d.answers && typeof d.answers === "object") S.answers = d.answers;
    if (d.apps && typeof d.apps === "object") S.apps = d.apps;
    if (d.seen && typeof d.seen === "object") S.seen = d.seen;
    if (d.gen && typeof d.gen === "object") S.gen = d.gen;

    if (d.lastSearch) S.lastSearch = d.lastSearch;
    if (typeof d.rawResume === "string") S.rawResume = d.rawResume;
    S.customText = d.customText || "";
    S.pro = !!d.pro;

    if (Array.isArray(d.jobs) && d.jobs.length) {
      S.jobs = d.jobs.map((x) => newJob(x));
      S.activeJob = d.activeJob || S.jobs[0].id;
    } else if (d.jd && (d.jd.text || (d.jd.kw && d.jd.kw.length))) {
      /* Migrate the pre-list format: one job becomes the first saved job. */
      const legacy = d.jd as Job;
      S.jobs = [
        newJob({
          title: legacy.title,
          co: legacy.co,
          text: legacy.text,
          kw: legacy.kw,
          picked: d.picked || {},
        }),
      ];
      S.activeJob = S.jobs[0].id;
    }
    syncActive();
  } catch {
    /* a corrupt store is better ignored than fatal; the snapshots are there */
  }
}

export function restoreSnapshot(snap: Snapshot): boolean {
  try {
    localStorage.setItem(STORAGE_KEY, snap.d);
    return true;
  } catch {
    return false;
  }
}

/** Small typed wrappers so every other module stops writing try/catch. */
export function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function writeJson(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* quota */
  }
}
