/* Pullers. One per source family. Every one returns {items, error?} so a dead
   source is countable rather than invisible: a search that hit six 429s and
   thirty CORS preflight failures used to look exactly like one that ran clean
   and found no jobs. */
import type { CompanyBoard, Aggregator, Listing, PullResult, SourceError } from "@/types";
import { S } from "@/store/state";
import { stripHtml } from "@/lib/util";
import { jget, netFetch, type CodedError } from "./net";
import { typeOf } from "./pay";
import { keyedCfg, rapidKey, rapidSources } from "./sources";
import { pullRapidSource } from "./rapid";

export async function pullBoard(b: CompanyBoard): Promise<PullResult> {
  const out: Listing[] = [];
  try {
    if (b.ats === "greenhouse") {
      const j = await jget("https://boards-api.greenhouse.io/v1/boards/" + b.t + "/jobs?content=false");
      (j.jobs || []).forEach((x: any) => {
        out.push({
          id: "gh" + x.id,
          title: x.title,
          co: b.t,
          loc: (x.location && x.location.name) || "",
          ts: Date.parse(x.first_published || x.updated_at || 0) || 0,
          url: x.absolute_url,
          src: "Greenhouse",
          types: typeOf(x.title, (x.location && x.location.name) || ""),
        });
      });
    } else if (b.ats === "lever") {
      const l = await jget<any[]>("https://api.lever.co/v0/postings/" + b.t + "?mode=json");
      (l || []).forEach((x: any) => {
        const c = x.categories || {};
        out.push({
          id: "lv" + x.id,
          title: x.text,
          co: b.t,
          loc: c.location || "",
          ts: x.createdAt || 0,
          url: x.hostedUrl,
          src: "Lever",
          types: typeOf(x.text, (c.commitment || "") + " " + (c.location || "") + " " + (x.workplaceType || "")),
        });
      });
    } else if (b.ats === "ashby") {
      const a = await jget("https://api.ashbyhq.com/posting-api/job-board/" + b.t);
      (a.jobs || []).forEach((x: any) => {
        out.push({
          id: "ab" + (x.id || x.jobUrl),
          title: x.title,
          co: b.t,
          loc: x.location || "",
          ts: Date.parse(x.publishedAt || 0) || 0,
          url: x.jobUrl,
          src: "Ashby",
          types: typeOf(x.title, (x.employmentType || "") + " " + (x.location || "") + (x.isRemote ? " remote" : "")),
        });
      });
    }
  } catch (e) {
    /* One dead board must never sink the whole search, but the caller needs to
       know which sources failed so the summary can be honest. */
    const err = e as CodedError;
    return {
      items: out,
      error: { code: err.code || err.name || "err", src: b.ats + ":" + b.t, msg: String(err.message || err) },
    };
  }
  return { items: out };
}

