import { useEffect, useState } from "react";
import type { CompanyBoard, RapidSource } from "@/types";
import { Veil } from "@/components/Veil";
import { Spinner } from "@/components/Toast";
import { useUi } from "@/ui/UiContext";
import {
  AGGREGATORS, BLOCKED_SOURCES, KEYED_SOURCES, boardList, keyedCfg, rapidKey, rapidSaved,
  rapidSources, saveBoardList, saveKeyedCfg, saveRapid, isAggOn, setAggOn,
  type KeyedCfg, type RapidSaved,
} from "@/lib/search/sources";
import { parseCurl, templatizePath } from "@/lib/search/curl";
import { mapRapidRow, pickRows } from "@/lib/search/rapid";

export function SourcesModal() {
  const ui = useUi();
  const open = ui.isOpen("sources");
  const [boards, setBoards] = useState("");
  const [rKey, setRKey] = useState("");
  const [srcs, setSrcs] = useState<RapidSource[]>([]);
  const [cfg, setCfg] = useState<KeyedCfg>({});
  const [curl, setCurl] = useState<Record<string, string>>({});
  const [curlOut, setCurlOut] = useState<Record<string, React.ReactNode>>({});
  const [testOut, setTestOut] = useState<Record<string, React.ReactNode>>({});
  const [, setTick] = useState(0);   // force a re-render after an aggregator toggle

  useEffect(() => {
    if (!open) return;
    setBoards(boardList().map((b) => b.ats + ":" + b.t).join("\n"));
    setRKey(rapidKey());
    setSrcs(rapidSources());
    setCfg(keyedCfg());
    setCurl({});
    setCurlOut({});
    setTestOut({});
  }, [open]);

  function patch(id: string, field: keyof RapidSource, value: string | boolean) {
    setSrcs(srcs.map((s) => (s.id === id ? { ...s, [field]: value } : s)));
  }

  function readCurl(id: string) {
    const r = parseCurl(curl[id] || "");
    if (!r.ok) {
      setCurlOut({ ...curlOut, [id]: <span style={{ color: "var(--none)" }}>{r.error}</span> });
      return;
    }
    setSrcs(
      srcs.map((s) =>
        s.id === id
          ? {
              ...s,
              host: r.host || "",
              path: templatizePath(r.path || ""),
              method: r.method || "",
              body: r.body || "",
              headers: r.headers || null,
              key: r.key || s.key,
            }
          : s,
      ),
    );
    setCurlOut({
      ...curlOut,
      [id]: (
        <span style={{ color: "var(--audited)" }}>
          Read it. Host, path{r.key ? ", key" : ""}
          {r.method !== "GET" ? ", " + r.method : ""} filled in. Search values were turned into {"{q}"}{" "}
          and {"{loc}"}. Press Test.
        </span>
      ),
    });
  }

  /**
   * One live call per source, so a wrong path is a five-second self-check
   * rather than a support question. Reports the HTTP status, how many rows came
   * back, and the first row as this adapter mapped it.
   */
  async function test(s: RapidSource) {
    const key = s.key || rKey.trim();
    if (!key) {
      setTestOut({ ...testOut, [s.id]: <span style={{ color: "var(--none)" }}>Add your RapidAPI key first.</span> });
      return;
    }
    if (!s.host || !s.path) {
      setTestOut({ ...testOut, [s.id]: <span style={{ color: "var(--none)" }}>Needs a host and a path.</span> });
      return;
    }
    setTestOut({ ...testOut, [s.id]: <><Spinner /> calling {s.host}...</> });
    const path = s.path
      .replace(/\{q\}/g, encodeURIComponent("designer"))
      .replace(/\{loc\}/g, encodeURIComponent("United States"));
    const u =
      "https://" + s.host.replace(/^https?:\/\//, "").replace(/\/$/, "") +
      (path.charAt(0) === "/" ? path : "/" + path);
    try {
      const r = await fetch(u, { headers: { "x-rapidapi-key": key, "x-rapidapi-host": s.host } });
      const txt = await r.text();
      let body: unknown = null;
      try {
        body = JSON.parse(txt);
      } catch {
        body = null;
      }
      if (!r.ok) {
        /* Always show what the API actually said. Guessing was wrong: RapidAPI's
           gateway uses 404 for "API doesn't exists", 403 for "not subscribed"
           and 401 for a bad key. Sending someone to re-copy a path that was
           already correct wastes their time. */
        let said = "";
        try {
          const b = body as any;
          said = (b && (b.message || b.error || b.detail)) || "";
        } catch {
          said = "";
        }
        let hint = "";
        if (r.status === 404)
          hint = /doesn.t exist/i.test(said)
            ? "The HOST is wrong, or your key is not on an app subscribed to it. Check the host spelling against the code snippet on the listing page."
            : "The host is fine but this ENDPOINT does not exist on that API. Open the playground and copy the exact path, or paste the whole curl and press Read it.";
        else if (r.status === 403)
          hint = "Your key works but this app is not subscribed to this API. Open the listing on RapidAPI and press Subscribe, then use the key from the SAME app.";
        else if (r.status === 401)
          hint = "The key was not accepted. Re-copy it from the Authorization tab of your RapidAPI app, with no spaces or line breaks.";
        else if (r.status === 429) hint = "Rate limited or over your plan quota. Wait a moment, or check your usage on RapidAPI.";
        else if (r.status >= 500) hint = "That API is erroring on its own side. Not something you can fix here.";
        setTestOut({
          ...testOut,
          [s.id]: (
            <>
              <span style={{ color: "var(--none)" }}>
                HTTP {r.status}
                {said ? ". It said: " + said : ""} {hint}
              </span>
              <div style={{ color: "var(--muted)", fontSize: 11.6, marginTop: 3, wordBreak: "break-all" }}>
                Called: {u}
              </div>
            </>
          ),
        });
        return;
      }
      const rows = pickRows(body);
      const mapped = rows.map((x) => mapRapidRow(x, { id: s.id, label: s.label })).filter(Boolean);
      if (!rows.length)
        setTestOut({
          ...testOut,
          [s.id]: <span style={{ color: "var(--estimated)" }}>Reached it, but found no rows. The path may need different parameters.</span>,
        });
      else if (!mapped.length)
        setTestOut({
          ...testOut,
          [s.id]: (
            <span style={{ color: "var(--estimated)" }}>
              {rows.length} rows, but none had both a title and a link. Field names:{" "}
              {Object.keys(rows[0]).slice(0, 10).join(", ")}
            </span>
          ),
        });
      else
        setTestOut({
          ...testOut,
          [s.id]: (
            <span style={{ color: "var(--audited)" }}>
              Working. {rows.length} rows, {mapped.length} usable. First: <b>{mapped[0]!.title}</b>
              {mapped[0]!.co ? " at " + mapped[0]!.co : ""}
              {mapped[0]!.loc ? ", " + mapped[0]!.loc : ""}
            </span>
          ),
        });
    } catch (e) {
      setTestOut({
        ...testOut,
        [s.id]: (
          <span style={{ color: "var(--none)" }}>
            {String((e as Error).message || e)}. If this says Failed to fetch, the API is not sending
            CORS headers and cannot be used from a browser.
          </span>
        ),
      });
    }
  }

  function addCustom() {
    const saved = rapidSaved();
    saved._custom = saved._custom || [];
    /* Date.now() alone collides: adding three rows inside one millisecond gave
       all three the same id and they overwrote each other on save. */
    let nid = "";
    let guard = 0;
    do {
      nid = "c" + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
      guard++;
    } while (guard < 20 && saved._custom.some((c) => c.id === nid));
    saved._custom.push({ id: nid, label: "", host: "", path: "/search?query={q}&location={loc}" });
    saveRapid(saved);
    setSrcs(rapidSources());
  }

  function removeCustom(id: string) {
    const saved = rapidSaved();
    saved._custom = (saved._custom || []).filter((c) => c.id !== id);
    delete saved[id];
    saveRapid(saved);
    setSrcs(rapidSources());
  }

  function saveAll() {
    const list: CompanyBoard[] = boards
      .split(/\n+/)
      .map((l) => {
        const p = l.split(":");
        return p.length === 2
          ? { ats: p[0].trim().toLowerCase() as CompanyBoard["ats"], t: p[1].trim() }
          : null;
      })
      .filter((b): b is CompanyBoard => !!b && ["greenhouse", "lever", "ashby"].indexOf(b.ats) >= 0);
    saveBoardList(list);

    const nextCfg: KeyedCfg = {};
    Object.keys(KEYED_SOURCES).forEach((k) => {
      const fields = KEYED_SOURCES[k].fields;
      fields.forEach((f) => {
        const v = (cfg[k] && cfg[k][f]) || "";
        if (!v.trim()) return;
        nextCfg[k] = nextCfg[k] || {};
        nextCfg[k][f] = v.trim();
      });
    });
    if (rKey.trim()) nextCfg._rapidapi = { key: rKey.trim() };
    saveKeyedCfg(nextCfg);

    const rs: RapidSaved = {};
    const customIds: Record<string, 1> = {};
    srcs.filter((s) => s.custom).forEach((s) => (customIds[s.id] = 1));
    srcs.forEach((s) => {
      if (s.custom) return;
      rs[s.id] = {
        host: s.host, path: s.path, key: s.key, off: s.off,
        /* headers, method and body come from a pasted curl, never from a text
           field, so carry them through untouched. */
        headers: s.headers, method: s.method, body: s.body,
      };
    });
    rs._custom = srcs
      .filter((s) => s.custom)
      .map((s) => ({
        id: s.id, label: s.label, host: s.host, path: s.path, key: s.key,
        headers: s.headers, method: s.method, body: s.body, off: s.off,
      }));
    saveRapid(rs);

    const liveRapid = rKey.trim() ? srcs.filter((x) => x.host && x.path && !x.off).length : 0;
    ui.toast(
      list.length + " boards, " + liveRapid + " RapidAPI sources and " +
        Object.keys(nextCfg).filter((k) => k.charAt(0) !== "_").length + " other keyed sources saved",
    );
  }

  return (
    <Veil on={open} wide label="Where the roles come from">
      <h3>Where the roles come from</h3>
      <p>
        Your browser calls each of these directly. Nothing about you is sent anywhere, which is also
        the reason some sites cannot be included: a browser can only read what a site permits it to.
      </p>

      <h4 className="lh">Live now, no setup</h4>
      <p style={{ fontSize: 12.5, color: "var(--muted)", marginBottom: 6 }}>
        Click a source to switch it on or off. Off sources are skipped on the next search.
      </p>
      <ul className="atslist">
        {AGGREGATORS.map((a) => {
          const on = isAggOn(a.id);
          return (
            <li
              className={on ? "ok" : ""}
              key={a.id}
              onClick={() => { setAggOn(a.id, !on); setTick((t) => t + 1); }}
              style={{ cursor: "pointer", userSelect: "none", opacity: on ? 1 : 0.5 }}
              title={on ? "On — click to turn off" : "Off — click to turn on"}
            >
              <span className="m">{on ? "✓" : "○"}</span>
              <span>{a.label}</span>
              <span className={"grade " + (on ? "g-audited" : "g-none")} style={{ marginLeft: "auto" }}>
                {on ? "On" : "Off"}
              </span>
            </li>
          );
        })}
        <li className="ok">
          <span className="m">✓</span>
          <span>{boardList().length} company boards on Greenhouse, Lever and Ashby</span>
        </li>
      </ul>

      <h4 className="lh">Company boards</h4>
      <p style={{ fontSize: 12.5, color: "var(--muted)", marginBottom: 6 }}>
        One per line as <code>ats:token</code>. The token is the company name in the board URL, for
        example <code>greenhouse:webflow</code>. Supported: greenhouse, lever, ashby.
      </p>
      <textarea
        value={boards}
        onChange={(e) => setBoards(e.target.value)}
        style={{ minHeight: 110, fontFamily: "ui-monospace,Menlo,monospace", fontSize: 12.5 }}
      />

      <h4 className="lh">Add LinkedIn and Indeed coverage, legitimately</h4>
      <p style={{ fontSize: 12.5, color: "var(--ink-2)", marginBottom: 4 }}>
        These services license and redistribute the same inventory rather than scraping it. A free key
        switches them on and the key stays in your browser.
      </p>

      <div style={{ padding: "11px 0", borderBottom: "2px solid var(--rule)" }}>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <b style={{ fontSize: 13.5 }}>RapidAPI key</b>
          <span className={"grade " + (rKey ? "g-audited" : "g-none")}>
            <span className="dot" />
            {rKey ? "Connected" : "Off"}
          </span>
        </div>
        <div style={{ fontSize: 12.5, color: "var(--ink-2)", margin: "3px 0 6px" }}>
          One key covers every RapidAPI source below. RapidAPI issues a single key per app and it works
          for every API that app is subscribed to, so you paste it once.
        </div>
        <input
          type="password" placeholder="x-rapidapi-key" autoComplete="off" style={{ marginBottom: 5 }}
          value={rKey} onChange={(e) => setRKey(e.target.value)}
        />
        <div style={{ fontSize: 12 }}>
          <a href="https://rapidapi.com/developer/apps" target="_blank" rel="noopener">
            Find your key on RapidAPI
          </a>{" "}
          &middot;{" "}
          <span style={{ color: "var(--muted)" }}>
            Stored in this browser only. It is never sent anywhere except to RapidAPI.
          </span>
        </div>
      </div>

      {srcs.map((x) => {
        const ready = x.host && x.path;
        return (
          <div key={x.id} style={{ padding: "11px 0", borderBottom: "1px solid var(--hairline)" }}>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <b style={{ fontSize: 13.5 }}>{x.label || x.id}</b>
              <span className={"grade " + (ready && (rKey || x.key) && !x.off ? "g-audited" : "g-none")}>
                <span className="dot" />
                {x.off ? "Off" : ready && (rKey || x.key) ? "On" : "Needs a host"}
              </span>
              {x.unofficial && (
                <span className="tag" style={{ borderColor: "var(--estimated)", color: "var(--estimated)" }}>
                  unofficial
                </span>
              )}
            </div>
            <div style={{ fontSize: 12.5, color: "var(--ink-2)", margin: "3px 0 6px" }}>{x.note}</div>
            {x.signup && (
              <div style={{ fontSize: 12.5, margin: "0 0 6px" }}>
                <a href={x.signup} target="_blank" rel="noopener">Get a free key</a>
                <span style={{ color: "var(--muted)" }}> — then paste it into this source&apos;s key field below.</span>
              </div>
            )}
            {x.custom && (
              <input
                type="text" placeholder="a name for this source" style={{ marginBottom: 5 }}
                value={x.label} onChange={(e) => patch(x.id, "label", e.target.value)}
              />
            )}
            <textarea
              rows={2}
              placeholder="Paste the curl command from the API playground here, then press Read it. Fills the host, path, method and key for you."
              style={{ marginBottom: 5, fontFamily: "ui-monospace,Menlo,monospace", fontSize: 11.6 }}
              value={curl[x.id] || ""}
              onChange={(e) => setCurl({ ...curl, [x.id]: e.target.value })}
            />
            <div style={{ marginBottom: 6 }}>
              <button className="btn quiet sm" onClick={() => readCurl(x.id)}>Read it</button>
              <span style={{ fontSize: 12.2, marginLeft: 8 }}>{curlOut[x.id]}</span>
            </div>
            <input
              type="text" placeholder="host, for example jsearch.p.rapidapi.com" style={{ marginBottom: 5 }}
              value={x.host} onChange={(e) => patch(x.id, "host", e.target.value)}
            />
            <input
              type="text" placeholder="path, use {q} for the search text and {loc} for the location"
              style={{ marginBottom: 5 }}
              value={x.path} onChange={(e) => patch(x.id, "path", e.target.value)}
            />
            <input
              type="password" autoComplete="off" style={{ marginBottom: 5 }}
              placeholder="key for this source only, leave blank to use the shared key above"
              value={x.key} onChange={(e) => patch(x.id, "key", e.target.value)}
            />
            {x.method && x.method !== "GET" && (
              <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 5 }}>
                {x.method}
                {x.body ? " with a body" : ""}
                {x.headers && Object.keys(x.headers).length
                  ? ", " + Object.keys(x.headers).length + " extra header(s)"
                  : ""}
              </div>
            )}
            <label style={{ fontSize: 12.2, color: "var(--muted)" }}>
              <input type="checkbox" checked={x.off} onChange={(e) => patch(x.id, "off", e.target.checked)} /> turn
              this source off
            </label>{" "}
            <button className="btn quiet sm" style={{ marginLeft: 8 }} onClick={() => test(x)}>Test</button>
            {x.custom && (
              <button className="btn quiet sm" onClick={() => removeCustom(x.id)}> Remove</button>
            )}
            <div style={{ fontSize: 12.2, marginTop: 5 }}>{testOut[x.id]}</div>
          </div>
        );
      })}

      <div style={{ padding: "11px 0", borderBottom: "1px solid var(--hairline)" }}>
        <button className="btn sm" onClick={addCustom}>Add another RapidAPI source</button>
        <div style={{ fontSize: 12.2, color: "var(--muted)", marginTop: 5 }}>
          Trying a new scraper? Subscribe on RapidAPI, copy the host and the endpoint path from its
          playground, paste them here and press Test. The adapter reads whatever shape the response
          comes back in, so no code change is needed.
        </div>
      </div>

      {Object.keys(KEYED_SOURCES).map((k) => {
        const d = KEYED_SOURCES[k];
        const on = cfg[k] && Object.keys(cfg[k]).length;
        return (
          <div key={k} style={{ padding: "11px 0", borderBottom: "1px solid var(--hairline)" }}>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <b style={{ fontSize: 13.5 }}>{d.label}</b>
              <span className={"grade " + (on ? "g-audited" : "g-none")}>
                <span className="dot" />
                {on ? "Connected" : "Off"}
              </span>
            </div>
            <div style={{ fontSize: 12.5, color: "var(--ink-2)", margin: "3px 0 6px" }}>{d.note}</div>
            {d.fields.map((f) => (
              <input
                key={f} type="text" placeholder={f} style={{ marginBottom: 5 }}
                value={(cfg[k] && cfg[k][f]) || ""}
                onChange={(e) => setCfg({ ...cfg, [k]: { ...(cfg[k] || {}), [f]: e.target.value } })}
              />
            ))}
            <div style={{ fontSize: 12 }}>
              <a href={d.signup} target="_blank" rel="noopener">Get a free key</a>
            </div>
          </div>
        );
      })}

      <h4 className="lh">Cannot be included, and why</h4>
      <ul className="atslist">
        {BLOCKED_SOURCES.map((b) => (
          <li className="no" key={b.name}>
            <span className="m">✕</span>
            <span>
              <b>{b.name}</b>
              {b.kind === "cors" && (
                <>
                  {" "}
                  <span className="tag" style={{ borderColor: "var(--estimated)", color: "var(--estimated)" }}>
                    a proxy would fix this
                  </span>
                </>
              )}
              <span style={{ display: "block", color: "var(--muted)", fontSize: 12.2, marginTop: 2 }}>
                {b.why}
              </span>
            </span>
          </li>
        ))}
      </ul>

      <div className="btnrow" style={{ marginTop: 18 }}>
        <button className="btn" onClick={saveAll}>Save sources</button>
        <button className="btn quiet" onClick={() => ui.close("sources")}>Close</button>
      </div>
    </Veil>
  );
}
