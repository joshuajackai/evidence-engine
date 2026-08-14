import { MONETIZATION, useAppState } from "@/store/state";
import { aiReady } from "@/lib/ai/client";
import { useUi } from "@/ui/UiContext";

const STEPS = ["Evidence", "Target role", "Match", "Resume", "Apply"];

export function TopBar({ aiOn, followUps }: { aiOn: boolean; followUps: number }) {
  const S = useAppState();
  const ui = useUi();
  const connected = aiOn || aiReady();

  return (
    <div className="topbar">
      <div className="topbar-in">
        <div className="brand">
          <b>Evidence Engine</b>
          <span>Nothing on your resume is invented</span>
        </div>
        {MONETIZATION && (
          <span className={"plan" + (S.pro ? " pro" : "")}>{S.pro ? "Full" : "Free"}</span>
        )}
        <button className="btn sm quiet noprint" onClick={() => ui.open("ai")}>
          <span className={"aidot " + (connected ? "on" : "off")} />
          {connected ? "AI connected" : "Connect AI"}
        </button>
        {MONETIZATION && !S.pro && (
          <button className="btn sm ghost noprint" onClick={() => ui.open("paywall")}>
            Unlock full version
          </button>
        )}
      </div>
      <nav className="steps">
        {STEPS.map((label, i) => (
          <button
            key={label}
            className="step"
            aria-current={ui.step === i ? "true" : "false"}
            onClick={() => ui.go(i)}
          >
            <span className="n">{i + 1}</span>
            {label}
            {i === 4 && followUps > 0 && <span className="nudge">{followUps}</span>}
          </button>
        ))}
      </nav>
    </div>
  );
}
