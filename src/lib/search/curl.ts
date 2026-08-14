/* =========================================================================
   PASTE A cURL, GET A SOURCE
   Added after a fair complaint: the tool assumed one RapidAPI key for
   everything, and made you retype a host and a path that RapidAPI already
   hands you as a ready-made cURL command.

   The parser reads any cURL: any host, any headers, any method, any body.
   RapidAPI is just the common case. The key inside a pasted cURL goes into the
   same browser-local storage as every other key here and is never transmitted
   anywhere except to that API.
   ========================================================================= */

/** Split a shell command respecting quotes, escapes and line continuations. */
export function shellTokens(cmd: string): string[] {
  const s = String(cmd || "").replace(/\\\r?\n/g, " ").replace(/\r/g, " ");
  const out: string[] = [];
  let cur = "";
  let q: string | null = null;
  let i = 0;
  while (i < s.length) {
    const c = s[i];
    if (q) {
      if (c === "\\" && q === '"' && i + 1 < s.length) {
        cur += s[i + 1];
        i += 2;
        continue;
      }
      if (c === q) {
        q = null;
        i++;
        continue;
      }
      cur += c;
      i++;
      continue;
    }
    if (c === "'" || c === '"') {
      q = c;
      i++;
      continue;
    }
    if (/\s/.test(c)) {
      if (cur !== "") {
        out.push(cur);
        cur = "";
      }
      i++;
      continue;
    }
    if (c === "\\" && i + 1 < s.length) {
      cur += s[i + 1];
      i += 2;
      continue;
    }
    cur += c;
    i++;
  }
  if (cur !== "") out.push(cur);
  return out;
}

export interface ParsedCurl {
  ok: boolean;
  error?: string;
  url?: string;
  host?: string;
  path?: string;
  method?: string;
  headers?: Record<string, string>;
  body?: string;
  key?: string;
}

/** Turn a cURL command into the fields this tool needs. */
export function parseCurl(cmd: string): ParsedCurl {
  let t = shellTokens(cmd);
  if (!t.length) return { ok: false, error: "Nothing to read." };
  if (t[0].toLowerCase() !== "curl") {
    /* Be forgiving: a bare URL is a valid thing to paste. */
    if (/^https?:\/\//i.test(t[0])) t = ["curl", t[0]];
    else return { ok: false, error: "That does not look like a curl command or a URL." };
  }
  let url = "";
  let method = "";
  const headers: Record<string, string> = {};
  let body = "";
  for (let i = 1; i < t.length; i++) {
    const a = t[i];
    if (a === "--url") {
      url = t[++i] || "";
      continue;
    }
    if (a === "-X" || a === "--request") {
      method = (t[++i] || "").toUpperCase();
      continue;
    }
    if (a === "-H" || a === "--header") {
      const h = t[++i] || "";
      const p = h.indexOf(":");
      if (p > 0) headers[h.slice(0, p).trim()] = h.slice(p + 1).trim();
      continue;
    }
    if (a === "-d" || a === "--data" || a === "--data-raw" || a === "--data-binary") {
      body = t[++i] || "";
      continue;
    }
    if (["--compressed", "-s", "--silent", "-L", "--location", "-i", "-v"].indexOf(a) >= 0) continue;
    if (a.charAt(0) === "-") {
      /* unknown flag, skip its value if it takes one */
      if (t[i + 1] && t[i + 1].charAt(0) !== "-") i++;
      continue;
    }
    if (!url && /^https?:\/\//i.test(a)) url = a;
  }
  if (!url) return { ok: false, error: "No URL found in that command." };
  let host = "";
  let path = "";
  try {
    const u = new URL(url);
    host = u.host;
    path = u.pathname + (u.search || "");
  } catch {
    return { ok: false, error: "That URL could not be read." };
  }

  /* Pull the key out of the headers so it lands in the key field rather than
     sitting in a generic header blob. */
  let key = "";
  Object.keys(headers).forEach((k) => {
    if (k.toLowerCase() === "x-rapidapi-key") {
      key = headers[k];
      delete headers[k];
    }
    if (k.toLowerCase() === "x-rapidapi-host") delete headers[k]; /* implied by the URL */
  });
  if (!method) method = body ? "POST" : "GET";
  return { ok: true, url, host, path, method, headers, body, key };
}

/**
 * RapidAPI playgrounds paste real search values. Turn the obvious ones into
 * the placeholders this tool substitutes at search time.
 */
export function templatizePath(path: string): string {
  const p = String(path || "");
  if (p.indexOf("{q}") >= 0 || p.indexOf("{loc}") >= 0) return p; /* already done */
  const QKEYS = ["query", "q", "keyword", "keywords", "search", "title", "title_filter", "job_title", "position", "what"];
  const LKEYS = ["location", "loc", "location_filter", "city", "where", "place", "region", "country", "geo"];
  return p.replace(/([?&])([a-zA-Z_][a-zA-Z0-9_]*)=([^&#]*)/g, (m, sep, k) => {
    const lk = String(k).toLowerCase();
    if (QKEYS.indexOf(lk) >= 0) return sep + k + "={q}";
    if (LKEYS.indexOf(lk) >= 0) return sep + k + "={loc}";
    return m;
  });
}
