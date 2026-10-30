# RAG and model routing handover

**Historical report.** For the current routing, chat review/quiz workflows, labelled
model groups and 21 October live verification, read
[Four chatbot functions](four-chatbot-functions.md). That report supersedes the
navigation and activation descriptions below; this document retains the earlier
reference audit and testing history.

Implemented 17 October 2026 in the existing Next.js 16.3.1 App Router application (React 19.2.8, React Three Fiber 9.7, Drei 10.7, Three 0.185, OpenAI JS SDK 7.32.0, Zod 4.6.5). The server page reads runtime configuration on incoming requests using Next.js `connection()`, so permissions are not frozen into a static build. The existing Node route handlers, viewer reducer, local references, session events, Word export and source-template quiz interface remain in use. No Supabase, database, vector service, hosted retrieval deployment, classifier model or new dependency was added.

## Reference audit

The authoritative selection is `knowledge-base/active-collection.json`, pointing to `knowledge-base/collections/minimal-2026-10-14/registry.json` and `register.json`. Source text is in the approved, content-addressed Markdown files below. `lib/knowledge-base/minimal.ts` checks registry, source hashes, versions, scope, licence/approval and extraction locators before use. Ingestion/extraction remain in the existing `scripts/minimal-rag.mjs` and knowledge-base modules. These are selected article sections, **not the 11 complete articles**. The 17 annotations are a separate structure inventory.

