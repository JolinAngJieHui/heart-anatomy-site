# Personalised quiz reliability

This change preserves the approved `minimal-2026-10-14` collection (R1–R11), its 137 extracted passages, the production heart and all 17 canonical IDs. It introduces no database or additional service.

## Diagnosed failure

The previous generator structurally required exactly five questions both before and after the factual audit. If one audit verdict rejected a question, filtering left four and the final validator threw. No targeted recovery existed. The client and component replaced schema, timeout, evidence, and content failures with the same suggestion to explore more material. Visual questions also required MCQ options and answer keys even though their answers are determined by the production mapping.

The old evidence selector used structure metadata as an eligibility filter and selected up to 24 passages. Rebuilding the learning catalogue repeatedly also repeated local indexing and anatomical matching. The SDK already had `maxRetries: 0`; automatic SDK retries were not the cause.

The original failure was reproduced with synthetic API responses before changing code (`artifacts/quiz-baseline.log`). Four supported questions and one rejected question caused the five-question attempt to fail.

## Current pipeline

1. Capture the session/review scope and learning level; reference versions are part of cache keys.
2. Load a byte-verified approved catalogue. Reuse its prepared index only while the active collection, registry, permissions, and exact document bytes are unchanged.
3. Search actual passage text and headings globally using canonical names and recognised aliases. Preserve cited discussion passages and source qualifications. Vessel metadata is not a document-category filter. Student questions indicate interests, not medical truth.
4. Generate five candidates together using the configured model. Keep the existing level-specific language/depth instructions.
5. Validate each candidate independently: shape, scope, canonical IDs, aliases, answer key, duplicate choices and production mesh/marker compatibility. Visual choices can be null/omitted; derive canonical choices and keys locally. Whole-vessel highlights cannot identify individual segments.
6. Audit structurally valid candidates together against approved article text. Article passages substantiate medical claims; the actual production mapping substantiates which vessel/marker the application identifies. Citations or relevance scores alone do not prove an answer.
7. Retain passing candidates and make at most one targeted correction request for failed/missing questions. Include rejection reasons and accepted questions so replacements avoid duplication. Audit only the new candidates. A normal success uses two calls; correction uses at most four total calls. There is no per-question API loop or automatic model downgrade.
8. Validate the final set of exactly five, then expose it. A failure exposes no partial question set. No source-template filler or newly invented reviewed bank items are used.

A corrected batch stays in memory during the bounded attempt. Partial candidates are not persisted across failed requests or restarts: they have not passed the final five-question boundary. Successful attempts and answer order remain in the existing versioned tab cache. Reopening a running request joins it; deliberate retries receive a new generation ID. Returning to the model does not destroy the learning session.

## Honest progress and recovery

The existing quiz route supports newline-delimited JSON when requested by the browser; existing JSON callers remain supported. Events identify actual stages: finding relevant material, preparing questions, checking answers, and replacing questions. Only the final event contains a validated complete quiz. The stream does not reveal draft questions or answers.

Timeout, incomplete output, invalid response shape/IDs, duplicate choices, model mapping problems, insufficient evidence, disabled configuration, rate limits and unavailable credentials/models receive different recovery messages. Return to summary and Return to model remain available. The server uses one configured deadline, shared by generation and checking; the browser also has a finite deadline. SDK retries remain disabled.

The original explorer remains mounted while reviewing. Its downloaded GLB bytes are reused by the existing asset loader, and the quiz scene module warms during question preparation. A separate quiz scene still parses/prepares its own disposable scene when a visual question is displayed; the shared explorer mesh objects are not moved or reused unsafely across canvases.

## Development diagnostics

`quiz_stage` events include elapsed/stage duration, source/chunk IDs, candidate/retained counts, rejection reasons and outcomes. Existing `anatomy_request` events record model, response IDs, token usage, call count and duration. No API key, full conversation or source article body is logged. HTTP streaming returns immediately; use the final quiz-stage/usage event to measure completion, rather than the HTTP response-header timing.

## Verification and measurements

