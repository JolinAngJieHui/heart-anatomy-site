import fs from "node:fs/promises";
import path from "node:path";
import OpenAI, { toFile } from "openai";
import { loadTypeScript } from "./load-typescript.mjs";
const { loadRegistry, prepareAvailableDocuments, validateManifest, planIndex, matchesIndex } = loadTypeScript("lib/knowledge-base/documents.ts");
const { externalIndexingAllowed } = loadTypeScript("lib/knowledge-base/registry.ts");

const root = path.resolve("knowledge-base");
const registry = await loadRegistry(path.join(root, "registry.json"));
const manifestPath = path.join(root, "index-manifest.json");
const manifest = validateManifest(JSON.parse(await fs.readFile(manifestPath, "utf8")));
const args = process.argv.slice(2);
const apply = args.includes("--apply");
const remove = args.includes("--remove-obsolete");
const queryIndex = args.indexOf("--search");
const readiness = await prepareAvailableDocuments(registry, root);
const eligible = readiness.documents.filter(d => externalIndexingAllowed(d.source));
const { changed: changes, obsolete } = planIndex(eligible, manifest);
console.log(JSON.stringify({ approved: eligible.length, excluded: readiness.excluded, permissionDenied: readiness.documents.filter(d => !externalIndexingAllowed(d.source)).map(d => d.source.id), uploads: changes.map(e => e.source.id), obsolete: obsolete.map(d => d.sourceId), mode: apply ? "LIVE / BILLABLE" : "DRY RUN / NO NETWORK" }, null, 2));
if (!apply) process.exit(0);
if (process.env.TUTOR_LIVE_ENABLED !== "true" || !process.env.OPENAI_API_KEY) throw new Error("Explicit billing activation and API key required");
if (!eligible.length && !remove) throw new Error("No approved documents to index");
const client = new OpenAI({ timeout: 60000, maxRetries: 0 });
const requested = process.env.OPENAI_VECTOR_STORE_ID;
if (requested && manifest.vectorStoreId && requested !== manifest.vectorStoreId) throw new Error("Store ID differs from manifest; use a separate manifest for a new store");
const persist = () => fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2) + "\n");
if (!manifest.vectorStoreId) {
  manifest.vectorStoreId = requested ?? (await client.vectorStores.create({ name: "Approved Anatomy Tutor References" })).id;
  await persist();
}
for (const entry of changes) {
  let file;
  try {
    file = await client.files.create({ file: await toFile(entry.bytes, path.basename(entry.source.documentPath)), purpose: "assistants" });
    const indexed = await client.vectorStores.files.createAndPoll(manifest.vectorStoreId, { file_id: file.id, attributes: { source_id: entry.source.id, version: entry.hash, document_version: entry.version, metadata_hash: entry.metadataHash, review_status: "approved", ...(entry.source.extraction ? { collection_id: entry.source.extraction.collectionId } : {}) } }, { pollIntervalMs: 1000, signal: AbortSignal.timeout(300000) });
    if (indexed.status !== "completed") throw new Error(`Indexing failed: ${indexed.last_error?.message ?? indexed.status}`);
    const old = manifest.documents.filter(d => d.sourceId === entry.source.id);
    // Publish the new version locally before detaching old remote versions. Old files
    // cease to be eligible immediately, even if subsequent remote removal fails.
    manifest.documents = manifest.documents.filter(d => d.sourceId !== entry.source.id);
    manifest.documents.push({ sourceId: entry.source.id, fileId: file.id, hash: entry.hash, documentVersion: entry.version, metadataHash: entry.metadataHash });
    await persist();
    for (const previous of old) await client.vectorStores.files.delete(previous.fileId, { vector_store_id: manifest.vectorStoreId });
    console.log(`Indexed ${entry.source.id}`);
  } catch (error) {
    console.error(`Indexing failed for ${entry.source.id}. Inspect remote files before retrying. ${error instanceof Error ? error.name : "Provider error"}`);
    if (file && !manifest.documents.some(d => d.fileId === file.id)) {
      try { await client.vectorStores.files.delete(file.id, { vector_store_id: manifest.vectorStoreId }); await client.files.delete(file.id); } catch { console.error("Orphan cleanup failed; review remote file inventory."); }
    }
    process.exitCode = 1;
    break;
  }
}
if (remove && !process.exitCode) {
  for (const entry of obsolete) {
    await client.vectorStores.files.delete(entry.fileId, { vector_store_id: manifest.vectorStoreId });
    manifest.documents = manifest.documents.filter(d => d.fileId !== entry.fileId);
    await persist();
  }
}
if (queryIndex >= 0 && !process.exitCode) {
  const query = args[queryIndex + 1];
  if (!query || query.length > 1200) throw new Error("A bounded educational search query is required");
  const results = await client.vectorStores.search(manifest.vectorStoreId, { query, max_num_results: 6, filters: { type: "eq", key: "review_status", value: "approved" } });
  console.log(JSON.stringify(results.data.filter(r => manifest.documents.some(entry => entry.fileId === r.file_id && eligible.some(document => matchesIndex(document, entry)))).map(r => ({ fileId: r.file_id, score: r.score })), null, 2));
}
console.log(`Vector store: ${manifest.vectorStoreId}`);
