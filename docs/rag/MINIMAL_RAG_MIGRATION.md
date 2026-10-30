# Minimal RAG migration — 14 October 2026

## Current result

Active collection: **minimal-2026-10-14**. Exactly 11 sources, 17 unchanged canonical labels, 29 source assignments and 137 real article passages. This is development review, using the existing deterministic keyword/concept retriever through `/api/chat`. No neural embeddings, external upload, LLM-generated anatomical explanation or scientific approval was performed. Production review mode is blocked; production defaults to a disabled tutor until approved live retrieval is configured.

The selected register was adapted, not indexed as scientific evidence. Original article text was obtained from Europe PMC structured XML (nine sources) and official publisher article HTML (R2/R7). DOI, title and named-author identities were checked against source content, and article-specific CC BY 4.0 licence evidence is recorded. Attribution retains the full author list, year, DOI, copyright notice when supplied, licence link and extraction change notice. Paragraph and section locators replace invented PDF page numbers. Excluded paragraph hashes and reasons are recorded in `knowledge-base/collections/minimal-2026-10-14/extraction-log.json`.

## Per-source status

| Source | Title | Extracted passages | Local status | Scientific review | Hosted index |
| --- | --- | --- | --- | --- | --- |
| R1 | Coronary Artery Anomalies: A Computed Tomography Angiography Pictorial Review | 9 | Acquired; CC BY 4.0 verified; locally indexed; chatbot probe passed | pending_review | Not uploaded: credentials missing |
| R2 | Right ventricular myocardial infarction: pathophysiology, clinical implications and management | 8 | Acquired; CC BY 4.0 verified; locally indexed; chatbot probe passed | pending_review | Not uploaded: credentials missing |
| R3 | Left Main Coronary Artery Disease: A Contemporary Review of Diagnosis and Management | 13 | Acquired; CC BY 4.0 verified; locally indexed; chatbot probe passed | pending_review | Not uploaded: credentials missing |
| R4 | Clinical Updates in Coronary Artery Disease: A Comprehensive Review | 30 | Acquired; CC BY 4.0 verified; locally indexed; chatbot probe passed | pending_review | Not uploaded: credentials missing |
| R5 | The diagonal branches and outcomes in patients with anterior ST-elevation myocardial infarction | 6 | Acquired; CC BY 4.0 verified; locally indexed; chatbot probe passed | pending_review | Not uploaded: credentials missing |
| R6 | Navigation of the Clinical Implications, Interventional Challenges, and Complexities of the Circumflex Coronary Artery: A Comprehensive Review | 24 | Acquired; CC BY 4.0 verified; locally indexed; chatbot probe passed | pending_review | Not uploaded: credentials missing |
| R7 | Successful coronary angioplasty of a spontaneous occlusion of the conus artery causing a ST-segment elevation myocardial infarction and electrical storm | 2 | Acquired; CC BY 4.0 verified; locally indexed; chatbot probe passed | pending_review | Not uploaded: credentials missing |
| R8 | Imaging of the aortic root on high-pitch non-gated and ECG-gated CT: awareness is the key! | 5 | Acquired; CC BY 4.0 verified; locally indexed; chatbot probe passed | pending_review | Not uploaded: credentials missing |
| R9 | Optimal Management of Spontaneous Aortic Thrombus Floating in the Ascending Aorta, from a Single Case Experience to a Literature Review | 14 | Acquired; CC BY 4.0 verified; locally indexed; chatbot probe passed | pending_review | Not uploaded: credentials missing |
| R10 | Review of evolving etiologies, implications and treatment strategies for the superior vena cava syndrome | 10 | Acquired; CC BY 4.0 verified; locally indexed; chatbot probe passed | pending_review | Not uploaded: credentials missing |
| R11 | Coronary sinus thrombosis: insights from a comprehensive literature review | 16 | Acquired; CC BY 4.0 verified; locally indexed; chatbot probe passed | pending_review | Not uploaded: credentials missing |

Source probes prove article-body retrieval; some use literal original paragraph text after a natural question did not return that source. They are not evidence that every student question is answerable. Read their exact queries and returned text in [minimal-chat-verification.json](minimal-chat-verification.json).

## Per-vessel chatbot evaluation

