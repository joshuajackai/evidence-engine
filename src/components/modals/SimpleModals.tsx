import { useState } from "react";
import { Veil } from "@/components/Veil";
import { Msg } from "@/components/Toast";
import { BUY_URL, S, checkKey } from "@/store/state";
import { save } from "@/store/storage";
import { useUi } from "@/ui/UiContext";
import { copyText } from "@/lib/util";
import { PREP_FLAGS, prepPrompt } from "@/lib/resume/prepPrompt";

/* ---------- welcome, first run only ---------- */
export function WelcomeModal({ onDemo }: { onDemo(): void }) {
  const ui = useUi();
  const close = () => {
    ui.close("welcome");
    try {
      localStorage.setItem("ee.seen", "1");
    } catch {
      /* private mode; the modal simply shows again */
    }
  };
  return (
    <Veil on={ui.isOpen("welcome")} wide>
      <div className="wtag">Free. No account. Nothing leaves your browser.</div>
      <h3 style={{ fontSize: 24 }}>
        Every other AI resume tool writes your bullets for you.
        <br />
        This one cannot.
      </h3>
      <p style={{ marginTop: 10 }}>
        There is no model in here. You write the words, and the tool grades how well each claim would
        hold up if somebody asked you about it in an interview. That is the whole idea, and it is why
        nothing on your resume can be made up.
      </p>
      <div className="wsteps">
        <div><b>1</b><span>Add what you have done</span></div>
        <div><b>2</b><span>Paste the job you want</span></div>
        <div><b>3</b><span>Get a resume aimed at it</span></div>
      </div>
      <p style={{ fontSize: 13, color: "var(--muted)" }}>
        Takes about ten minutes if you have your old resume handy. You can stop and come back, your
        work is saved on this device.
      </p>
      <div className="btnrow" style={{ marginTop: 16 }}>
        <button className="btn" onClick={() => { close(); ui.open("paste"); }}>
          Paste my resume to start
        </button>
        <button className="btn ghost" onClick={() => { close(); ui.open("prep"); }}>
          My resume needs cleaning up first
        </button>
        <button className="btn quiet" onClick={close}>Start from scratch</button>
        <button className="btn quiet" onClick={() => { close(); onDemo(); }}>Show me an example</button>
      </div>
    </Veil>
  );
}

/* ---------- the resume clean-up prompt ---------- */
export function PrepModal() {
  const ui = useUi();
  const [msg, setMsg] = useState("");
  const text = prepPrompt();
  return (
    <Veil on={ui.isOpen("prep")} wide>
      <h3>Get your resume machine readable first</h3>
      <p>
        Most resumes are built to look good on a page, not to be read by software. Two columns, text
        boxes, icons and tables all survive a human eye and get shredded by an applicant tracking
        system. If yours has any of that, fix it once here and every application after it gets easier.
      </p>
      <p style={{ fontSize: 13, color: "var(--ink-2)" }}>
        Copy the prompt below into whichever AI you already pay for, attach your current resume and
        anything else with your history in it, and paste the answer back into this tool. The prompt is
        written to forbid inventing anything, so what comes back is your own history, reformatted.
      </p>
      <div className="prepsteps">
        <div><span>1</span>Copy the prompt</div>
        <div><span>2</span>Attach your files in ChatGPT, Claude or Gemini</div>
        <div><span>3</span>Paste the answer back here</div>
      </div>
      <div className="field" style={{ marginTop: 16 }}>
        <label htmlFor="prepText">The prompt</label>
        <textarea
          id="prepText"
          readOnly
          value={text}
          style={{ minHeight: 260, fontFamily: "ui-monospace,SFMono-Regular,Menlo,monospace", fontSize: 12 }}
        />
      </div>
      <div className="btnrow">
        <button
          className="btn"
          onClick={() => {
            copyText(text);
            setMsg("Copied. Open your AI, attach your resume, paste this in, then bring the answer back.");
          }}
        >
          Copy the prompt
        </button>
        <a className="btn quiet sm" href="https://chatgpt.com/" target="_blank" rel="noopener">Open ChatGPT</a>
        <a className="btn quiet sm" href="https://claude.ai/new" target="_blank" rel="noopener">Open Claude</a>
        <a className="btn quiet sm" href="https://gemini.google.com/app" target="_blank" rel="noopener">Open Gemini</a>
        <button className="btn ghost sm" onClick={() => { ui.close("prep"); ui.open("paste"); }}>
          I have the answer, paste it in
        </button>
        <button className="btn quiet" onClick={() => ui.close("prep")}>Close</button>
      </div>
      {msg && <Msg kind="good">{msg}</Msg>}

      <details style={{ marginTop: 16 }}>
        <summary style={{ cursor: "pointer", fontSize: 13, fontWeight: 600 }}>
          What this prompt actually enforces
        </summary>
        <ul style={{ fontSize: 12.5, color: "var(--ink-2)", margin: "10px 0 0 18px", lineHeight: 1.75 }}>
          <li>One column, no tables, no text boxes, no headers or footers, no graphics. These are the four things that break parsing most often.</li>
          <li>Plain hyphens for bullets and straight quotes throughout, because curly quotes, en dashes and decorative glyphs arrive as junk characters.</li>
          <li>Every number kept in the same bullet as the work that produced it, so the achievement and its result never get separated.</li>
          <li>Standard section names an ATS is looking for, spelled the ordinary way.</li>
          <li>A hard rule against inventing a company, a date, a tool or a number. If your source does not say it, it does not appear.</li>
        </ul>
        {(PREP_FLAGS.twoCol || PREP_FLAGS.thin > 0) && (
          <p style={{ fontSize: 12.5, color: "#8A5A00", marginTop: 10 }}>
            The prompt above already carries the extra context read from your file.
          </p>
        )}
      </details>
    </Veil>
  );
}

