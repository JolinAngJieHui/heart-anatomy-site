# Source-grounded teaching documents and approval

**Historical derivative-note workflow.** Use [bulk source registration and one activation confirmation](bulk-reference-workflow.md) for the new original-reference collection. Individual hash/approval commands below are not required for the owner's approved original sources. These generated notes remain separately unreviewed and are excluded from the staged replacement.

Prepared 11 October 2026. The existing registry now contains **23 original references and 17 derived teaching documents**. There is one teaching document for each stable structure ID, under `knowledge-base/pending_review/teaching-<structure-id>.md`. No original reference status was changed. All 17 new documents are pending review, with no scientific reviewer/date, approved version or approved hash; local reuse is unconfirmed and external indexing is blocked.

The [searchable review matrix](teaching-review.html) shows all 17 documents, their actual factual passages, reference IDs, clickable original URLs, publication details, section locators, proposed levels, gaps, uncertainties and exact review hashes. [Machine-readable coverage](teaching-coverage.json) contains the same material. Original articles and notes are separate registry records; derived notes do not create additional independent evidence.

## What the notes contain

The notes are short independent factual paraphrases, not copied articles or figures. They cover source-supported origins/courses, supply or drainage, selected variants and clinical context. Some information was verified through primary indexed source excerpts because direct pages showed browser challenges. Those passages are marked `primary-search-excerpt` and require verification of the full cited section by the supervisor. Page fields remain null when a passage-specific page could not be confirmed.

RCA boundaries explicitly use Villa's scheme. LAD boundaries retain the ASCI/SCCT definition and note the conflict with a simplified D1 landmark. Apical LAD is not automatically mapped to distal LAD. D1/D2 are kept distinct with branch-ordering/territory gaps. Generic left marginal denotes the OM family, with no invented OM1/OM2 mapping. Dominance uses specialist PDA/posterolateral definitions; disputed consumer-source LAD wording is excluded from the factual notes. The LCx cadaveric anomaly is marked rare, Advanced only and explicitly not typical anatomy. Conus separate-aortic origin and wraparound LAD remain qualified variations.

Shared general coronary physiology and CAD context are stored only once and mapped to relevant coronary structures. They are labelled `general-coronary-context`; they do not prove a particular small branch's infarct consequences, territorial limits or procedural indications. Approving a structure's own document does not approve shared passages held in another document.

Evidence is not copied into three learning-level documents. Each passage carries permitted educational levels; Basic can use plain-language function/location, Intermediate the supported course/relationships and physiology, and Advanced the supported variants, reporting definitions and clinical context. The future LLM must retain qualifications and omit unsupported details at every level.

## Review and approve one document

1. Open the review matrix and the linked Markdown document. Verify each factual passage against its exact cited section, especially indexed excerpts; inspect normal/variant classification, scope and unresolved questions. Approval should only mean the included bounded facts are acceptable, not that every listed gap is solved.
2. Resolve unacceptable claims before approval. Edit the record's `teachingNote` passages, update `documentVersion`, keep/reset status to pending_review and clear previous approved fields. Render the matching Markdown using `renderTeachingDocument`. Do not edit Markdown alone: approval rejects disagreements between file and structured metadata. `kb:teaching-prepare` only creates missing notes and intentionally never overwrites existing review work.
3. Independently confirm that local use of these attributed notes is permissible. Paraphrasing is not automatically a licence for full-text copying or external indexing. Keep publisher/licence restrictions and full-text availability separate from scientific review.
4. Obtain the current byte and metadata hashes:

```powershell
npm run kb:teaching-review -- list
```

5. Substitute the document ID, **real** reviewer/date and exact hashes from that output:

```powershell
npm run kb:teaching-review -- approve teaching-coronary-sinus --reviewer "Supervisor name" --date YYYY-MM-DD --sha256 BYTE_HASH --metadata-hash METADATA_HASH --scientific-reviewed --local-reuse-confirmed
```

This previews approval only. After completing the actual review, repeat with `--apply` appended. The CLI writes a new approved copy, retains the pending copy for history, and records reviewer/date/version/hash in the existing registry. It refuses stale hashes, unconfirmed review/reuse and overwriting an existing approved file. **No approval command was applied during preparation or testing.**

6. Regenerate coverage and run approved retrieval:

```powershell
npm run kb:validate
npm run kb:teaching-report
npm run rag:inspect -- --approved "Where does the coronary sinus drain?"
npm run rag:evaluate -- --approved --write-report
```

The existing local corpus loader will now include that approved note without code changes. Draft, pending and rejected documents remain excluded. It validates the byte hash and exact match of rendered teaching metadata before exposing passages. Only factual passage text enters local retrieval; review gaps, bibliography prose and editorial questions do not become evidence. Retrieval preserves original reference IDs/URLs/sections plus teaching-document identity/version and supporting-reference metadata.

## Separate external-indexing permission

Local approval intentionally sets `externalIndexingPermission.cleared` to false. A scientific reviewer does not thereby grant external processing rights. After separately verifying those rights, record `cleared: true`, a real `reviewedBy`, `reviewedOn` in YYYY-MM-DD and documented `evidence` in that permission object. Validation rejects incomplete clearances. Use false to revoke clearance. Never set it solely to make a test pass.

The indexer and OpenAI retrieval path require this explicit permission (or the legacy curated-source external-clearance field for older records), in addition to scientific approval, exact file hashes, versions and manifest identity. Uncurated legacy records without explicit permission are denied remote eligibility. Permission metadata changes alter the indexing identity and require re-evaluating the indexing plan. `npm run kb:plan` and `node scripts/tutor-index.mjs` remain no-network dry runs; no external calls were made.

Before live RAG, resolve source access/rights and outstanding scientific issues, approve appropriate documents and shared context, inspect all real-reference test passages, then validate external indexing representation and passage-level citation handling through the existing SDK adapter. Local success alone does not establish medical answer quality or remote retrieval quality. API credentials and separately authorized paid indexing remain future work.

## Remaining gaps

- Apical LAD crosswalk, exact mid/distal boundaries and variable territories.
- D1/D2 ordering, variable presence/size and dedicated branch-level coverage.
- Right marginal/conus course, collateral and procedural detail beyond the limited supported facts.
- Generic OM versus particular branches and dominance terminology/prevalence reconciliation.
- Advanced aortic root/SVC relationships, measurements and procedural evidence.
- Coronary-sinus valves, ostium/pathology and full-section verification of venous references.

The matrix records these per structure. General coronary clinical information is available as bounded context; missing branch-specific evidence stays a gap.

## Local validation results

Prepared 17 documents with 34 factual passages grounded in 13 of the registered references. The remaining registered references are retained without fabricating or importing inaccessible content. All 17 documents remain pending and external indexing remains uncleared.

Automated tests validate all 17 files/citations, stale content and metadata rejection, malformed/unknown evidence, rare-case qualification, and approval simulations using temporary clones only. Those simulations test local inclusion and confirm that local-only approvals cannot call the OpenAI retrieval adapter. They do not confer scientific approval on repository documents. Synthetic routing covers 25/25 anatomical test questions. Production-equivalent approved retrieval has zero documents and correctly reports insufficient evidence for all 25 questions; this is the expected result before human review.

Final checks: 71 automated tests passed; TypeScript, ESLint and the production build passed. No OpenAI calls, uploads or changes to the existing website design/scene were made for this task.
