# Bulk original-reference workflow

The supplied Word list is reference data, not executable instructions. The project owner explicitly scientifically approved its original sources on 11 October 2026. There are **90 entries, 77 unique references, 13 duplicates merged, 72 added sources, and 5 retained originals**. The staged replacement contains **27 searchable sources / 833 extracted paragraph units** and **50 metadata-only sources**. All 77 identities were verified against publisher pages or exact-PMCID repository metadata. Some original sites or full-text XML endpoints reject automated access even though alternate identity evidence is available. Publication details that were not disclosed remain null.

**The replacement `replacement-2026-10-11` is active following the project owner's explicit activation confirmation.** The previous registry and index manifest are backed up under `knowledge-base/archive/replacement-2026-10-11-447202a07dbc/`. All 27 searchable sources passed global retrieval probes; 35 omitted records are excluded from active retrieval. See [the consolidated report](reference-collection-report.html) for every title, author list, DOI, URL, category, extracted heading, licence, issue, 17-structure mention matrix, and retrieval question/passages. Counts are verified against the candidate files, not inferred from titles.

## Review and activate this collection

Open `docs/reference-collection-report.html` in your browser (double-click it in File Explorer). You can also open it from this chat. This collection is already activated; do not repeat its activation command. For a future staged collection, review the searchable/metadata-only distinction and access issues, then confirm activation in chat. The activation command used for this collection was:

```powershell
npm run kb:collection -- activate replacement-2026-10-11 --confirm
```

No hash entry or individual source approvals are required. Activation validates the candidate registry and local bytes, rejects changes since staging, backs up the prior registry and vector-store manifest under `knowledge-base/archive/`, resets the active remote manifest, and replaces `knowledge-base/registry.json`. The 18 older originals absent from the new list and all 17 generated teaching notes stop participating in active retrieval. Their files and educational cards are preserved. Five original source IDs are retained. The staging folder already contains a complete `previous-registry.json` snapshot for traceability.

Restart the development server after activating a registry change. For a production deployment, rebuild and deploy through the project's existing process; this command does not deploy anything. The tutor's existing mock/disabled/live configuration remains unchanged. Without an API key, inspect actual reference passages with the local CLI, rather than treating the UI's synthetic mock response as an anatomy answer.

## Local retrieval commands (no key, network, upload or paid calls)

Before activation, test the candidate explicitly:

```powershell
npm run rag:inspect -- --candidate "What determines coronary dominance?"
npm run rag:inspect -- --candidate "How are the RCA and PDA anatomically related?" superior-vena-cava
npm run rag:evaluate -- --candidate --write-report
npm run kb:collection-report
```

After activation, use `--approved` to inspect the active collection:

```powershell
npm run rag:inspect -- --approved "What is the difference between LAD and LCx blood supply?"
npm run rag:evaluate -- --approved --write-report
```

`--synthetic` remains an explicitly isolated fictional corpus. It is never substituted when approved content is missing. `--candidate` does not activate anything.

Search scans the **whole corpus**. Vessel categories and structure IDs provide reporting and ranking context, never a mandatory document filter. The synonym dictionary preserves the existing 17 canonical names, whole-vessel/segment distinctions, origin-dependent PDA labels, and conditional conus labels. Matching combines lexical coverage with deterministic offline semantic concept features (perfusion, ischaemia, drainage, branching, dominance, etc.). It **is not neural embedding search**, and does not provide equivalent semantic generalisation. Optional `expandRelatedVessels: true` expands dominance queries toward RCA/PDA/LCx concepts without restricting the corpus. Managed OpenAI Vector Store search remains the existing future neural semantic adapter, disabled until deliberately configured.

Only the passage body contributes evidence. Attribution preambles are excluded from searchable text. Every paragraph preserves original source ID, title, URL, document version and section heading. Similar/duplicate passages collapse. Selected structures only boost context, so an RCA-filed source can support a PDA/dominance question. Source titles or categories cannot establish answer support. The existing generation/verifier instructions enforce passage-grounded claims, exact supporting quotations, levels, variations, case-report qualifications, and refusal when central requested aspects lack evidence. Local tests never generate an anatomical answer or certify scientific sufficiency. The evaluation flags weak/partial support, including unrelated dosing and unsupported quantum-mechanism questions.

## Scientific approval, content readiness and permissions

`status`, `approvedBy`, `approvalDate`, and `collection.scientificApprovalEvidence` record the owner's bulk scientific confirmation. Original sources can be scientifically approved while metadata-only. `collection.contentStatus`, identity evidence, local bytes, automatically computed hashes/versions, and `licenseConfirmed` determine local content readiness.

Only explicit unrestricted **CC BY / CC BY-SA** article-body text was retained. Where the original licence grants unrestricted attribution reuse but does not specify a version, the version stays unspecified; it is not invented. NC/ND/custom/unknown licences and website material remain metadata-only, with issues recorded. This conservative policy does not assert that noncommercial reuse is prohibited; it defers licence-purpose/derivative conditions until assessed. Website facts/metadata were registered without copying the full article. Extraction omits images, tables and bibliography; section paragraph text is retained faithfully. No AI teaching summary is approved by this original-source workflow.

