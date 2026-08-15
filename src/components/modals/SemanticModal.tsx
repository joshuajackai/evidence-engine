/* =========================================================================
   SEMANTIC GAP RE-CHECK
   Keyword matching is literal, and that produces false negatives constantly. A
   posting asks for "people leadership"; the resume says "cross-collaborated
   across departments". Same thing, zero keyword overlap, and the tool calls it
   a gap.

   The buckets have different permissions, which is the whole design:
     covered -> offer a reword of THEIR line. Translation, not invention.
     implied -> ASK, never assert. This is where fabrication would creep in.
     missing -> no evidence. Stays a gap and is reported as one.
   ========================================================================= */
import { useEffect, useState } from "react";
import type { SemItem } from "@/types";
import { Veil } from "@/components/Veil";
import { Msg, Spinner } from "@/components/Toast";
import { useUi } from "@/ui/UiContext";
import { S } from "@/store/state";
import { save } from "@/store/storage";
import { bullet } from "@/lib/util";
import { aiCall, aiReady } from "@/lib/ai/client";
import { semSystem } from "@/lib/ai/prompts";

export function SemanticModal() {
  const ui = useUi();
  const open = ui.isOpen("sem");
  const [items, setItems] = useState<SemItem[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [done, setDone] = useState<Record<number, string>>({});

  useEffect(() => {
    if (!open) return;
    setItems([]);
    setErr("");
    setDone({});
    if (!aiReady()) return;
    void run(ui.semGaps);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  async function run(gaps: string[]) {
    setBusy(true);
    try {
      const evidence = S.units
        .map((u) =>
          "[" + u.id + "] " + (u.role ? u.role + " at " : "") + u.org + ": " + bullet(u) +
          ((u.tags || []).length ? " (tags: " + u.tags.join(", ") + ")" : ""),
        )
        .join("\n");
      const prompt =
        "A job posting asks for these terms and a literal keyword match found none of them " +
        "in the candidate's resume:\n" + gaps.join(", ") +
        "\n\nHere is everything the candidate actually wrote:\n" + evidence +
        "\n\nFor EACH term return an object with:\n" +
        "  term\n" +
        '  verdict: "covered" if an existing line already describes this in different words, ' +
        '"implied" if the work they described would very likely have involved it but they never said so, ' +
        '"missing" if there is no basis at all\n' +
        "  entry_id: the [id] of the line it relates to, or null\n" +
        "  reason: one short sentence\n" +
        "  rewrite: for covered only, that same line rewritten to use the posting's term naturally. " +
        "Keep every fact and number identical. Null otherwise.\n" +
        "  question: for implied only, the yes or no question to ask the candidate. Null otherwise.\n\n" +
        "Return ONLY a JSON array. No commentary, no code fences.";
      const txt = await aiCall(prompt, { system: semSystem() });
      const m = txt.match(/\[[\s\S]*\]/);
      if (!m) throw new Error("The model did not return a list.");
      setItems(JSON.parse(m[0]));
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const groups: Record<string, SemItem[]> = { covered: [], implied: [], missing: [] };
  items.forEach((x, i) => {
    x.__i = i;
    (groups[x.verdict] || groups.missing).push(x);
  });

  return (
    <Veil on={open} wide label="What you already said, in other words">
      <h3>What you already said, in other words</h3>
      <p>
        Keyword matching is literal, so it reports a gap whenever you described something using
        different vocabulary from the posting. This reads your actual wording and sorts each gap into
        what you already covered, what only you can confirm, and what is genuinely absent.
      </p>

      <div style={{ marginTop: 16 }}>
        {!aiReady() ? (
          <>
            <Msg kind="bad">
              This needs a connected model, because it is reading your wording rather than matching
              strings.
            </Msg>
            <p style={{ marginTop: 12 }}>
              Use <b>Connect AI</b> in the top bar. One click through OpenRouter, or paste a key from
              any provider. Or answer the gaps yourself with the other button.
            </p>
          </>
        ) : busy ? (
          <Msg>
            <Spinner />
            Reading what you actually wrote...
          </Msg>
        ) : err ? (
          <>
            <Msg kind="bad">Could not run the re-check: {err}</Msg>
            <p style={{ marginTop: 12 }}>You can still answer the gaps yourself.</p>
          </>
        ) : !items.length ? (
          <p>Nothing to report.</p>
        ) : (
          <>
            {groups.covered.length > 0 && (
              <>
                <h4 className="lh">You already said this, in other words</h4>
                <p style={{ fontSize: 12.5, color: "var(--ink-2)" }}>
                  Nothing new is being claimed. This is your own line, worded the way the posting
                  words it.
                </p>
                {groups.covered.map((x) => {
                  const u = S.units.filter((z) => String(z.id) === String(x.entry_id))[0];
                  const state = done[x.__i as number];
                  return (
                    <div key={x.__i} style={{ padding: "11px 0", borderBottom: "1px solid var(--hairline)" }}>
                      <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 4 }}>
                        <span className="grade g-audited">
                          <span className="dot" />
                          {x.term}
                        </span>
                      </div>
                      <div style={{ fontSize: 12.5, color: "var(--muted)" }}>{x.reason || ""}</div>
                      {u && (
                        <div style={{ fontSize: 12.5, marginTop: 6 }}>
                          <b>Now:</b> {bullet(u).slice(0, 150)}
                        </div>
                      )}
                      {x.rewrite && (
                        <>
                          <div style={{ fontSize: 12.5, marginTop: 4, color: "var(--audited)" }}>
                            <b>Becomes:</b> {x.rewrite}
                          </div>
                          {state ? (
                            <span className="grade g-audited">
                              <span className="dot" />
                              {state}
                            </span>
                          ) : (
                            <button
                              className="btn sm"
                              style={{ marginTop: 7 }}
                              onClick={() => {
                                const target = S.units.filter((z) => String(z.id) === String(x.entry_id))[0];
                                if (!target) {
                                  ui.toast("Could not find that entry");
                                  return;
                                }
                                target.action = String(x.rewrite).replace(/\.$/, "");
                                if (target.tags.indexOf(x.term) < 0) target.tags.push(x.term);
                                save();
                                setDone({ ...done, [x.__i as number]: "Applied" });
                                ui.toast("Reworded. Check it on the Evidence step.");
                              }}
                            >
                              Use this wording
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  );
                })}
              </>
            )}

            {groups.implied.length > 0 && (
              <>
                <h4 className="lh">Possibly true, only you know</h4>
                <p style={{ fontSize: 12.5, color: "var(--ink-2)" }}>
                  The work you described often involves these. Nothing is added unless you say yes.
                </p>
                {groups.implied.map((x) => {
                  const state = done[x.__i as number];
                  return (
                    <div key={x.__i} style={{ padding: "11px 0", borderBottom: "1px solid var(--hairline)" }}>
                      <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 4 }}>
                        <span className="grade g-estimated">
                          <span className="dot" />
                          {x.term}
                        </span>
                      </div>
                      <div style={{ fontSize: 13 }}>{x.question || "Did you use " + x.term + "?"}</div>
                      {state ? (
                        <span className={"grade " + (state === "Left as a gap" ? "g-none" : "g-audited")}>
                          <span className="dot" />
                          {state}
                        </span>
                      ) : (
                        <div className="btnrow" style={{ marginTop: 7 }}>
                          <button
                            className="btn sm"
                            onClick={() => {
                              const u = S.units.filter((z) => String(z.id) === String(x.entry_id))[0] || S.units[0];
                              if (u && u.tags.indexOf(x.term) < 0) u.tags.push(x.term);
                              save();
                              setDone({ ...done, [x.__i as number]: "Added to " + ((u && u.org) || "your evidence") });
                            }}
                          >
                            Yes, add it
                          </button>
                          <button
                            className="btn quiet sm"
                            onClick={() => setDone({ ...done, [x.__i as number]: "Left as a gap" })}
                          >
                            No
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </>
            )}

            {groups.missing.length > 0 && (
              <>
                <h4 className="lh">Genuinely missing</h4>
                <p style={{ fontSize: 12.5, color: "var(--ink-2)" }}>
                  No basis in anything you wrote. Leave these off and prepare an answer instead.
                </p>
                <div className="tags">
                  {groups.missing.map((x) => (
                    <span className="tag" key={x.__i} style={{ borderColor: "var(--none)", color: "var(--none)" }}>
                      {x.term}
                    </span>
                  ))}
                </div>
              </>
            )}
          </>
        )}
      </div>

      <div className="btnrow" style={{ marginTop: 18 }}>
        <button className="btn quiet" onClick={() => ui.close("sem")}>Close</button>
      </div>
    </Veil>
  );
}