Questions are exact-label location (Basic), impaired blood flow (Intermediate) and obstruction diagnosis (Advanced). “Excerpts” means a literal direct-text candidate, not a generated explanation, complete answer or scientific-confidence rating. “Gap” means the chatbot returned insufficient evidence. No old reference was substituted.

| Stable ID and existing name | Register mappings | Location | Impaired flow | Diagnostic investigation |
| --- | --- | --- | --- | --- |
| 1: right-coronary-proximal / Right Coronary Artery (Proximal) | R1, R2 | Evidence gap | Evidence gap | Evidence gap |
| 2: right-coronary-middle / Right Coronary Artery (Middle) | R1, R2 | Evidence gap | Evidence gap | Evidence gap |
| 3: right-coronary-distal / Right Coronary Artery (Distal) | R1, R2 | Evidence gap | Evidence gap | Evidence gap |
| 4: posterior-descending-artery / Posterior Descending Artery | R1, R2 | Excerpts: R1 | Evidence gap | Evidence gap |
| 5: left-coronary-artery / Left Coronary Artery | R3 | Evidence gap | Excerpts: R3 | Excerpts: R3 |
| 6: left-anterior-descending-proximal / Left Anterior Descending (Proximal) | R1, R4 | Evidence gap | Excerpts: R5 | Excerpts: R5 |
| 7: left-anterior-descending-mid / Left Anterior Descending (Mid) | R1, R4 | Evidence gap | Evidence gap | Evidence gap |
| 8: left-anterior-descending-apical / Left Anterior Descending (Apical) | R1, R4 | Evidence gap | Evidence gap | Evidence gap |
| 9: left-diagonal-d1 / Left Diagonal D1 | R1, R5 | Evidence gap | Evidence gap | Evidence gap |
| 10: left-diagonal-d2 / Left Diagonal D2 | R1, R5 | Evidence gap | Evidence gap | Evidence gap |
| 11: left-circumflex-artery / Left Circumflex Artery | R6 | Excerpts: R1, R6 | Evidence gap | Excerpts: R6 |
| 12: right-marginal-artery / Right Marginal Artery | R2 | Evidence gap | Evidence gap | Evidence gap |
| 13: right-conus-artery / Right Conus Artery | R2, R7 | Evidence gap | Evidence gap | Excerpts: R7 |
| 14: left-marginal-artery / Left Marginal Artery | R1, R6 | Evidence gap | Evidence gap | Evidence gap |
| 15: ascending-aorta / Ascending Aorta | R8, R9 | Excerpts: R8, R9 | Excerpts: R9 | Excerpts: R8, R9 |
| 16: superior-vena-cava / Superior Vena Cava | R10 | Excerpts: R10 | Excerpts: R10 | Excerpts: R10 |
| 17: coronary-sinus / Coronary Sinus | R11 | Excerpts: R11 | Excerpts: R11 | Excerpts: R11 |

**17 of 51 vessel questions returned candidate excerpts; 34 explicitly reported gaps.** Additional actual-route checks cover all 11 source identities, three negative/context tests and five abbreviation/comparison questions (70 recorded route results in total, plus fallback probes). Isolated D2 clinical/ECG/prognostic claims are explicitly refused. `pRCA` supply and proximal-versus-distal RCA remain gaps. CS abbreviation, coronary dominance and the RCA/LCx origin comparison return new-source excerpts. An explicit SVC question overrides an unrelated selected RCA; unsupported lunarbotany is refused.

### Scientific and coverage limitations

The register's 17 viewer labels are not a standard angiographic segmentation scheme. Parent RCA/LAD facts do not establish specific segments. Apical LAD is not automatically distal LAD. D1/D2 evidence cannot be extrapolated into an isolated-D2 prognosis. OM1/OM2 are not automatically this model's left marginal artery. PDA origin depends on dominance; an independent conus origin cannot be assumed.

R5 is observational diagonal-branch evidence, not isolated D2 validation. R7 contributes background and one explicitly case-qualified diagnostic sentence; its procedural/patient narrative remains excluded. R9 and R11 contain rare pathological/case evidence and cannot establish universal normal anatomy. General figures, captions, tables, supplements and bibliography text are excluded. The R1 left-main “2 to 4 mm” assertion is excluded. Numeric study observations in retained original prose remain observations requiring scientific review, not clinical thresholds. Broad segment mentions, missing direct diagnostic descriptions and the conservative exclusions explain many gaps. The review learning catalogue may omit case-report material entirely; pending passages cannot enter approved summaries or quizzes.

