# Evidence Engine

A resume builder that cannot write your bullets for you.

Every other AI resume tool generates claims. This one refuses to. You write the
words, and the tool grades how well each claim would survive an interview. There
is no model writing your achievements, which is why nothing on the resume can be
invented.

**Live:** _(Netlify URL goes here)_
**Status:** free, no account, no signup. Monetization is behind a single flag.

---

## How it works

| Step | What happens |
|---|---|
| 1. Evidence | Paste an existing resume and it is split into separate entries, or add them by hand. You grade each one. |
| 2. Target role | Paste a job description. It is read for skills, tools and platforms. |
| 3. Match | Entries are ranked by how much of that posting they answer. You pick what makes the page. |
| 4. Resume | A one-column ATS-safe document, editable as plain text, exportable to PDF. |

## The grading rule

Aim as high as the truth allows, then stop.

| Grade | Means |
|---|---|
| **Proven** | Your number, and you can say where it came from. |
| **My estimate** | Your number, worked out by you. Defensible out loud. |
| **Volume** | How much you did. Weaker than a result, better than nothing. |
| **No number yet** | Perfectly fine. Ship it unquantified rather than inventing something. |

Grading is deterministic. No model assigns a grade, ever.

## The quarantine

Industry statistics go in a separate locked field. They are stored for interview
preparation and can never reach the document. A statistic sitting next to your
name gets read as your result, and that is the specific failure this product
exists to prevent.

## Bring your own model

Optional. Connect an Anthropic, OpenAI, OpenRouter or any OpenAI-compatible key
and it is used for four things only:

- interviewing you to surface numbers you already have
- tightening wording you already wrote
- finding weak verbs
- telling you which claims a recruiter would doubt

The system prompt forbids inventing a number, supplying a benchmark as your
result, writing a new achievement, or suggesting a grade. The key is stored in
your browser and sent only to the provider you chose. There is no server in this
product for it to pass through.

## ATS

Font, size, line spacing and colour are adjustable, but only across stacks that
parsers read reliably. A live checker runs twelve structural tests against the
rendered DOM and shows the score with every check listed, so the claim is
inspectable rather than asserted.

Honest limit: no tool can guarantee a given third-party checker returns 100.
Several of them score keyword overlap against a specific job, which depends on
your content, not the template. What is guaranteed is the structure.

## Architecture

One file. No backend, no build step, no database, no dependencies beyond a
webfont.

- State lives in `localStorage`, so nothing is uploaded and there is nothing to
  breach. No account system and no personal data on any server.
- The resume parser, the keyword extraction, the match scoring and the grading
  are all deterministic JavaScript.
- PDF export is the browser print pipeline against a print stylesheet.

That is a deliberate trade. It removes hosting cost, API cost, auth, and the
entire CCPA and GDPR question, and it is the reason the anti-fabrication claim is
literally true rather than a marketing line.

## Files

| File | Purpose |
|---|---|
| `index.html` | The entire application. This is what deploys. |
| `netlify.toml` | Headers and caching. |
| `keygen.template.html` | Licence key generator with the salt removed. |
| `docs/LAUNCH.md` | Pricing, distribution and kill criteria. |

**`keygen.html` is intentionally not in this repository.** It holds the salt.
It lives on one machine and is listed in `.gitignore`.

## Turning on payment

1. Set `MONETIZATION = true` in `index.html`.
2. Put a Stripe, Lemon Squeezy or Square payment link in `BUY_URL`.
3. Copy `keygen.template.html` locally, set `SALT` to match `KEY_SALT`, and keep
   it off the server.

The licence check is client side and bypassable by anyone who opens devtools.
That is the correct trade at a consumer price point; a server to enforce it would
cost more than the leakage.

## Licence

Proprietary. All rights reserved. See `LICENSE`.