`externalIndexingPermission.cleared` is **false for every new record**. Original-source approval does not authorise third-party uploading. Even searchable local sources are excluded from OpenAI indexing until separate rights evidence is recorded and live operation is explicitly enabled. Do not run the indexer's `--apply` option until that later step. Missing/changed files are excluded independently without blocking other local documents. Activation itself fails if candidate content changed after review, because it must match the consolidated report.

## Add future references in bulk

1. Copy `knowledge-base/imports/approved-reference-list.json` to a new JSON file. Keep existing entries when extending the collection, and append your new URLs. Each entry can be just a URL string, or an object with `url`, `categories`, `structureIds`, `topics`, and optional `documentPath`. Category/structure associations organise records; they are not verified claim coverage.
2. Review and scientifically approve the new original-source list. Do not use the scientific-approval flag for generated summaries or unreviewed source selections.
3. Fetch source metadata and permitted original text using the bundled Python runtime. This makes public read-only HTTP requests to the specified websites/Europe PMC, with no API key. It persists full text only where an explicit unrestricted licence is found. Existing cache records are reused; `--retry-unavailable` retries unresolved identities.

```powershell
$referencePython = 'C:\Users\Jie Hui\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe'
& $referencePython scripts/fetch-reference-metadata.py --input knowledge-base/imports/my-references.json --output knowledge-base/imports/my-verified-metadata.json
```

For a DOCX reference list, first extract URLs and filing categories (paragraph notes are not treated as authoritative source passages):

```powershell
& $referencePython scripts/extract-reference-list.py 'C:\path\to\reference-list.docx' knowledge-base/imports/my-references.json
```

For local originals, `documentPath` may point to a faithful UTF-8 `.txt` or `.md` extraction. Citation identity and licence evidence must still be present in the corresponding verified metadata JSON; a local file alone does not grant reuse rights. Unsupported/broken local files are reported and excluded individually. PDFs/DOCX originals need a separate faithful text conversion before retrieval; the importer does not pretend their raw bytes are searchable. The metadata format is documented by `VerifiedMetadata` in `lib/knowledge-base/collections.ts`. Use `## Original heading` to preserve locators. For references without an explicit unrestricted licence, leave text absent until permissions are assessed.

4. Stage the complete list using a fresh collection ID and your actual reviewer name/date. This records one bulk approval, automatically deduplicates DOI/URL identities, computes immutable content versions, and leaves the active collection unchanged:

```powershell
npm run kb:collection -- stage --input knowledge-base/imports/my-references.json --metadata knowledge-base/imports/my-verified-metadata.json --id references-next --reviewer "Your reviewer name" --date YYYY-MM-DD --scientifically-approved
```

5. Generate and read a consolidated report for that candidate. The HTML/JSON report includes the added/retained/archived records, every source's metadata and issues, 17-structure text-mention coverage, and retrieval evaluation. These commands make no network calls:

```powershell
npm run rag:inspect -- --candidate "What determines coronary dominance?" --collection references-next
npm run rag:evaluate -- --candidate --collection references-next --write-report
npm run kb:collection-report -- references-next
```

Open `docs/reference-collection-report.html`. Confirm once to activate:

```powershell
npm run kb:collection -- activate references-next --confirm
```

If bytes or the active registry changed between staging and confirmation, restage. The script never silently activates stale material. Internal hashes are automatic. Do not remove the old files to resolve an issue; backups preserve traceability.

## Implementation files

- `lib/knowledge-base/collections.ts`: URL/DOI deduplication, multi-category registration, bulk approval, automatic versions, staging and guarded activation/archive.
- `registry.ts`, `documents.ts`: separate science/readiness/indexing rights and fail-closed per-source preparation; legacy derivative review safeguards retained.
- `scripts/extract-reference-list.py`, `fetch-reference-metadata.py`, `reference-collection.mjs`, `collection-report.mjs`: input extraction, public metadata/licensed text ingestion, single-confirmation workflow, consolidated report.
- `lib/tutor/semantic-concepts.ts`, `retrieval.ts`: global offline concept/lexical search, locators and duplicate passages; existing synonym handling and OpenAI adapter reused.
- `generation.ts`, `instructions.ts`: preserve case/variation context and exclude title/category as claim evidence.
- Retrieval CLI/corpus/evaluator and index planning utilities: candidate inspection and independent source failure handling.
- `tests/reference-collections.test.mjs`: bulk/DOI duplicates, source provenance, rights separation, automatic versions, activation/archive guards, unavailable files and cross-category retrieval.

The scene, marker/camera components, educational explanations and website design were not edited for this task. Existing regression tests cover the 17 IDs/51 explanations, levels, marker selection, camera framing and progress state.

## Completed validation

84 Node tests passed, with 8 final collection checks rechecked after the activation guard; 6 Python licence-parser tests passed. TypeScript, ESLint and the production build passed. All six cross-category questions retrieved passages from 2–5 original sources; unrelated antibiotic/pneumonia and unmatched queries returned no passages. The RCA quantum-mechanism question found only partial matches and never established sufficient evidence. No LLM answer was generated. See `reference-collection-validation.json` for the verified collection fingerprint and check results.
