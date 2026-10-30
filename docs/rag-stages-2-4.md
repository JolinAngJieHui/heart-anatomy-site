# RAG Stages 2–4: local chatbot and production adapters

Implemented on `feature/website-improvements`. Default mode needs no API key and makes no OpenAI requests. No billable resources were created, no files were uploaded, and no source was newly approved. The production corpus is still empty. Scene geometry, IDs/anchors, information cards, camera framing and the model-replacement boundary are unchanged.

## Architecture

`/api/chat` → bounded body + Zod request validation → shared usage limiter → provider factory → retrieval → conservative evidence preflight → generation → citation/quote validation → live entailment verification → structured response → existing tutor panel.

`/api/tutor` remains a compatibility alias to the same handler and global limits. This avoids maintaining two backends. The factory chooses paired providers through `TUTOR_MODE`: mock uses the isolated local synthetic corpus and mock generator; live uses approved/current OpenAI indexing and the Responses adapter; disabled returns unavailable. A missing live configuration or corpus never causes a synthetic fallback.

### Retrieval

`RetrievalProvider` accepts a question, selected structure and limited conversation context, plus AbortSignal. Both implementations return passages with request citation IDs, stable passage IDs, source IDs, document versions, section metadata and material kind.

Local indexing normalizes newlines and creates 1200-character chunks with 200-character overlap. Passage identity combines source ID, document version and a text digest. The lexical ranker expands inventory names, abbreviations (RCA, LAD, LCx, PDA, LM, SVC, CS) and stable anatomy IDs, scores text and metadata, and boosts selected-structure relevance. Ties are deterministic; selection does not exclude related sources. The local fixture corpus covers all 17 IDs with explicitly fictional pump text. It is not a semantic or anatomical relevance benchmark.

Local reference inspection reads only registered approved files through the Stage 1 preparation/hashing utilities. The local ranker never mixes reference and synthetic corpora. TXT/Markdown indexing is supported; PDF extraction is intentionally not implemented locally. A separately reviewed/hash-approved extraction can be used for local inspection. Future OpenAI managed indexing supports the approved PDF itself.

The OpenAI adapter uses `client.vectorStores.search`, approval attributes and local current-file identity checks. It filters approved metadata, exact bytes, version, metadata digest and manifest file ID. Unknown or stale remote hits are discarded. Missing/edited files are excluded. The existing uploader/synchronizer uses the same registry/planner, `files.create` and `vectorStores.files.createAndPoll`; version changes replace local identities before detaching old remote versions. Administrative search also filters current approved identities. No remote path was run.

### Generation and evidence

The mock generator emits deterministic **SYNTHETIC TEST ONLY** responses and null-URL fixture references. It generates no anatomical answer or verified medical claim. Unmatched questions return insufficient synthetic evidence. The UI labels mock mode before and beside responses.

The live adapter uses the official Responses API with strict structured claims and level-specific instructions. Basic minimizes jargon; Intermediate uses university anatomy/physiology terminology; Advanced permits detailed variation and diagnostic/procedural correlations only where referenced. Conversation is explicitly untrusted intent context, not evidence or instructions. No web fallback or generated scene command runs.

Evidence preflight rejects absent, short, injection-like, low-score or wrong-material passages. Passing this gate only permits generation. Every claim must name retrieved passages and include exact supporting quotes. A second conservative Responses call checks full-question coverage and entailment before a live supported response is returned. Citation IDs, similarity scores and matching quotes alone do not establish scientific support. `evidenceStatus: verified` means the automated grounding/entailment checks passed; it is **not** academic certification of the generated answer. Real deployment still requires qualified answer evaluation.

### API contract and limits

Requests contain `question`, nullable `selectedStructureId`, `learningLevel`, `privacyConfirmed: true`, and optional `conversation: [{ role: user|assistant, content }]`. No system role or extra client configuration is accepted. Zod enforces all 17 IDs and all three levels.

Limits: 1200 question characters; six conversation messages; 1800 characters per message and 4800 total context characters; 32 KiB streamed input and 5 seconds to read it; six evidence passages, at most 5000 characters each; at most ten validated claims and 5000 total claim characters. Responses are schema-bounded (7000 answer characters, six citations); the browser caps streamed response bytes at 128 KiB. Citation links require HTTPS, and reply context must match the submitted question's captured structure/level.

The configured 1–60 second pipeline deadline (default 20 seconds) covers document preparation, retrieval and generation. OpenAI operations share its abort signal and disable retries. Manual request reset/unmount cancels the browser operation; older responses cannot overwrite a new conversation. Errors are sanitized and expose a code/retryable flag without provider bodies or credentials. Input failures return 400, origin rejection 403, wrong media type 415, usage exhaustion 429 and provider/configuration failure 503. Missing evidence returns a normal 200 refusal.

`UsageLimiter` is injectable for testing. Existing process-local limits serve development/mock use; production live mode requires the existing shared HTTPS Redis limiter. Global ceilings protect usage across both aliases but are not authentication or monetary budgets.

Responses expose `schemaVersion`, deterministic `responseId`, answer, `selectedStructureId`, `learningLevel`, sources, status, `evidenceStatus`, provider mode, and error information when relevant. Each supporting source includes request citation `id`, stable `sourceId`, `passageId`, `documentVersion`, materialKind, title, section and nullable URL. The response fingerprint is a reproducibility identifier, not a unique event ID. Future persistence should allocate unique session/event IDs and save only verified live answers as grounded activity; client-supplied conversation cannot prove provenance. No session summary, Word download or quiz system was added.

