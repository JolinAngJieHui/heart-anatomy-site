import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { loadTypeScript } from "./load-typescript.mjs";
import { referenceProbes } from "./rag-reference-probes.mjs";

const { loadMinimalCorpus } = loadTypeScript("lib/knowledge-base/minimal.ts");
const { chunkDocument } = loadTypeScript("lib/tutor/retrieval.ts");
const { matchesIndex, validateManifest } = loadTypeScript("lib/knowledge-base/documents.ts");
async function optionalJson(filename) {
  try { return JSON.parse(await fs.readFile(filename, "utf8")); }
  catch (error) { if (error.code === "ENOENT") return null; throw error; }
}
const duplicates = values => [...new Set(values.filter((value, i) => values.indexOf(value) !== i))];

/** Read-only, offline audit. A local manifest is never proof of remote storage. */
export async function auditRag(root = path.resolve("knowledge-base")) {
  const started = performance.now();
  const collection = await loadMinimalCorpus(root, undefined, true);
  const loadMs = performance.now() - started;
  const chunks = collection.corpus.flatMap(chunkDocument);
  const localIndex = await optionalJson(path.join(root, "collections", collection.id, "local-index.json"));
  const savedRemote = await optionalJson(path.join(root, "index-manifest.json"));
  const remote = savedRemote ? validateManifest(savedRemote) : null;
  const references = [];
  for (const source of collection.records) {
    const units = collection.corpus.filter(p => p.source.id === source.id);
    const sourceChunks = chunks.filter(p => p.source.id === source.id);
    const probe = referenceProbes.find(p => p.sourceId === source.id);
    const start = performance.now();
    const retrieved = probe ? await collection.provider.retrieve({ question: probe.question, selectedStructureId: null }, AbortSignal.timeout(5000)) : [];
    const document = collection.documents.find(d => d.source.id === source.id);
    references.push({
      id: source.id, title: source.title, url: source.location, documentPath: source.documentPath,
      approval: source.status, contentHash: document?.hash ?? null,
      scope: "selected article sections, not full text", selectedSections: source.extraction.starterSections,
      localTextAvailable: units.some(p => p.text.trim()), paragraphs: units.length, chunks: sourceChunks.length,
      textCharacters: units.reduce((n, p) => n + p.text.length, 0), emptyParagraphs: units.filter(p => !p.text.trim()).length,
      locallyEmbedded: false, supabase: "not used", remoteEmbeddingStatus: "not verified",
      // Even a matching manifest is only an inventory hint until remotely checked.
      matchingOpenAIManifestEntry: !!(document && remote?.documents.some(entry => matchesIndex(document, entry))),
      probe: { question: probe?.question ?? null, found: retrieved.some(p => p.source.id === source.id),
        direct: retrieved.some(p => p.source.id === source.id && p.relevance?.answerFit?.direct),
        elapsedMs: Math.round((performance.now() - start) * 100) / 100,
        returnedSources: [...new Set(retrieved.map(p => p.source.id))] },
    });
  }
  const issues = [];
  if (!localIndex) issues.push("No saved local index inventory. Runtime builds from validated source files.");
  else if (localIndex.collectionVersion !== collection.collectionVersion) issues.push("Saved local-index.json has an older collection version. Runtime does not read it; the current counts below are freshly computed.");
  if (!remote?.vectorStoreId || !remote.documents.length) issues.push("Legacy remote index is unconfigured and unused by the live local-retrieval pipeline; no upload or embeddings are required.");
  if (references.some(r => !r.probe.direct)) issues.push("One or more fixed natural-language source probes failed. No copied-text fallback was used.");
  const duplicateSourceIds = duplicates(collection.records.map(r => r.id));
  const duplicateDois = duplicates(collection.records.map(r => r.extraction.doi.toLowerCase()));
  const duplicatePassageIds = duplicates(chunks.map(p => p.id));
  const textGroups = new Map();
  for (const p of chunks) {
    const key = p.text.replace(/\s+/g, " ").trim();
    textGroups.set(key, [...(textGroups.get(key) ?? []), p.id]);
  }
  const duplicateTexts = [...textGroups.values()].filter(ids => ids.length > 1);
  return {
    checkedAt: new Date().toISOString(), network: false, paidApiCalls: 0,
    collectionId: collection.id, collectionVersion: collection.collectionVersion,
    localLoadMs: Math.round(loadMs * 100) / 100,
    supabase: { verified: false, schema: null, tables: null, buckets: null,
      reason: "Not used by this application, as confirmed by the owner. No database connection is needed or attempted." },
    localRetrieval: "Deterministic lexical and anatomical-concept matching; no neural embeddings",
    sourceCount: references.length, chunkCount: chunks.length, excluded: collection.excluded,
    duplicateSourceIds, duplicateDois, duplicatePassageIds, duplicateTexts,
    localChecksPassed: references.length === 11 && references.every(r => r.localTextAvailable && r.chunks && r.probe.direct)
      && !collection.excluded.length && !duplicateSourceIds.length && !duplicateDois.length && !duplicatePassageIds.length && !duplicateTexts.length,
    issues, references,
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const args = process.argv.slice(2);
  if (args.length && (args.length !== 2 || args[0] !== "--output")) throw new Error("Use npm run rag:audit [-- --output report.json]; no network calls are made.");
  const report = await auditRag();
  if (args.length) await fs.writeFile(path.resolve(args[1]), JSON.stringify(report, null, 2) + "\n");
  console.log(JSON.stringify(report, null, 2));
  if (!report.localChecksPassed) process.exitCode = 1;
}
