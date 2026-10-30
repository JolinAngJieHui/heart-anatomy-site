# Supplied cardiovascular references: review workflow

**Superseded for original-source management:** use [the bulk approved-reference workflow](bulk-reference-workflow.md) and [consolidated replacement report](reference-collection-report.html). Counts below are historical.

Historical reference-registration report. The subsequent [teaching approval workflow](teaching-approval-workflow.md) and [17-structure factual review matrix](teaching-review.html) describe the 17 newly prepared documents and supersede the staging counts and combined approval/indexing steps below. Scientific/local-use approval is now separate from external-indexing permission.

The 23 unique URLs supplied on 11 October 2026 are in the existing `knowledge-base/registry.json`. The previously inventoried website explanations and links remain in `draft-registry.json`, untouched. New sources are `pending_review`, with no reviewer, approval date, approved version or approved hash. None is production eligible. The duplicate PMC12060931 URL was registered once.

The optional `curation` object adds authors/organisation, full publication details, DOI, exact update date, evidence URLs, access limitations, broad versus specific scope, reuse disposition, and section mappings with existing IDs, proposed levels, verification state and normal/variant/clinical/method flags. The validator checks enrichment, mapping consistency and rare-case warnings. Legacy records remain valid. Metadata hashes already include enrichment, so editing it invalidates any old indexing identity.

`publicationYear` is the article issue year or chapter/page update year, not the current hosting-site copyright year. For example, PMC12060931 appeared online in 2024 with a 2025 issue; StatPearls chapters updated in 2023 are currently hosted in a 2026 container. ScienceDirect's aggregation has no verified date or authors; those remain explicitly unresolved. Section locators are human-readable headings, not invented URL fragments. Original URLs are retained in `location` for future clickable citations, even when metadata was verified through PubMed. `publicCitation` expresses intended bibliographic citation availability, not permission to copy/store text or endorsement.

## Local preparation

- `npm run kb:validate`: validate registry and candidate inventory without network.
- `npm run kb:coverage`: regenerate the 17-structure coverage report and JSON from validated mappings.
- `npm run kb:review-plan`: hash the licence-eligible pending text for human review. This is deliberately separate from production PreparedDocument/index plans.
- `npm run kb:plan` and `node scripts/tutor-index.mjs`: existing approved-only, no-network plans. Both currently select zero documents.
- `npm run rag:inspect -- --approved RCA right-coronary-proximal`: returns no production passages until approval; never falls back to synthetic fixtures.

Only a short attributed original paraphrase of the CC BY 4.0 surgical review is staged at `knowledge-base/pending_review/pmc12060931.md`. No full texts or illustrations were copied. It covers the parent vessels and dominance overview, not every mapped section or all 17 structures. Other records are bibliographic metadata only. Permission-restricted and licence-unverified files are not fabricated, scraped or silently substituted with website explanations.

The NC sources require a determination that intended copying/adaptation and external processing comply with noncommercial terms. NBK470522's ND condition requires a separate assessment of adaptation/extraction/chunking. Other StatPearls licences are not inferred from this chapter. CC BY statements for the two cadaver case reports were found in PDFs outside the publisher/PMC endpoints; their authoritative licence verification remains unresolved. Cleveland Clinic and Mayo policies do not grant this application general storage/republication permission. ScienceDirect excerpt rights must be assessed at the underlying publication level. Radiology Assistant reuse terms remain unverified. Availability on PMC/PubMed is not a reuse grant; no systematic downloading from the article website is implemented.

## Review and future approval

1. Review source accuracy, each proposed locator, the selected educational level, and disagreements against specialist sources. Restrict rare-case sections to explicit anomaly discussion. Resolve the flagged consumer-source dominance wording and LAD apical/distal mapping. Do not certify an entire paper because its title is relevant.
2. Obtain/verify permissions for the actual intended use, including text extraction, adaptation, storage, external embedding/indexing and generated excerpts. Record evidence in `curation.reuse`, updating its disposition and notes; only then set `externalIndexingCleared` and `licenseConfirmed` true. Those flags are separate from academic approval. There is no automatic approval tool.
3. Prepare exact approved passages in UTF-8 TXT/Markdown with original URL, attribution and section provenance. Do not upload whole papers by default. Split normal and variant teaching into separate source records/files if both are used; retain the original URL and explicit warnings in every variant passage. Source-level structure mappings alone cannot identify which portion of a full paper supports a claim. The current staged summary contains no rare-case teaching.
4. Move the actual reviewed file into `approved/`, record its SHA-256, real reviewer/date, approvedVersion matching documentVersion, and status approved. Unverified titles/dates/authors must be resolved rather than invented. Changed bytes require renewed approval. Follow the existing knowledge-base README checklist.
5. Run validation and approved-only planning again. User approval of academic content does not automatically resolve missing rights or files. No command in this task uploads to OpenAI. Future paid indexing remains separately authorized using the existing guarded SDK path.

Adding approved text later requires rebuilding/restarting the site as documented in RAG Stages 2–4. This task changes no website UI, scene, markers, existing educational text or synthetic fixture corpus. Technical tests validate gates and metadata; they do not establish clinical correctness or completeness.

Files added: curation/coverage/review modules, reference registration/coverage/review-plan scripts, the pending attributed summary, coverage JSON, report and this workflow, and source-catalog tests. Modified: registry schema and data, package commands, documentation links and the old empty-registry test invariant (now tests zero approved sources).

Verification: all 63 tests, TypeScript, ESLint and production build passed. Local review inventory contains one hashed review-only summary; approved indexing plan selects zero documents and excludes all 23 records; approved retrieval inspection returns zero passages. No OpenAI calls or uploads were made. The production build validates both existing tutor API routes and the site; no UI files were edited in this task.
