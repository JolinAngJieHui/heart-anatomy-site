# Running local retrieval

Use [the bulk source workflow](bulk-reference-workflow.md) for the new scientifically approved original-reference collection. Test its 27 permitted local sources with `npm run rag:inspect -- --candidate "What determines coronary dominance?"`. After the consolidated activation confirmation, use `--approved`. The 17 generated teaching notes remain separately unreviewed; individual note approval is not required for this replacement. External indexing permission remains separate. Earlier evaluations below are historical.

Run from the heart-anatomy-site project root. No API key is needed; these commands do not call OpenAI or any network service.

```powershell
npm run rag:inspect -- --approved "What does the right coronary artery supply?"
npm run rag:inspect -- --synthetic "blue conduit" right-coronary-proximal
npm run rag:evaluate -- --approved --write-report
npm run rag:evaluate -- --synthetic --write-report
npm test
npm run typecheck
npm run lint
npm run build
```

`rag:inspect` explicitly chooses approved references or the existing fictional tutor demonstration corpus. `rag:evaluate` uses a separate labelled routing corpus in synthetic mode, and tests all 17 structures, the eight requested questions and three unanswerable questions. Reports are written under docs, outside the production source registry. The two fixture corpora have different purposes; neither is an automatic fallback for approved mode.

The existing `LocalRetrievalProvider` now normalizes names, abbreviations, stable IDs and synonyms. Ranking uses passage token overlap, lower-weight structure/title metadata and a selected-structure context boost. Scores are lexical overlap, not probabilities. Explicit proximal, middle and distal terms remain distinct; apical is not aliased to distal, and generic marginal is not silently assigned to the right or left branch. Multi-structure comparisons retain both branches in the query. This is deterministic lexical retrieval, not embeddings or semantic reasoning.

Passages preserve source ID, title, original URL, document version and the registry section/page locator if provided. Overlapping chunks preserve source text after newline normalization, with stable IDs based on source/version/chunk bytes. Section/page precision is only as good as the reviewed extraction's locator; the retriever does not invent page numbers. PDF extraction is deliberately rejected locally: prepare a separately reviewed TXT/Markdown extraction first. Instructions embedded in source passages are excluded by the existing safety filter.

Approved mode reuses `loadRegistry`, `prepareDocuments` and `preparedToLocal`: approval metadata, exact byte hashes, versions, path boundaries and reuse gates apply before retrieval. Draft, pending_review and rejected documents are excluded. Mixed reference/synthetic corpora are rejected. No sources were approved by this implementation.

## Evaluation findings

The approved corpus has **0 documents**: all 25 anatomical test questions lack eligible passages. The isolated fixture corpus routes all **25/25** questions to the expected structure IDs within the top six passages, including comparisons. Automated tests also require the correct first result for every structure's name and stable ID. These are routing checks, not measurements of medical answer quality. Fixture passages intentionally contain labels and fictional tokens, not anatomical explanations.

Unrelated questions return no passages. A question mentioning RCA while asking for an unsupported molecular mechanism can retrieve RCA-labelled material; this is a known lexical limitation. The evaluation never declares scientific sufficiency from such topical overlap. `possible-support-needs-review` means only text overlap and required structure coverage look promising; `sufficientScientificEvidence` stays false because a lexical diagnostic cannot certify evidence. All outputs display exact passages, provenance, scores, text/metadata matches and missing required structures. No answer generation occurs.

See `retrieval-evaluation-approved.md/json`, `retrieval-evaluation-synthetic.md/json`, `knowledge-base-audit.md/html` and `reference-coverage-report.md` for results and coverage gaps.

## Before Vector Store integration

1. Resolve the audit's scientific mappings, access and reuse restrictions; obtain suitable local extracted reference text.
2. Review and approve exact metadata, extraction content, document version and byte hash using the existing reference-review workflow. Approval requires applicable external-indexing clearance; public access alone is insufficient.
3. Repeat approved local evaluation. Review whether each question's exact anatomy, physiology and clinical claims have supporting passages; add missing coverage rather than relying on lexical matches.
4. Run the existing no-network indexing plan and inspect version/update changes. Separately authorize and configure API credentials, then use the existing official SDK Vector Store adapter. No upload or paid call has been performed here.

Changed retrieval code: `lib/tutor/terminology.ts`, `retrieval.ts`, `retrieval-evaluation.ts`; shared CLI corpus loader and evaluation utility under scripts; local retrieval tests and isolated evaluation fixture; npm evaluation command and these reports. Bibliographic author correction affects the registry and its registration script. Existing 3D scene, markers, cards and design were not edited for this task.
