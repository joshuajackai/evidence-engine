import { useEffect, useState } from "react";
import { Veil } from "@/components/Veil";
import { Msg, Spinner } from "@/components/Toast";
import { useUi } from "@/ui/UiContext";
import { S } from "@/store/state";
import { save } from "@/store/storage";
import { bullet } from "@/lib/util";
import { readabilitySuggestions } from "@/lib/doc/ats";
import { aiCall, aiReady } from "@/lib/ai/client";

/**
 * Nothing here is applied until the user says so. Anything that would change a
 * fact or add a claim is refused outright rather than offered, which is why
 * only the two wording checks carry a checkbox at all.
 */
export function AtsModal({ atsFailed }: { atsFailed: string[] }) {
  const ui = useUi();
  const open = ui.isOpen("ats");
  const [ticked, setTicked] = useState<Record<number, boolean>>({});
  const [msg, setMsg] = useState<{ kind: "" | "good" | "bad"; node: React.ReactNode } | null>(null);
  const sugg = readabilitySuggestions(atsFailed);

  useEffect(() => {
    if (open) {
      setTicked({});
      setMsg(null);
    }
  }, [open]);

  async function apply() {
    const picks = sugg.filter((_, i) => ticked[i]);
    if (!picks.length) {
      setMsg({ kind: "bad", node: "Tick at least one line to rewrite." });
      return;
    }
    if (!aiReady()) {
      setMsg({
        kind: "bad",
        node: "Rewriting needs a connected model. Use Connect AI, or edit the lines yourself on the Evidence step.",
      });
      return;
    }
    setMsg({
      kind: "",
      node: (
        <>
          <Spinner />
          Rewriting {picks.length} line{picks.length > 1 ? "s" : ""}...
        </>
      ),
    });
    const payload = picks
      .map((p) => {
        const u = S.units.filter((x) => x.id === p.id)[0];
        return u ? { id: u.id, line: bullet(u) } : null;
      })
      .filter(Boolean) as { id: number; line: string }[];
    try {
      const txt = await aiCall(
        "Rewrite each numbered line below so it opens with a strong specific verb and reads " +
          "tighter. Keep every fact, every number and every claim exactly as written. Add nothing. " +
          "Remove nothing factual. Return ONLY valid JSON, an array of {id, rewritten}. No " +
          "commentary, no code fences.\n\n" +
          payload.map((p) => p.id + ": " + p.line).join("\n"),
      );
      const mm = txt.match(/\[[\s\S]*\]/);
      if (!mm) throw new Error("The model did not return a list.");
      const arr = JSON.parse(mm[0]);
      let n = 0;
      arr.forEach((o: any) => {
        const u = S.units.filter((x) => String(x.id) === String(o.id))[0];
        if (u && o.rewritten) {
          u.action = String(o.rewritten).replace(/\.$/, "");
          n++;
        }
      });
      save();
      setMsg({
        kind: "good",
        node: n + " line" + (n > 1 ? "s" : "") + " rewritten. Check them on the Evidence step before you send anything.",
      });
      setTimeout(() => ui.close("ats"), 1800);
    } catch (e) {
      setMsg({ kind: "bad", node: "Rewrite failed: " + (e as Error).message });
    }
  }

  return (
    <Veil on={open} wide label="Suggested improvements">
      <h3>Suggested improvements</h3>
      <p>
        Nothing below is applied until you say so. Anything that would change a fact or add a claim is
        refused outright rather than offered.
      </p>
      <div style={{ marginTop: 16 }}>
        {sugg.map((x, i) => {
          const canAI = x.kind === "verb" || x.kind === "long";
          return (
            <label
              key={i}
              style={{ display: "flex", gap: 10, alignItems: "flex-start", padding: "10px 0", borderBottom: "1px solid var(--hairline)" }}
            >
              {canAI ? (
                <input
                  type="checkbox"
                  style={{ marginTop: 3, width: "auto" }}
                  checked={!!ticked[i]}
                  onChange={(e) => setTicked({ ...ticked, [i]: e.target.checked })}
                />
              ) : (
                <span style={{ width: 13 }} />
              )}
              <span style={{ flex: 1 }}>
                <b style={{ fontSize: 13.5 }}>{x.label}</b>
                {x.detail && (
                  <span style={{ display: "block", fontSize: 12.5, color: "var(--muted)", marginTop: 2 }}>
                    {x.detail}
                  </span>
                )}
                {x.fix && (
                  <span style={{ display: "block", fontSize: 12.5, color: "var(--ink-2)", marginTop: 2 }}>
                    {x.fix}
                  </span>
                )}
                {canAI && (
                  <span style={{ display: "block", fontSize: 12, color: "var(--accent)", marginTop: 3 }}>
                    Tick to let your model rewrite this line. Facts and numbers are held fixed.
                  </span>
                )}
              </span>
            </label>
          );
        })}
      </div>
      <div className="btnrow" style={{ marginTop: 16 }}>
        <button className="btn" onClick={apply}>Apply the ones I ticked</button>
        <button className="btn quiet" onClick={() => ui.close("ats")}>Close</button>
      </div>
      {msg && <Msg kind={msg.kind}>{msg.node}</Msg>}
    </Veil>
  );
}
