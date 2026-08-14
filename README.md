# Evidence Engine

**A resume builder that cannot write your bullet points for you.**

### [Open the tool](https://joshuajackai.github.io/evidence-engine/)

Free. No account. No sign up. Nothing you type ever leaves your own browser.

---

## What this is

Every other AI resume tool writes your achievements for you. This one refuses to.

You write the words. The tool then grades how well each claim would hold up if a
hiring manager asked you about it in an interview, and it builds a resume aimed
at one specific job posting using only the facts you gave it.

There is no model writing your history, which is the entire reason nothing on the
resume it produces can be made up.

**Who it is for.** Anybody applying for jobs who has been burned by one of these:

- Your resume is honest, and it keeps getting filtered out before a person sees it
- An AI tool wrote you a resume full of numbers you cannot defend out loud
- You have real results but you cannot remember which ones matter for this job
- You are applying to twenty roles and rewriting the same document twenty times
- You do not know whether your file is even readable by the software companies use

**What you get out of it.** A one page resume and a longer CV aimed at a specific
posting, an honest score for how much of that posting your history actually
covers, a list of what the job asks for that you genuinely do not have, a machine
readability check on the document itself, and a tracker so the follow up a week
later does not get forgotten.

---

## Start here

**[Open the tool](https://joshuajackai.github.io/evidence-engine/)**, then read the
**[Getting started guide](docs/GUIDE.md)**. It takes about ten minutes if you have
your old resume handy.

If you have a question, the **[Questions and answers](docs/FAQ.md)** page covers
privacy, cost, what happens to your data, and what to do when something looks
wrong.

---

## The idea in one page

Most resume advice tells you to quantify everything. That advice is incomplete,
because it does not tell you what to do when there is no number, and it does not
distinguish between a number you can prove and a number you made up on a Tuesday.

So this tool sorts every line you write into one of four grades:

| Grade | What it means |
|---|---|
| **Proven** | Your number, and you can say where it came from |
| **My estimate** | Your number, worked out by you. Defensible out loud |
| **Volume** | How much you did. Weaker than a result, better than nothing |
| **No number yet** | Perfectly fine. Ship it unquantified rather than inventing something |

Aim as high as the truth allows, then stop.

The grading is done by plain arithmetic, never by a model, so it cannot be
flattered or talked into a better score.

There is also a **quarantine** field. Industry statistics you want for interview
preparation go in there and are locked out of the document permanently, because a
statistic sitting next to your name gets read as your result, and that is the
specific mistake this product exists to prevent.

---

## What it will not do

It will not invent a number. It will not upgrade "assisted with" into "led". It
will not add a tool you have never used because the posting asks for it. When the
posting wants something your history genuinely does not show, it says so, puts it
on a list called **Honestly declined**, and leaves it off the page.

A resume that wins a keyword filter and then collapses in the first interview
question is worse than one that never got read.

---

## Bringing your own AI is optional

Everything above works with no account, no key and no AI.

Connecting your own AI key unlocks four extra things: it can interview you to
help you remember a real number, tighten wording you already wrote, find weak
verbs, and rewrite your own lines into the posting's vocabulary so a keyword
filter stops marking you as a poor fit for saying the same thing differently.

It is still forbidden from inventing a number or writing a new achievement. Those
limits are sent with every single request.

The key stays in your browser and goes only to the provider you picked. There is
no server in this product for it to pass through, because there is no server at
all. See **[Connecting an AI](docs/GUIDE.md#optional-connecting-your-own-ai)** for
what it costs and how to get one.

---

## Your data

Everything lives in your own browser, on your own device. There is no account, no
login, no database and nobody, including the person who built this, who can see
your resume.

That cuts both ways. If you clear your browser data, or switch to a different
computer, your work will not follow you. Use **Save to file** and **Download
everything** to keep copies you control. This is covered step by step in the
[guide](docs/GUIDE.md#keeping-your-work-safe).

---

## For developers

Build and architecture notes are in **[DEVELOPERS.md](DEVELOPERS.md)**.

```bash
npm install
npm run dev
```

## Licence

Proprietary. All rights reserved. See [LICENSE](LICENSE). You may use the tool.
The source is published so it can be inspected, which matters for a product whose
central claim is about what it does with your data. It is not licensed for reuse,
resale or redistribution.

Built by [Joshua Jackai](https://www.linkedin.com/in/joshua-jackai).
