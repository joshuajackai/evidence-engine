/* =========================================================================
   GAP CLOSING
   The honest way to raise a match score. Every unmatched requirement is put to
   the user as a question. If they have it, it becomes a real graded entry and
   the score rises because the evidence rose. If they do not, it stays a gap and
   is reported as one. The model is never asked to supply the answer, which is
   the whole reason a score from this tool means anything.
   ========================================================================= */
import { useEffect, useState } from "react";
import { Veil } from "@/components/Veil";
import { useUi } from "@/ui/UiContext";
import { S } from "@/store/state";
import { save } from "@/store/storage";

export function GapModal() {
  const ui = useUi();
  const open = ui.isOpen("gap");
  const [i, setI] = useState(0);
  const [answering, setAnswering] = useState(false);
  const [where, setWhere] = useState("");
  const [metric, setMetric] = useState("");
  const [answers, setAnswers] = useState<Record<string, boolean>>({});

  const list = ui.gapTerms.slice(0, 12);

  useEffect(() => {
    if (open) {
      setI(0);
      setAnswering(false);
      setWhere("");
      setMetric("");
      setAnswers({});
    }
  }, [open]);

  function finish(final: Record<string, boolean>) {
    ui.close("gap");
    const added = Object.keys(final).filter((k) => final[k]).length;
    const real = Object.keys(final).filter((k) => !final[k]);
    if (added) ui.toast(added + " new entries added. Grade them properly on the Evidence step.");
    if (real.length)
      setTimeout(
        () => ui.toast("Still genuinely missing: " + real.slice(0, 4).join(", ") + ". Worth preparing an answer."),
        added ? 2600 : 200,
      );
  }

  function step(next: number, final = answers) {
    if (next >= list.length) {
      finish(final);
      return;
    }
    setI(next);
    setAnswering(false);
    setWhere("");
    setMetric("");
  }

  const g = list[i];
  if (!open || !g) return <Veil on={false}>{null}</Veil>;

  return (
    <Veil on={open} wide>
      <div
        style={{
          fontSize: 11.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".06em",
          color: "var(--muted)", marginBottom: 8,
        }}
      >
        Requirement {i + 1} of {list.length}
      </div>
      <h3>
        Do you have experience with <span style={{ color: "var(--accent)" }}>{g}</span>?
      </h3>

      {!answering && (
        <div>
          <p>
            This posting asks for it and nothing in your evidence mentions it. If you have done it and
            simply never wrote it down, say so and it becomes a real entry. If you have not, that is a
            genuine gap and worth knowing before an interview rather than during one.
          </p>
          <div className="btnrow" style={{ marginTop: 16 }}>
            <button className="btn" onClick={() => setAnswering(true)}>Yes, I have done this</button>
            <button
              className="btn quiet"
              onClick={() => {
                const next = { ...answers, [g]: false };
                setAnswers(next);
                step(i + 1, next);
              }}
            >
              No, not really
            </button>
            <button className="btn quiet" onClick={() => step(i + 1)}>Skip</button>
          </div>
        </div>
      )}

      <div style={{ marginTop: 18, paddingTop: 12, borderTop: "1px solid var(--hairline)" }}>
        <button className="linkbtn" onClick={() => finish(answers)}>Stop and go back</button>
      </div>

      {answering && (
        <div>
          <div className="field" style={{ marginTop: 14 }}>
            <label htmlFor="gapWhere">What did you actually do with it</label>
            <textarea
              id="gapWhere" autoFocus
              placeholder="Built the weekly reporting in SQL for the operations review"
              value={where} onChange={(e) => setWhere(e.target.value)}
            />
            <div className="hint">Your words. Nothing is generated for you here.</div>
          </div>
          <div className="field">
            <label htmlFor="gapMetric">A number, if one exists</label>
            <input
              id="gapMetric" type="text" placeholder="Leave blank if there is not one"
              value={metric} onChange={(e) => setMetric(e.target.value)}
            />
            <div className="hint">Blank is fine and common. An invented number is worse than none.</div>
          </div>
          <div className="btnrow">
            <button
              className="btn"
              onClick={() => {
                if (!where.trim()) {
                  ui.toast("Say where you did it, or choose Not really.");
                  return;
                }
                const org = (S.units[0] && S.units[0].org) || "Previous role";
                S.units.push({
                  id: Date.now() + i, org, role: "", dates: "",
                  action: where.trim(),
                  metricType: metric.trim() ? "estimated" : "none",
                  metric: metric.trim(),
                  constraint: "",
                  evidence: metric.trim()
                    ? "Added while closing a gap, confirm the source before sending"
                    : "",
                  benchmark: "", tags: [g],
                });
                const next = { ...answers, [g]: true };
                setAnswers(next);
                save();
                step(i + 1, next);
              }}
            >
              Add this and continue
            </button>
            <button className="btn quiet" onClick={() => finish(answers)}>Stop here</button>
          </div>
        </div>
      )}
    </Veil>
  );
}
