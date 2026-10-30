# RAG Stage 1: knowledge-base foundations

This report records Stage 1. The later [Stages 2–4 implementation](rag-stages-2-4.md) replaces the echo-only mock with modular synthetic retrieval/generation and adds `/api/chat` with bounded conversation context.

Implemented in `feature/website-improvements`. This stage changes knowledge-base/server tooling only; the 3D scene, marker anchors, educational cards and website design are unchanged. No real references were approved or uploaded, no vector store was created and no paid API calls were made.

## Repository inspection

`lib/heart-parts.ts` defines the 17 numbered structures and the `HeartPartId` union. Fixed explanations, blood-flow routes and reference links live in `lib/education.ts`, keyed by these IDs, with Basic, Intermediate and Advanced content. These authored explanations remain website content, not an approved production RAG corpus.

`LearningLevelControls` dispatches the shared reducer's `level` action. `HeartExplorer` passes current selection and level into the cards and `AnatomyTutor`; the tutor validates both through its existing request schema. No alternate IDs, duplicate state or replacement UI was introduced.

The existing Node.js `app/api/tutor/route.ts` provides bounded JSON validation, origin checks and usage limits. `lib/tutor/service.ts` already uses the official OpenAI SDK for vector-store retrieval and Responses generation/verification. It refuses inadequate evidence and supplies citations from server metadata. Its default mock mode echoes context without anatomical answers. The existing indexing script already had a no-network dry run and gated remote apply path. These were reused.

Verified installed dependencies: Next.js 16.3.1, React/React DOM 19.2.8, TypeScript 5.9.3, React Three Fiber 9.7.0, Drei 10.7.8, Three.js 0.185.1, Tailwind CSS/PostCSS 4.3.3, ESLint 9.39.5, eslint-config-next 16.3.1, `server-only` 0.0.1 and official `openai` SDK 7.32.0. Installed type packages are @types/node 20.19.43, @types/react 19.2.18 and @types/react-dom 19.2.4. No dependency was added. Next.js bundled documentation and current official OpenAI retrieval documentation were checked.

## Data and indexing flow

Private source documents → validated metadata → explicit academic/usage approval of exact bytes/version → document preparation → local change plan → future authorized OpenAI indexing → manifest-bound retrieval → existing grounded tutor response.

The registry separates source text from bibliographic metadata. Seven topic tags cover cardiovascular/coronary anatomy, physiology, clinical correlations, variants, diagnostics and procedures. Every association uses the existing inventory; associations broaden context without preventing cross-structure retrieval. Nullable draft metadata does not imply verification. Validation checks fields, real calendar dates, IDs, source types, approval states, file paths, unique source IDs and complete approval records.

Preparation reads only approved files. It resolves actual paths, rejects path/junction escapes and empty/oversized files, validates UTF-8 TXT/Markdown or PDF headers, and checks SHA-256 bytes against the reviewed digest. The local file limit is 20 MiB. PDF header checks are not extraction QA; reviewers must inspect extraction and future chunks.

Indexed identity includes source ID, content hash, declared version and stable metadata digest. Planning identifies new documents, content/version changes, metadata changes and obsolete approvals. Legacy manifest entries lacking version/metadata hashes require reindexing. Live retrieval shares the validation/preparation layer and accepts only exact matches to the completed manifest. Invalid registries/manifests fail closed; missing or changed individual files are excluded.

## Future OpenAI retrieval

The retained SDK indexer will create/reuse a vector store, upload approved files, attach them with `createAndPoll`, and publish completed file IDs plus hashes/versions locally. OpenAI manages parsing, chunking and semantic indexing. This local preparer does not implement embeddings or PDF extraction. File attributes carry source ID, content hash, document version, metadata hash and review status. Changed documents replace old local identities; obsolete files can be explicitly detached later.

The existing tutor constructs an educational query with selected-structure context, searches the configured store, and filters retrieved file IDs against current approved identities. Learning level controls explanation depth rather than creating three duplicate corpora. Generation and verification use supplied passages; insufficient evidence is refused. Synthetic material never enters production indexing. Tests injecting a fake provider/registry establish control flow, not live medical/API accuracy.

Official API basis: [OpenAI Retrieval guide](https://developers.openai.com/api/docs/guides/retrieval). Remote file removal is eventually consistent, so local current-approval/file-ID checks remain necessary after detachment.

Before future deployment, keep approved files on the server and verify Next.js file tracing on the chosen host. Rebuild/restart after imported registry/manifest changes. Run one indexer at a time and reconcile interrupted-upload orphans before retrying. Existing live activation, server-only credentials and shared production usage limits remain in place; this stage does not enable them.

## Isolated local mock

`mock.ts` accepts only a `synthetic-test-only` dataset with `synthetic` records. Fictional pump passages live under `tests/fixtures/knowledge-base/`, outside production. The lexical ranker is deterministic, supports validated structure context, has stable ties and returns no passages for unmatched questions. It never imports approved production files and uses no SDK/client/key. The existing website mock interface is unchanged.

## Files created and modified

Created:

- `lib/knowledge-base/registry.ts`: reference types, topic/approval vocabularies, validation and approved selection.
- `lib/knowledge-base/documents.ts`: loading, preparation, digest/version tracking, manifest validation and change planning.
- `lib/knowledge-base/mock.ts`: isolated deterministic synthetic retrieval.
- `scripts/load-typescript.mjs`: trusted repository TypeScript loader for CLI reuse without another runtime dependency.
- `scripts/knowledge-base.mjs`: local validate, plan and mock commands.
- `knowledge-base/reference-template.json`: unapproved metadata template.
- `tests/fixtures/knowledge-base/synthetic.json`, `tests/knowledge-base.test.mjs`: isolated fixtures and 10 architecture tests.
- `docs/rag-stage-1.md`: this report.

Modified:

- `lib/tutor/types.ts`, `core.ts`, `service.ts`: shared source types and approval/version checks.
- `scripts/tutor-index.mjs`: shared preparation/planning and version/metadata index records.
- `scripts/tutor-draft-registry.mjs`, `knowledge-base/draft-registry.json`: migrate candidate metadata without approving content.
- `tests/tutor.test.mjs`: adapt synthetic provider fixtures to the expanded source/manifest schema.
- `package.json`: local `kb:validate`, `kb:plan`, `kb:mock` commands.
- `knowledge-base/README.md`, `docs/anatomy-tutor.md`, `README.md`: current architecture/workflow links.

## Verification and remaining work

All 47 unit/server tests pass, including 10 new architecture tests. Coverage includes valid/invalid metadata, actual dates, all 17 mappings, duplicate IDs, every approval state, exact file/version approval, metadata changes, unchanged/obsolete plans, legacy manifest compatibility, missing/malformed files, junction escapes, deterministic retrieval, namespace separation and CLI dry runs. The synthetic provider pipeline also passes with no network.

TypeScript, ESLint and the production build pass. Validation reports 31 unapproved candidates and zero approved production sources. Both planners report no uploads; the synthetic CLI returns fictional passages without credentials. Browser regression was not rerun for this server/tooling-only stage; no UI/scene file changed.

The next input is a real reference/excerpt that the project is permitted to index, with verified metadata and qualified review. Stage 1 is complete without it. Academically grounded production answers remain unavailable until references are reviewed and indexing is separately authorized. No automatic approval, copyright inference or medical accuracy claim is made.

See [how to add and approve references](../knowledge-base/README.md).
