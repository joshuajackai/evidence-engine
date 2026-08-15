import { MONETIZATION, useAppState } from "@/store/state";
import { aiReady } from "@/lib/ai/client";
import { useUi } from "@/ui/UiContext";
import { LOCALES, useI18n } from "@/i18n";

export function TopBar({ aiOn, followUps }: { aiOn: boolean; followUps: number }) {
  const S = useAppState();
  const ui = useUi();
  const { t, locale, setLocale } = useI18n();
  const connected = aiOn || aiReady();
  const steps = [t.step1, t.step2, t.step3, t.step4, t.step5];

  return (
    <header className="topbar">
      {/* A keyboard user should not have to tab through the whole top bar and
          five step tabs to reach the panel they came for. */}
      <a className="skip-link" href="#main">
        {t.skipToContent}
      </a>

      <div className="topbar-in">
        <div className="brand">
          <b>{t.appName}</b>
          <span>{t.tagline}</span>
        </div>

        {MONETIZATION && (
          <span className={"plan" + (S.pro ? " pro" : "")}>{S.pro ? t.planFull : t.planFree}</span>
        )}

        <label className="sr-only" htmlFor="langpick">
          {t.languageLabel}
        </label>
        <select
          id="langpick"
          className="langpick noprint"
          value={locale}
          onChange={(e) => setLocale(e.target.value)}
        >
          {LOCALES.map((l) => (
            /* Each option carries its own language tag, so a screen reader
               pronounces "Español" in Spanish rather than in English. */
            <option key={l.code} value={l.code} lang={l.code}>
              {l.label}
            </option>
          ))}
        </select>

        <button className="btn sm quiet noprint" onClick={() => ui.open("ai")}>
          <span className={"aidot " + (connected ? "on" : "off")} aria-hidden="true" />
          {connected ? t.aiConnected : t.connectAi}
        </button>

        {MONETIZATION && !S.pro && (
          <button className="btn sm ghost noprint" onClick={() => ui.open("paywall")}>
            {t.unlock}
          </button>
        )}
      </div>

      <nav className="steps" aria-label={t.stepsLabel}>
        {steps.map((label, i) => (
          <button
            key={label}
            className="step"
            aria-current={ui.step === i ? "step" : undefined}
            onClick={() => ui.go(i)}
          >
            <span className="n" aria-hidden="true">
              {i + 1}
            </span>
            {label}
            {i === 4 && followUps > 0 && (
              <span className="nudge">
                {followUps}
                <span className="sr-only"> follow-ups due</span>
              </span>
            )}
          </button>
        ))}
      </nav>
    </header>
  );
}