export async function pullAggregator(a: Aggregator): Promise<PullResult> {
  const out: Listing[] = [];
  try {
    /* Three of these are not JSON, so they get handled before the shared path. */
    if (a.id === "wwr") {
      const xml = await netFetch<string>(a.url, { json: false });
      const doc = new DOMParser().parseFromString(xml, "text/xml");
      doc.querySelectorAll("item").forEach((it) => {
        const g = (t: string) => {
          const e = it.querySelector(t);
          return e ? (e.textContent || "").trim() : "";
        };
        const full = g("title");
        const sp = full.split(/:\s+/);
        out.push({
          id: "wwr" + g("link"),
          title: sp.length > 1 ? sp.slice(1).join(": ") : full,
          co: sp.length > 1 ? sp[0] : "",
          loc: g("region") || "Remote",
          ts: Date.parse(g("pubDate")) || 0,
          url: g("link"),
          src: "We Work Remotely",
          types: typeOf(full, (g("type") || "") + " " + (g("region") || "") + " remote"),
        });
      });
      return { items: out };
    }
    if (a.id === "remoteok") {
      const rk = await jget<any[]>(a.url);
      (rk || []).forEach((x: any) => {
        if (!x.position) return; // first element is a legal notice, not a job
        out.push({
          id: "rok" + x.id,
          title: x.position,
          co: x.company || "",
          loc: x.location || "Remote",
          ts: (x.epoch ? x.epoch * 1000 : Date.parse(x.date)) || 0,
          url: x.url || "https://remoteok.com/l/" + x.id,
          src: "RemoteOK",
          types: typeOf(x.position, (x.tags || []).join(" ") + " remote"),
        });
      });
      return { items: out };
    }
    if (a.id === "themuse") {
      /* The Muse holds tens of thousands of listings across hundreds of pages.
         Five pages was reading roughly one percent of it. Twenty-five is the
         point where the time cost stops being worth the extra depth. */
      for (let pg = 0; pg < 25; pg++) {
        let mu: any;
        try {
          mu = await jget("https://www.themuse.com/api/public/jobs?page=" + pg);
        } catch {
          break;
        }
        const got = (mu && mu.results) || [];
        if (!got.length) break;
        got.forEach((x: any) => {
          out.push({
            id: "muse" + x.id,
            title: x.name,
            co: (x.company && x.company.name) || "",
            loc: (x.locations || []).map((l: any) => l.name).join(", "),
            ts: Date.parse(x.publication_date) || 0,
            url: (x.refs && x.refs.landing_page) || "",
            src: "The Muse",
            types: typeOf(
              x.name,
              (x.levels || []).map((l: any) => l.name).join(" ") + " " +
                (x.locations || []).map((l: any) => l.name).join(" "),
            ),
          });
        });
      }
      return { items: out };
    }
    if (a.id === "hn") {
      /* The monthly thread is the story; the jobs are its top-level comments.
         Convention is "Company | Role | Location | Remote", loosely followed,
         so this is best-effort and labelled as such in the UI. */
      const s = await jget<any>(a.url);
      const story = (s.hits || [])[0];
      if (!story) return { items: out };
      const th = await jget<any>("https://hn.algolia.com/api/v1/items/" + story.objectID);
      /* Children arrive oldest first, so an unsorted slice returned the start
         of a month-old thread and every entry looked stale. */
      (th.children || [])
        .slice()
        .sort((x: any, y: any) => (y.created_at_i || 0) - (x.created_at_i || 0))
        .slice(0, 120)
        .forEach((c: any) => {
          if (!c.text) return;
          const plain = stripHtml(c.text).replace(/\s+/g, " ").trim();
          if (plain.length < 30) return;
          const head = plain.split(/[.\n]/)[0].slice(0, 150);
          const parts = head.split(/\s*[|·]\s*/).map((p) => p.trim()).filter(Boolean);
          const LOOKSPLACE = /remote|onsite|hybrid|,\s*[A-Z]{2}\b|United States|USA|UK|Europe|Canada|Germany|India/i;
          const co = parts[0] || "HN";
          let role = "";
          const locs: string[] = [];
          parts.slice(1).forEach((p) => {
            if (!role && !LOOKSPLACE.test(p)) role = p;
            else locs.push(p);
          });
          out.push({
            id: "hn" + c.id,
            title: (role || parts[1] || co).slice(0, 90),
            co: co.slice(0, 50),
            loc: (locs.join(", ") || "See post").slice(0, 60),
            ts: (c.created_at_i || 0) * 1000,
            url: "https://news.ycombinator.com/item?id=" + c.id,
            src: "HN Who Is Hiring",
            types: typeOf(head, plain.slice(0, 300)),
          });
        });
      return { items: out };
    }
    /* Everything below paginates. Taking page one and stopping is why a "deep"
       search was reading a few hundred listings from sources holding several
       thousand. Each loop stops on an empty page, a repeat, or the ceiling. */
    if (a.id === "remotive") {
      const seenR: Record<string, 1> = {};
      for (let rp = 0; rp < 6; rp++) {
        let rj: any;
        try {
          rj = await jget("https://remotive.com/api/remote-jobs?limit=200&offset=" + rp * 200);
        } catch {
          break;
        }
        const rg = (rj && rj.jobs) || [];
        if (!rg.length) break;
        const before = out.length;
        const full = rg.length >= 200;
        rg.forEach((x: any) => {
          if (seenR[x.id]) return;
          seenR[x.id] = 1;
          out.push({
            id: "rm" + x.id,
            title: x.title,
            co: x.company_name,
            loc: x.candidate_required_location || "Remote",
            ts: Date.parse(x.publication_date || 0) || 0,
            url: x.url,
            src: "Remotive",
            types: typeOf(x.title, (x.job_type || "") + " remote"),
          });
        });
        /* A short page is the last page. Remotive currently ignores limit and
           offset entirely and returns the same rows every time, so without this
           the loop burns five requests to learn nothing. */
        if (!full || out.length === before) break;
      }
      return { items: out };
    }
    if (a.id === "arbeitnow") {
      for (let ap = 1; ap <= 8; ap++) {
        let aj: any;
        try {
          aj = await jget("https://www.arbeitnow.com/api/job-board-api?page=" + ap);
        } catch {
          break;
        }
        const ag = (aj && aj.data) || [];
        if (!ag.length) break;
        ag.forEach((x: any) => {
          out.push({
            id: "an" + x.slug,
            title: x.title,
            co: x.company_name,
            loc: x.location || "",
            ts: (x.created_at || 0) * 1000,
            url: x.url,
            src: "Arbeitnow",
            types: typeOf(x.title, (x.job_types || []).join(" ") + (x.remote ? " remote" : "")),
          });
        });
      }
      return { items: out };
    }
    if (a.id === "jobicy") {
      /* Jobicy caps a single call at 50 but exposes the catalogue by industry,
         so the industries are the pagination. These slugs were verified against
         the live API. Guessed ones return 400 and cost a request each. */
      const inds = ["", "smm", "seller", "design-multimedia", "business", "data-science",
        "dev", "hr", "supporting", "management", "copywriting", "technical-support"];
      const seenJ: Record<string, 1> = {};
      for (let ji = 0; ji < inds.length; ji++) {
        const q = "https://jobicy.com/api/v2/remote-jobs?count=50" + (inds[ji] ? "&industry=" + inds[ji] : "");
        let jj: any;
        try {
          jj = await jget(q);
        } catch {
          continue;
        }
        ((jj && jj.jobs) || []).forEach((x: any) => {
          if (seenJ[x.id]) return;
          seenJ[x.id] = 1;
          out.push({
            id: "jy" + x.id,
            title: x.jobTitle,
            co: x.companyName,
            loc: x.jobGeo || "Remote",
            ts: Date.parse(x.pubDate || 0) || 0,
            url: x.url,
            src: "Jobicy",
            types: typeOf(x.jobTitle, (x.jobType || []).join(" ") + " remote"),
          });
        });
      }
      return { items: out };
    }
    await jget(a.url);
  } catch (e) {
    const err = e as CodedError;
    return {
      items: out,
      error: { code: err.code || err.name || "err", src: a.label || a.id, msg: String(err.message || err) },
    };
  }
  return { items: out };
}

