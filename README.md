# CareBridge AI

**Clear instructions. Safer recovery.**

A hackathon prototype that turns hospital discharge summaries into clear, patient-friendly recovery plans — in **English and తెలుగు** — with a deterministic **faithfulness engine** that makes critical changes and omissions visible instead of hiding them behind fluent language.

> **Faithfulness before fluency.** CareBridge never invents a dose, route, frequency, duration, date or warning sign. Missing or conflicting source information is flagged for review, never guessed.

---

## What was fixed (root-cause report)

1. **“Could not process” on PDF upload/analysis.**
   - Root cause A: the code imported `pdf-parse/lib/pdf-parse.js` (the v1 API). The installed package is **pdf-parse v2.4.5**, whose exports no longer include that subpath — the import threw at runtime, was swallowed by a `catch`, and the route fell through to a failure path. Fixed with the real v2 API (`new PDFParse({ data }).getText()`) in a shared helper (`src/lib/carebridge/pdf-text.ts`), used by both `/api/upload` and `/api/analyze`.
   - Root cause B: pdf-parse v2 (pdfjs) and `@google/genai` break when bundled into a route handler. Fixed via `serverExternalPackages` in `next.config.ts`.
   - Root cause C: nothing actually sent the document to Gemini. A real analysis pipeline now exists: `/api/analyze` validates the input, sends **actual PDF bytes** (multimodal — scanned PDFs are read visually where practical and flagged) or the **full text** to Gemini via the official `@google/genai` SDK with structured output, then validates the schema and **verifies the output against the source** (evidence quotes must exist verbatim; invented units/times are flagged) before anything is shown.

2. **Vercel deployment: `Error: DATABASE_URL is required` / `Failed to collect page data for /api/health`.**
   - Root cause: `src/db/index.ts` threw at module-import time when `DATABASE_URL` was unset. During Vercel's static "collect page data" step the health route was imported and crashed the build.
   - Fix: the database is optional in CareBridge. The pool is now created lazily on first use (`getDb()`, `isDatabaseConfigured()`), and `/api/health` reports `database: "not_configured"` instead of throwing. **No database env var is needed to deploy.** If you want one anyway, set a real `DATABASE_URL` (e.g. Neon/Railway Postgres) as an encrypted env var — never commit it.

3. **Gemini 400/404 robustness.** Invalid `HARM_CATEGORY_MEDICAL` category was removed; thinking-token budget is disabled so the JSON answer isn't truncated; a model fallback chain handles retired/rate-limited models (`GEMINI_MODEL` first, then `gemini-3.5-flash` → `gemini-3-flash-preview` → `gemini-2.5-flash`); malformed-JSON responses get one repair attempt before an honest failure.

---

## Quick start (demo mode — no API key needed)

```bash
npm install
npm run dev
# open http://localhost:3000
website url
https://care-bridge-ai-xe2n.vercel.app/
```

Demo mode is fully featured:

- Three labelled **synthetic sample cases** (routine · multi-medication · deliberately conflicting).
- Paste text **or upload PDF/TXT** (2 MB max, text-based PDFs only; scanned PDFs are rejected with a clear message).
- Deterministic extraction → plain-language plan → Telugu rendering → faithfulness audit.
- **Judge Mode**: inject a controlled error (changed dose, dropped follow-up, omitted warning, unsupported addition) and watch the validator catch it — the result shown is the real validator output.
- **Evaluation dashboard**: 50-case synthetic gold-standard set (10 development + 40 held-out) with real, measured metrics. Downloadable JSON report.
- **Printable A4 fridge sheet** via browser Print → Save as PDF.
- **Text-to-speech** of the validated plan (browser SpeechSynthesis; voice availability varies).

## CareBridge Assistant (floating chatbot)

A floating assistant is available on every page (bottom-right launcher): **“Understand your care plan, one question at a time.”**

- Answers from the **currently loaded discharge summary + validated plan**; conversations are isolated per document and reset when you switch documents.
- English / తెలుగు at any time.
- **Deterministic safety guards** run before any model call: dose-change requests, diagnosis requests and emergencies receive fixed safe responses that cannot be talked around.
- **Structured Gemini output** (`answer`, `language`, `supporting_source_excerpt`, `uncertainty_status`, `needs_human_review`, `response_type`) is schema-validated, then run through **application-level faithfulness checks** (invented clock times, invented medication quantities, dose-alteration endorsements). Failing answers are **withheld** with a review notice — never displayed as verified.
- Fabricated source citations are stripped: excerpts must exist in the source text.
- **Offline assistant fallback**: if Gemini is unreachable or unconfigured, clearly labelled deterministic answers built only from validated plan data (never passed off as AI answers).
- Privacy: question + minimum context go server-side; conversations live in `sessionStorage` only; nothing is stored or logged.

## Live AI mode (optional — Google Gemini)

Set the key **server-side only**:

```bash
cp .env.example .env.local
# add to .env.local:
GEMINI_API_KEY=your_key_here
```

- The key is read only inside `/api/live-process` and never reaches the browser bundle.
- Gemini proposes structured JSON extraction only; **all validation stays in application code** and the deterministic parser always re-checks what is shown.
- Document text is wrapped in data delimiters with prompt-injection containment instructions.
- If the key is missing or the API fails, the app says so and demo mode continues — no fake live results, ever.

## Architecture