/* ---------- privacy and terms ---------- */
export function LegalModal() {
  const ui = useUi();
  return (
    <Veil on={ui.isOpen("legal")} wide>
      <h3>Privacy and terms</h3>
      <p style={{ color: "var(--muted)", fontSize: 12.5, marginBottom: 16 }}>Last updated 30 July 2026</p>

      <h4 className="lh">What happens to your data</h4>
      <p>
        Nothing you type here is uploaded. There is no account, no login, no database and no server
        belonging to this tool. Your entries, your resume and your settings are stored by your own
        browser, on this device, using local storage.
      </p>
      <p>
        That means two things worth knowing. Nobody, including the person who made this, can see your
        resume. And if you clear your browser data, or use a different device or browser, your work
        will not be there. Use <b>Save to file</b> to keep a copy you control.
      </p>

      <h4 className="lh">If you connect your own AI key</h4>
      <p>
        This is optional and off by default. If you connect a key, your key and the entries you send
        go directly from your browser to the provider you chose, such as Anthropic or OpenAI, and are
        then covered by that provider's own privacy policy. They do not pass through any server owned
        by this tool, because there is not one. Your key is stored in your browser and you can remove
        it at any time with <b>Disconnect</b>.
      </p>

      <h4 className="lh">If you upload a file</h4>
      <p>
        Your file is read inside your browser and is never uploaded anywhere. Plain text and Markdown
        are read directly. PDF and Word need a reader, so the first time you open one of those the
        page fetches the open-source pdf.js or mammoth.js library from a public CDN
        (cdnjs.cloudflare.com). Only the library comes down; your document never goes up.
      </p>

      <h4 className="lh">Analytics</h4>
      <p>
        There are no analytics scripts, no cookies, no pixels, no fingerprinting and no third-party
        trackers on this page. The only outbound request made on load is to Google Fonts for the
        typeface. The hosting provider keeps standard server logs, as all web hosts do.
      </p>

      <h4 className="lh">Your rights</h4>
      <p>
        Because no personal data is collected or held, there is nothing to request, export or delete
        from anybody else. You already hold all of it. Clearing your browser storage for this site
        erases it completely and immediately.
      </p>

      <h4 className="lh">Terms of use</h4>
      <p>
        This tool is provided as is, with no warranty. Documents you create belong to you entirely. No
        claim is made that a resume produced here will pass any particular applicant tracking system,
        or lead to an interview or an offer. The ATS score shown in the app measures the structure of
        the document against published checks; it is not a prediction of any third-party tool's result.
      </p>
      <p>
        You are responsible for the accuracy of what you write. The grading is a prompt for honesty,
        not a verification service, and it cannot confirm that a number you enter is true.
      </p>

      <div className="btnrow" style={{ marginTop: 18 }}>
        <button className="btn" onClick={() => ui.close("legal")}>Close</button>
      </div>
    </Veil>
  );
}

/* ---------- paywall ---------- */
export function PaywallModal() {
  const ui = useUi();
  const [key, setKey] = useState("");
  const [msg, setMsg] = useState<{ kind: "good" | "bad"; text: string } | null>(null);
  return (
    <Veil on={ui.isOpen("paywall")}>
      <h3>Unlock the full version</h3>
      <p>
        The free version holds five entries and stamps the export. One payment removes both, forever.
        There is no subscription and no account.
      </p>
      <div className="price">
        <b>$39</b>
        <span>one time</span>
      </div>
      <ul className="checks">
        <li>Unlimited evidence entries</li>
        <li>Clean PDF export with no stamp</li>
        <li>Unlimited tailored versions</li>
        <li>Your data stays in your browser. Nothing is uploaded.</li>
      </ul>
      <div className="btnrow">
        <button className="btn" onClick={() => window.open(BUY_URL, "_blank", "noopener")}>Buy a licence</button>
        <button className="btn quiet" onClick={() => ui.close("paywall")}>Not now</button>
      </div>
      <div className="field" style={{ marginTop: 18, marginBottom: 0 }}>
        <label htmlFor="keyIn">Already have a key</label>
        <input
          id="keyIn" type="text" autoComplete="off" placeholder="EE-XXXX-XXXX-XXXX"
          value={key} onChange={(e) => setKey(e.target.value)}
        />
        <div className="btnrow" style={{ marginTop: 9 }}>
          <button
            className="btn sm quiet"
            onClick={() => {
              if (checkKey(key)) {
                S.pro = true;
                save();
                setMsg({ kind: "good", text: "Activated. Thank you." });
                setTimeout(() => ui.close("paywall"), 900);
              } else setMsg({ kind: "bad", text: "That key is not valid. Check for typos." });
            }}
          >
            Activate
          </button>
        </div>
        {msg && <Msg kind={msg.kind}>{msg.text}</Msg>}
      </div>
    </Veil>
  );
}