See the HTML report for original source links, actual retrieved sections, full answers, cautions, original search queries and per-vessel scope limitations: [minimal-migration-report.html](minimal-migration-report.html).

## Reversible replacement

Previous active registry: 77 records. Its 27 referenced local documents and the old index manifest are preserved at `knowledge-base/archive/minimal-2026-10-14-1daa76f7ea62/`. Their original active paths are archived; the active registry now contains R1–R11 only. New-only loaders and collection/document/metadata hashes prevent superseded or stale passages from entering chat or learning evidence. Existing conversations are preserved as activity history, but old-version replies/citations are hidden and excluded from new evidence. Obsolete staged extractions are separately retained under `knowledge-base/archive/minimal-2026-10-14-obsolete-staging/`.

Rollback: `npm run rag:minimal -- rollback`. This restores the backed-up local registry, manifest and document paths; it does not delete any remote resources or the new collection. Inspect any destination collision rather than overwriting it. Repeating activation of the unchanged collection is a no-op. Scientific approval or changed content produces a new collection version; old remote file IDs remain ineligible even if retained remotely.

## Test results

- Automated tests: 120 passed; zero failed or skipped.
- TypeScript: passed; ESLint: passed; production build: passed with TUTOR_MODE=disabled.
- Actual chatbot route: all 11 source identities retrieved; 70 recorded route results, including 51 vessel questions, abbreviation/comparison probes and negative/context checks.
- Chrome integration: real chatbot request/citations/attribution, level switching, closed initial panels and pending scientific-review gates passed.
- Existing camera suite: all 17 list/marker selections, rapid changes, manual rotation/zoom/reset and six viewport sizes with/without tutor passed.
- Twelve protected explorer files match their pre-migration SHA-256 values. Repeated activation is a no-op; all 27 historical document backups were checked.
- OpenAI SDK adapters were tested with isolated mocks. Real hosted retrieval and generated answers were not tested; no OpenAI API calls occurred.

See [minimal-validation.json](minimal-validation.json), [minimal-browser-verification.json](minimal-browser-verification.json) and [minimal-chat-verification.json](minimal-chat-verification.json). Passing technical tests does not confer scientific approval or complete coverage.

## Run locally (PowerShell)

Open a terminal in the project folder:

```powershell
cd "C:\Users\Jie Hui\Documents\WebsiteProjects\heart-anatomy-site"
npm run rag:minimal -- status
$env:TUTOR_MODE="review"
$env:TUTOR_REVIEW_BACKEND="local"
$env:TUTOR_REQUESTS_PER_MINUTE="60"
$env:TUTOR_DAILY_REQUEST_LIMIT="1000"
npm run dev -- --hostname localhost --port 3104
```

