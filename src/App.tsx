import { useCallback, useEffect, useMemo, useState } from "react";
import type { Job, Listing } from "@/types";
import { S, useAppState } from "@/store/state";
import { load, save } from "@/store/storage";
import { aiLoad, aiReady } from "@/lib/ai/client";
import { finishOpenRouterSSO } from "@/lib/ai/sso";
import { inferProfile } from "@/lib/resume/profile";
import { UiContext, type ModalName, type UiApi } from "@/ui/UiContext";
import { useStepRoute } from "@/ui/useStepRoute";
import { TopBar } from "@/components/TopBar";
import { Toast } from "@/components/Toast";
import { EvidencePanel } from "@/components/panels/EvidencePanel";
import { TargetPanel } from "@/components/panels/TargetPanel";
import { MatchPanel } from "@/components/panels/MatchPanel";
import { ResumePanel } from "@/components/panels/ResumePanel";
import { ApplyPanel, needsFollowUp } from "@/components/panels/ApplyPanel";
import { WelcomeModal, PrepModal, LegalModal, PaywallModal } from "@/components/modals/SimpleModals";
import { PasteModal } from "@/components/modals/PasteModal";
import { AiModal } from "@/components/modals/AiModal";
import { SourcesModal } from "@/components/modals/SourcesModal";
import { GapModal } from "@/components/modals/GapModal";
import { SemanticModal } from "@/components/modals/SemanticModal";
import { AtsModal } from "@/components/modals/AtsModal";
import { GenModal } from "@/components/modals/GenModal";
import type { AtsResult } from "@/lib/doc/ats";
import { useT } from "@/i18n";

/* Load persisted state once, before the first render, so nothing flashes empty. */
let booted = false;
function boot(): void {
  if (booted) return;
  booted = true;
  aiLoad();
  load();
  /* Restore the profile inferred from the evidence, so a returning visit needs
     no re-typing before pressing Search. */
  if ((!S.profile || !S.profile.titles || !S.profile.titles.length) && S.units.length)
    S.profile = inferProfile();
}
boot();

export default function App() {
  const state = useAppState();
  const t = useT();
  /* The URL carries the step, so Back, Forward, refresh and sharing all work. */
  const [step, goStep] = useStepRoute();
  const [modals, setModals] = useState<Record<string, boolean>>({});
  const [toastText, setToastText] = useState("");
  const [toastOn, setToastOn] = useState(false);
  const [gapTerms, setGapTerms] = useState<string[]>([]);
  const [semGaps, setSemGaps] = useState<string[]>([]);
  const [genJob, setGenJob] = useState<Job | null>(null);
  const [pendingListing, setPendingListing] = useState<Listing | null>(null);
  const [jobDraft, setJobDraft] = useState<UiApi["jobDraft"]>(null);
  const [writerJump, setWriterJump] = useState(0);
  const [aiOn, setAiOn] = useState(aiReady());
  const [ats, setAts] = useState<AtsResult>({ score: 0, checks: [], failed: [] });

  const toast = useCallback((msg: string) => {
    setToastText(msg);
    setToastOn(true);
    window.clearTimeout((toast as unknown as { _t?: number })._t);
    (toast as unknown as { _t?: number })._t = window.setTimeout(() => setToastOn(false), 2300);
  }, []);

  /* Welcome shows once, and only to somebody with no work in progress. */
  useEffect(() => {
    try {
      if (!localStorage.getItem("ee.seen") && !S.units.length)
        setModals((m) => ({ ...m, welcome: true }));
    } catch {
      /* private mode; the welcome simply shows every time */
    }
  }, []);

  /* Catch the return trip from OpenRouter before anything else paints, and
     clean the code out of the address bar so a refresh cannot replay it. */
  useEffect(() => {
    const q = new URLSearchParams(location.search);
    const code = q.get("code");
    if (!code) return;
    history.replaceState({}, "", location.origin + location.pathname);
    toast("Finishing sign-in...");
    finishOpenRouterSSO(code)
      .then(() => {
        setAiOn(true);
        toast("Connected to OpenRouter. Every major model is available now.");
      })
      .catch((e) => toast("Sign-in did not complete: " + e.message));
  }, [toast]);

  const ui: UiApi = useMemo(
    () => ({
      step,
      go(i) {
        goStep(i);
        /* Respect a reduced-motion preference for the scroll as well as the CSS. */
        const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
        window.scrollTo({ top: 0, behavior: reduce ? "auto" : "smooth" });
      },
      toast,
      open: (n: ModalName) => setModals((m) => ({ ...m, [n]: true })),
      close: (n: ModalName) => setModals((m) => ({ ...m, [n]: false })),
      isOpen: (n: ModalName) => !!modals[n],
      gapTerms,
      openGapWizard(terms) {
        if (!terms.length) return;
        setGapTerms(terms);
        setModals((m) => ({ ...m, gap: true }));
      },
      semGaps,
      openSemantic(terms) {
        setSemGaps(terms);
        setModals((m) => ({ ...m, sem: true }));
      },
      genJob,
      openGen(job) {
        setGenJob(job);
        setModals((m) => ({ ...m, gen: true }));
      },
      pendingListing,
      handOffListing: setPendingListing,
      jobDraft,
      setJobDraft,
      writerJump,
      jumpToWriter() {
        goStep(4);
        setWriterJump((n) => n + 1);
        setTimeout(() => document.getElementById("writeBox")?.scrollIntoView({ behavior: "smooth", block: "center" }), 120);
      },
    }),
    [step, goStep, modals, toast, gapTerms, semGaps, genJob, pendingListing, jobDraft, writerJump],
  );

  /* The gap wizard adds entries; make sure they persist even if the modal is
     dismissed mid-flow. */
  useEffect(() => {
    if (!modals.gap) save();
  }, [modals.gap]);

  const followUps = needsFollowUp().length;

  return (
    <UiContext.Provider value={ui}>
      <TopBar aiOn={aiOn} followUps={followUps} />

      <main id="main" tabIndex={-1}>
        {step === 0 && <EvidencePanel aiOn={aiOn} />}
        {step === 1 && <TargetPanel />}
        {step === 2 && <MatchPanel />}
        {step === 3 && <ResumePanel onAts={setAts} />}
        {step === 4 && <ApplyPanel atsScore={ats.score} />}

        <footer className="foot noprint">
          <span>{t.appName}</span>
          <span className="sep">·</span>
          <span>{t.dataNeverLeaves}</span>
          <span className="sep">·</span>
          <button className="linkbtn" onClick={() => ui.open("legal")}>
            {t.privacyTerms}
          </button>
        </footer>
      </main>

      <WelcomeModal
        onDemo={() => {
          /* The example lives in the Evidence panel, so step there and let its
             own button do the work on the next tick. */
          goStep(0);
          setTimeout(() => {
            const btn = [...document.querySelectorAll("button")].find(
              (b) => b.textContent === "See an example",
            ) as HTMLButtonElement | undefined;
            btn?.click();
          }, 60);
        }}
      />
      <PasteModal />
      <PrepModal />
      <AiModal onChange={() => setAiOn(aiReady())} />
      <SourcesModal />
      <GapModal />
      <SemanticModal />
      <AtsModal atsFailed={ats.failed} />
      <LegalModal />
      <PaywallModal />
      <GenModal />

      <Toast text={toastText} on={toastOn} />

      {/* Reading `state` keeps this component subscribed to every store write,
          which is what makes the panels above re-render on save(). */}
      <span hidden>{state.units.length}</span>
    </UiContext.Provider>
  );
}
