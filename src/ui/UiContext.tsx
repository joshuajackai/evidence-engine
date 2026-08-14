/* The one piece of state that is genuinely UI rather than data: which step is
   showing, which modal is open, and what the toast currently says. Kept in
   React rather than on S, because none of it survives a reload and none of it
   belongs in a backup. */
import { createContext, useContext } from "react";
import type { Job, Listing } from "@/types";

export type ModalName =
  | "welcome" | "paste" | "prep" | "ai" | "sources" | "legal" | "paywall"
  | "gap" | "sem" | "ats" | "gen";

export interface UiApi {
  step: number;
  go(step: number): void;
  toast(msg: string): void;
  open(name: ModalName): void;
  close(name: ModalName): void;
  isOpen(name: ModalName): boolean;
  /** Gap wizard payload. */
  gapTerms: string[];
  openGapWizard(terms: string[]): void;
  /** Semantic re-check payload. */
  semGaps: string[];
  openSemantic(terms: string[]): void;
  /** Tailor generator target. */
  genJob: Job | null;
  openGen(job: Job): void;
  /** Hand a search result to the Target panel so it can be saved and keyworded. */
  pendingListing: Listing | null;
  handOffListing(l: Listing | null): void;
  /** Prefill for the manual "add one myself" form. */
  jobDraft: { title: string; co: string; url: string; text: string } | null;
  setJobDraft(d: { title: string; co: string; url: string; text: string } | null): void;
  /** The writer panel jumps here when a follow-up is drafted from the banner. */
  writerJump: number;
  jumpToWriter(): void;
}

export const UiContext = createContext<UiApi | null>(null);

export function useUi(): UiApi {
  const v = useContext(UiContext);
  if (!v) throw new Error("useUi called outside the provider");
  return v;
}
