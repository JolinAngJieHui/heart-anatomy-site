import fs from "node:fs/promises";
import { createHash } from "node:crypto";
import { loadTypeScript } from "./load-typescript.mjs";
import { loadLocalCorpus } from "./local-retrieval-corpus.mjs";
const label = process.argv[2];
if (!["before", "after"].includes(label)) throw new Error("Use before or after");
if (label === "before" && !process.argv.includes("--replace-baseline")) {
  let exists = false;
  try { await fs.access("docs/retrieval-relevance-before.json"); exists = true; }
  catch (error) { if (error.code !== "ENOENT") throw error; }
  if (exists) throw new Error("Historical baseline already exists. Use after to evaluate current code; --replace-baseline deliberately starts a new comparison.");
}
const { HEART_PARTS } = loadTypeScript("lib/heart-parts.ts");
const { LocalRetrievalProvider } = loadTypeScript("lib/tutor/retrieval.ts");
const { evaluateSupport } = loadTypeScript("lib/tutor/retrieval-evaluation.ts");
const cases = HEART_PARTS.flatMap(p => [
  { question: `What is the function of ${p.name}?`, level: "Basic", structureIds: [p.id] },
  { question: `Describe the normal anatomical course and connections of ${p.name}.`, level: "Intermediate", structureIds: [p.id] },
  { question: `How is ${p.name} evaluated with CT imaging?`, level: "Advanced", structureIds: [p.id] },
]);
cases.push(...[
  "What does the right coronary artery supply?", "What determines coronary dominance?",
  "What is the difference between proximal and distal RCA?", "What are the D1 and D2 diagonal branches?",
  "Compare the blood supply of LAD and LCx.", "How do SVC and coronary sinus drainage differ?",
  "Where does the CS empty?", "Where does pLAD arise?", "What is the course of the acute marginal artery?",
  "How does coronary artery disease impair myocardial perfusion?",
  "How is superior vena cava syndrome treated with stents?", "What are coronary sinus congenital anomalies?",
  "How is the conus branch used in PCI for chronic total occlusion?",
  "Compare normal coronary dominance with anomalous coronary origins.",
  "Does distal LAD mean exactly the same as apical LAD?",
].map(question => ({ question, level: "Mixed", structureIds: [] })));
cases.push(...["unmatchedxyz lunarbotany", "What antibiotic dose treats pneumonia?",
  "What is the RCA quantum molecular mechanism?", "What does the LAD supply on Mars?",
  "What is the price of an SVC stent?", "What is the weather near the coronary sinus?",
].map(question => ({ question, level: "Unsupported", structureIds: [], negative: true })));
const corpus = await loadLocalCorpus("--approved");
const provider = new LocalRetrievalProvider(corpus);
const results = [];
for (const c of cases) {
  const passages = await provider.retrieve({ question: c.question, selectedStructureId: null }, AbortSignal.timeout(10000));
  results.push({ ...c, passages, support: evaluateSupport(passages, c.structureIds) });
}
const registryHash = createHash("sha256").update(await fs.readFile("knowledge-base/registry.json")).digest("hex");
await fs.writeFile(`docs/retrieval-relevance-${label}.json`, JSON.stringify({ label, registryHash,
  network: false, scientificAccuracyCertified: false, cases: cases.length, documents: new Set(corpus.map(d => d.source.id)).size, results }, null, 2) + "\n");
console.log(JSON.stringify({ label, cases: cases.length, negativeQueriesWithResults: results.filter(r => r.negative && r.passages.length).length,
  ordinaryQuestionsWithResults: results.filter(r => !r.negative && r.passages.length).length }));
