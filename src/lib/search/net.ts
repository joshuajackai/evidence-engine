/* =========================================================================
   Every network call the search fires goes through this. Three problems were
   costing results silently before it existed:
   1) A slow board could hang the entire batch. Now every request has a hard
      timeout via AbortController, so a stuck source never starves the rest.
   2) Free tiers throttle at low rates. Retrying with exponential backoff on
      429 and 5xx turns most of those into a successful second attempt instead
      of a silent zero.
   3) Repeat searches hammered the same APIs. A short in-memory cache holds
      identical responses for 60 seconds so a returning user does not burn
      their free-tier quota by pressing Search twice.
   All errors bubble up with a categorised code so the caller can decide
   whether to surface it, retry it, or count it.
   ========================================================================= */
import { sleep } from "@/lib/util";

export interface CodedError extends Error {
  code?: string | number;
}

const NET_CACHE: Record<string, { at: number; v: unknown }> = {};
const NET_TTL_MS = 60000;

function cacheKey(u: string, init: RequestInit): string {
  try {
    return (init.method || "GET") + " " + u + " " + (init.body || "");
  } catch {
    return u;
  }
}

function cacheGet(k: string): unknown | null {
  const e = NET_CACHE[k];
  if (!e) return null;
  if (Date.now() - e.at > NET_TTL_MS) {
    delete NET_CACHE[k];
    return null;
  }
  return e.v;
}

export interface NetOpts {
  init?: RequestInit;
  timeoutMs?: number;
  retries?: number;
  /** false reads the body as text rather than JSON, and skips the cache. */
  json?: boolean;
}

export async function netFetch<T = unknown>(u: string, opts: NetOpts = {}): Promise<T> {
  const init: RequestInit = { headers: { accept: "application/json" }, ...(opts.init || {}) };
  const timeoutMs = opts.timeoutMs || 15000;
  const maxRetries = opts.retries == null ? 2 : opts.retries;
  const wantJson = opts.json !== false;

  if (wantJson) {
    const hit = cacheGet(cacheKey(u, init));
    if (hit) return hit as T;
  }

  let attempt = 0;
  let lastErr: CodedError | null = null;

  while (attempt <= maxRetries) {
    const ctrl = "AbortController" in window ? new AbortController() : null;
    const timer = ctrl ? setTimeout(() => ctrl.abort(), timeoutMs) : null;
    try {
      const r = await fetch(u, ctrl ? { ...init, signal: ctrl.signal } : init);
      if (timer) clearTimeout(timer);
      if (r.status === 429 || (r.status >= 500 && r.status <= 599)) {
        lastErr = new Error("HTTP " + r.status) as CodedError;
        lastErr.code = r.status;
        if (attempt < maxRetries) {
          await sleep(400 * Math.pow(2, attempt) + Math.floor(Math.random() * 300));
          attempt++;
          continue;
        }
        throw lastErr;
      }
      if (!r.ok) {
        const e = new Error("HTTP " + r.status) as CodedError;
        e.code = r.status;
        throw e;
      }
      const body = wantJson ? await r.json() : await r.text();
      if (wantJson) NET_CACHE[cacheKey(u, init)] = { at: Date.now(), v: body };
      return body as T;
    } catch (err) {
      if (timer) clearTimeout(timer);
      const e = err as CodedError;
      lastErr = e;
      const code = typeof e.code === "number" ? e.code : 0;
      const retriable =
        e.name === "AbortError" ||
        code === 429 ||
        (code >= 500 && code <= 599) ||
        /Failed to fetch|NetworkError|Load failed/i.test(e.message || "");
      if (retriable && attempt < maxRetries) {
        await sleep(400 * Math.pow(2, attempt) + Math.floor(Math.random() * 300));
        attempt++;
        continue;
      }
      break;
    }
  }
  throw lastErr || new Error("Request failed");
}

export async function jget<T = any>(u: string): Promise<T> {
  return await netFetch<T>(u);
}
