/* =========================================================================
   THE STRING CATALOGUE

   English is the reference. Every other locale is typed against it, so a
   missing or misspelt key is a compile error rather than a blank space that
   ships. That typing is the reason this is a hand-rolled catalogue rather than
   react-i18next: a translator cannot silently forget a key, because the build
   fails.

   Adding a language is three steps and no code changes:
     1. Copy `en.ts` to `xx.ts` and translate the values.
     2. Add it to LOCALES in `index.ts`.
     3. Run `npm run typecheck`. Anything missed is listed for you.

   Coverage note, stated plainly rather than implied: this catalogue covers the
   application shell and the core journey, which is everything a user must read
   to import their history, target a job, and export a resume. The advanced
   panels (job sources, AI diagnostics, the tailor generator's analysis tab)
   remain English for now and are marked in the UI. That is a smaller lie than
   half-translating them.
   ========================================================================= */

export interface Strings {
  /* shell */
  appName: string;
  tagline: string;
  connectAi: string;
  aiConnected: string;
  unlock: string;
  planFree: string;
  planFull: string;
  stepsLabel: string;
  skipToContent: string;
  languageLabel: string;
  privacyTerms: string;
  dataNeverLeaves: string;
  partiallyTranslated: string;

  /* steps */
  step1: string;
  step2: string;
  step3: string;
  step4: string;
  step5: string;

  /* step headings and blurbs */
  evidenceTitle: string;
  evidenceBlurb: string;
  targetTitle: string;
  targetBlurb: string;
  matchTitle: string;
  matchBlurb: string;
  resumeTitle: string;
  resumeBlurb: string;
  applyTitle: string;
  applyBlurb: string;

  /* grades */
  gradeProven: string;
  gradeEstimate: string;
  gradeVolume: string;
  gradeNoNumber: string;
  gradeProvenHelp: string;
  gradeEstimateHelp: string;
  gradeVolumeHelp: string;
  gradeNoNumberHelp: string;
  gradesTitle: string;
  gradesRule: string;

  /* evidence panel */
  pasteMyResume: string;
  cleanUpFirst: string;
  addByHand: string;
  seeExample: string;
  openSavedFile: string;
  saveToFile: string;
  noEntriesYet: string;
  noEntriesBlurb: string;
  resumeStrength: string;
  editEntry: string;
  deleteEntry: string;
  entrySource: string;
  quarantinedNote: string;

  /* entry form */
  fieldOrg: string;
  fieldRole: string;
  fieldDates: string;
  fieldAction: string;
  fieldActionHint: string;
  fieldType: string;
  fieldTypeHint: string;
  typeNone: string;
  typeAudited: string;
  typeEstimated: string;
  typeActivity: string;
  fieldMetric: string;
  fieldConstraint: string;
  fieldConstraintHint: string;
  fieldEvidence: string;
  fieldTags: string;
  fieldTagsHint: string;
  quarantineTitle: string;
  quarantineBody: string;
  saveEntry: string;
  cancel: string;

  /* validation */
  errOrg: string;
  errAction: string;
  errMetric: string;
  errEvidenceAudited: string;
  errEvidenceEstimated: string;

  /* common actions */
  close: string;
  copy: string;
  copied: string;
  restore: string;
  download: string;
  search: string;
  save: string;
  remove: string;

  /* welcome */
  welcomeTag: string;
  welcomeHeadline: string;
  welcomeBody: string;
  welcomeStep1: string;
  welcomeStep2: string;
  welcomeStep3: string;
  welcomeTime: string;
  welcomePaste: string;
  welcomePrep: string;
  welcomeBlank: string;
  welcomeDemo: string;

  /* importer */
  importNonEnglish: string;

  /* pay periods, for Intl-formatted amounts */
  perHour: string;
  perDay: string;
  perMonth: string;
  perYear: string;
}

