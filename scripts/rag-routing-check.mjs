import fs from "node:fs/promises";
import { loadTypeScript } from "./load-typescript.mjs";
const { loadMinimalCorpus } = loadTypeScript("lib/knowledge-base/minimal.ts");
const { selectEvidence, evidenceTokenCount, tokenUpperBound } = loadTypeScript("lib/tutor/evidence-budget.ts");
const collection = await loadMinimalCorpus(undefined, undefined, true);
const reports = [];
for (const question of ["What does the RCA do?", "Compare the RCA and LCx", "Where does the coronary sinus drain?", "What about its branches?", "What is the weather near the SVC?"]) {
  const query = { question, selectedStructureId: null, conversation: [{ role: "user", content: "Where does the right coronary artery arise?" }] };
  const original = await collection.provider.retrieve(query, AbortSignal.timeout(5000));
  const candidates = await collection.provider.retrieve({ ...query, maxPassages: 12 }, AbortSignal.timeout(5000));
  const selected = selectEvidence(candidates, query);
  const oldPayload = original.map(p => ({ id: p.citationId, text: p.text, section: p.source.section, anatomyPattern: p.source.anatomyPattern ?? "Preserve all qualifications in passage", title: p.source.title, cautions: p.source.cautions ?? [] }));
  reports.push({ question, previousPassages: original.length, selectedPassages: selected.length,
    previousPayloadUtf8Bytes: tokenUpperBound(oldPayload), selectedPayloadUtf8Bytes: evidenceTokenCount(selected),
    sources: [...new Set(selected.map(p => p.source.id))], selectedIds: selected.map(p => p.id),
    note: "Measured serialized evidence bytes / conservative token upper bounds. Exact model tokens and live answer quality were not measured. The old payload is reconstructed using its pre-change fields with today's unchanged approved corpus and improved question interpretation." });
}
await fs.mkdir("artifacts/rag-routing", { recursive: true });
await fs.writeFile("artifacts/rag-routing/evidence-budget.json", JSON.stringify({ paidCalls: 0, reports }, null, 2));
console.log(JSON.stringify(reports, null, 2));
