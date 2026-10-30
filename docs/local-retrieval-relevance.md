# Local retrieval relevance improvements

The active reference collection remains `replacement-2026-10-11`: 77 approved originals, 27 locally searchable, 50 metadata-only. No registry, approved source bytes, teaching cards, canonical vessel names, or website design changed. All work is offline; no key, LLM, paid API calls, or uploads are used.

## What changed

`lib/tutor/question-relevance.ts` identifies the question's requested domain and aspects: normal anatomy, physiology, pathology, procedures, and variations. It removes vessel names before classifying intent, so “conus branch” alone does not become a branching question. A passage must contain a requested structure/segment in its body, a requested aspect where applicable, and sufficient question-specific terms. Source titles and filing categories alone cannot pass this gate.

`lib/tutor/retrieval.ts` searches the entire approved corpus and ranks direct sentence candidates ahead of mere mentions. It reduces ordinary-question scores for case material and pathological observations, prefers general statements and reviews when relevant, and preserves specialised evidence for clinical requests. Individual clinical observations cannot serve as normal-anatomy evidence merely because they mention a vessel. General background statements from case sources may remain candidates, with case warnings and lower preference. Complementary passages are reserved for comparisons; absent sides are explicitly reported. Body features are cached when the local provider is constructed, avoiding repeated corpus parsing per question.

`lib/tutor/terminology.ts` and the separate synonym dictionary preserve stable names and add spaced/short segment abbreviations, shared-segment grammar (“proximal and distal RCA”), CT/computed tomography and PCI/percutaneous coronary intervention matching. Ascending aorta matching now requires the ascending portion rather than any mention of the aorta. Distal LAD is still not equated with apical LAD, OM1/OM2 remain unconfirmed mappings, origin-specific PDA names stay distinct, and the third-coronary label still requires confirmed separate origin.

`lib/tutor/retrieval-evaluation.ts` checks body mentions rather than category tags, flags missing question aspects and comparison targets, and never treats whole-vessel mentions as proof of a particular segment's coverage. Every passage retains its original text, source ID, title, URL, section/page locator where present, and version. All ranking scores are explicitly relevance diagnostics, never scientific confidence or probability. The feature-based directness label is a candidate for review, not an answer or a claim of scientific completeness.

Synthetic mock routing remains isolated and labelled. Its tag-based fictional fixtures retain their earlier routing behavior; they are not a substitute for approved references or production evidence. The website tutor's existing mock/live configuration has not changed.

## Before and after

Open [the interactive comparison report](retrieval-relevance-comparison.html). Filter by question text or Basic, Intermediate, Advanced, Mixed, or Unsupported labels, then expand a question to read both sets of literal passages and clickable original sources side by side.

The unchanged original ranker was run before implementation. The same 27 documents, registry fingerprint, and 72 questions were used after implementation: 51 covering every structure at three question levels, 15 additional domain/comparison/synonym questions, and six deliberately unsupported questions. Question-level labels do not establish an approved article reading level.

Both outputs are assessed with the same current text-feature rules. Counts of top passages meeting the direct-text heuristic improved from 10 to 36. Unsupported questions returning results dropped from 4 to 0. Ordinary questions led by case reports dropped from 7 to 1. Comparisons with all targets represented in passage bodies stayed at 4. These are automated proxies without human answer labels, not measurements of scientific accuracy, recall, or completeness.

Positive questions returning any passages dropped from 66 to 52. This is an explicit precision/coverage tradeoff: generic vessel mentions no longer fill segment-specific or modality-specific gaps. Some abstentions can reflect strict terminology matching rather than absent information. Review the comparison report before relaxing those gates.

Remaining weak coverage includes RCA segment functions, mid/apical LAD functions and course, D2 details, and CT assessment of several individual segments/small branches. The existing 50 metadata-only references remain unavailable to local retrieval. Additional permitted source text and scientific review are needed; the ranker does not manufacture answers. The distal-versus-apical LAD question can retrieve contextual case material but does not establish synonym equivalence.

## Run locally

From a terminal in the project folder:

```powershell
npm run rag:inspect -- --approved "What does the right coronary artery supply?"
npm run rag:inspect -- --approved "Compare the blood supply of LAD and LCx."
npm run rag:inspect -- --approved "How is superior vena cava syndrome treated with stents?"
npm run rag:inspect -- --approved "What is the RCA quantum molecular mechanism?"
npm run rag:relevance -- after
npm run rag:relevance-report
npm run rag:evaluate -- --approved --write-report
node scripts/verify-collection-activation.mjs
npm test
npm run typecheck
npm run lint
npm run build
```

The existing `before` JSON is historical. Do not overwrite it with the improved ranker and call it the old behavior. The evaluator protects it by default; `--replace-baseline` is only for intentionally starting a future comparison before further code changes. The report rejects unequal corpus fingerprints or question sets.

Reports: `docs/retrieval-relevance-before.json`, `docs/retrieval-relevance-after.json`, `docs/retrieval-relevance-comparison.json/.html`. The existing active evaluation and consolidated collection report are refreshed separately. `tests/question-relevance.test.mjs` adds isolated fictional regressions for intent, directness, case qualification, modalities, global retrieval, comparisons, unsupported queries, segment distinctions, literal provenance and score meaning. The historical teaching-note test now checks top-result body relevance rather than requiring a particular filing label to rank first.

OpenAI integration remains a separate future operation. Approval and external-indexing permissions are unchanged; all remote indexing clearances remain false. No changes here enable the API or vector-store uploads.