| Reference title / URL | Existing storage location | Text available? | Index/chunk status | Retrieval verified? |
| --- | --- | --- | --- | --- |
| R1 [Coronary Artery Anomalies: A Computed Tomography Angiography Pictorial Review](https://doi.org/10.3390/jcm13133920) | `knowledge-base/approved/minimal-2026-10-14/R1-902f00fd9cfb502b59e3.md` | Yes; selected sections | 9 validated chunks; no embeddings | Yes, fixed question retrieved direct text |
| R2 [Right ventricular myocardial infarction: pathophysiology, clinical implications and management](https://doi.org/10.31083/j.rcm2204131) | `knowledge-base/approved/minimal-2026-10-14/R2-b67e48256dec001a2fd0.md` | Yes; selected sections | 8 validated chunks; no embeddings | Yes, fixed question retrieved direct text |
| R3 [Left Main Coronary Artery Disease: A Contemporary Review of Diagnosis and Management](https://doi.org/10.31083/j.rcm2502066) | `knowledge-base/approved/minimal-2026-10-14/R3-b8a9d77176b4446820d3.md` | Yes; selected sections | 13 validated chunks; no embeddings | Yes, fixed question retrieved direct text |
| R4 [Clinical Updates in Coronary Artery Disease: A Comprehensive Review](https://doi.org/10.3390/jcm13164600) | `knowledge-base/approved/minimal-2026-10-14/R4-bbf8691887802536939e.md` | Yes; selected sections | 30 validated chunks; no embeddings | Yes, fixed question retrieved direct text |
| R5 [The diagonal branches and outcomes in patients with anterior ST-elevation myocardial infarction](https://doi.org/10.1186/s12872-020-01386-4) | `knowledge-base/approved/minimal-2026-10-14/R5-2bbf792e50ba8cc5b003.md` | Yes; selected sections | 6 validated chunks; no embeddings | Yes, fixed question retrieved direct text |
| R6 [Navigation of the Clinical Implications, Interventional Challenges, and Complexities of the Circumflex Coronary Artery: A Comprehensive Review](https://doi.org/10.31083/RCM47426) | `knowledge-base/approved/minimal-2026-10-14/R6-4f034b046ac6d610bca8.md` | Yes; selected sections | 24 validated chunks; no embeddings | Yes, fixed question retrieved direct text |
| R7 [Successful coronary angioplasty of a spontaneous occlusion of the conus artery causing a ST-segment elevation myocardial infarction and electrical storm](https://doi.org/10.1186/s42269-024-01247-6) | `knowledge-base/approved/minimal-2026-10-14/R7-2d95f735ac411f392a31.md` | Yes; selected sections | 2 validated chunks; no embeddings | Yes, fixed question retrieved direct text |
| R8 [Imaging of the aortic root on high-pitch non-gated and ECG-gated CT: awareness is the key!](https://doi.org/10.1186/s13244-020-00855-w) | `knowledge-base/approved/minimal-2026-10-14/R8-e64da376909eab54280e.md` | Yes; selected sections | 5 validated chunks; no embeddings | Yes, fixed question retrieved direct text |
| R9 [Optimal Management of Spontaneous Aortic Thrombus Floating in the Ascending Aorta, from a Single Case Experience to a Literature Review](https://doi.org/10.3390/jcdd12040146) | `knowledge-base/approved/minimal-2026-10-14/R9-15a6c9a025f2de8aac2b.md` | Yes; selected sections | 14 validated chunks; no embeddings | Yes, fixed question retrieved direct text |
| R10 [Review of evolving etiologies, implications and treatment strategies for the superior vena cava syndrome](https://doi.org/10.1186/s40064-016-1900-7) | `knowledge-base/approved/minimal-2026-10-14/R10-42510bff97e1e205fc21.md` | Yes; selected sections | 10 validated chunks; no embeddings | Yes, fixed question retrieved direct text |
| R11 [Coronary sinus thrombosis: insights from a comprehensive literature review](https://doi.org/10.1186/s12959-025-00707-x) | `knowledge-base/approved/minimal-2026-10-14/R11-67b46f7bf412fad59eb8.md` | Yes; selected sections | 16 validated chunks; no embeddings | Yes, fixed question retrieved direct text |

Result: 11 approved sources, 137 chunks; no missing source text, empty paragraphs, duplicate IDs, DOIs, chunk IDs or exact duplicate text detected. All 11 fixed source probes retrieved direct text. Search uses the existing deterministic lexical, alias, concept and question-facet ranking across the entire collection. There are **no local neural embeddings**. Changing the tutor model did not re-embed or re-chunk anything.

The saved `local-index.json` inventory has an older collection version. Runtime does not read it: it builds current chunks from byte-validated source files. It was deliberately left untouched. The legacy remote index is unconfigured and no longer a prerequisite for live tutoring. No remote storage or remote embeddings were verified or required. Supabase is not used, as confirmed by the owner. No approved reference files or approval records were changed.

Reproduce the read-only audit: `npm run rag:audit -- --output artifacts/rag-routing/reference-audit.json`. Raw findings include exact sections, hashes, probe questions and source counts. Local retrieval passing these probes does not establish clinical completeness or anatomical answer accuracy.

## Request flow

- UI/marker/camera actions continue directly through the existing viewer controller without an API call.
- Tutor messages reach `/api/chat` (the `/api/tutor` alias remains). Privacy/input checks, same-origin checks, explicit live gates and the existing shared limiter remain in force.
- Routine navigation: the existing anatomy alias registry resolves unambiguous names locally. Whole RCA/LAD requests ask which annotated segment. Unsupported annotated regions and unselected pronouns ask for clarification. Less literal navigation uses Luna with only a bounded request/context, registered names/aliases and four strict navigation tools. No reference passages, geometry or full session are sent.
- Educational questions, including short questions, use Sol plus approved local passages. Mixed teaching/navigation also uses Sol and the same tools; there is no Sol-Luna-Sol chain.
- Sol generates cited claims with exact evidence quotes; the existing second Sol verification request checks entailment and coverage. Invalid citations, insufficient evidence, incomplete output or failed verification produce no unsupported teaching answer. The verifier remains a model-based safeguard, not scientific validation.
- A mixed request may add one bounded Sol continuation after a complete tool call. Tool definitions allow selection/focus, clearing selection and resetting the view only. No arbitrary camera coordinates, code, unknown tools or IDs are accepted. Inferred functional targets must appear explicitly in both grounded claims and cited passage text.
- The browser validates complete proposals, rejects repeated IDs and stale session epochs, and dispatches the existing scene action. Completion text is application-generated only after committed selection and the existing camera transition settle. Restored conversations never replay actions. Restart aborts pending replies/actions and clears review/quiz caches.
- Navigation, teaching and errors use the same conversation and session event records. Review and Word export retain original questions and saved responses.

The imported scan still has no anatomical attachments configured. Its 17 catalogue identities and teaching data remain intact. A navigation request can open the relevant information, but explicitly says the scan position has not been tagged. No coordinates or marker mappings were guessed or changed.

## Evidence selection and limits

Defaults: `RAG_TOP_K=5`, `RAG_MAX_CONTEXT_TOKENS=3500`. The existing ranker can supply at most 12 candidates. Selection deduplicates, preserves whole passages and their qualifications, and uses at most top-k (top-k plus two for comparisons, capped at 12). Tied comparisons favour complementary sources. Explicit question targets override a selected vessel; pronoun follow-ups use relevant selected/recent context. Navigation verbs no longer make a mixed question fail lexical coverage. “What does X do?” now requests function evidence.

The budget counts the **complete serialized evidence JSON**, including source/chunk IDs, URLs, titles, section headings, tags and cautions. Because the exact requested models' tokenizer has not been verified locally, counting deliberately uses UTF-8 bytes as a conservative byte-token upper bound. This can return fewer than five passages. It is not a chars/4 estimate or a claim about exact billed tokens. No paid counting API is invoked. The same evidence serializer feeds the actual model request; no hidden whole-article fallback exists.

`node scripts/rag-routing-check.mjs` writes measured byte counts to `artifacts/rag-routing/evidence-budget.json`. It compares the previous six-passage payload shape with the new bounded payload using current retrieval and the unchanged corpus. This is a reconstructed payload comparison, not a pre/post live API experiment. Exact input/output/cached tokens are available only from authorised live API usage.

Missing reference content, collection-load failure, search failure, insufficient search results and unavailable API/model errors are distinct outcomes. An unsuccessful search never claims the complete articles contain no answer.

## Reviews and quizzes

Reviews reuse the existing constrained structured-output workflow, now with the central Sol model. Inputs include deliberate selections, levels, actual questions, saved supported answer paragraphs and source IDs, unresolved outcomes and compact actual quiz results. Unneeded answer paragraphs are omitted from model input while originals remain in the browser and Word exports. A response cannot select a paragraph it was not sent, rewrite original records, invent questions or declare mastery from clicks. The existing unchanged-session review cache and deterministic basic fallback remain.

The new `/api/learning/quiz` route uses the same evidence catalogue and actual activity underlying the lesson review: explored structures, explicitly reviewed source citations, discussed topics and actual quiz results. It reconstructs eligible questions and keys from trusted approved passages on the server. Sol selects question IDs to prioritise revision and variety; it cannot invent answer keys, rewrite source explanations or treat an AI-written recap as evidence. This is **AI-personalised selection of source-grounded practice**, not a new clinically validated question bank. Application questions still require the existing reviewed bank. Structures without suitable exact-structure passages remain ineligible rather than receiving invented questions.

Quiz requests happen only on Start Personalised Quiz. Missing credentials, disabled gates, errors or malformed selections retain the deterministic local quiz. Successful and fallback results are cached for identical activity; restart clears/aborts them. Model replies contain IDs only; the browser preserves its existing full questions, explanations and source links. The interface labels AI selection only after a validated provider response.

## Model verification and activation

Official pages checked on 17 October 2026 confirm the exact requested IDs and function/structured-output support: [GPT-6.1 Sol](https://developers.openai.com/api/docs/models/gpt-6.1-sol) and [GPT-6 Luna](https://developers.openai.com/api/docs/models/gpt-6-luna). Calls use the [Responses function-calling contract](https://developers.openai.com/api/docs/guides/function-calling), strict function arguments and `text.format` structured JSON, supported by the installed official SDK. Model choice is server-controlled; request schemas reject frontend model overrides. No silent alternative model is configured.

At implementation on 17 October, no API key was configured and no paid calls had
been made. Account access and one bounded live Tutor question were subsequently
checked on 20 October as recorded below. Model visibility alone does not prove
generation entitlement or teaching quality.

1. Copy `.env.example` to `.env.local` for local development; do not commit credentials. The default `TUTOR_MODE=review` and local backend provide actual excerpt previews with no generated teaching. Reviews/quizzes work locally. Production must use `TUTOR_MODE=disabled` until live activation; development review mode is intentionally prohibited in production.
2. Set server-only `OPENAI_API_KEY`, `OPENAI_TUTOR_MODEL=gpt-6.1-sol`, `OPENAI_NAVIGATION_MODEL=gpt-6-luna`. The legacy `OPENAI_MODEL`, `LESSON_REVIEW_MODEL` and remote vector-store settings no longer select live tutor/review/quiz models. Legacy optional ingestion tools remain separate.
3. After explicit authorisation for live use, set `TUTOR_MODE=live`, `TUTOR_LIVE_ENABLED=true`; independently set `LESSON_REVIEW_LIVE_ENABLED=true` and `QUIZ_LIVE_ENABLED=true` for those billable features. A key alone cannot activate them. Keep them false during routine development/testing.
4. Set retrieval limits above, plus `TUTOR_TIMEOUT_MS`, `TUTOR_MAX_OUTPUT_TOKENS`, `LESSON_REVIEW_TIMEOUT_MS`, `TUTOR_REQUESTS_PER_MINUTE`, `TUTOR_DAILY_REQUEST_LIMIT` as needed. SDK automatic retries are disabled. Sol uses supported low reasoning effort; Luna navigation uses none. The verifier allows 800 output tokens, including reasoning, rather than the old 300-token cap. These bounds need evaluation during authorised live testing; incomplete responses fail safely. Teaching normally uses two Sol calls (generation plus verification); mixed tool requests can use three. Navigation uses at most one Luna call and often none. Review and quiz use one Sol call each.
5. In NUS hosting, configure the same variables in the server/service secret environment. Use a compatible Node.js Next server (`next start` or equivalent), not a static-file-only host. Ship the local `knowledge-base` files with the server and public GLB assets with the site. Preserve the **existing** production shared usage limiter: `TUTOR_REDIS_REST_URL` and `TUTOR_REDIS_REST_TOKEN` must already be configured for live production. No replacement database/service has been introduced.
6. Check account visibility without generation using `node --env-file=.env.local scripts/check-model-access.mjs` (omit the env-file option if variables are already configured). It uses Models GET only, never generation, and prints no credentials. Missing/unsupported models are reported; there is no substitution.
7. After live testing is authorised, restart the app and try one anatomy question, one less-literal navigation request, one mixed request, Review Session and a quiz after reading an eligible passage. Verify displayed citations against originals and actual viewer selection. Inspect the privacy-safe `anatomy_request` server metadata for category/model, passage count, evidence upper bound, API-reported input/output/cached tokens, latency, call count, retries and proposal status. Viewer confirmation is local; server logs do not falsely claim execution. No raw questions, references, session IDs or secrets are logged by this instrumentation.

No additional feature development is needed to activate these routes. Valid account access, supported model configuration, explicit live permission, compatible hosting and the pre-existing production limiter remain deployment prerequisites. Scientific review of generated teaching remains a separate verification task.

## Verification commands

- `npm test` — all unit tests, with a hard guard against accidental live OpenAI fetches; provider tests inject mocked clients.
- `npm run typecheck` and `npm run lint`.
- `npm run build -- --webpack` — production build using the working build path on this Windows machine. The default Turbopack CSS worker previously failed in this environment; this task does not change the default build script.
- `npm run dev -- --port 3000` then `node tests/rag-routing-browser.mjs` — isolated Chrome profile, mocked provider responses, external network blocked; verifies navigation, actual scan integration, review/quiz/export, restart and mobile behavior. Browser harness uses the project's existing cached Playwright tools.
- `node tests/lesson-review-browser.mjs` with `EXPLORER_TEST_URL=http://localhost:3000` — existing review, Word export, responsive toast and cache regression suite.

Results: **169/169 automated tests passed**, including all 11 fixed source probes under the complete evidence budget; TypeScript/type generation and ESLint passed. The final Webpack production build passed. A separate production server smoke test also passed: runtime mock configuration reached the page after a build made with live usage disabled; tutor mock, basic review and disabled-live quiz endpoints behaved correctly. The temporary server was stopped. Both browser suites passed with zero page errors and no external API calls. They covered 17 schematic markers, all three levels, actual imported GLB navigation, ambiguous/duplicate/stale action handling, refresh without replay, progress colours, review caching, actual-question retention, mocked AI quiz selection, reset, mobile/six responsive layouts, timed floating notifications and Word export. All provider generations were mocked; the real local retrieval and actual imported model were exercised.

Measured reconstructed payload comparison: RCA function question 7,758 → 3,237 UTF-8 bytes; RCA/LCx comparison 7,495 → 3,493 bytes (two sources); coronary-sinus question 2,422 → 2,771 bytes because retained provenance adds metadata and both original passages still fit. These are serialized payload measurements / conservative bounds, **not exact model token usage or assumed uniform savings**.

Remaining verification at the original handover: account-specific model access,
paid Responses/tool execution, generated teaching quality and clinician/educator
assessment had not been tested. The bounded check below updates account access
and one teaching response only. Source selection and JSON/schema validation alone
cannot establish anatomical accuracy. The supplied scan's manual marker
calibration and reviewed clinical quiz bank remain pre-existing work outside this
routing task.

## First authorized live Tutor check — 20 October 2026

Read-only model checks succeeded for both configured models. The user then
authorized one Tutor question: “Where does the coronary sinus drain?” The actual
`/api/chat` handler retrieved two approved R11 passages and obtained a completed
Sol response. Initially, local claim validation rejected two exact quotations
associated with one passage ID because it required equal-length arrays.

The validator now accepts multiple quotations for a single unambiguous passage
only when **every** quotation occurs verbatim in that passage. Multiple passage
IDs still require strict positional pairing; unknown IDs, missing quotations,
fabricated quotes and ambiguous pairings remain rejected. The generation prompt
also explicitly asks for paired arrays. The separate evidence-verification model
step is still required.

The original saved live answer passed the corrected local validator. The
existing generation/verification pipeline then reused that exact answer and made
only its remaining live verification request. This completed with `supported`
and `verified`, preserving its R11 citation. Across both phases the test used
exactly **two paid Responses requests**, with 1,744 input tokens and 150 output
tokens reported by the API. No answer was regenerated or automatically retried.

Live settings were scoped to the diagnostic process, not the open website.
The `.env.local` file remained byte-for-byte unchanged, and Tutor, lesson-review
and quiz live flags remained false afterward. The response, offline replay and
completed verification are saved under `artifacts/api-live-test/`; they contain
no API credentials. These diagnostic scripts are not part of automated tests.

This checks one backend teaching response and its citation/evidence workflow.
It does not establish browser integration, live navigation tool execution,
live reviews/quizzes, production hosting or general medical accuracy.
Regression tests cover multiple quotes, all invalid attribution cases and
continued rejection when the separate verifier fails. All 195 automated tests,
TypeScript, ESLint and the Webpack production build passed after the correction;
the automated suite and build made no live generation requests.

## Files changed in this task

- Tutor: `lib/tutor/models.ts`, `usage.ts`, `evidence-budget.ts`, `routing.ts`, `navigation.ts`, `scene-actions.ts`, `config.ts`, `service.ts`, `pipeline.ts`, `retrieval.ts`, `terminology.ts`, `question-relevance.ts`, `instructions.ts`, `generation.ts`, `schema.ts`, `types.ts`, `http.ts`, `minimal-review.ts`.
- Learning: `lib/learning/lesson-review.ts`, `review-generation.ts`, `review-http.ts`, `quiz-personalisation.ts`, `quiz-generation.ts`, `quiz-http.ts`, `quiz-client.ts`; `app/api/learning/quiz/route.ts`.
- Frontend wiring: `components/HeartExplorer.tsx`, `AnatomyTutor.tsx`, `LearningReview.tsx`, `PersonalisedQuiz.tsx`, `useLearningSession.ts`; `app/page.tsx` (runtime configuration). No CSS, geometry, GLB configuration, annotation coordinates, lighting or camera algorithms changed.
- Configuration/documentation: `.env.example`, `package.json` (offline test guard), `README.md`, this handover.
- Scripts/tests: `scripts/audit-rag.mjs`, `rag-routing-check.mjs`, `check-model-access.mjs`; `tests/tutor.test.mjs`, `rag-reference-audit.test.mjs`, `rag-routing.test.mjs`, `quiz-routing.test.mjs`, `rag-routing-browser.mjs`, `lesson-review-browser.mjs` (stable model fixture for timed UI checks), `tests/helpers/no-live-api.mjs`.
- Verification artefacts under `artifacts/rag-routing/` (ignored by Git). Existing unrelated uncommitted work was preserved.
