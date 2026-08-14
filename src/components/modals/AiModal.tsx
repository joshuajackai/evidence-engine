import { useEffect, useState } from "react";
import type { ModelOption, ProviderId } from "@/types";
import { Veil } from "@/components/Veil";
import { Msg, Spinner } from "@/components/Toast";
import { useUi } from "@/ui/UiContext";
import { AI_DEFAULTS, PROVIDER_ORDER, providerFromKey } from "@/lib/ai/providers";
import { clearModelCache, discoverModels, pickClosestModel } from "@/lib/ai/models";
import { AI, AI_LOG, AI_STATE, aiCall, aiModel, aiSave, clearAiLog, onAiLog } from "@/lib/ai/client";
import { startOpenRouterSSO } from "@/lib/ai/sso";
import { copyText } from "@/lib/util";

const CUSTOM = "__custom";

export function AiModal({ onChange }: { onChange(): void }) {
  const ui = useUi();
  const [prov, setProv] = useState<ProviderId>(AI.provider || "openrouter");
  const [key, setKey] = useState(AI.key);
  const [baseUrl, setBaseUrl] = useState(AI.baseUrl || "");
  const [models, setModels] = useState<ModelOption[]>(AI_DEFAULTS[AI.provider || "openrouter"].models);
  const [sel, setSel] = useState(AI.model || AI_DEFAULTS[AI.provider || "openrouter"].model || "");
  const [customModel, setCustomModel] = useState("");
  const [note, setNote] = useState<React.ReactNode>("");
  const [msg, setMsg] = useState<{ kind: "" | "good" | "bad"; node: React.ReactNode } | null>(null);
  const [debugOpen, setDebugOpen] = useState(false);
  const [, force] = useState(0);

  useEffect(() => onAiLog(() => force((n) => n + 1)), []);

  const open = ui.isOpen("ai");
  useEffect(() => {
    if (!open) return;
    setProv(AI.provider || "openrouter");
    setKey(AI.key);
    setBaseUrl(AI.baseUrl || "");
    setMsg(null);
    switchProvider(AI.provider || "openrouter", AI.model);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  /**
   * Render whatever we have now, then quietly upgrade to the provider's own
   * list the moment it arrives. The user never waits on a network call to see
   * options, and never sees a model that no longer exists.
   */
  function switchProvider(p: ProviderId, keepModel?: string) {
    setProv(p);
    const d = AI_DEFAULTS[p];
    const opts = d.live && d.live.length ? d.live : d.models;
    setModels(opts);
    const want = keepModel && opts.some((m) => m[0] === keepModel) ? keepModel : d.model || CUSTOM;
    if (keepModel && !opts.some((m) => m[0] === keepModel)) {
      setSel(CUSTOM);
      setCustomModel(keepModel);
    } else {
      setSel(want || CUSTOM);
      setCustomModel("");
    }
    refreshModels(p, keepModel);
  }

  function refreshModels(p: ProviderId, keepModel?: string) {
    const d = AI_DEFAULTS[p];
    if (!d || !d.modelsUrl) {
      setNote("");
      return;
    }
    const k = key || AI.key || "";
    if (!k && !d.modelsNoKey) {
      setNote("Paste your key and the live model list loads automatically.");
      return;
    }
    setNote(
      <>
        <Spinner />
        Reading {d.label}'s current model list...
      </>,
    );
    discoverModels(p, k)
      .then((list) => {
        if (!list) return;
        d.live = list;
        setModels(list);
        const want = keepModel && list.some((m) => m[0] === keepModel) ? keepModel : d.model;
        if (want && list.some((m) => m[0] === want)) setSel(want);
        setNote(list.length + " models available from " + d.label + ", newest first.");
      })
      .catch((e) => {
        setNote(
          "Could not read the live model list (" + e.message +
            "). The built-in list is being used, and you can type any model name.",
        );
      });
  }

  function chosenModel(): string {
    return sel === CUSTOM ? customModel.trim() : sel;
  }

  async function saveAndTest() {
    AI.provider = prov;
    AI.key = key.trim();
    AI.model = chosenModel();
    AI.baseUrl = baseUrl.trim();
    aiSave();
    onChange();
    if (!(AI.key && AI.key.length > 10)) {
      setMsg({ kind: "bad", node: "Add a key first." });
      return;
    }
    setMsg({
      kind: "",
      node: (
        <>
          <Spinner />
          Testing {AI_DEFAULTS[AI.provider].label} + {aiModel()}...
        </>
      ),
    });
    try {
      const reply = await aiCall("Reply with exactly the single word: connected", { maxTokens: 40 });
      setMsg({
        kind: "good",
        node: (
          <>
            Connected. Model replied:{" "}
            <code style={{ background: "#F0F0F1", padding: "1px 5px", borderRadius: 3 }}>
              {reply.slice(0, 80)}
            </code>
          </>
        ),
      });
      setTimeout(() => ui.close("ai"), 1400);
    } catch (e) {
      setMsg({
        kind: "bad",
        node: (
          <>
            Could not reach the model: {(e as Error).message}
            <br />
            <br />
            Open the Debug drawer below to see the exact request and response.
          </>
        ),
      });
      setDebugOpen(true);
    }
  }

  /**
   * A connection can fail at five separate layers and one sentence covered all
   * of them. Test each layer in order and name the one that broke, because
   * "check your key" is useless advice when the key is fine and the model id is
   * retired.
   */
  async function diagnose() {
    const d = AI_DEFAULTS[prov];
    const k = key.trim() || AI.key;
    const model = chosenModel();
    const rows: { ok: boolean; label: string; detail?: string }[] = [];
    let failed = false;
    const line = (ok: boolean, label: string, detail?: string) => {
      rows.push({ ok, label, detail });
      if (!ok) failed = true;
    };
    const paint = (head: string) =>
      setMsg({
        kind: failed ? "bad" : "",
        node: (
          <>
            {head && <b>{head}</b>}
            <ul className="atslist">
              {rows.map((r, i) => (
                <li className={r.ok ? "ok" : "no"} key={i}>
                  <span className="m">{r.ok ? "✓" : "✕"}</span>
                  <span>
                    <b>{r.label}</b>
                    {r.detail ? ". " + r.detail : ""}
                  </span>
                </li>
              ))}
            </ul>
          </>
        ),
      });

    setMsg({ kind: "", node: <><Spinner />Running the diagnostic...</> });

    line(!!k, k ? "A key is present" : "No key", k ? k.slice(0, 7) + "..." + k.slice(-4) : "Paste one above.");
    if (!k) {
      paint("Stopped at the first step. ");
      return;
    }

    /* Can the browser reach the provider at all, and is the key accepted? The
       catalogue endpoint answers both at once and costs nothing. */
    let live: ModelOption[] | null = null;
    if (d.modelsUrl) {
      try {
        clearModelCache(prov);
        live = await discoverModels(prov, k);
        line(true, "Reached " + d.label + " from this browser", (live?.length || 0) + " models offered");
      } catch (e) {
        const em = String((e as Error).message || e);
        if (/failed to fetch|network|cors/i.test(em))
          line(false, "The browser could not reach " + d.label,
            "This is usually the provider refusing browser requests, an extension blocking it, or no connection.");
        else if (/401|403/.test(em)) line(false, "The key was rejected", em);
        else line(false, "Could not read the model list", em);
        paint("");
        return;
      }
    } else line(true, "Custom endpoint", "Skipping the catalogue check");

    if (live && live.length) {
      const ok = live.some((x) => x[0] === model);
      if (ok) line(true, "The model exists", model);
      else {
        const alt = pickClosestModel(model, live);
        line(false, "That model is not in " + d.label + "'s list any more",
          model + ". Closest live match is " + alt + ", which will be used automatically.");
      }
    }

    /* A real round trip, deliberately tiny. */
    try {
      const saveKey = AI.key;
      const saveProv = AI.provider;
      const saveModel = AI.model;
      AI.key = k;
      AI.provider = prov;
      AI.model = model;
      const t0 = Date.now();
      const txt = await aiCall("Reply with the single word: ready", {
        maxTokens: 24,
        system: "Reply with one word.",
      });
      AI.key = saveKey;
      AI.provider = saveProv;
      AI.model = saveModel;
      line(true, "Round trip succeeded", Date.now() - t0 + "ms, replied " + JSON.stringify(txt.trim().slice(0, 20)));
      if (AI_STATE.swapped)
        line(true, "Model was swapped automatically",
          AI_STATE.swapped.from + " is retired, used " + AI_STATE.swapped.to + " instead");
    } catch (e) {
      line(false, "The completion call failed", (e as Error).message);
    }
    paint(failed ? "Found the problem. " : "Everything works. ");
  }

  const d = AI_DEFAULTS[prov];

  return (
    <Veil on={open} wide>
      <h3>Connect a model</h3>
      <p>
        Optional. Everything works without it. Requests go straight from this browser to the provider,
        and the key is stored on this device only. There is no server in this product for it to travel
        through.
      </p>

      <div className="hero-sso">
        <h4>One click, every major model</h4>
        <p>
          Sign in through OpenRouter and you get Claude, GPT, Gemini, Llama, DeepSeek, Mistral, Grok
          and Qwen behind a single connection. No key to copy, no account to set up here. You approve
          it on OpenRouter and land back on this page connected.
        </p>
        <button
          className="btn sso"
          onClick={() => {
            setMsg({ kind: "", node: <><Spinner />Taking you to OpenRouter...</> });
            startOpenRouterSSO().catch((e) => setMsg({ kind: "bad", node: e.message }));
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 12.5 L9.5 18 L20 6.5" />
          </svg>
          Sign in with OpenRouter
        </button>
      </div>

      <div className="or"><span>or use a provider key directly</span></div>

      <div className="prov">
        {PROVIDER_ORDER.map((k) => {
          const p = AI_DEFAULTS[k];
          return (
            <button type="button" key={k} aria-pressed={prov === k} onClick={() => switchProvider(k, prov === k ? AI.model : "")}>
              <span className="pi" style={{ background: p.colour }}>{p.initials}</span>
              <span>
                {p.label}
                <small>{p.note}</small>
              </span>
            </button>
          );
        })}
      </div>

      <div className="row" style={{ marginTop: 14 }}>
        <div className="field">
          <label htmlFor="aiProv">Provider</label>
          <select id="aiProv" value={prov} onChange={(e) => switchProvider(e.target.value as ProviderId)}>
            <option value="openrouter">OpenRouter</option>
            <option value="anthropic">Anthropic</option>
            <option value="openai">OpenAI</option>
            <option value="google">Google Gemini</option>
            <option value="groq">Groq</option>
            <option value="deepseek">DeepSeek</option>
            <option value="mistral">Mistral</option>
            <option value="xai">xAI Grok</option>
            <option value="together">Together AI</option>
            <option value="custom">Other, OpenAI compatible</option>
          </select>
        </div>
        <div className="field">
          <label htmlFor="aiModelSel">Model</label>
          <select id="aiModelSel" value={sel} onChange={(e) => setSel(e.target.value)}>
            {models.map((m) => (
              <option value={m[0]} key={m[0]}>{m[1]}</option>
            ))}
            <option value={CUSTOM}>Something else, type it in</option>
          </select>
          <div className="hint">{note}</div>
          {sel === CUSTOM && (
            <input
              type="text" placeholder="exact model id" autoFocus
              value={customModel} onChange={(e) => setCustomModel(e.target.value)}
            />
          )}
        </div>
      </div>

      <p style={{ fontSize: 12.5, color: "var(--muted)", margin: "-6px 0 12px" }}>
        {d.keys ? (
          <>
            Get a {d.label} key:{" "}
            <a href={d.keys} target="_blank" rel="noopener">{d.keys.replace(/^https:\/\//, "")}</a>, then
            paste it below.
          </>
        ) : (
          "Enter the endpoint and key for your own OpenAI-compatible service."
        )}
      </p>

      {prov === "custom" && (
        <div className="field">
          <label htmlFor="aiBase">API endpoint</label>
          <input
            id="aiBase" type="text" placeholder="https://your-host/v1/chat/completions"
            value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)}
          />
        </div>
      )}

      <div className="field">
        <label htmlFor="aiKey">API key</label>
        <input
          id="aiKey" type="text" placeholder="sk-..." autoComplete="off" spellCheck={false}
          value={key}
          onChange={(e) => {
            const v = e.target.value;
            setKey(v);
            /* Nobody should have to know which provider their key belongs to. */
            const guess = providerFromKey(v.trim());
            if (guess && guess !== prov) {
              switchProvider(guess);
              setMsg({ kind: "good", node: "Recognised a " + AI_DEFAULTS[guess].label + " key. Provider and model set for you." });
            }
          }}
          onBlur={() => refreshModels(prov, chosenModel())}
        />
        <div className="hint">
          Stored in this browser only. Clearing site data removes it. Use a key with a spending limit
          set.
        </div>
      </div>

      <div className="btnrow">
        <button className="btn" onClick={saveAndTest}>Save and test</button>
        <button className="btn ghost" onClick={diagnose}>Run full diagnostic</button>
        <button
          className="btn quiet"
          onClick={() => {
            AI.provider = "anthropic";
            AI.key = "";
            AI.model = "";
            AI.baseUrl = "";
            aiSave();
            onChange();
            setKey("");
            setMsg({ kind: "good", node: "Disconnected. The key is gone from this device." });
          }}
        >
          Disconnect
        </button>
        <button className="btn quiet" onClick={() => ui.close("ai")}>Close</button>
      </div>
      {msg && <Msg kind={msg.kind}>{msg.node}</Msg>}

      <details
        open={debugOpen}
        onToggle={(e) => setDebugOpen((e.target as HTMLDetailsElement).open)}
        style={{ marginTop: 14, border: "1px solid var(--hairline)", borderRadius: 8, padding: 0 }}
      >
        <summary style={{ cursor: "pointer", padding: "10px 12px", fontSize: 13, color: "var(--ink-2)", userSelect: "none" }}>
          Debug: last AI calls
        </summary>
        <div style={{ padding: "8px 12px 12px" }}>
          <p style={{ fontSize: 12, color: "var(--muted)", margin: "0 0 8px" }}>
            Every request and response is logged here (keys redacted). Open this when a call returns
            empty or errors, so you can see exactly what the provider sent back. This also appears in
            the browser console with the tag [EvidenceEngine AI].
          </p>
          <div style={{ display: "flex", gap: 8, margin: "0 0 8px" }}>
            <button type="button" className="btn sm quiet" onClick={clearAiLog}>Clear log</button>
            <button
              type="button"
              className="btn sm quiet"
              onClick={() => {
                copyText(debugText());
                ui.toast("Debug log copied.");
              }}
            >
              Copy log to clipboard
            </button>
          </div>
          <div
            style={{
              fontFamily: "ui-monospace,Menlo,Consolas,monospace", fontSize: 11.5, color: "var(--ink-2)",
              background: "#F7F7F8", borderRadius: 6, padding: 10, maxHeight: 320, overflow: "auto",
              whiteSpace: "pre-wrap",
            }}
          >
            {debugText()}
          </div>
        </div>
      </details>

      <div className="quarantine" style={{ marginTop: 18 }}>
        <div className="qh">
          <span className="dot" />
          What the model is not allowed to do
        </div>
        <p>
          It cannot write a claim for you and it cannot produce a number you did not give it. Those
          limits are in the instructions the tool sends with every request. It is there to question
          you, tighten your own words, and tell you what a recruiter would doubt.
        </p>
      </div>
    </Veil>
  );
}

function debugText(): string {
  if (!AI_LOG.length) return "No calls yet.";
  return AI_LOG.map((e, i) => {
    const head =
      i + 1 + ". [" + e.at + "] " + e.provider + " / " + e.model + " -> " +
      (e.status != null ? "HTTP " + e.status : "no response") +
      (e.elapsedMs != null ? " (" + e.elapsedMs + "ms)" : "") +
      (e.attempt && e.attempt > 1 ? " retry#" + e.attempt : "") +
      (e.textLen != null ? " text:" + e.textLen + "ch" : "") +
      (e.error ? " ERROR" : e.ok === false ? " NOT OK" : "");
    const lines = [head];
    lines.push("  URL: " + e.url);
    lines.push("  Headers: " + JSON.stringify(e.headers || {}));
    lines.push("  Request body: " + e.requestBodyPreview);
    if (e.responseBodyPreview != null) lines.push("  Response body: " + e.responseBodyPreview);
    if (e.error) lines.push("  Error: " + e.error);
    return lines.join("\n");
  }).join("\n\n");
}
