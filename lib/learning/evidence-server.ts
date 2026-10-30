import path from "node:path";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { HEART_PARTS } from "../heart-parts";
import { chunkDocument, preparedToLocal, LocalRetrievalProvider } from "../tutor/retrieval";
import { resolveAnatomicalTerms } from "../tutor/terminology";
import { ordinaryTeachingPassage, type EvidenceCatalogue, type LearningPassage } from "./evidence";
import { loadMinimalCorpus, readMinimalSelection } from "../knowledge-base/minimal";
import { externalIndexingAllowed } from "../knowledge-base/registry";
import { ragSettings } from "../tutor/evidence-budget";

let cached: { key:string; value:Promise<EvidenceCatalogue> } | undefined;
/** Hash the active registry and exact local bytes before reusing a prepared catalogue.
 * A changed approval, licence, collection or document invalidates the cache. */
export async function loadLearningEvidence(): Promise<EvidenceCatalogue> {
  const root=path.resolve(process.cwd(),"knowledge-base");
  const selectionBytes=readFileSync(path.join(root,"active-collection.json"));
  const selection=JSON.parse(selectionBytes.toString("utf8"));
  const read=(relative:string)=>{ const target=path.resolve(root,relative); if(!target.startsWith(root+path.sep))throw Error("Invalid collection path"); return readFileSync(target); };
  const registry=read(selection.registryPath);
  const hash=createHash("sha256").update(root).update(process.env.NODE_ENV??"").update(selectionBytes).update(registry);
  // The collection loader also checks the root registry agreement.
  hash.update(read("registry.json"));
  for(const record of JSON.parse(registry.toString("utf8"))) if(record.documentPath)hash.update(read(record.documentPath));
  const key=hash.digest("hex");
  if(cached?.key===key)return cached.value;
  const value=buildLearningEvidence(); cached={key,value};
  try{return await value;}catch(error){if(cached?.value===value)cached=undefined;throw error;}
}
/** Only local byte-validated approved references. No provider or network call. */
async function buildLearningEvidence(): Promise<EvidenceCatalogue> {
  const root = path.resolve(process.cwd(), "knowledge-base");
  const minimal = readMinimalSelection(root) ? await loadMinimalCorpus(root, undefined, process.env.NODE_ENV === "production") : null;
  if (!minimal) throw Error("No authoritative reference collection selected");
  const registry = minimal.records, available = minimal;
  const documents = available.documents.filter(d => !d.source.documentPath?.endsWith(".pdf"));
  const corpus = preparedToLocal(documents);
  const provider = new LocalRetrievalProvider(corpus);
  const chunks = corpus.flatMap(chunkDocument);
  const passages: LearningPassage[] = [];
  const gaps: EvidenceCatalogue["gaps"] = [];
  for (const part of HEART_PARTS) {
    const ranked = await provider.retrieve({ question: `Where is ${part.name} located?`, selectedStructureId: part.id }, AbortSignal.timeout(5000));
    const order = new Map(ranked.map((p, i) => [p.id, i]));
    const eligible = chunks.flatMap(p => {
      if (!p.source.url || p.source.materialKind !== "reference") return [];
      // Keep whole-vessel evidence for synthesis; the generation/audit contract
      // forbids deriving segment-specific claims from it.
      // Paragraph headings carry definitions for abbreviations such as CS. A
      // two-letter exclusion dropped the actual anatomy/function paragraphs.
      const match = resolveAnatomicalTerms(`${p.source.section}\n${p.text}`).matches.find(m => m.usable && m.structureIds.includes(part.id));
      if (!match) return [];
      const text = p.text.trim();
      return [{ id: p.id, structureId: part.id, text, sourceId: p.source.id, title: p.source.title, url: p.source.url, section: p.source.section, documentVersion: p.source.documentVersion,
        pattern: p.source.anatomyPattern ?? "Preserve source qualifications", domain: !ordinaryTeachingPassage(text, p.source.section, p.source.articleType, p.source.anatomyPattern) ? "clinical" as const : /\b(drain|supply|flow|blood|function)\b/i.test(text) ? "physiology" as const : "anatomy" as const,
        levels: ["basic", "intermediate", "advanced"] as LearningPassage["levels"], matchedTerm: match.term, reviewStatus: p.source.reviewStatus }];
    }).sort((a, b) => (order.get(a.id) ?? 1000) - (order.get(b.id) ?? 1000) || a.id.localeCompare(b.id));
    const distinct = eligible.filter((p, i) => eligible.findIndex(q => q.id === p.id) === i);
    passages.push(...distinct);
    if (!distinct.length) gaps.push({ structureId: part.id, reason: "No matching passage was found in the current approved local collection. This does not establish that the structure has no anatomical function." });
  }
  return { mode: registry.every(r => r.status === "approved") ? "approved-local" : "review-local", generatedAt: new Date().toISOString(), passages, gaps, quizLimits: ragSettings(),
    sources: registry.filter(r => minimal || r.status === "approved").map(r => ({ id: r.id, title: r.title, url: r.location, documentVersion: r.documentVersion, available: documents.some(d => d.source.id === r.id), reviewStatus: r.status, externalProcessingAllowed: externalIndexingAllowed(r) })) };
}
