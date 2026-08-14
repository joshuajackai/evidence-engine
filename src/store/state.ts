/* =========================================================================
   The store.

   Deliberately a single mutable object plus a version counter, read through
   useSyncExternalStore. The alternative was rewriting six thousand lines of
   pure logic to thread state through arguments, which would have been a
   different program rather than a port. Every mutation goes through commit(),
   which persists and then notifies, so nothing can change without React
   hearing about it.
   ========================================================================= */
import { useSyncExternalStore } from "react";
import type { AppState, Job } from "@/types";

export const MONETIZATION = false;
export const BUY_URL = "https://buy.stripe.com/REPLACE_WITH_YOUR_PAYMENT_LINK";
export const FREE_LIMIT = 5;
export const KEY_SALT = "JJEE1";

export const STORAGE_KEY = "ee.v1";
export const BACKUP_KEY = "ee.bk";

let jobSeq = 0;

/** Jobs are a list. Each one keeps its own keyword set and its own picks. */
export function newJob(o: Partial<Job> = {}): Job {
  return {
    id: o.id || "j" + Date.now() + "-" + (jobSeq++).toString(36) + Math.floor(Math.random() * 999),
    title: o.title || "",
    co: o.co || "",
    url: o.url || "",
    text: o.text || "",
    kw: o.kw || [],
    picked: o.picked || {},
    pay: o.pay ?? null,
    aiDoc: o.aiDoc ?? null,
    idealDoc: o.idealDoc ?? null,
    aiScore: o.aiScore,
  };
}

export function emptyJob(): Job {
  return { id: "", title: "", co: "", url: "", text: "", kw: [], picked: {} };
}

export function initialState(): AppState {
  return {
    units: [],
    jobs: [],
    activeJob: null,
    jd: emptyJob(),
    picked: {},
    hdr: { name: "", title: "", loc: "", email: "", phone: "", link: "", summary: "" },
    type: { font: "sans", size: "11", lead: "1.5", accent: "on" },
    customText: "",
    pro: false,
    editing: null,
    profile: { titles: [], level: "", loc: "", remote: true, minPay: 0, ready: false },
    answers: {},
    apps: {},
    seen: {},
    lastSearch: null,
    rawResume: "",
    gen: {},
  };
}

/** The live state. Ported logic reads and writes this directly, as before. */
export const S: AppState = initialState();

/* ---------- subscription ---------- */

let version = 0;
const listeners = new Set<() => void>();

function subscribe(fn: () => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

function getVersion(): number {
  return version;
}

/** Bump the version and tell React. Does not persist. */
export function notify(): void {
  version++;
  listeners.forEach((l) => l());
}

/**
 * Subscribe a component to the store. The returned object is the same
 * reference every time, so read what you need during render rather than
 * memoising on identity.
 */
export function useAppState(): AppState {
  useSyncExternalStore(subscribe, getVersion, getVersion);
  return S;
}

/**
 * The store version, for effect dependency arrays.
 *
 * S is a stable object, which is the whole point of the design, but it also
 * means `useEffect(fn, [state])` never fires again. Anything that has to run
 * AFTER a write, rather than during the render it caused, depends on this
 * instead. The ATS check is the one that matters: it measures the rendered
 * document, so a stale reading is a wrong number on screen.
 */
export function useStoreVersion(): number {
  return useSyncExternalStore(subscribe, getVersion, getVersion);
}

/* ---------- active job ---------- */

export function activeJob(): Job | null {
  if (!S.jobs.length) return null;
  const j = S.jobs.filter((x) => x.id === S.activeJob)[0];
  return j || S.jobs[0];
}

export function syncActive(): void {
  const j = activeJob();
  if (j) {
    S.activeJob = j.id;
    S.jd = j;
    S.picked = j.picked;
  } else {
    S.jd = emptyJob();
    S.picked = {};
  }
}

/* ---------- licence ----------
   Deliberately a speed bump, not real DRM. A backend to enforce this properly
   would cost more than the leakage at a $39 price point. */
export function isPro(): boolean {
  return !MONETIZATION || S.pro;
}

export function hash(s: string): number {
  let x = 5381;
  for (let i = 0; i < s.length; i++) x = ((x * 33) ^ s.charCodeAt(i)) >>> 0;
  return x;
}

export function checkKey(k: string): boolean {
  const up = (k || "").toUpperCase().replace(/\s/g, "");
  const m = up.match(/^EE-([A-Z0-9]{4})-([A-Z0-9]{4})-([A-Z0-9]{4})$/);
  if (!m) return false;
  let want = (hash(KEY_SALT + m[1] + m[2]) % 1679616).toString(36).toUpperCase();
  while (want.length < 4) want = "0" + want;
  return want === m[3];
}