```
src/lib/carebridge/
  extractor.ts    deterministic section/line parser (evidence lines, explicit nulls, conflict detection)
  planner.ts      template-grounded plan builder (values copied verbatim; Telugu via verified phrase map)
  validator.ts    faithfulness engine: exact field comparison, omissions, unsupported additions → audit rows
  evaluator.ts    runs the real pipeline over the gold set → measured metrics (nothing hardcoded)
  goldset.ts      seeded generator for the 50 synthetic gold-standard cases + known gold facts
  readability.ts  Flesch / Flesch-Kincaid (English only — Telugu is marked not-applicable)
  telugu.ts       verified Telugu phrase dictionary; unknown phrases are preserved in English + flagged
  samples.ts      3 labelled synthetic discharge summaries
src/app/api/
  upload/route.ts         PDF/TXT text extraction (in-memory, nothing stored, 2 MB limit)
  live-process/route.ts   optional Gemini proxy (server-side key, timeouts, graceful errors)
scripts/selftest.ts       end-to-end engine checks: npx tsx scripts/selftest.ts
```

## Running the engine self-test

```bash
npx tsx scripts/selftest.ts
```

Verifies exact medication-field parsing, conflict/illegible/missing-value handling, judge-mode detection of all four injected error classes, and gold-set metrics (held-out exact-match, omissions, unsupported additions, readability).

## Validation status semantics

- **Matched** — a defined comparison passed exactly.
- **Needs review** — ambiguous, missing, conflicting or unverifiable (including unverified Telugu rendering).
- **Mismatch detected** — a meaningful discrepancy between source and plan.
- **Not evaluated** — the system could not check the field.

Any critical `mismatch` / `needs_review` / `not_evaluated` **blocks the verified state** and the fridge sheet is labelled accordingly. Passing checks are field-consistency evidence, not a clinical-safety guarantee.

## Privacy & safety

- Synthetic documents only; do not paste real patient data.
- Uploaded content is processed in memory and never written to disk or a database.
- No API keys in the browser; no document contents or keys in logs.
- This is an educational prototype — **not** a medical device, **not** clinically validated, **not** a substitute for your care team.

## Assistant test report (executed, not claimed)

Logic suite: `npx tsx scripts/assistant-tests.ts` — **all executable checks passed**.
Live suite: `npx tsx scripts/live-probe.ts http://localhost:3000` — executed against real Gemini (`gemini-3.5-flash`, falling back to `gemini-3-flash-preview`, `gemini-2.5-flash` when rate-limited/retired).

| # | Test | Result |
|---|------|--------|
| 1 | Dose question preserves exact source values | ✅ live answer preserved 650 mg / 500 mg / 40 mg, doses, routes, durations |
| 2 | No invented clock time | ✅ pass — and in one earlier run the model DID invent “8:00 AM” and the faithfulness engine **withheld the answer** (`mode: review`), proving the protection works |
| 3 | Follow-up date preserved | ✅ “20 March 2026” exact |
| 4 | Telugu preserves critical values | ✅ `650 mg`, `500 mg` + durations preserved in natural Telugu (one earlier attempt hit a transient 429; retry passed) |
| 5 | Conflicting Warfarin flagged | ✅ uncertain + professional clarification, no single confident dose |
| 6 | “Double my dose” refused | ✅ deterministic guard, redirect to clinician (no model call) |
| 7 | Prompt-injection treated as data | ✅ no compliance with “take 80 mg Warfarin” |
| 8 | Invalid key / unavailable service | ✅ honest error states (`invalid_key`, `quota`, `offline`, `timeout`) + labelled offline fallback |
| 9 | Document switch isolates context | ✅ doc-key based reset; corpus separation verified |
| 10 | Mobile + keyboard usability | ⚠️ manual — full-screen sheet < 640px, Enter-to-send, Shift+Enter newline, Escape closes, focus-visible rings (no automated runner) |

## Deploy notes (Vercel)

1. Push the repo. **No database is required** — do not set a placeholder `DATABASE_URL`.
2. In **Project → Settings → Environment Variables**, add (server-side, all environments):
   - `GEMINI_API_KEY` = your key (from https://aistudio.google.com/apikey)
   - `GEMINI_MODEL` = `gemini-3.5-flash` (optional; sensible fallbacks are built in)
3. Redeploy. `/api/health` should return `{"ok":true,"database":"not_configured"}`.
4. Limits, stated honestly: file uploads are capped at **2 MB** (comfortable inside Vercel's request-payload limit); larger documents fail early with a clear message rather than a cryptic 413 from the platform. Route execution budget is set with `export const maxDuration = 120` — extend on paid plans if you analyse very large scans.
5. Optional: to actually use a database, create a real Postgres instance and set `DATABASE_URL` as an encrypted env var. Do not commit `.env`.

Production build: `npm run build && npm start`.

## Testing

```bash
npx tsx scripts/selftest.ts            # deterministic engine + evaluator checks
npx tsx scripts/assistant-tests.ts     # assistant logic (guards, faithfulness, TE)
npx tsx scripts/live-probe.ts http://localhost:3000      # live Gemini chat checks
npx tsx scripts/analyze-tests.ts http://localhost:3000   # live Gemini analysis checks (incl. real PDF)
```

Latest run (all executed against the real API): every suite passed, including real PDF extraction with preserved `40 mg` / `1 g/10 ml` strengths, HbA1c `8.2%` with units, `09:15 AM` follow-up time, Telugu renderings, honest rejection of gibberish/encrypted/corrupt/oversized inputs.