Open [http://localhost:3104](http://localhost:3104), select a structure, open **Ask AI Tutor**, tick the privacy checkbox and ask **Where does CS drain?** The answer should display literal excerpts and R11's original DOI and section citation. The anatomy-card reference list is contextual reading, not proof that the unchanged static card text was scientifically approved. Use Ctrl+C to stop this server.

In a second terminal in the same folder:

```powershell
npm run rag:minimal-test -- http://localhost:3104
npm run rag:minimal -- validate
npm run rag:minimal -- index-review
npm test
npm run typecheck
npm run lint
$env:EXPLORER_TEST_URL="http://localhost:3104"
node tests/minimal-rag-browser.mjs
node tests/panel-framing-browser.mjs
node scripts/minimal-rag-report.mjs
```

The source-route suite respects a 60/minute ceiling and needs roughly two minutes. The ordinary default remains 10/minute; do not weaken production limits for testing. The browser scripts use the existing Playwright cache and installed Chrome. Stop the development server before running `npm run build`; builds and dev share generated Next.js files. Test build with `$env:TUTOR_MODE="disabled"` to keep pending scientific material out of production.

## Exact remaining actions for hosted retrieval and generated answers

1. **Credentials:** configure your own OpenAI project key privately in `.env.local` for Next.js. CLI scripts do not load this file automatically; load the values securely into that terminal's environment (for example, PowerShell `$env:OPENAI_API_KEY=Read-Host "Project API key" -MaskInput`). Never commit or paste the key into a report. No configured key was found, so all 11 hosted uploads and real SDK search checks remain unperformed.
2. **Optional hosted development review:** `npm run rag:minimal -- index-review --apply` creates a separate review vector store using only the 11 verified extracted text files, waits for completed indexing and records per-source actual SDK search results. This incurs API charges. Set `TUTOR_REVIEW_BACKEND=openai` and `TUTOR_MODE=review`, restart dev, then rerun the chatbot suite. Pending scientific review remains pending. It cannot be used in production.
3. **Scientific review:** inspect the retained excerpts, excluded-paragraph log, rare-case cautions and vessel limitations. Record actual corrections/reviewer approval first. The explicit command is `npm run rag:minimal -- approve --sources R1,R2 --reviewer "ACTUAL REVIEWER NAME" --date YYYY-MM-DD --scientifically-reviewed`; it previews only. Add `--apply` only after those named sources have actually been reviewed. Do not mechanically approve all 11, or regenerate extracts after approval without renewing review. New text/metadata invalidates the previous version and must be revalidated.
4. **Production hosted index:** after actual source approval, configure `TUTOR_LIVE_ENABLED=true` and the key, then run the existing `node scripts/tutor-index.mjs` dry run and `node scripts/tutor-index.mjs --apply` for eligible approved documents. Use a dedicated store, no `--remove-obsolete`, and copy the resulting manifest's vector-store ID into `OPENAI_VECTOR_STORE_ID`. Configure `OPENAI_MODEL` and `TUTOR_MODE=live`. Production also requires the existing shared usage-limiter credentials. Re-run actual live-route/claim/citation tests; this task has not validated real generated answers.
5. **Coverage:** complete the scientific review and address documented gaps with permitted, reviewed source content before claiming all 17 labels are comprehensively taught. A retrieved passage, review reply or numeric ranking score is not scientific confidence.

The official OpenAI SDK was reused for vector-store indexing/search and the existing Responses generation pipeline. No separate service, vector database or new student search interface was introduced. No public deployment or remote deletion occurred.

## Files changed for this migration

- scripts/acquire-minimal-references.py
- scripts/extract-minimal-references.py
- scripts/minimal-rag.mjs
- scripts/verify-minimal-chat.mjs
- scripts/minimal-rag-report.mjs
- scripts/tutor-index.mjs
- lib/knowledge-base/registry.ts
- lib/knowledge-base/minimal.ts
- lib/knowledge-base/minimal-public.ts
- lib/tutor/minimal-review.ts
- lib/tutor/minimal-remote.ts
- lib/tutor/retrieval.ts
- lib/tutor/question-relevance.ts
- lib/tutor/types.ts
- lib/tutor/schema.ts
- lib/tutor/config.ts
- lib/tutor/http.ts
- lib/tutor/service.ts
- lib/tutor/pipeline.ts
- lib/tutor/generation.ts
- lib/learning/evidence.ts
- lib/learning/evidence-server.ts
- lib/learning/quiz.ts
- lib/learning/summary.ts
- app/page.tsx
- components/HeartExplorer.tsx
- components/FloatingStructureEducation.tsx
- components/StructureEducation.tsx
- components/AnatomyTutor.tsx
- components/LearningReview.tsx
- tests/minimal-rag.test.mjs
- tests/minimal-rag-browser.mjs
- tests/reference-collections.test.mjs
- tests/tutor.test.mjs
- package.json
- .env.example

- `knowledge-base/registry.json`, `index-manifest.json`, `active-collection.json`: active selection/production manifest reset.
- `knowledge-base/collections/minimal-2026-10-14/`: input snapshot, validated registry, versioned local index, extraction log, activation record.
- `knowledge-base/pending_review/minimal-2026-10-14/`: 11 attributed real-text extractions.
- `knowledge-base/archive/`: reversible old collection and obsolete staging versions.
- `docs/rag/MINIMAL_RAG_MIGRATION.md`, `minimal-migration-report.html`, `minimal-chat-verification.json`, `minimal-browser-verification.json`: reproducible documentation/results.

Existing pending work in the checkout was retained. The 3D scene, camera, CSS, markers, canonical inventory, coordinates, original educational explanations and progress implementations were not changed by this migration.