/**
 * Licensed aggregators, only when the user has supplied their own key. This is
 * the honest route to the inventory people mean when they say LinkedIn or
 * Indeed: these services license and redistribute it rather than scraping it.
 */
export async function pullKeyed(loc: string, extra: string): Promise<PullResult> {
  const cfg = keyedCfg();
  let out: Listing[] = [];
  let errors: SourceError[] = [];
  const q =
    (extra || "").split(",")[0].trim() ||
    (S.units[0] && (S.units[0].role || (S.units[0].tags || [])[0])) ||
    "remote";
  const where = loc || "";

  if (cfg.usajobs && cfg.usajobs.authorization_key) {
    /* Official federal jobs. Host is set by the browser. User-Agent is a
       forbidden header in fetch, so it is sent on a best-effort basis and the
       Test button is what tells you whether this API accepts it. */
    try {
      const uj = await netFetch<any>(
        "https://data.usajobs.gov/api/search?Keyword=" +
          encodeURIComponent(q) +
          (where ? "&LocationName=" + encodeURIComponent(where) : "") +
          "&ResultsPerPage=250",
        {
          init: {
            headers: {
              "Authorization-Key": cfg.usajobs.authorization_key,
              "User-Agent": cfg.usajobs.registered_email || "",
            },
          },
        },
      );
      const ujRows = (uj && uj.SearchResult && uj.SearchResult.SearchResultItems) || [];
      ujRows.forEach((it: any) => {
        const d = (it && it.MatchedObjectDescriptor) || {};
        if (!d.PositionTitle || !d.PositionURI) return;
        let pay = "";
        try {
          const r0 = (d.PositionRemuneration || [])[0];
          if (r0) pay = " $" + Math.round(r0.MinimumRange) + " to $" + Math.round(r0.MaximumRange);
        } catch {
          /* the pay block is optional */
        }
        out.push({
          id: "uj" + (d.PositionID || d.PositionURI),
          title: d.PositionTitle,
          co: d.OrganizationName || d.DepartmentName || "US Federal Government",
          loc: ((d.PositionLocation || [])[0] || {}).LocationName || "United States",
          ts: Date.parse(d.PublicationStartDate || d.PositionStartDate || 0) || 0,
          url: d.PositionURI,
          src: "USAJOBS",
          types: typeOf(
            d.PositionTitle,
            (d.PositionSchedule || []).map((x: any) => x.Name).join(" ") + " " +
              (d.PositionOfferingType || []).map((x: any) => x.Name).join(" ") + pay,
          ),
        });
      });
    } catch (e) {
      const err = e as CodedError;
      errors.push({ code: err.code || err.name || "err", src: "USAJOBS", msg: String(err.message || err) });
    }
  }

  /* Every RapidAPI-backed source, one shared key, one generic adapter. Run any
     source that is configured; the per-source key is resolved inside the
     puller, so a source carrying its own key runs even with no shared key. */
  const rkey = rapidKey();
  const rsrcs = rapidSources().filter(
    (x) => x.host && x.path && !x.off && (x.key || rkey || !/\.rapidapi\.com$/i.test(x.host)),
  );
  const rres = await Promise.all(
    rsrcs.map((x) =>
      pullRapidSource(x, rkey, q + (where && x.path.indexOf("{loc}") < 0 ? " in " + where : ""), where),
    ),
  );
  rres.forEach((r) => {
    out = out.concat(r.items || []);
    if (r.errors) errors = errors.concat(r.errors);
  });

  return { items: out, errors };
}
