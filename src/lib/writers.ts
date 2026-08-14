/* ---- the three pieces of writing --------------------------------------
   Assembled from graded evidence and nothing else. No model is asked to invent
   a reason, because a reason it invents is a reason the user cannot defend. */
import { S, activeJob } from "@/store/state";
import { appKey, bullet } from "@/lib/util";
import { topUnits } from "@/lib/jd/match";

export type WriterKind = "fit" | "cover" | "reach";

export const WRITER_TABS: [WriterKind, string][] = [
  ["fit", "Why I fit"],
  ["cover", "Cover letter"],
  ["reach", "Message the team"],
];

export function fitParagraph(): string {
  const j = activeJob();
  if (!j) return "Save a job in step 2 first.";
  const picks = topUnits(3);
  const name = S.hdr.name || "";
  if (!picks.length) return "Add and select some evidence first, then this writes itself.";
  const role = j.title || "this role";
  const co = j.co || "your team";
  const lines = picks.map((u) => "- " + bullet(u).replace(/\.$/, "") + (u.org ? " (" + u.org + ")" : ""));
  const overlap = (j.kw || []).slice(0, 6).map((k) => k.k).join(", ");
  return (
    "I am applying for " + role + " at " + co + ".\n\n" +
    "The closest three things I have done to what this posting describes:\n" +
    lines.join("\n") + "\n\n" +
    (overlap ? "That covers " + overlap + ", which is most of what the posting leads with. " : "") +
    "Happy to walk through any of these in detail, including how each number was measured." +
    (name ? "\n\n" + name : "")
  );
}

export function coverLetter(): string {
  const j = activeJob();
  if (!j) return "Save a job in step 2 first.";
  const picks = topUnits(3);
  if (!picks.length) return "Add and select some evidence first, then this writes itself.";
  const co = j.co || "your team";
  const role = j.title || "the role";
  const leadTxt = bullet(picks[0]).replace(/\.$/, "");
  const rest = picks.slice(1).map((u) => "- " + bullet(u).replace(/\.$/, ""));
  return (
    "Dear hiring team at " + co + ",\n\n" +
    "I am writing about the " + role + " post.\n\n" +
    leadTxt + ". That is the piece of my history closest to what you have described, and it is the " +
    "one I would expect you to ask about first.\n\n" +
    (rest.length ? "Two others worth knowing about:\n" + rest.join("\n") + "\n\n" : "") +
    "Every figure above is mine and I can say where each one came from. I have not padded this " +
    "with anything I could not walk you through.\n\n" +
    "Thank you for reading.\n\n" +
    (S.hdr.name || "") +
    (S.hdr.email ? "\n" + S.hdr.email : "") +
    (S.hdr.phone ? "\n" + S.hdr.phone : "") +
    (S.hdr.link ? "\n" + S.hdr.link : "")
  );
}

export function outreachNote(): string {
  const j = activeJob();
  if (!j) return "Save a job in step 2 first.";
  const picks = topUnits(1);
  const co = j.co || "your team";
  const role = j.title || "the role";
  const a = S.apps[appKey(j.url || j.id)];
  const applied = a && a.applied;
  const proof = picks.length ? bullet(picks[0]).replace(/\.$/, "") : "";
  return (
    "Subject: " + (applied ? "Following up on " : "") + role + (applied ? "" : " at " + co) + "\n\n" +
    "Hello,\n\n" +
    (applied
      ? "I applied for " + role + " about a week ago and wanted to put my name in front of a person " +
        "rather than a queue. I am still very interested.\n\n"
      : "I am about to apply for " + role + " and wanted to introduce myself first.\n\n") +
    (proof ? "The most relevant thing I have done: " + proof + ".\n\n" : "") +
    "If it is useful I can send the detail behind that, or the two other pieces closest to what " +
    "the posting describes. Either way, thank you for your time.\n\n" +
    (S.hdr.name || "") +
    (S.hdr.email ? "\n" + S.hdr.email : "") +
    (S.hdr.link ? "\n" + S.hdr.link : "")
  );
}

export function writerText(kind: WriterKind): string {
  return kind === "fit" ? fitParagraph() : kind === "cover" ? coverLetter() : outreachNote();
}
