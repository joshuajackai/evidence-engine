# Developer notes

React 18 and TypeScript, strict. Vite. 57 modules, roughly 12,400 lines. No
backend, no database, no dependency at runtime beyond React and a webfont.

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # static files in dist/
npm run typecheck
```

Deploys as static files. GitHub Pages is wired up in
`.github/workflows/deploy.yml`; `netlify.toml` covers Netlify. Both are the same
`dist` folder.

---

## Where this came from

This is the port of an earlier single-file build: one 8,423 line `index.html`
holding the markup, the stylesheet and roughly 6,800 lines of vanilla JavaScript.

Every parsing rule, weighting constant, regular expression, guard, scoring
formula and prompt came across verbatim, and so did the comments explaining them,
because most of those comments record a measurement rather than an opinion. The
keyword weights, the geography tiers, the metric extractor's exclusion lists, the
fourteen ATS checks, the three model-facing system prompts and the per-source job
board pullers are the same logic in TypeScript syntax.

| Before | Now |
|---|---|
| One 8,400 line `index.html` | 57 modules under `src/`, typed |
| `var S = {...}` global | The same single store object, read through `useSyncExternalStore` |
| `innerHTML` string assembly | React components |
| `document.getElementById` wiring | Props and a small UI context |
| No types | `src/types.ts`, which writes down every shape the original left implicit |

---

## The store

Deliberately still one mutable object with a version counter, read through
`useSyncExternalStore`. Threading six thousand lines of pure logic through
arguments would have produced a different program rather than a port.

Every write goes through `save()`, which persists to `localStorage`, takes a
throttled snapshot, then notifies React. Nothing can change without the interface
hearing about it.

`S` has a stable identity, which is the point of the design and also a trap:
`useEffect(fn, [state])` never fires again. Anything that must run *after* a
write rather than during the render it caused depends on `useStoreVersion()`
instead. The ATS check is the case that matters, because it measures the rendered
document and a stale reading is a wrong number on screen.

---

## Layout

```
src/
  types.ts                  every domain shape
  store/
    state.ts                the store, active job, licence check
    storage.ts              localStorage, rolling snapshots
  lib/
    util.ts                 grades, bullet composition, clipboard, downloads
    answers.ts              the twelve screener questions
    writers.ts              why-I-fit, cover letter, outreach note
    resume/                 clean-up, splitter, metric extraction, contact
                            extraction, profile inference, file readers, the
                            reformatting prompt
    jd/                     vocabulary, keyword weighting, matching, URL fetch
    search/                 sources, network layer, pay parsing, geography, role
                            families, curl parsing, the RapidAPI adapter, the run
    ai/                     providers, model discovery, the call, PKCE sign-in,
                            prompts
    doc/                    markdown, ATS checks, document scoring, the tailor
  components/
    panels/                 the five steps
    modals/                 welcome, paste, prep, AI, sources, gap, semantic,
                            ATS, legal, paywall, tailor
```

---

## Things worth knowing before you change something

**The grading is deterministic on purpose.** No model assigns a grade, ever. That
is the product claim, not an implementation detail.

**Keyword weight is not frequency.** An earlier version used raw counts and the
top "skills" it produced from a real posting were `/li` at 48 and `/strong` at 38,
with the single most important requirement in thirteenth place. Frequency now
contributes logarithmically; position, section and known-tool status carry more.
See the comment block at the top of `lib/jd/keywords.ts`.

**Geography matching has three tiers and the order is the design.** A country
query expands to the whole country. A region query does not expand to its
country, because "new york" meaning every US listing including Austin is worse
than useless. Two letter region codes are matched only in the "City, ST" position
on the original-case string, because lowercasing first is how Ontario starts
matching the word "on".

**Every network call in the search returns `{items, error?}`.** A search that hit
six rate limits and thirty CORS failures used to look identical to one that ran
clean and found nothing. The diagnostics panel exists to make that visible.

**`aiCall` self-heals two failures** that otherwise read as "the AI is broken": a
retired model id, which is swapped for the closest live sibling in the same
family, and a 200 response truncated at the token ceiling, which grows the budget
and retries. Both are logged.

**The document carries no graphics at all.** No rules, no filled bands, no boxes.
The hierarchy is size, weight, case and spacing, because that is what every
parser handles. The ATS check measures the rendered DOM rather than trusting the
stylesheet.

---

## The bullet style contract

`src/lib/doc/style.ts` is a port of the author's production resume-pipeline
style contract (`bullet-style.json` v1.1.0), taken 2026-08-14. The core of it:

- **The lead verb names the discipline deployed, never the act of making.**
  "Built the landing pages" could be a designer, a developer, a PM or a
  founder. "Front-end developed the WordPress landing pages" can only be one
  of them. 49 leads are hard-banned, 13 are flagged as weak, and "Produced" is
  rescued only when production is literally the discipline (a film, an
  episode, a print run).
- **Six bullet frames**, intervention-result by default, with the mechanism and
  every numeral RETRIEVED from the user's entries rather than generated.
- **Banned phrase groups with reasons**: hedges, vague quantities, asserted
  adjectives. The lint message says why a phrase failed, not just that it did.

The module is the single source of truth: `AI_WRITER`, `GEN_SYSTEM`, the
`verbs` preset, the AtsModal rewrite prompt, `computeGenLint` and
`readabilitySuggestions` all import from it. Re-typing a rule in two places is
how rules drift, so do not.

The lead-verb judgement is anchored to the start of each bullet line, which is
what keeps "Built" failing a bullet without also flagging "built-in analytics"
inside prose.

## Defects fixed during the port

1. **The ATS score went stale.** Fixed with `useStoreVersion()`, above.
2. **A fetch failure was written and then hidden.** Tailor switches the user to
   the Add pane, and the message explaining that a board's full text could not be
   read lived inside the Find pane, so it went with it. It now renders above the
   tabs.
3. **The empty state claimed success.** With no entries and no posting the
   coverage panel read "Everything named in the posting is covered", which is a
   claim about a comparison that had not happened.

## Known behaviour worth a decision

Choosing **Monochrome, safest** for the resume colour costs seven ATS points. That
option adds a `border-bottom` under each section heading, and the checker counts
any visible border as a graphic, which is correct and is the same rule keeping
rules and bands off the page. If monochrome is meant to be the safest option, the
border should go rather than the check.

---

## Turning on payment

`MONETIZATION`, `BUY_URL`, `FREE_LIMIT` and `KEY_SALT` sit at the top of
`src/store/state.ts`. Set the flag, put a payment link in `BUY_URL`, and keep a
key generator matching `KEY_SALT` off the server.

The licence check is client side and bypassable by anyone who opens devtools.
That is the correct trade at a consumer price point; a server to enforce it would
cost more than the leakage.
