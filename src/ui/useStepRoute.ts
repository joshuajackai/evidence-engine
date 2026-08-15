/* =========================================================================
   STEP ROUTING

   The audit measured this: on step 3 the URL was unchanged from load, so the
   browser Back button left the application entirely. On a phone Back is the
   primary navigation gesture, which meant the most natural way to say "go back
   one step" threw the user out of the tool and lost their place.

   A hash rather than a path, for two reasons. It needs no server rewrite rule,
   and it survives the GitHub Pages sub-path without any base configuration.
   ========================================================================= */
import { useCallback, useEffect, useState } from "react";

export const STEP_SLUGS = ["evidence", "target", "match", "resume", "apply"] as const;
export type StepSlug = (typeof STEP_SLUGS)[number];

function stepFromHash(): number {
  const slug = location.hash.replace(/^#\/?/, "").toLowerCase();
  const i = STEP_SLUGS.indexOf(slug as StepSlug);
  return i >= 0 ? i : 0;
}

export function useStepRoute(): [number, (step: number, replace?: boolean) => void] {
  const [step, setStep] = useState(stepFromHash);

  /* Back and Forward. Also covers somebody editing the hash by hand. */
  useEffect(() => {
    const onPop = () => setStep(stepFromHash());
    window.addEventListener("hashchange", onPop);
    window.addEventListener("popstate", onPop);
    return () => {
      window.removeEventListener("hashchange", onPop);
      window.removeEventListener("popstate", onPop);
    };
  }, []);

  /* Put a hash on the first load so the very first Back press has somewhere to
     go, and so a refresh keeps the user where they were. Replace rather than
     push, or the first Back would land on a hashless copy of the same page. */
  useEffect(() => {
    if (!location.hash) history.replaceState(null, "", "#" + STEP_SLUGS[step]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const go = useCallback((next: number, replace = false) => {
    const slug = STEP_SLUGS[next] || STEP_SLUGS[0];
    if (stepFromHash() === next) {
      setStep(next);
      return;
    }
    if (replace) history.replaceState(null, "", "#" + slug);
    else history.pushState(null, "", "#" + slug);
    setStep(next);
  }, []);

  return [step, go];
}
