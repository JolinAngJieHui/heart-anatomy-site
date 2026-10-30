import fs from 'node:fs/promises';
const root='knowledge-base/collections/minimal-2026-10-14';
const read=async p=>JSON.parse(await fs.readFile(p,'utf8'));
const records=await read(`${root}/registry.json`),log=await read(`${root}/extraction-log.json`),report=await read('docs/rag/minimal-chat-verification.json'),active=await read('knowledge-base/active-collection.json');
const validation=await read('docs/rag/minimal-validation.json');
if(!report.passed||report.collectionVersion!==active.collectionVersion)throw new Error('Only a current, passing route evaluation can produce this report');
for(const source of log){source.localIndexed=true;source.searchTested=report.sourceRouteProbes.some(p=>p.sourceId===source.sourceId&&p.pass);source.remoteIndexed=false;source.remoteBlocker='OPENAI_API_KEY is not configured; no remote upload or paid API calls performed.';}
await fs.writeFile(`${root}/extraction-log.json`,JSON.stringify(log,null,2)+'\n');
const cells=value=>String(value??'').replaceAll('|',' / ').replaceAll('\n',' ');
const sourceLines=records.map(r=>`| ${r.id} | ${cells(r.title)} | ${r.extraction.locators.length} | Acquired; CC BY 4.0 verified; locally indexed; chatbot probe passed | pending_review | Not uploaded: credentials missing |`);
const outcome=r=>r.status==='review'?`Excerpts: ${[...new Set(r.sources.map(s=>s.sourceId))].join(', ')}`:'Evidence gap';
const directQuestions=report.vessels.flatMap(v=>v.results).filter(r=>r.status==='review').length;
const gapQuestions=51-directQuestions;
const vesselLines=report.vessels.map(v=>`| ${v.number}: ${v.id} / ${v.name} | ${records.filter(r=>r.structureIds.includes(v.id)).map(r=>r.id).join(', ')} | ${v.results.map(outcome).join(' | ')} |`);
const files=['scripts/acquire-minimal-references.py','scripts/extract-minimal-references.py','scripts/minimal-rag.mjs','scripts/verify-minimal-chat.mjs','scripts/minimal-rag-report.mjs','scripts/tutor-index.mjs','lib/knowledge-base/registry.ts','lib/knowledge-base/minimal.ts','lib/knowledge-base/minimal-public.ts','lib/tutor/minimal-review.ts','lib/tutor/minimal-remote.ts','lib/tutor/retrieval.ts','lib/tutor/question-relevance.ts','lib/tutor/types.ts','lib/tutor/schema.ts','lib/tutor/config.ts','lib/tutor/http.ts','lib/tutor/service.ts','lib/tutor/pipeline.ts','lib/tutor/generation.ts','lib/learning/evidence.ts','lib/learning/evidence-server.ts','lib/learning/quiz.ts','lib/learning/summary.ts','app/page.tsx','components/HeartExplorer.tsx','components/FloatingStructureEducation.tsx','components/StructureEducation.tsx','components/AnatomyTutor.tsx','components/LearningReview.tsx','tests/minimal-rag.test.mjs','tests/minimal-rag-browser.mjs','tests/reference-collections.test.mjs','tests/tutor.test.mjs','package.json','.env.example'];
const md=`# Minimal RAG migration — 14 October 2026

## Current result

Active collection: **${active.id}**. Exactly 11 sources, 17 unchanged canonical labels, 29 source assignments and 137 real article passages. This is development review, using the existing deterministic keyword/concept retriever through \`/api/chat\`. No neural embeddings, external upload, LLM-generated anatomical explanation or scientific approval was performed. Production review mode is blocked; production defaults to a disabled tutor until approved live retrieval is configured.

The selected register was adapted, not indexed as scientific evidence. Original article text was obtained from Europe PMC structured XML (nine sources) and official publisher article HTML (R2/R7). DOI, title and named-author identities were checked against source content, and article-specific CC BY 4.0 licence evidence is recorded. Attribution retains the full author list, year, DOI, copyright notice when supplied, licence link and extraction change notice. Paragraph and section locators replace invented PDF page numbers. Excluded paragraph hashes and reasons are recorded in \`${root}/extraction-log.json\`.

## Per-source status

| Source | Title | Extracted passages | Local status | Scientific review | Hosted index |
| --- | --- | --- | --- | --- | --- |
${sourceLines.join('\n')}

Source probes prove article-body retrieval; some use literal original paragraph text after a natural question did not return that source. They are not evidence that every student question is answerable. Read their exact queries and returned text in [minimal-chat-verification.json](minimal-chat-verification.json).

## Per-vessel chatbot evaluation

Questions are exact-label location (Basic), impaired blood flow (Intermediate) and obstruction diagnosis (Advanced). “Excerpts” means a literal direct-text candidate, not a generated explanation, complete answer or scientific-confidence rating. “Gap” means the chatbot returned insufficient evidence. No old reference was substituted.

| Stable ID and existing name | Register mappings | Location | Impaired flow | Diagnostic investigation |
| --- | --- | --- | --- | --- |
${vesselLines.join('\n')}

**${directQuestions} of 51 vessel questions returned candidate excerpts; ${gapQuestions} explicitly reported gaps.** Additional actual-route checks cover all 11 source identities, three negative/context tests and five abbreviation/comparison questions (70 recorded route results in total, plus fallback probes). Isolated D2 clinical/ECG/prognostic claims are explicitly refused. \`pRCA\` supply and proximal-versus-distal RCA remain gaps. CS abbreviation, coronary dominance and the RCA/LCx origin comparison return new-source excerpts. An explicit SVC question overrides an unrelated selected RCA; unsupported lunarbotany is refused.

### Scientific and coverage limitations

The register's 17 viewer labels are not a standard angiographic segmentation scheme. Parent RCA/LAD facts do not establish specific segments. Apical LAD is not automatically distal LAD. D1/D2 evidence cannot be extrapolated into an isolated-D2 prognosis. OM1/OM2 are not automatically this model's left marginal artery. PDA origin depends on dominance; an independent conus origin cannot be assumed.

R5 is observational diagonal-branch evidence, not isolated D2 validation. R7 contributes background and one explicitly case-qualified diagnostic sentence; its procedural/patient narrative remains excluded. R9 and R11 contain rare pathological/case evidence and cannot establish universal normal anatomy. General figures, captions, tables, supplements and bibliography text are excluded. The R1 left-main “2 to 4 mm” assertion is excluded. Numeric study observations in retained original prose remain observations requiring scientific review, not clinical thresholds. Broad segment mentions, missing direct diagnostic descriptions and the conservative exclusions explain many gaps. The review learning catalogue may omit case-report material entirely; pending passages cannot enter approved summaries or quizzes.

See the HTML report for original source links, actual retrieved sections, full answers, cautions, original search queries and per-vessel scope limitations: [minimal-migration-report.html](minimal-migration-report.html).

## Reversible replacement

Previous active registry: 77 records. Its 27 referenced local documents and the old index manifest are preserved at \`knowledge-base/${active.rollback}/\`. Their original active paths are archived; the active registry now contains R1–R11 only. New-only loaders and collection/document/metadata hashes prevent superseded or stale passages from entering chat or learning evidence. Existing conversations are preserved as activity history, but old-version replies/citations are hidden and excluded from new evidence. Obsolete staged extractions are separately retained under \`knowledge-base/archive/minimal-2026-10-14-obsolete-staging/\`.

Rollback: \`npm run rag:minimal -- rollback\`. This restores the backed-up local registry, manifest and document paths; it does not delete any remote resources or the new collection. Inspect any destination collision rather than overwriting it. Repeating activation of the unchanged collection is a no-op. Scientific approval or changed content produces a new collection version; old remote file IDs remain ineligible even if retained remotely.

## Test results

- Automated tests: ${validation.automatedTests.passed} passed; zero failed or skipped.
- TypeScript: ${validation.typecheck}; ESLint: ${validation.eslint}; production build: ${validation.productionBuild}.
- Actual chatbot route: all 11 source identities retrieved; 70 recorded route results, including 51 vessel questions, abbreviation/comparison probes and negative/context checks.
- Chrome integration: real chatbot request/citations/attribution, level switching, closed initial panels and pending scientific-review gates passed.
- Existing camera suite: all 17 list/marker selections, rapid changes, manual rotation/zoom/reset and six viewport sizes with/without tutor passed.
- Twelve protected explorer files match their pre-migration SHA-256 values. Repeated activation is a no-op; all 27 historical document backups were checked.
- OpenAI SDK adapters were tested with isolated mocks. Real hosted retrieval and generated answers were not tested; no OpenAI API calls occurred.

See [minimal-validation.json](minimal-validation.json), [minimal-browser-verification.json](minimal-browser-verification.json) and [minimal-chat-verification.json](minimal-chat-verification.json). Passing technical tests does not confer scientific approval or complete coverage.

## Run locally (PowerShell)

Open a terminal in the project folder:

\`\`\`powershell
cd "C:\\Users\\Jie Hui\\Documents\\WebsiteProjects\\heart-anatomy-site"
npm run rag:minimal -- status
$env:TUTOR_MODE="review"
$env:TUTOR_REVIEW_BACKEND="local"
$env:TUTOR_REQUESTS_PER_MINUTE="60"
$env:TUTOR_DAILY_REQUEST_LIMIT="1000"
npm run dev -- --hostname localhost --port 3104
\`\`\`

Open [http://localhost:3104](http://localhost:3104), select a structure, open **Ask AI Tutor**, tick the privacy checkbox and ask **Where does CS drain?** The answer should display literal excerpts and R11's original DOI and section citation. The anatomy-card reference list is contextual reading, not proof that the unchanged static card text was scientifically approved. Use Ctrl+C to stop this server.

In a second terminal in the same folder:

\`\`\`powershell
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
\`\`\`

The source-route suite respects a 60/minute ceiling and needs roughly two minutes. The ordinary default remains 10/minute; do not weaken production limits for testing. The browser scripts use the existing Playwright cache and installed Chrome. Stop the development server before running \`npm run build\`; builds and dev share generated Next.js files. Test build with \`$env:TUTOR_MODE="disabled"\` to keep pending scientific material out of production.

## Exact remaining actions for hosted retrieval and generated answers

1. **Credentials:** configure your own OpenAI project key privately in \`.env.local\` for Next.js. CLI scripts do not load this file automatically; load the values securely into that terminal's environment (for example, PowerShell \`$env:OPENAI_API_KEY=Read-Host "Project API key" -MaskInput\`). Never commit or paste the key into a report. No configured key was found, so all 11 hosted uploads and real SDK search checks remain unperformed.
2. **Optional hosted development review:** \`npm run rag:minimal -- index-review --apply\` creates a separate review vector store using only the 11 verified extracted text files, waits for completed indexing and records per-source actual SDK search results. This incurs API charges. Set \`TUTOR_REVIEW_BACKEND=openai\` and \`TUTOR_MODE=review\`, restart dev, then rerun the chatbot suite. Pending scientific review remains pending. It cannot be used in production.
3. **Scientific review:** inspect the retained excerpts, excluded-paragraph log, rare-case cautions and vessel limitations. Record actual corrections/reviewer approval first. The explicit command is \`npm run rag:minimal -- approve --sources R1,R2 --reviewer "ACTUAL REVIEWER NAME" --date YYYY-MM-DD --scientifically-reviewed\`; it previews only. Add \`--apply\` only after those named sources have actually been reviewed. Do not mechanically approve all 11, or regenerate extracts after approval without renewing review. New text/metadata invalidates the previous version and must be revalidated.
4. **Production hosted index:** after actual source approval, configure \`TUTOR_LIVE_ENABLED=true\` and the key, then run the existing \`node scripts/tutor-index.mjs\` dry run and \`node scripts/tutor-index.mjs --apply\` for eligible approved documents. Use a dedicated store, no \`--remove-obsolete\`, and copy the resulting manifest's vector-store ID into \`OPENAI_VECTOR_STORE_ID\`. Configure \`OPENAI_MODEL\` and \`TUTOR_MODE=live\`. Production also requires the existing shared usage-limiter credentials. Re-run actual live-route/claim/citation tests; this task has not validated real generated answers.
5. **Coverage:** complete the scientific review and address documented gaps with permitted, reviewed source content before claiming all 17 labels are comprehensively taught. A retrieved passage, review reply or numeric ranking score is not scientific confidence.

The official OpenAI SDK was reused for vector-store indexing/search and the existing Responses generation pipeline. No separate service, vector database or new student search interface was introduced. No public deployment or remote deletion occurred.

## Files changed for this migration

${files.map(f=>"- "+f).join('\n')}

- \`knowledge-base/registry.json\`, \`index-manifest.json\`, \`active-collection.json\`: active selection/production manifest reset.
- \`knowledge-base/collections/minimal-2026-10-14/\`: input snapshot, validated registry, versioned local index, extraction log, activation record.
- \`knowledge-base/pending_review/minimal-2026-10-14/\`: 11 attributed real-text extractions.
- \`knowledge-base/archive/\`: reversible old collection and obsolete staging versions.
- \`docs/rag/MINIMAL_RAG_MIGRATION.md\`, \`minimal-migration-report.html\`, \`minimal-chat-verification.json\`, \`minimal-browser-verification.json\`: reproducible documentation/results.

Existing pending work in the checkout was retained. The 3D scene, camera, CSS, markers, canonical inventory, coordinates, original educational explanations and progress implementations were not changed by this migration.
`;
await fs.writeFile('docs/rag/MINIMAL_RAG_MIGRATION.md',md);
const escape=s=>String(s??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
const rows=records.map(r=>`<tr><td>${r.id}</td><td><a href="${escape(r.location)}">${escape(r.title)}</a><br>${escape(r.extraction.authors.join('; '))}<br>${r.year??r.publicationYear??''} / ${escape(r.extraction.doi)}<br><a href="${escape(r.extraction.licenceEvidenceUrl)}">Article licence evidence</a></td><td>${r.extraction.locators.length}</td><td>Acquired / verified CC BY 4.0 / local index / actual route probe passed</td><td>pending_review<br>No remote upload: key missing</td></tr>`).join('');
const detail=result=>`<details><summary>${escape(outcome(result))}</summary><p>${escape(result.question)}</p><pre>${escape(result.answer)}</pre>${result.sources.map(s=>`<p><a href="${escape(s.url)}">[${escape(s.sourceId)}] ${escape(s.title)}</a><br>${escape(s.section)}</p>`).join('')}<p>Rankings describe retrieval relevance, not scientific confidence.</p></details>`;
const vessels=report.vessels.map(v=>`<tr><td>${v.number}. ${escape(v.name)}<br><code>${escape(v.id)}</code></td><td>${records.filter(r=>r.structureIds.includes(v.id)).map(r=>r.id).join(', ')}<p>${escape(v.limitation)}</p></td>${v.results.map(r=>`<td>${detail(r)}</td>`).join('')}</tr>`).join('');
await fs.writeFile('docs/rag/minimal-migration-report.html',`<!doctype html><html lang="en"><meta charset="utf-8"><title>Minimal RAG migration report</title><style>body{font:16px/1.5 system-ui;max-width:1600px;margin:30px auto;padding:20px;color:#172d35}table{border-collapse:collapse;width:100%;margin-bottom:35px}th,td{border:1px solid #b9cad0;padding:12px;vertical-align:top}th{background:#e6f4f2}pre{white-space:pre-wrap;max-height:500px;overflow:auto;background:#f2f6f7;padding:12px}summary{cursor:pointer}code{overflow-wrap:anywhere}a{color:#006964}</style><h1>Minimal RAG replacement: verified local review</h1><p>11 original sources / 137 passages / 17 labels / 29 assignments. Scientific approval pending. No hosted indexing or AI-generated anatomical explanations. Collection version: <code>${escape(active.collectionVersion)}</code>.</p><p>70 recorded actual-chat-route results, including 51 vessel questions: ${directQuestions} excerpt candidates and ${gapQuestions} evidence gaps. Eleven source-body probes pass; some use literal article text and prove searchability rather than complete coverage. <a href="MINIMAL_RAG_MIGRATION.md">Commands, architecture, files changed and remaining actions</a>.</p><h2>Per-source acquisition, licence and indexing</h2><table><thead><tr><th>ID</th><th>Original source / attribution</th><th>Passages</th><th>Local status</th><th>Review / hosted status</th></tr></thead><tbody>${rows}</tbody></table><h2>Per-vessel actual chatbot results</h2><p>Expand cells to read original questions, literal returned passages and article section citations. Excerpts require scientific review. Gap results do not substitute old references.</p><table><thead><tr><th>Existing label / stable ID</th><th>Mapping / scope limitation</th><th>Basic location</th><th>Intermediate impaired flow</th><th>Advanced diagnostics</th></tr></thead><tbody>${vessels}</tbody></table><h2>Source route probes</h2>${report.sourceRouteProbes.map(r=>`<h3>${r.sourceId}: ${r.pass?'passed':'failed'}</h3>${detail(r)}`).join('')}<h2>Synonyms, comparisons and negative/context checks</h2>${[...report.comparisons,...report.negative].map(detail).join('')}<h2>Backup</h2><p>Previous 77-reference registry and 27 local documents: <code>knowledge-base/${escape(active.rollback)}</code>. They are excluded from new retrieval. No remote resources were deleted.</p></html>`);
console.log('Updated extraction search flags and generated Markdown/HTML reports from actual route results.');
