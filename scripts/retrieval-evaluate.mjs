import fs from "node:fs/promises";
import { loadTypeScript } from "./load-typescript.mjs";
import { loadLocalCorpus } from "./local-retrieval-corpus.mjs";
const mode = process.argv[2];
const { HEART_PARTS } = loadTypeScript("lib/heart-parts.ts");
const { LocalRetrievalProvider } = loadTypeScript("lib/tutor/retrieval.ts");
const { evaluateSupport } = loadTypeScript("lib/tutor/retrieval-evaluation.ts");
const collectionIndex = process.argv.indexOf("--collection");
const collectionId = collectionIndex < 0 ? undefined : process.argv[collectionIndex + 1];
const corpus = await loadLocalCorpus(mode, true, collectionId), provider = new LocalRetrievalProvider(corpus);
const cases = [
  ...HEART_PARTS.map(p => ({ question: `What is the function of ${p.name}?`, requiredIds: [p.id] })),
  { question: "What does the right coronary artery supply?", requiredIds: ["right-coronary-proximal"] },
  { question: "What is the difference between proximal and distal RCA?", requiredIds: ["right-coronary-proximal", "right-coronary-distal"] },
  { question: "What are the D1 and D2 diagonal branches?", requiredIds: ["left-diagonal-d1", "left-diagonal-d2"] },
  { question: "What determines coronary dominance?", requiredIds: ["posterior-descending-artery"] },
  { question: "What does the proximal LAD supply?", requiredIds: ["left-anterior-descending-proximal"] },
  { question: "What is the role of the left circumflex artery?", requiredIds: ["left-circumflex-artery"] },
  { question: "Where does the coronary sinus drain?", requiredIds: ["coronary-sinus"] },
  { question: "What is the function of the ascending aorta?", requiredIds: ["ascending-aorta"] },
  { question: "How are the RCA and PDA anatomically related?", requiredIds: [] },
  { question: "What is the difference between LAD and LCx blood supply?", requiredIds: [] },
  { question: "What are the first and second diagonal branches?", requiredIds: [] },
  { question: "How does coronary artery disease affect myocardial perfusion?", requiredIds: [] },
  { question: "What anatomical variations may affect coronary angiography?", requiredIds: [] },
  { question: "unmatchedxyz lunarbotany", requiredIds: [], negative: true },
  { question: "What antibiotic dose treats pneumonia?", requiredIds: [], negative: true },
  { question: "What is the RCA quantum molecular mechanism?", requiredIds: [], negative: true },
];
const results = [];
for (const c of cases) {
  const passages = await provider.retrieve({ question: c.question, selectedStructureId: null }, AbortSignal.timeout(5000));
  results.push({ ...c, passages, support: evaluateSupport(passages, c.requiredIds), routingCovered: c.requiredIds.length ? c.requiredIds.every(id => passages.some(p => p.source.structureIds.includes(id))) : null });
}
const report = { mode, collectionId: collectionId ?? (mode === "--candidate" ? "replacement-2026-10-11" : null), network: false, documents: new Set(corpus.map(d => d.source.teachingDocumentId ?? d.source.id)).size, passageUnits: corpus.length, scientificEvidenceEstablished: false, routingCovered: results.filter(r => r.routingCovered).length, positiveCases: results.filter(r => !r.negative).length, results };
if (process.argv.includes("--write-report")) {
  const label = mode.slice(2);
  await fs.writeFile(`docs/retrieval-evaluation-${label}.json`, JSON.stringify(report, null, 2) + "\n");
  await fs.writeFile(`docs/retrieval-evaluation-${label}.md`, `# Local retrieval evaluation: ${label}\n\nNo network or LLM calls. Documents: ${report.documents}; passage units: ${corpus.length}. Routing coverage: ${report.routingCovered}/${report.positiveCases}. Scientific evidence established: **no**. Synthetic results test routing only; approved results reflect only eligible local files. Scores describe lexical and offline concept relevance, not confidence.\n\n` + results.map(r => `## ${r.question}\n\nStatus: ${r.support.status}. ${r.support.explanation}\nMissing required IDs: ${r.support.missingStructureIds.join(", ") || "none"}.\n\n` + (r.passages.map(p => `- ${p.source.id} — ${p.source.title}; URL: ${p.source.url ?? "none (synthetic)"}; section: ${p.source.section}; version: ${p.source.documentVersion}; score: ${p.score.toFixed(3)}; text matches: ${p.relevance.textMatches.join(", ")}; metadata matches: ${p.relevance.metadataMatches.join(", ")}.${p.source.teachingDocumentId ? ` Teaching document: ${p.source.teachingDocumentId} v${p.source.teachingDocumentVersion}; ${p.source.anatomyPattern}; ${p.source.domain}.` : ""}\n\n  > ${p.text.replaceAll("\n", "\n  > ")}\n`).join("\n") || "No retrieved passages.\n")).join("\n"));
}
console.log(JSON.stringify(report, null, 2));
