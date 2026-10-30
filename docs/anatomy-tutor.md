# AI Anatomy Tutor

The current provider architecture, chat endpoint and activation steps are documented in [RAG Stages 2–4](rag-stages-2-4.md). Reference review uses the [knowledge-base workflow](../knowledge-base/README.md).

## Architecture and completed files

The rose Ask AI Tutor button in the workspace toolbar opens a dedicated right-side panel. On desktop the open workspace shows structures, viewer and tutor in three columns; tablet uses a compact layout or partial overlay, and mobile uses a bottom sheet. Closing restores viewer space and preserves chat, the input draft and consent. Escape/Close returns focus to the toolbar button. Chat history scrolls independently and the input remains pinned.

Each question captures current selection and learning level and sends up to six previous user/assistant messages (4800 characters total). Context-aware suggestions use the same validated workflow; before privacy consent they populate the input, and after consent they send directly. Mock/unavailable status is visible before any question. Session-local history is limited to 20 visible turns. New Conversation cancels pending work and clears transmitted context. Conversation is untrusted intent context, never reference evidence. Fixed cards, camera and progress retain the existing reducer. No generated scene commands are activated.

Added components/AnatomyTutor.tsx, app/api/tutor/route.ts, lib/tutor/{types,core,config,limiter,service,scene-actions}.ts, knowledge-base registries/directories, scripts/tutor-index.mjs and tutor-draft-registry.mjs, tutor unit/browser tests, .env.example and evaluation documentation. Integration modifies HeartExplorer.tsx, globals.css, .gitignore, package.json/package-lock.json and README; previous viewer work is preserved.

The API bounds streamed JSON, validates IDs/levels, rejects browser cross-origin requests, reserves usage and calls a server-only SDK pipeline. Explicit vector-store search is filtered by approval, indexed file identity and local document hashes. Embedded instruction patterns are rejected. Structured Responses output must include individually supported claims and verbatim quotes; a second model checks entailment and full question coverage. Server metadata supplies citations. Missing evidence, invalid citations and incomplete outputs fail closed. There is no web fallback or activated scene control.

Grounding and injection checks reduce but cannot eliminate unsupported claims or adversarial behavior. Model self-verification is not academic approval. The browser receives answers/public citation metadata, not retrieved passage text or internal prompts. Responses use store:false; this does not override every provider retention policy. No question content is logged by this code.

## Run locally and configure

Run npm.cmd install, copy .env.example to .env.local, then npm.cmd run dev -- --hostname 127.0.0.1 and open http://127.0.0.1:3000. Default mock mode uses deterministic fictional retrieval and test generation without API calls or anatomical claims. The original fixed content remains available. The UI uses `/api/chat`; `/api/tutor` remains an alias with the same validation and shared usage limit.

Never paste an API key into chat, browser code or NEXT_PUBLIC variables. Set a project-scoped OPENAI_API_KEY only in Git-ignored .env.local. Choose an account-supported Responses model with strict JSON schema and set OPENAI_MODEL; no model default is assumed. Set OPENAI_VECTOR_STORE_ID to match the index manifest after approved indexing.

TUTOR_MODE accepts mock (default), disabled or live. TUTOR_LIVE_ENABLED must explicitly equal true for live/indexing; keep false until billing, academic and copyright approvals are complete. No billable resources were activated during implementation.

TUTOR_TIMEOUT_MS defaults to 20000 (1000–60000), shared across retrieval/generation/verification. TUTOR_MAX_OUTPUT_TOKENS defaults to 1600 (300–2500); verification adds at most 300 output tokens. Claim text is limited to 5000 characters. A supported answer can incur one search plus two Responses calls; retries are disabled.

TUTOR_REQUESTS_PER_MINUTE defaults to 10 and TUTOR_DAILY_REQUEST_LIMIT to 100 globally per UTC day. These are request ceilings, not monetary budgets. Set provider project spend limits too. Development uses bounded process-local counters, which reset on restart. Production live mode requires TUTOR_REDIS_REST_URL (HTTPS Redis REST supporting EVAL) and TUTOR_REDIS_REST_TOKEN for shared atomic caps; unavailable limits block API calls. Configure authenticated gateway/WAF controls before deployment. A global limit bounds usage but cannot prevent one user exhausting it.

Privacy confirmation and conservative local personal/patient-information checks reduce accidental transmission but cannot detect every identifier. Do not enter personal or patient information. The tutor is educational and cannot diagnose or recommend personal treatment.

See ../knowledge-base/README.md for approval and upload instructions. Rebuild after indexing/registry changes and package approved files on the server. Deployment and authentication infrastructure are not activated here.

## Test and review

Run npm.cmd test, npm.cmd run typecheck, npm.cmd run lint and npm.cmd run build. Start production locally with npm.cmd run start -- --hostname 127.0.0.1 --port 3100; run node tests/tutor-browser.mjs. Existing tests/browser-check.mjs, information-card-browser.mjs and progress-browser.mjs check viewer regression. Browser checks use existing isolated Playwright and Chrome.

Synthetic tests establish control flow, not anatomical accuracy. No live API evaluation was performed. Use tutor-evaluation.json and tutor-evaluation-report.md for authorized academic evaluation. The allowlisted scene-action interface is prepared only; generated text never dispatches it or isolates absent coronary meshes.

Current official references: [OpenAI retrieval](https://developers.openai.com/api/docs/guides/retrieval) and [Structured Outputs](https://developers.openai.com/api/docs/guides/structured-outputs). Installed SDK types verify request signatures.
