/** Timeout wrapper around fetch. Aborts after ms and throws a clear error. */
export function aiFetch(url: string, init: RequestInit, ms = 60000): Promise<Response> {
  const ctrl = "AbortController" in window ? new AbortController() : null;
  if (ctrl) init.signal = ctrl.signal;
  const to = setTimeout(() => {
    if (ctrl) ctrl.abort();
  }, ms);
  return fetch(url, init).then(
    (r) => {
      clearTimeout(to);
      return r;
    },
    (e) => {
      clearTimeout(to);
      if (e && (e.name === "AbortError" || String(e).indexOf("abort") >= 0)) {
        throw new Error(
          "Request timed out after " + Math.round(ms / 1000) +
            " seconds. The provider did not respond in time.",
        );
      }
      const low = String(e).toLowerCase();
      if (low.indexOf("failed to fetch") >= 0 || low.indexOf("networkerror") >= 0) {
        throw new Error(
          "Network or CORS block. The browser could not reach the provider. If this is Anthropic, " +
            "try a different provider for this run.",
        );
      }
      throw e;
    },
  );
}

export function aiTrunc(s: unknown, n: number): string {
  const v = String(s == null ? "" : s);
  return v.length > n ? v.slice(0, n) + "...(+" + (v.length - n) + " chars)" : v;
}
