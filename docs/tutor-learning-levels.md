# Tutor learning levels and answer provenance

The existing `/api/chat` route, server-side client, configured tutor model and approved 11-source collection are retained. No Supabase, extra backend or reference re-indexing is involved.

## Behaviour

- Each generation request explicitly includes the current `learningLevel` and its teaching instructions. Basic explains essential terms in plain language; Intermediate uses university anatomy and relevant relationships; Advanced includes relevant mechanisms and clinical detail. The current level overrides earlier conversation context, without clearing the chat or triggering a request on a level change.
- Reference-supported claims and general explanations are produced in one structured generation request. Full coverage uses citations. Partial coverage separates cited claims from a general section. No relevant passages permits a general answer with the requested notice. Uncertainty remains visible, and unreliable answers can decline to guess.
- The existing citation audit checks only reference-supported claims, allowing those claims to cover part of a question. It never certifies general knowledge. Exact supporting quotations and valid passage IDs are required before that audit. Failed reference claims are omitted, not relabelled as general knowledge. No automatic regeneration loop was added.
- General-only answers use one generation call. Answers proposing reference claims use one generation plus the existing citation audit. Explicit compound questions receive additional **local** clause searches where useful, to avoid discarding a covered clause when another clause is outside the collection. These searches make no provider calls.
- Citations come from the retrieved collection, never generated URLs. General content has no citations and displays: **Not verified against this website’s references: This answer uses general AI knowledge. Please cross-check it with a reliable anatomy textbook or another authoritative source.**
- The same notice is included in saved plain text, conversation history, lesson reviews and Word-export content. Mixed/general discussions remain unverified. The lesson review may retain a faithful general takeaway only with its explicit notice and original question IDs; such takeaways are excluded from the verified quiz takeaway context. Approved source passages remain usable independently. Existing saved answers remain readable.
- Reference-loading or provider failures remain explicit errors. They are not misrepresented as an empty search. Privacy checks, action routing, local navigation, learning workflows and session cancellation remain in place.

## Configuration and API contract

No new credentials or live-enable switches are needed. `TUTOR_TIMEOUT_MS` now defaults to `60000`; `.env.example` and the existing local setting use this deadline, after a compound live answer exceeded the former 20-second limit. Browser cancellation remains bounded at 65 seconds. API keys remain server-side. Hosting should allow the configured duration.

The tutor's structured draft includes `sufficient`, cited `claims`, `generalExplanation` and `uncertainty`. The API response adds typed `sections` and the statuses `partially_supported` / `general_knowledge`, with `partial` / `unverified` evidence labels. Response validation checks that sections, citations, status and saved text agree. Grounded legacy responses retain compatibility.

The request continues to use the existing Responses API JSON schema format, following [OpenAI's Structured Outputs guidance](https://developers.openai.com/api/docs/guides/structured-outputs?api-mode=responses).

## Verification

Automated regression coverage is in `tests/tutor-learning-levels.test.mjs`, including all nine level/coverage combinations, current-level precedence, call counts, forged citations, invalid quotes, failed audits, uncertainty, clause retrieval, and preservation of provenance in saved reviews. Routine tests use mocked API responses and the repository's no-live-API guard.

`tests/tutor-learning-levels-browser.mjs` tests changing levels within one chat, full/partial/general rendering, citation separation, refresh persistence, mobile layout and no requests on level changes. It can replay saved live-check outputs for screenshots without generating again.

The manually invoked `tests/tutor-learning-levels-live.mjs --authorised-live-test` uses synthetic study activity, the actual approved collection and the configured model. It is never run by `npm test`. Results and bounded call counts are recorded in `artifacts/tutor-learning-levels/live-check.json`; failed attempts are retained. The same coronary-sinus function question is tested at all three levels, plus a compound question and an out-of-collection titin question. Live model outputs can vary; these samples do not guarantee all future answers are correct.

Completed checks (22 October 2026): all 221 automated tests passed, along with TypeScript, ESLint, the production build and the desktop/mobile browser regression. The browser test exercised all nine level/coverage combinations, preserved nine answers through refresh, and made no extra generation requests for level changes or restoration. Live checks used 14 provider request attempts in total, including one timeout under the former deadline. The final compound answer cited R11 for coronary-sinus anatomy and separately labelled the SA-node explanation as general knowledge; the no-reference answer used one generation call. Screenshots and reports are in `artifacts/tutor-learning-levels/`.

## Changed files

- Generation and retrieval: `lib/tutor/instructions.ts`, `core.ts`, `generation.ts`, `pipeline.ts`, `retrieval.ts`, `service.ts`.
- Response contract and saved provenance: `lib/tutor/answer-provenance.ts`, `types.ts`, `schema.ts`, `lib/learning/lesson-review.ts`.
- Interface: `components/TutorAnswer.tsx`, `components/AnatomyTutor.tsx`, `app/globals.css`.
- Configuration: `lib/tutor/config.ts`, `.env.example`, and the ignored local timeout setting in `.env.local` (no credential changes).
- Tests: `tests/tutor-learning-levels.test.mjs`, `tests/tutor-learning-levels-browser.mjs`, `tests/tutor-learning-levels-live.mjs`.
- Documentation: `README.md`, this report, and `docs/navigation-learning-handover.md`.