- `tests/quiz-recovery.test.mjs`: one/multiple studied vessels at Basic, Intermediate and Advanced; partial factual/structural failure; model questions without MCQ fields; aliases; prohibited/unapproved/stale evidence; global passage search; incomplete output; bounded recovery; streaming/coalescing; cause-specific errors; prepared catalogue reuse.
- `tests/quiz-model-recovery-browser.mjs`: production-model visual identification and marker selection, canonical scoring, and no GLB redownloads; synthetic API content.
- `tests/quiz-recovery-browser.mjs`: real Chrome and production GLB; both summary/chat entry points; all levels; actual quiz handler/generator/validator with synthetic provider responses; targeted repair; five questions; local grading; summary result integration; toolbar restoration and invalid-generation recovery. This does not establish medical accuracy of live generated content.
- `artifacts/quiz-reliability/benchmark.json`: controlled synthetic timing, with 20 ms per-call overhead and 8 ms per question. It reproduces former failure followed by a whole-batch retry and compares a targeted replacement. Read the recorded numbers rather than treating these as OpenAI latency. Both recovery scenarios use four calls, but whole retry generates ten questions versus six for targeted repair. The original failing first attempt used two calls and produced no quiz.
- `artifacts/quiz-reliability/observed-server-timings.json`: pre-existing server log observations, including failed two-call requests of about 34–38 seconds and a later successful two-call request of about 46 seconds. These are different sessions, not a controlled live before/after speed comparison. No live API requests are initiated by the automated or browser tests.

Exactly five validated questions is a success requirement, not a promise that every source scope can support them. After bounded recovery, genuinely insufficient support remains a visible error. AI auditing is an additional check, not human scientific approval. Controlled live latency and expert review of generated questions remain necessary before making claims about live performance or educational validity.

## Recorded results

- Automated suite: 248 passed, zero failed. TypeScript, ESLint, production build and minimal reference validation passed. All 11 sources remain approved with the same collection version.
- Browser workflow: passed all three levels, both quiz entry points, targeted one-question replacement, five-question grading and summary feedback. Provider responses are synthetic; the browser uses the actual production heart.
- Controlled mock recovery: former whole retry 269.2 ms; targeted correction 231.5 ms. Both four calls. Former first attempt failed after 127.9 ms/two calls. These are deliberately small simulated delays, not a live-service performance claim.
- Actual local preparation: cold catalogue 666.1 ms; unchanged-byte cached catalogue 28.6 ms. Global text search across all 17 studied IDs: cold 14.0 ms, subsequent new request 7.6 ms. These measurements include no external API calls.
- Visual browser check: passed actual heart identification and normal rotation/marker selection, 5/5 local scoring, two mocked calls, zero GLB downloads during the attempt and zero browser errors.
- Live controlled before/after: not performed. Existing server observations are retained separately and must not be treated as equivalent-session benchmarks.

SDK handling was checked against [OpenAI structured-output documentation](https://developers.openai.com/api/docs/guides/structured-outputs) and the [official Node SDK configuration guide](https://github.com/openai/openai-node/blob/main/docs/configuration.md). The installed SDK remains unchanged.

## Run checks

```powershell
npm test
npm run typecheck
npm run lint
npm run build
npm run rag:minimal -- validate
node --import ./tests/helpers/no-live-api.mjs --test tests/quiz-recovery.test.mjs
```

For browser verification, start the local development server, then run:

```powershell
npm run dev
# In a second terminal:
node tests/quiz-recovery-browser.mjs
node tests/quiz-model-recovery-browser.mjs
```

The browser test blocks external traffic and substitutes a synthetic provider while exercising the local quiz pipeline. It makes no paid API calls. For a manual live check, use the site's configured live quiz mode, explore one vessel, open Review Session and choose the personalised quiz. Observe stage and usage events; retry a genuine technical failure without discarding the saved session. Do not publish token-bearing logs or environment files.

## Files touched

- `lib/learning/quiz-evidence.ts`: global approved passage selection and request-local memoization.
- `lib/learning/quiz-status.ts`: shared stage labels and sanitised failure categories/messages.
- `lib/learning/evidence-server.ts`: exact-byte invalidated prepared catalogue reuse.
- `lib/learning/generated-quiz.ts`: independent candidate validation and final exactly-five boundary.
- `lib/learning/quiz-generation.ts`: bounded targeted repair, batched audits and diagnostics.
- `lib/learning/verify-content.ts`: independent verdicts with reasons and model/application distinction.
- `lib/learning/quiz-http.ts`: shared in-flight work, typed failures and progress events.
- `lib/learning/quiz-client.ts`: streamed progress, coalescing and cause-specific errors.
- `app/api/learning/quiz/route.ts`: pass progress from generator to existing route.
- `components/PersonalisedQuiz.tsx`: real stage display, original error preservation and scene module warming.
- `tests/navigation-learning.test.mjs`: update retrieval contract and bounded-recovery expectation.
- `tests/quiz-recovery.test.mjs`, `tests/quiz-recovery-browser.mjs`, `tests/quiz-model-recovery-browser.mjs`: regression coverage.
- This document and local test/benchmark artifacts.