## Run locally, without credentials

1. `npm install` (Zod is the only newly added dependency).
2. Optionally copy `.env.example` to `.env.local`; keep `TUTOR_MODE=mock`, `TUTOR_LIVE_ENABLED=false` and API fields blank. Defaults also work without the file.
3. `npm run dev -- --hostname 127.0.0.1`, open `http://127.0.0.1:3000`, select a structure/level, open Ask AI Tutor and confirm the privacy checkbox.
4. Ask a general or selected-structure question. Expect a labelled fictional pipeline demonstration, not an anatomical answer. New Conversation clears history and transmitted context; closing/reopening preserves state.

Local commands:

- `npm run kb:validate` and `npm run kb:plan`: registry/version checks, no network.
- `npm run rag:inspect -- --synthetic RCA right-coronary-proximal`: explicit fixture retrieval.
- `npm run rag:inspect -- --approved "coronary circulation"`: real approved-document inspection; the current empty corpus returns no passages.
- `npm run rag:fixtures`: regenerate fictional context fixtures only under tests.
- `node scripts/tutor-index.mjs`: future index synchronization plan, no uploads without --apply.
- `npm test`, `npm run typecheck`, `npm run lint`, `npm run build`: checks.

For browser QA, build and serve port 3100 in mock mode, then run `node tests/tutor-browser.mjs`. It uses existing isolated Playwright/installed Chrome. Existing viewer/card/progress scripts verify anatomy interactions. Development/global limits can be raised to the permitted 60 requests/minute for repeated local testing; never switch to live for synthetic tests.

## Switch to live later: configuration and operations

These are future instructions, not actions performed during this task.

1. Add legally usable real references using [review instructions](../knowledge-base/README.md). Have a qualified reviewer approve exact bytes/version, bibliographic metadata and indexing permissions. Run `npm run kb:validate` and `npm run kb:plan`.
2. Obtain a project API key. Put `OPENAI_API_KEY` and an account-supported structured-output Responses model in `OPENAI_MODEL` in ignored `.env.local` or server secrets. Never use NEXT_PUBLIC fields. Keep `TUTOR_MODE=mock` until indexing and evaluation are ready.
3. After separately authorizing billable indexing, set `TUTOR_LIVE_ENABLED=true` and run `node --env-file=.env.local scripts/tutor-index.mjs --apply`. Set `OPENAI_VECTOR_STORE_ID` to the printed store ID, exactly matching `knowledge-base/index-manifest.json`. A future `--apply --remove-obsolete` detaches no-longer-eligible indexed files; inspect plans before applying.
4. Set `TUTOR_MODE=live`. For a production build/server, configure `TUTOR_REDIS_REST_URL` and `TUTOR_REDIS_REST_TOKEN` for the shared limiter. Configure provider project spending controls and the existing request/token caps.
5. Rebuild/restart (`npm run build`, then `npm run start`) with matching server environment and current registry/manifest. The page's availability mode and imported registry/manifest are build-time data. Package approved files on the server and verify Next.js tracing on the chosen host. Configuration changes require this rebuild, not application rewrites.
6. Only then run explicitly authorized live smoke tests with general educational questions and review answers/citations against the actual references. Check semantic relevance, extraction, sufficiency/refusals and clinical accuracy; fake-provider tests cannot establish those. Confirm auth/gateway and usage controls before exposing the service publicly.

Without a key we can test contracts, local ranking, context, approval/version gates, citation mapping, deterministic generation, provider control flow using injected fakes, API behavior, timeouts and all UI states. Real upload/indexing, model availability, remote semantic relevance, extraction quality and live answer quality need configured authorized API access and reviewed material.

## Files and verification

Created: `app/api/chat/route.ts`; `lib/tutor/{schema,retrieval,instructions,generation,pipeline,deadline,http,conversation,client}.ts`; `scripts/{retrieval-inspect,retrieval-fixtures}.mjs`; `tests/rag-pipeline.test.mjs`; `tests/helpers/load-module.mjs`; this document.

Modified: existing `app/api/tutor/route.ts` (alias); `lib/tutor/{core,types,service,limiter}.ts`; `components/AnatomyTutor.tsx`; `scripts/tutor-index.mjs`; synthetic fixture JSON; tutor unit/browser tests; package.json/lock (Zod and commands); `.env.example`; README and Stage 1/tutor/knowledge-base documentation. No educational content, 3D or styling file changed for this task.

All 59 unit/server tests pass, including 12 new provider/pipeline/API tests. Coverage includes all anatomy IDs/levels, selected relevance, local indexing/retrieval, invalid queries/context, empty/insufficient evidence, approved/current source filtering, citation/quote validation, model-verification refusal, mock labels, missing files and version changes, error sanitization, deadlines, output bounds and explicit no-fallback inspection. TypeScript, ESLint and the production build pass.

Browser checks cover actual mock API replies, all three levels, selected/general context, bounded prior conversation, reset/persistence, citations, refusal, error/loading and malformed-response handling, keyboard collapse and six responsive layouts. Existing viewer checks cover all 51 explanations, all 17 marker selections, camera/zoom/rotation, isolation, keyboard and responsive layout. Source approval and model-based verification remain complementary controls, not guarantees against all unsupported claims or prompt injection.

Official implementation references: [OpenAI Retrieval](https://developers.openai.com/api/docs/guides/retrieval) and [Structured Outputs](https://developers.openai.com/api/docs/guides/structured-outputs). The adapters were also compiled against installed official SDK types. No live OpenAI evaluation was performed.
