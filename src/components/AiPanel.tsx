import { useState } from "react";
import { aiCall } from "@/lib/ai/client";
import { AI_PRESETS, AI_PRESET_LABELS } from "@/lib/ai/prompts";
import { evidenceDigest } from "@/lib/doc/score";
import { Spinner } from "@/components/Toast";

/**
 * The model is scoped to work that cannot invent: asking the user questions,
 * tightening words they already wrote, and pointing at gaps. Grading stays
 * deterministic and no number is ever produced here.
 */
export function AiPanel() {
  const [q, setQ] = useState("");
  const [out, setOut] = useState("");
  const [err, setErr] = useState(false);
  const [busy, setBusy] = useState(false);

  async function run(promptText: string) {
    setBusy(true);
    setErr(false);
    setOut("");
    try {
      const txt = await aiCall(promptText + "\n\n--- MY ENTRIES ---\n" + evidenceDigest());
      setOut(txt);
    } catch (e) {
      setErr(true);
      setOut(
        "That did not work: " + (e as Error).message +
          "\n\nCheck the key, the model name, and that your provider allows requests from a browser.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="ai-panel">
      <h3>Ask your AI</h3>
      <div className="sub">
        Runs on your own key, against your own entries. It can question you, tighten your wording and
        spot gaps. It is blocked from inventing numbers.
      </div>
      <div className="chips">
        {AI_PRESET_LABELS.map(([k, label]) => (
          <button
            className="chip"
            key={k}
            onClick={() => {
              setQ(AI_PRESETS[k]);
              run(AI_PRESETS[k]);
            }}
          >
            {label}
          </button>
        ))}
      </div>
      <textarea
        placeholder="Or ask anything about your own experience. For example: which of these lines is weakest, and what should I ask my old manager for?"
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />
      <div className="btnrow" style={{ marginTop: 10 }}>
        <button className="btn sm" disabled={busy} onClick={() => run(q.trim() || AI_PRESETS.tighten)}>
          Send
        </button>
        <button className="btn quiet sm" onClick={() => { setQ(""); setOut(""); setErr(false); }}>
          Clear
        </button>
      </div>
      {(busy || out) && (
        <div className={"ai-out on" + (err ? " err" : "")}>
          {busy ? (
            <>
              <Spinner />
              Thinking...
            </>
          ) : (
            out
          )}
        </div>
      )}
    </div>
  );
}
