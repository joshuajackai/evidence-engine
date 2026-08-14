# Questions and answers

Short answers. The [guide](GUIDE.md) has the long ones.

---

## Cost and access

**Is it really free?**
Yes. There is no paid tier, no trial and no card. There is nothing to upsell you
because there is no server to run and therefore nothing to pay for.

**Do I have to make an account?**
No. There is no account system at all. Nothing to sign up for, nothing to log
into, no password to forget.

**Is there an app to download?**
No. It runs in your browser. You can add it to your home screen or dock so it
behaves like an app. See
[Installing it like an app](GUIDE.md#installing-it-like-an-app).

**Does it work on a phone?**
Yes, all of it. A laptop is easier for writing, but nothing is cut down or hidden
on a small screen.

**Which browsers work?**
Chrome, Safari, Firefox and Edge, on any operating system.

---

## Privacy

**Where does my information go?**
Nowhere. It is stored by your own browser, on your own device. There is no
database, no server and no account belonging to this tool.

**Can you see my resume?**
No. Nobody can, including the person who built it. There is no place for it to
arrive.

**Is my resume used to train an AI?**
No. Nothing is sent anywhere unless you choose to connect your own AI key, and
in that case it goes directly from your browser to the provider you picked and is
covered by their policy, not by anything here.

**What about analytics or tracking?**
None. No analytics scripts, no cookies, no pixels, no fingerprinting, no third
party trackers. The only outbound request the page makes on its own is to Google
Fonts for the typeface.

**What happens when I upload a PDF?**
It is read inside your browser and never uploaded. Plain text and Markdown are
read directly. PDF and Word need a reader program, so the first time you open one
of those the page downloads the open source pdf.js or mammoth.js library from a
public code host. The library comes down to you; your document does not go up.

**How do I delete everything?**
Clear your browser's site data for this address. That erases it completely and
immediately. There is nothing held anywhere else to request or delete.

**Can I check any of this for myself?**
Yes, and that is why the code is published. Open your browser's developer tools,
watch the network tab, and use the whole tool. Apart from the font and the two
document reader libraries, nothing leaves.

---

## The AI part

**Do I need AI to use this?**
No. Every core feature works without it: importing your resume, grading, the job
search, matching, the resume itself, the ATS check, the writing, the tracker.

**What does AI add?**
Four things. Interviewing you to help you remember a real number. Tightening
wording you already wrote. Finding weak verbs. Rewriting your own lines into the
posting's vocabulary so a keyword filter stops rejecting you for phrasing.

**Will the AI write my resume for me?**
It will rewrite your own entries into the posting's words. It cannot invent a
number, a tool, an employer, a date or an achievement. Those limits are sent with
every request, and after the model replies the tool checks its work with plain
arithmetic and reports anything that looks like an upgrade.

**What does it cost?**
You pay your provider directly for what you use, with no markup. Tailoring a
resume and CV is a small request: fractions of a cent on a cheap model, cents on
an expensive one. Several providers have a free tier that covers it.

**Is it safe to paste an API key?**
The key is stored in your browser only and sent only to the provider you chose.
Set a spending limit on it in their dashboard, and do not paste one into a shared
or public computer. Press **Disconnect** to remove it.

**I do not want to connect a key at all.**
Use **Copy the prompt for any chat AI** in the tailoring window. It gives you the
whole prompt to paste into whatever AI you already use, and a box to paste the
answer back into. Same result, no key.

---

## Using it

**How long does the first pass take?**
About ten minutes with your old resume to hand.

**Do I have to grade every entry?**
No, but the grades are the product. An ungraded pile still builds a resume; it
just cannot tell you which claims are strong.

**Is it bad to have entries with no number?**
No. "No number yet" is a legitimate answer and the tool says so. An invented
number is far worse than a missing one.

**Can I keep more than one job at a time?**
Yes, as many as you like. Each keeps its own keywords and its own selected
entries, so two applications give you two different resumes from the same
inventory.

**Why is my coverage score low?**
Because your evidence does not currently answer much of what that posting asks
for. That is real information about the fit, arriving before you spend an hour on
the application rather than after.

**Can I edit the resume by hand?**
Yes. **Edit as text** on step 4. Your edits win and are kept until you press
Discard.

**Why will it not export my specimen resume?**
The specimen is a teaching document showing the candidate the posting was written
for, with everything you cannot currently support in [square brackets]. It exists
to make the gap concrete. Sending it would be sending claims that are not yours.

---

## Job search

**Where do the jobs come from?**
Public job feeds and company job boards, called directly by your browser: around
140 company boards on Greenhouse, Lever and Ashby, plus Remotive, Arbeitnow,
Jobicy, We Work Remotely, RemoteOK, The Muse and the monthly Hacker News hiring
thread. A typical run reads 13,000 to 15,000 live listings.

**Why is LinkedIn or Indeed not included?**
They do not permit this kind of reading. LinkedIn has no public jobs API,
requires a login, and has taken legal action over automated reading. Indeed closed
its publisher programme to new registrations. The **Sources** window lists every
excluded site with the specific reason, and separates "a proxy would fix this"
from "this is a wall".

**Can I add LinkedIn and Indeed coverage anyway?**
Yes, legitimately. Some services license and redistribute that same inventory
rather than scraping it. Add a free key in **Sources** and they switch on. The key
stays in your browser.

**How current are the dates?**
They are each board's own published timestamp, not a search engine's guess at
freshness.

---

## Trust

**Why should I believe the anti-fabrication claim?**
Because of how it is built rather than because it is asserted. The grading is
plain arithmetic with no model involved. The tool works fully with no AI
connected at all. When a model is connected, the instructions forbidding
invention are sent on every request, and the output is then checked
deterministically afterwards. And the source is published so all of that can be
read.

**What is the ATS score actually measuring?**
The structure of the document on your screen, against fourteen published checks.
It is not a prediction of what any particular third party checker will return,
because several of those score keyword overlap against a specific job, which
depends on your content. What is checkable here is the structure, and every check
is listed rather than summarised.

**Can this guarantee me an interview?**
No, and any tool that says otherwise is selling something. It can stop you being
filtered out for reasons that have nothing to do with your ability, and it can
stop you walking into an interview holding a claim you cannot defend.

---

## Something is wrong

See [When something looks wrong](GUIDE.md#when-something-looks-wrong) for the
common cases.

Anything else:
[github.com/joshuajackai/evidence-engine/issues](https://github.com/joshuajackai/evidence-engine/issues).
Please do not paste your resume into a public issue.