export const en: Strings = {
  appName: "Evidence Engine",
  tagline: "Nothing on your resume is invented",
  connectAi: "Connect AI",
  aiConnected: "AI connected",
  unlock: "Unlock full version",
  planFree: "Free",
  planFull: "Full",
  stepsLabel: "Application steps",
  skipToContent: "Skip to content",
  languageLabel: "Language",
  privacyTerms: "Privacy and terms",
  dataNeverLeaves: "Your data never leaves this browser",
  partiallyTranslated:
    "This panel is in English for now. The core steps are translated; the advanced panels are not yet.",

  step1: "Evidence",
  step2: "Target role",
  step3: "Match",
  step4: "Resume",
  step5: "Apply",

  evidenceTitle: "Everything you have done, one thing at a time",
  evidenceBlurb:
    "Add each thing separately. Beside every one you will see the grade a hiring manager is already assigning in their head. Seeing it first is the advantage.",
  targetTitle: "The jobs you are going for",
  targetBlurb:
    "Search live boards for roles that match your evidence, or add a posting yourself. Each job keeps its own tailored resume.",
  matchTitle: "What earns a place on the page",
  matchBlurb:
    "Entries are ranked by how much of this posting they answer. Everything below the line stays in your inventory and off this resume.",
  resumeTitle: "Your resume",
  resumeBlurb:
    "Every bullet below was assembled from words you typed. No model wrote a claim on your behalf, which is why there is nothing here you cannot walk through in an interview.",
  applyTitle: "Send it, and keep track of what you sent",
  applyBlurb:
    "Everything an application form asks for, written once and reused. The tracker is here because the follow-up is where most interviews actually come from, and it is the part everybody drops.",

  gradeProven: "Proven",
  gradeEstimate: "My estimate",
  gradeVolume: "Volume",
  gradeNoNumber: "No number yet",
  gradeProvenHelp: "Your number, and you can say where it came from.",
  gradeEstimateHelp: "Your number, worked out by you. Say so out loud in the interview.",
  gradeVolumeHelp: "How much you did. Weaker than a result, better than nothing.",
  gradeNoNumberHelp: "Perfectly fine. Leave it unquantified rather than inventing something.",
  gradesTitle: "How the grades work",
  gradesRule: "Aim as high as the truth allows, then stop.",

  pasteMyResume: "Paste my resume",
  cleanUpFirst: "Clean up my resume first",
  addByHand: "Add one by hand",
  seeExample: "See an example",
  openSavedFile: "Open saved file",
  saveToFile: "Save to file",
  noEntriesYet: "No entries yet",
  noEntriesBlurb: "Add your first, or load the example to see how grading works.",
  resumeStrength: "Resume strength",
  editEntry: "Edit entry",
  deleteEntry: "Delete entry",
  entrySource: "Source",
  quarantinedNote: "Quarantined statistic, interview use only",

  fieldOrg: "Company or client",
  fieldRole: "Your role",
  fieldDates: "Dates",
  fieldAction: "What you did",
  fieldActionHint:
    "Start with a verb you can defend. Rebuilt, migrated, coded, diagnosed, negotiated. Avoid words that hide your hands, such as optimized or leveraged.",
  fieldType: "Is there a number attached to this",
  fieldTypeHint:
    "Be honest. This grade is the whole point, and it is the question an interviewer will ask.",
  typeNone: "Not yet, or there is no number",
  typeAudited: "Yes, and I can show where it came from",
  typeEstimated: "Yes, but it is my own estimate",
  typeActivity: "Only a volume count, such as how many I did",
  fieldMetric: "The number",
  fieldConstraint: "What stayed the same",
  fieldConstraintHint: "This turns a claim into evidence.",
  fieldEvidence: "Where the number came from",
  fieldTags: "Skills and tools",
  fieldTagsHint: "Comma separated. These are what get matched against a job description.",
  quarantineTitle: "Quarantine: industry statistics",
  quarantineBody:
    "Anything typed here is stored for interview preparation and is locked out of your resume permanently. A statistic sitting next to your name gets read as your result. That is the mistake this tool exists to prevent.",
  saveEntry: "Save entry",
  cancel: "Cancel",

  errOrg: "Add the company or client.",
  errAction: "Describe what you did.",
  errMetric: "You chose a graded type, so the number is required. Switch to No number if none exists.",
  errEvidenceAudited: "Audited means you can name the source. Add it, or downgrade to Estimated.",
  errEvidenceEstimated: "Estimated needs your reasoning, so you can defend it out loud.",

  close: "Close",
  copy: "Copy",
  copied: "Copied",
  restore: "Restore",
  download: "Download everything",
  search: "Search live boards",
  save: "Save",
  remove: "Remove",

  welcomeTag: "Free. No account. Nothing leaves your browser.",
  welcomeHeadline: "Every other AI resume tool writes your bullets for you. This one cannot.",
  welcomeBody:
    "There is no model in here. You write the words, and the tool grades how well each claim would hold up if somebody asked you about it in an interview. That is the whole idea, and it is why nothing on your resume can be made up.",
  welcomeStep1: "Add what you have done",
  welcomeStep2: "Paste the job you want",
  welcomeStep3: "Get a resume aimed at it",
  welcomeTime:
    "Takes about ten minutes if you have your old resume handy. You can stop and come back, your work is saved on this device.",
  welcomePaste: "Paste my resume to start",
  welcomePrep: "My resume needs cleaning up first",
  welcomeBlank: "Start from scratch",
  welcomeDemo: "Show me an example",

  importNonEnglish:
    "This resume does not look like it is in English. The importer reads English section headings and month names, so it will split badly. Use \"Clean up my resume first\" instead: that hands you a prompt for your own AI, which works in any language, and you paste the result back.",

  perHour: "/hr",
  perDay: "/day",
  perMonth: "/mo",
  perYear: "",
};
