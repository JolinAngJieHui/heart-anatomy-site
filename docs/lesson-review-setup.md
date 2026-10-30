# Personalised lesson reviews and chatbot controls

Updated 22 October 2026. The existing Next.js routes, official OpenAI SDK, approved 11-source collection, server-side credentials and usage limiter are retained. No new backend or database is required.

## Student experience

The chatbot no longer displays the introductory medical-use line or privacy checkbox. Typed questions and suggestions can submit immediately. The request accepts omission of the legacy confirmation field; existing clients supplying `true` remain compatible. Privacy screening, medical-safety instructions, input validation, origin checks, rate limits and server-only credentials remain in place. Answer-specific source citations and unverified-knowledge notices remain visible.

The entire **Continue your revision** section is removed. **Take Personalised Quiz** sits beside Download Word and Return to Model. Review and quiz use the main toolbar's selected learning level, avoiding conflicting selectors. Existing recorded revision notes remain stored and exportable; they are not added to the API summary input.

**Key takeaways** contains one encouraging sentence followed by approximately 3–5 personalised points, fewer for limited material. This is generated prose, not a selection of static templates. The original explored-structure list and questions/answers remain independently available, including expandable full answers. Generated prose stays inside Key takeaways. Word exports retain the summary, source metadata and notices.

## Generation and evidence

`generateLessonReview` uses the existing `/api/learning/review` endpoint and `client.responses.parse`. The server receives canonical structure IDs, current and relevant learning-level history, substantive current-session questions/answers with provenance, and recorded quiz results. It resolves canonical names and independently loads approved, available reference passages with external-processing clearance. Browser/session IDs, timestamps, event logs, private notes and camera activity are not sent to OpenAI.

Navigation-only commands and learning-workflow commands are excluded. Repeated marker events do not create duplicate exploration records or change the generation fingerprint. The current session is the only input: previous sessions are never aggregated.

The generation prompt differentiates Basic, Intermediate and Advanced, prioritises questioned topics, groups related concepts and forbids invented achievements. Conversation is activity data, not anatomical evidence. Reference takeaways require existing evidence IDs and exact source versions. A retained general-AI point must refer to an actual recorded general or mixed answer, carry no reference citations, preserve uncertainty, and display the unverified-knowledge notice. Unreliable claims should be omitted. General takeaways are excluded from the quiz's verified takeaway context.

One generation request is followed by the existing evidence audit. The audit checks reference support, faithful question summaries, qualifications and actual activity. For general points it checks faithful retention and labelling; it does not certify their medical accuracy. Invalid, incomplete or rejected output is not displayed as a successful AI summary. There is no automatic generation/retry loop.

## Caching, updates and failure states

- First meaningful Review Session request generates the summary. Empty sessions show an invitation to explore or ask a question without a review API call.
- Successful results are cached in bounded memory and tab-scoped sessionStorage, keyed by session, relevant content, learning level and reference content. Refresh can restore them.
- Reopening unchanged content makes no new generation request. After meaningful activity or a level change, the earlier review remains visible with an Update review notice; the student chooses when to update it.
- Changed reference content invalidates the prior summary/citations and requires Update review. Rejected or corrupted cached records never count as AI output.
- Concurrent requests within the same browser session share in-flight work. The server also coalesces identical in-flight requests and keeps no completed student-review cache.
- Loading and failure states remain explicit. A failed request shows actual saved activity and a Retry review button, with no generic/template takeaways presented as AI content.
- Restart Session clears the app's tab storage and in-memory caches, aborts pending generation, and invalidates late responses. Other tabs keep their independent lesson scope.
- Quiz attempts hold their own review snapshot, so recording quiz results does not remount an attempt or generate another review.

## Existing configuration

No new credentials, live switches or dependencies were introduced. Keep keys in `.env.local` locally and the host's server-side environment/secret settings in deployment; never use `NEXT_PUBLIC_*` for secrets. Current review configuration uses:

```dotenv
OPENAI_API_KEY=<server-side key>
OPENAI_TUTOR_MODEL=<configured model supporting Responses structured output>
LESSON_REVIEW_LIVE_ENABLED=true
LEARNING_GENERATION_TIMEOUT_MS=60000
TUTOR_REQUESTS_PER_MINUTE=10
TUTOR_DAILY_REQUEST_LIMIT=100
# Required for live production usage:
TUTOR_REDIS_REST_URL=<HTTPS Redis REST endpoint>
TUTOR_REDIS_REST_TOKEN=<server-side token>
```

This documents activation; this change did not alter credentials or live-enable settings. Review generation requires a compatible Next.js Node hosting runtime, the knowledge-base files, outbound API access, the production shared limiter and a request duration covering the configured deadline. Missing configuration, provider failures or rate limits leave the saved-activity review usable.

## Verification

No paid API calls were made for this change. Automated tests inject provider responses; the browser regression intercepts all AI endpoints and blocks external network requests.

- `tests/key-takeaways.test.mjs`: all three levels, exploration-only and discussion sessions, canonical names/context, prompt/schema rules, provenance, invalid citations, current-session scope, deterministic fingerprints, stale results, reference changes, storage restoration, duplicate requests, empty sessions, explicit retries and retained privacy checks.
- `tests/key-takeaways-browser.mjs`: real production GLB loads; chat sends without confirmation; removed controls/section are absent; all three review levels with exploration and questions; navigation exclusion; source/general distinction; Word download; mobile layout; in-flight reopening; failure/retry; quiz completion without review regeneration; restart/refresh isolation.
- The full 227-test suite passed. TypeScript, ESLint and the production build also passed. Windows sandbox restrictions on temporary test links/renames required rerunning the suite with normal local filesystem access.

Reports, screenshots, Word output and verification logs are under `artifacts/key-takeaways/` and `artifacts/key-takeaways-*.log`. Browser screenshot prose is explicitly synthetic test content. These checks verify the integration and safeguards; this turn did not assess new live-model outputs or guarantee medical accuracy of general knowledge.

## Changed implementation files

- Interface: `components/AnatomyTutor.tsx`, `components/LearningReview.tsx`, `components/LessonRecap.tsx`, `app/globals.css`.
- Chat request compatibility: `lib/tutor/schema.ts`, `types.ts`, `core.ts`, `http.ts`.
- Review data, generation, validation, caching and export: `lib/learning/lesson-review.ts`, `review-generation.ts`, `verify-content.ts`, `review-client.ts`, `workflow-client.ts`, `summary.ts`.
- Quiz provenance: `lib/learning/quiz-generation.ts`.
- Tests: new key-takeaway unit/browser suites, adjusted learning-session export expectations, and existing browser scripts updated for removal of the checkbox/revision controls.
- Documentation: this setup guide and `docs/tutor-learning-levels.md`.

Floating milestone behaviour, model geometry, vessel highlighting, camera controls and the reference collection are unchanged by this task.
