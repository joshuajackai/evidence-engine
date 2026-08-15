import { useRef, useState, type DragEvent } from "react";
import { Veil } from "@/components/Veil";
import { Msg, Spinner } from "@/components/Toast";
import { useUi } from "@/ui/UiContext";
import { S } from "@/store/state";
import { save } from "@/store/storage";
import { unitKey } from "@/lib/resume/text";
import { checkLanguage, normalizeResume } from "@/lib/resume/normalize";
import { splitResume } from "@/lib/resume/split";
import { extractContact } from "@/lib/resume/contact";
import { inferProfile } from "@/lib/resume/profile";
import { fileToText } from "@/lib/resume/files";
import { PREP_FLAGS } from "@/lib/resume/prepPrompt";
import { aiCall, aiReady } from "@/lib/ai/client";
import { useT } from "@/i18n";

interface FileRow {
  name: string;
  ok: boolean;
  words?: number;
  err?: string;
}

export function PasteModal() {
  const ui = useUi();
  const t = useT();
  const [box, setBox] = useState("");
  const [msg, setMsg] = useState<{ kind: "" | "good" | "bad" | "warn"; node: React.ReactNode } | null>(null);
  const [fileMsg, setFileMsg] = useState<{ kind: "" | "good" | "bad" | "warn"; node: React.ReactNode } | null>(null);
  const [rows, setRows] = useState<FileRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [over, setOver] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  async function handleFiles(fileList: FileList | null) {
    if (!fileList || !fileList.length) return;
    const files = [...fileList];
    setBusy(true);
    setFileMsg({ kind: "", node: <><Spinner />Reading {files.length} file{files.length === 1 ? "" : "s"}...</> });

    const results: { name: string; ok: boolean; text?: string; fixes?: string[]; twoCol?: boolean; err?: string }[] = [];
    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      setFileMsg({ kind: "", node: <><Spinner />Reading {f.name} ({i + 1} of {files.length})...</> });
      try {
        const txt = await fileToText(f);
        if (!txt || txt.trim().length < 40) {
          results.push({ name: f.name, ok: false, err: "almost no text" });
          continue;
        }
        const norm = normalizeResume(txt);
        results.push({ name: f.name, ok: true, text: norm.text, fixes: norm.fixes, twoCol: norm.suspectTwoColumn });
      } catch (err) {
        results.push({ name: f.name, ok: false, err: (err as Error).message });
      }
    }

    /* Combine every successfully-read file into the paste box, separated by a
       blank line, so the splitter treats the combined body as one inventory. */
    const combined = results.filter((r) => r.ok).map((r) => r.text as string).join("\n\n");
    if (combined) {
      setBox(combined);
      /* Keep the raw text so the AI tailor step has the full source to trace
         claims back to. Append rather than overwrite so a second upload adds to
         the corpus rather than replacing it. */
      S.rawResume = (S.rawResume ? S.rawResume + "\n\n===\n\n" : "") + combined;
      save();
    }

    const twoColHit = results.some((r) => r.ok && r.twoCol);
    PREP_FLAGS.twoCol = twoColHit;
    const ok = results.filter((r) => r.ok);
    const bad = results.filter((r) => !r.ok);

    const fixes: Record<string, 1> = {};
    ok.forEach((r) => (r.fixes || []).forEach((f) => (fixes[f] = 1)));
    const fixList = Object.keys(fixes);

    setRows(
      results.map((r) => ({
        name: r.name,
        ok: r.ok,
        words: r.ok && r.text ? r.text.split(/\s+/).length : undefined,
        err: r.err,
      })),
    );
    setFileMsg({
      kind: bad.length || twoColHit ? "warn" : "good",
      node: (
        <>
          Read {ok.length} of {results.length} file{results.length === 1 ? "" : "s"}.{" "}
          {fixList.length > 0 && (
            <>
              Cleaned up: <strong>{fixList.join(", ")}</strong>.{" "}
            </>
          )}
          {ok.length > 0 && "Check the text below, then split it into entries."}
          {bad.length > 0 && (
            <>
              <br />
              <span style={{ color: "var(--none)" }}>
                Could not read {bad.length} file{bad.length === 1 ? "" : "s"}:{" "}
                {bad.map((b) => b.name + " (" + b.err + ")").join(", ")}. Scanned images cannot be read
                in a browser; paste the text instead.
              </span>
            </>
          )}
          {twoColHit && (
            <>
              <br />
              <span style={{ color: "#8A5A00" }}>
                One or more files look like they came from a two-column layout, so reading order may
                be scrambled. Applicant tracking systems hit the same problem.{" "}
                <button type="button" className="linkbtn" onClick={() => { ui.close("paste"); ui.open("prep"); }}>
                  Fix the file properly first
                </button>
              </span>
            </>
          )}
        </>
      ),
    });
    setBusy(false);
  }

  function commit(found: ReturnType<typeof splitResume>, normText: string, raw: string) {
    /* Importing the same resume twice used to append a second full copy of
       every entry, which is how the live tool ended up showing the same
       achievement three and four times. Only genuinely new entries are added,
       and the user is told what was skipped rather than it happening silently. */
    const have: Record<string, 1> = {};
    S.units.forEach((u) => {
      const k = unitKey(u);
      if (k) have[k] = 1;
    });
    const fresh = found.filter((u) => {
      const k = unitKey(u);
      if (!k) return true;
      if (have[k]) return false;
      have[k] = 1;
      return true;
    });
    const dupSkipped = found.length - fresh.length;
    S.units = S.units.concat(fresh);

    if (raw && S.rawResume.indexOf(raw.trim().slice(0, 120)) < 0)
      S.rawResume = (S.rawResume ? S.rawResume + "\n\n===\n\n" : "") + raw;

    /* Fill in everything the file already told us, rather than presenting the
       user with empty forms for facts sitting in the document they just gave. */
    const got = extractContact(normText);
    const filled: string[] = [];
    (["name", "email", "phone", "loc", "link"] as const).forEach((k) => {
      if (got[k] && !S.hdr[k]) {
        S.hdr[k] = got[k] as string;
        filled.push(k === "loc" ? "location" : k);
      }
    });
    if (!S.hdr.title && found[0] && found[0].role) S.hdr.title = found[0].role;
    S.profile = inferProfile();
    save();

    setBox("");
    ui.close("paste");
    const q = fresh.filter((u) => u.metricType !== "none").length;
    ui.toast(
      "Added " + fresh.length + " entr" + (fresh.length === 1 ? "y" : "ies") +
        (dupSkipped ? ", skipped " + dupSkipped + " already here" : "") +
        (q ? ", pulled a number out of " + q : "") +
        (filled.length ? " and filled in your " + filled.join(", ") : "") +
        ". Check each number, then say where it came from.",
    );
  }

  function split() {
    const raw = box;
    if (raw.trim().length < 40) {
      setMsg({ kind: "bad", node: "That looks too short. Paste the whole resume." });
      return;
    }
    /* Idempotent, so running it again after a file read costs nothing and it
       still catches text pasted straight out of a PDF viewer. */
    const norm = normalizeResume(raw);

    /* Say so before splitting badly rather than after. The parser reads English
       month names and section headings, so a resume in another language will
       come apart, and the clean-up prompt is the working escape hatch because
       the user's own AI does that part in any language. */
    const lang = checkLanguage(norm.text);
    if (lang.looksNonEnglish) {
      setMsg({
        kind: "warn",
        node: (
          <>
            {t.importNonEnglish}{" "}
            <button type="button" className="linkbtn" onClick={() => { ui.close("paste"); ui.open("prep"); }}>
              {t.cleanUpFirst}
            </button>
          </>
        ),
      });
      return;
    }

    const found = splitResume(norm.text);
    PREP_FLAGS.twoCol = PREP_FLAGS.twoCol || norm.suspectTwoColumn;

    /* A resume this tool cannot read is a resume an applicant tracking system
       cannot read either, so the useful response is to fix the file rather than
       to shrug. Offered at exactly the moment the evidence for it is on screen. */
    const wordy = raw.split(/\s+/).length;
    if (found.length < 3 && wordy > 150) {
      PREP_FLAGS.thin = found.length;
      setMsg({
        kind: "warn",
        node: (
          <>
            {found.length
              ? "Only " + found.length + " entr" + (found.length === 1 ? "y" : "ies") + " came out of "
              : "Nothing could be split out of "}
            roughly {wordy.toLocaleString()} words, which usually means the layout is fighting the
            parser rather than that your history is short.{" "}
            <button type="button" className="linkbtn" onClick={() => { ui.close("paste"); ui.open("prep"); }}>
              Reformat it in your own AI first
            </button>
            {found.length ? ", or continue and add the rest by hand." : "."}
          </>
        ),
      });
      if (!found.length) return;
    }
    if (!found.length) {
      setMsg({ kind: "bad", node: "Nothing could be split out of that. Try adding one by hand instead." });
      return;
    }
    commit(found, norm.text, raw);
  }

  async function aiSplit() {
    const raw = box.trim();
    if (raw.length < 40) {
      setMsg({ kind: "bad", node: "Paste the resume first." });
      return;
    }
    setBusy(true);
    setMsg({ kind: "", node: <><Spinner />Reading it...</> });
    try {
      const txt = await aiCall(
        "Split the resume below into separate entries. Return ONLY valid JSON, an array of objects " +
          "with keys org, role, dates, action, tags. One object per bullet or achievement. Copy the " +
          "wording of each bullet across unchanged into action. tags is an array of up to 6 lowercase " +
          "skills or tools you can see named in that bullet. Invent nothing. No commentary, no code " +
          "fences.\n\n" + raw,
      );
      const m = txt.match(/\[[\s\S]*\]/);
      if (!m) throw new Error("The model did not return a list.");
      const arr = JSON.parse(m[0]);
      let id = Date.now();
      let added = 0;
      arr.forEach((o: any) => {
        if (!o || !o.action) return;
        S.units.push({
          id: id++, org: o.org || "Untitled", role: o.role || "", dates: o.dates || "",
          action: String(o.action), metricType: "none", metric: "", constraint: "", evidence: "",
          benchmark: "", tags: (Array.isArray(o.tags) ? o.tags : []).slice(0, 6),
        });
        added++;
      });
      save();
      setBox("");
      ui.close("paste");
      ui.toast("Found " + added + " entries. Every one is ungraded until you say otherwise.");
    } catch (e) {
      setMsg({ kind: "bad", node: "AI split failed: " + (e as Error).message + ". Use the plain split instead." });
    } finally {
      setBusy(false);
    }
  }

  function onDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setOver(false);
    const files = e.dataTransfer && e.dataTransfer.files;
    if (files && files.length) handleFiles(files);
  }

  return (
    <Veil on={ui.isOpen("paste")} wide label="Bring in your current resume">
      <h3>Bring in your current resume</h3>
      <p>
        Upload the file or paste the text. Either way it is split into separate entries for you to
        check, and it stays on this device.
      </p>

      <div
        className={"drop" + (over ? " over" : "")}
        onClick={() => fileRef.current?.click()}
        onDragEnter={(e) => { e.preventDefault(); setOver(true); }}
        onDragOver={(e) => { e.preventDefault(); setOver(true); }}
        onDragLeave={(e) => { e.preventDefault(); setOver(false); }}
        onDrop={onDrop}
      >
        <input
          ref={fileRef}
          type="file"
          hidden
          multiple
          accept=".pdf,.docx,.txt,.md,.markdown,text/plain,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          onChange={(e) => { handleFiles(e.target.files); e.target.value = ""; }}
        />
        <div className="drop-in">
          <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M12 16V4M12 4L7 9M12 4l5 5" />
            <path d="M20 16v3a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-3" />
          </svg>
          <div>
            <b>Drop one or more resumes here, or choose files</b>
            <span>
              PDF, Word, plain text or Markdown. Drop several at once and every entry from every file
              is added to your inventory. Read in your browser, never uploaded.
            </span>
          </div>
        </div>
      </div>
      {fileMsg && <Msg kind={fileMsg.kind}>{fileMsg.node}</Msg>}
      {rows.length > 0 && (
        <div style={{ marginTop: 8, fontSize: 12.5, color: "var(--muted)" }}>
          {rows.map((r, i) => (
            <div key={i}>
              {r.ok ? (
                <span style={{ color: "var(--audited)" }}>Read</span>
              ) : (
                <span style={{ color: "var(--none)" }}>Failed</span>
              )}
              {" · "}
              {r.name}
              {r.ok && r.words ? " · " + r.words.toLocaleString() + " words" : ""}
            </div>
          ))}
        </div>
      )}

      <div className="or"><span>or paste the text</span></div>

      <div className="field">
        <textarea
          style={{ minHeight: 170 }}
          value={box}
          onChange={(e) => setBox(e.target.value)}
          placeholder={
            "Northwind Logistics\nOperations Analyst | March 2024 to Present\n" +
            "• Rebuilt the returns workflow and cut support tickets 41%\n" +
            "• Wrote the SQL behind the weekly operations review\n\n" +
            "Brightside Retail\nCoordinator | 2022 to 2024\n• Ran vendor onboarding for 94 suppliers"
          }
        />
      </div>
      <div className="btnrow">
        <button className="btn" disabled={busy} onClick={split}>Split this into entries</button>
        {aiReady() && (
          <button className="btn ghost" disabled={busy} onClick={aiSplit}>
            Split it with my AI, more accurate
          </button>
        )}
        <button className="btn ghost" onClick={() => { ui.close("paste"); ui.open("prep"); }}>
          My resume is a mess
        </button>
        <button className="btn quiet" onClick={() => ui.close("paste")}>Cancel</button>
      </div>
      {msg && <Msg kind={msg.kind}>{msg.node}</Msg>}
      <p style={{ fontSize: 12.5, color: "var(--muted)", marginTop: 14 }}>
        Nothing is graded automatically. Every entry arrives marked <b>No number yet</b> and you
        decide what it really is. A tool that grades your claims for you would be guessing.
      </p>
    </Veil>
  );
}
