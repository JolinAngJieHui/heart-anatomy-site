# AnaBuddy reference collection

The current collection is selected by [`active-collection.json`](active-collection.json):
`minimal-2026-10-14`, containing **11 approved sources (R1–R11), 137 extracted
passages and 137 runtime retrieval chunks**. Its metadata is in
`collections/minimal-2026-10-14/registry.json` and its source-attributed excerpts
are in `approved/minimal-2026-10-14/`. The live tutor loads these files through
`lib/knowledge-base/minimal.ts`, validates their approval/version/hash records,
and uses the local retrieval implementation in `lib/tutor/retrieval.ts`.

These are selected excerpts, not eleven complete articles. Original attribution,
source URLs, section locators, licence notices and qualifications are retained.
No reference upload or vector-database setup is needed to run the current
application. See the [root README](../README.md) for setup and implementation
locations.

The directories `archive/`, `pending_review/` and the older collection records
are retained for provenance and migration tests. They do not expand the active
11-source collection. The notes below describe earlier development stages;
their historical source counts and activation status are not current settings.

## Historical source-management notes

The current source-management workflow is [bulk original-reference import and activation](../docs/bulk-reference-workflow.md), with [one consolidated report](../docs/reference-collection-report.html). The replacement `replacement-2026-10-11` is active: 77 scientifically approved originals, 27 searchable, 50 metadata-only. Global retrieval is not restricted by vessel filing categories. External indexing remains blocked.

The previous 40-record registry and index manifest are backed up under `archive/replacement-2026-10-11-447202a07dbc/`. The 35 omitted records are excluded from active retrieval. The generated teaching notes and [their review matrix](../docs/teaching-review.html) are preserved as historical, independently unreviewed derivatives; their individual approval process is not required to activate the new original-source collection. No uploads or paid calls were made.

## Current registry and source workflow

`registry.json` stores metadata for a manually curated corpus. Source text lives separately in private `draft/`, `pending_review/`, `approved/` or `rejected/` directories. The generated `draft-registry.json` inventories 17 existing explanations and 14 external links without academic approval; regenerate it with `node scripts/tutor-draft-registry.mjs`, and do not put manual curation edits in that generated file.

Copy `reference-template.json` into `registry.json` for each real reference. Fields include unique `id`, `title`, `institution` (author/organisation), `publicationYear`, `edition`, exact chapter/section/pages in `section`, existing `structureIds`, `topics`, public citation `location`, local `documentPath`, `sourceType`, `materialKind`, `status`, `approvedBy`, `approvalDate`, `documentVersion`, `approvedVersion`, `approvedSha256`, `licenseConfirmed`, and `publicCitation`. Compatibility field `yearOrEdition` remains nullable; new records use separate year/edition fields. Leave unverified bibliographic values null.

Approval states are `draft`, `pending_review`, `approved`, `rejected`. Source types are `textbook`, `journal`, `guideline`, `website`, `educational-summary`; production materialKind must be `reference`. Topics cover `cardiovascular-anatomy`, `coronary-anatomy`, `cardiovascular-physiology`, `clinical-correlations`, `anatomical-variants`, `diagnostics`, `procedures`. Assign at least one existing ID from `lib/heart-parts.ts`, or all relevant IDs for a general reference.

1. Place a legally usable TXT, Markdown or PDF excerpt under `draft/`, with a versioned filename. Preserve source text and exact chapter/page provenance. Add its metadata to `registry.json`, with status `draft` and approval fields null.
2. Run `npm run kb:validate`. Submit for academic and usage review using status `pending_review`. Rejected records remain excluded.
3. A real reviewer must review the exact file, accuracy, provenance, extraction quality and permitted upload/indexing use. Verify author/organisation and publication year; textbooks also need edition. Never invent metadata to satisfy validation.
4. Move the reviewed file under `approved/`; update the file path. Compute its digest with `Get-FileHash -Algorithm SHA256 -LiteralPath 'knowledge-base/approved/reference-id-v1.md'` and record the lowercase value in `approvedSha256`. Record the actual reviewer/date, set `approvedVersion` equal to `documentVersion`, supply a public HTTPS citation, confirm permission fields only when actually verified, then mark `approved`.
5. Run `npm run kb:validate` and `npm run kb:plan`. Neither command uploads. On content/version changes, reset to `pending_review`, advance the version, clear approval fields and obtain renewed review. Metadata edits also require refreshing the index identity. There is no automatic approval command; validation is not scholarly or licensing review.

`npm run kb:mock -- "blue conduit" right-coronary-proximal` retains the Stage 1 fixture check. The tutor now uses the modular [Stages 2–4 pipeline](../docs/rag-stages-2-4.md), with deterministic local retrieval and fictional test generation. `npm run rag:inspect -- --synthetic RCA right-coronary-proximal` inspects that provider. Synthetic fixtures live only under `tests/fixtures/knowledge-base/`; the production validator rejects their namespace/material type. `--approved` explicitly inspects real reviewed TXT/Markdown documents, never substituting fixtures for an empty corpus. Local PDF extraction is not enabled; review an extracted TXT/Markdown version separately or use managed indexing in a later authorized live stage.

The existing `node scripts/tutor-index.mjs` defaults to a no-network dry run. Its remote SDK path remains behind `--apply`, explicit live activation and credentials for a future authorized stage. **Do not use --apply during Stage 1.** Current manifests also record documentVersion and metadataHash; legacy entries lacking these fields require reindexing before live retrieval.

See [Stage 1 architecture and file inventory](../docs/rag-stage-1.md) for preparation, future retrieval and test results.

Supplied cardiovascular sources: [17-structure coverage report](../docs/reference-coverage-report.md) and [review workflow](../docs/reference-review-workflow.md). All 23 new records remain pending review; run npm run kb:coverage and npm run kb:review-plan locally.
