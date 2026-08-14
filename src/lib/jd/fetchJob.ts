/* =========================================================================
   IMPORT A POSTING FROM ITS URL
   Browsers cannot fetch an arbitrary job page: the sites do not send CORS
   headers. What they can do is call the public JSON API that the big applicant
   tracking systems already expose for their own embedded boards. That covers a
   large share of real postings with no backend and no third-party proxy.
   Anything else has to be pasted, and the message says so plainly.
   ========================================================================= */
import { decodeEntities, stripHtml } from "@/lib/util";

interface Target {
  ats: "greenhouse" | "lever" | "ashby" | "smartrecruiters" | "unknown";
  api?: string;
  id?: string;
  host?: string;
}

export function parseJobUrl(raw: string): Target | null {
  let u = String(raw || "").trim();
  if (!u) return null;
  if (!/^https?:\/\//i.test(u)) u = "https://" + u;
  let url: URL;
  try {
    url = new URL(u);
  } catch {
    return null;
  }
  const host = url.hostname.replace(/^www\./, "");
  const path = url.pathname;
  let m: RegExpMatchArray | null;

  if (/greenhouse\.io$/.test(host)) {
    m = path.match(/\/([^/]+)\/jobs\/(\d+)/);
    if (m)
      return {
        ats: "greenhouse",
        api: "https://boards-api.greenhouse.io/v1/boards/" + m[1] + "/jobs/" + m[2],
      };
    const jid = url.searchParams.get("gh_jid") || "";
    const tok = path.split("/").filter(Boolean)[0];
    if (jid && tok)
      return {
        ats: "greenhouse",
        api: "https://boards-api.greenhouse.io/v1/boards/" + tok + "/jobs/" + jid,
      };
  }
  if (/lever\.co$/.test(host)) {
    m = path.match(/\/([^/]+)\/([0-9a-f-]{8,})/i);
    if (m) return { ats: "lever", api: "https://api.lever.co/v0/postings/" + m[1] + "/" + m[2] };
  }
  if (/ashbyhq\.com$/.test(host)) {
    m = path.match(/\/([^/]+)\/([0-9a-f-]{8,})/i);
    if (m)
      return {
        ats: "ashby",
        api: "https://api.ashbyhq.com/posting-api/job-board/" + m[1],
        id: m[2],
      };
  }
  if (/smartrecruiters\.com$/.test(host)) {
    m = path.match(/\/([^/]+)\/(\d+)/);
    if (m)
      return {
        ats: "smartrecruiters",
        api: "https://api.smartrecruiters.com/v1/companies/" + m[1] + "/postings/" + m[2],
      };
  }
  return { ats: "unknown", host };
}

export interface FetchedJob {
  title: string;
  co: string;
  text: string;
}

export async function fetchJob(rawUrl: string): Promise<FetchedJob> {
  const t = parseJobUrl(rawUrl);
  if (!t) throw new Error("That does not look like a web address.");
  if (t.ats === "unknown")
    throw new Error(
      t.host +
        " cannot be read automatically from a browser. Open the posting, copy the text, and paste " +
        "it below. This is a restriction those sites set, not a bug here.",
    );

  const r = await fetch(t.api as string, { headers: { accept: "application/json" } }).catch(() => {
    throw new Error("Could not reach that board. Paste the text below instead.");
  });
  if (!r.ok)
    throw new Error(
      "That posting returned HTTP " + r.status +
        ". It may have been taken down. Paste the text below instead.",
    );
  const j = await r.json();

  if (t.ats === "greenhouse")
    return { title: j.title || "", co: "", text: stripHtml(decodeEntities(j.content || "")) };

  if (t.ats === "lever")
    return {
      title: j.text || "",
      co: (j.categories && j.categories.team) || "",
      text:
        stripHtml(j.description || "") +
        "\n" +
        (j.lists || [])
          .map((l: { text: string; content: string }) => l.text + "\n" + stripHtml(l.content))
          .join("\n"),
    };

  if (t.ats === "ashby") {
    const job = (j.jobs || []).filter(
      (x: { jobUrl?: string; id?: string }) =>
        (x.jobUrl || "").indexOf(t.id as string) > -1 || x.id === t.id,
    )[0];
    if (!job)
      throw new Error("That role is no longer listed on the board. Paste the text below instead.");
    return {
      title: job.title || "",
      co: "",
      text: stripHtml(job.descriptionHtml || job.descriptionPlain || ""),
    };
  }

  if (t.ats === "smartrecruiters") {
    const sec = (j.jobAd && j.jobAd.sections) || {};
    const parts = ["companyDescription", "jobDescription", "qualifications", "additionalInformation"]
      .map((k) => (sec[k] && sec[k].text ? stripHtml(sec[k].text) : ""))
      .filter(Boolean);
    return { title: j.name || "", co: (j.company && j.company.name) || "", text: parts.join("\n\n") };
  }

  throw new Error("Unsupported board.");
}
