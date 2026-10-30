import fs from "node:fs/promises";
import path from "node:path";
import OpenAI, { toFile } from "openai";
import { loadTypeScript } from "./load-typescript.mjs";
const root = path.resolve("knowledge-base"), id = "minimal-2026-10-14";
const { loadMinimalCorpus, readMinimalSelection } = loadTypeScript("lib/knowledge-base/minimal.ts");
const { sha256, matchesIndex, validateManifest } = loadTypeScript("lib/knowledge-base/documents.ts");
const { chunkDocument } = loadTypeScript("lib/tutor/retrieval.ts");
const command = process.argv[2] ?? "status";
const collection = path.join(root, "collections", id), activePath = path.join(root, "active-collection.json");
const json = async filename => JSON.parse(await fs.readFile(filename, "utf8"));
const write = async (filename, value) => { const temporary = filename + ".tmp"; await fs.writeFile(temporary, JSON.stringify(value, null, 2) + "\n"); await fs.rename(temporary, filename); };
const bounded = relative => { const target = path.resolve(root, relative), r = path.relative(root, target); if (!r || r.startsWith("..") || path.isAbsolute(r)) throw new Error("Path outside knowledge base"); return target; };
if (!["status", "validate", "activate-review", "rollback", "index-review", "approve"].includes(command)) throw new Error("Use status, validate, activate-review, rollback, index-review or approve");

if (command === "rollback") {
  const active = readMinimalSelection(root);
  if (!active) throw new Error("No minimal collection to roll back");
  const backup = bounded(active.rollback), record = await json(path.join(backup, "rollback.json"));
  for (const filename of record.documents) {
    const destination = bounded(filename);
    try { await fs.access(destination); throw new Error("Rollback destination exists; inspect before restoring"); } catch (e) { if (e.code !== "ENOENT") throw e; }
    await fs.mkdir(path.dirname(destination), { recursive: true }); await fs.copyFile(path.join(backup, "documents", filename), destination);
  }
  await fs.copyFile(path.join(backup, "registry.json"), path.join(root, "registry.json"));
  await fs.copyFile(path.join(backup, "index-manifest.json"), path.join(root, "index-manifest.json"));
  if (record.previousSelection) await write(activePath, record.previousSelection); else await fs.unlink(activePath);
  console.log("Previous registry/index restored locally. New collection and all remote resources retained.");
} else {
  const corpus = await loadMinimalCorpus(root, id);
  const chunks = corpus.corpus.flatMap(chunkDocument);
  if (command === "approve") {
    // Explicit scientific approval only; never inferred from licence or upload authorisation.
    const args = process.argv.slice(3), get = flag => args[args.indexOf(flag) + 1];
    const { validateRegistry, validDate } = loadTypeScript("lib/knowledge-base/registry.ts");
    const reviewer = get("--reviewer"), date = get("--date"), ids = (get("--sources") ?? "").split(",");
    if (!args.includes("--scientifically-reviewed") || !reviewer?.trim() || !validDate(date) || !ids.length || ids.some(key => !corpus.records.some(r => r.id === key))) throw new Error("Actual scientific review, reviewer/date and explicit source IDs are required");
    const next = corpus.records.map(r => ids.includes(r.id) ? { ...r, status: "approved", approvedBy: reviewer, approvalDate: date, approvedVersion: r.documentVersion, approvedSha256: r.extraction.sha256, documentPath: r.documentPath.replace("pending_review/", "approved/") } : r);
    validateRegistry(next);
    if (args.includes("--apply")) {
      for (const r of next.filter(r => ids.includes(r.id))) { const target = bounded(r.documentPath); await fs.mkdir(path.dirname(target), { recursive: true }); await fs.copyFile(bounded(corpus.records.find(s => s.id === r.id).documentPath), target); }
      await write(path.join(collection, "registry.json"), next);
      const selection = readMinimalSelection(root);
      if (selection?.id === id) { const fresh = await loadMinimalCorpus(root, id); await write(path.join(root, "registry.json"), fresh.records); await write(activePath, { ...selection, registrySha256: fresh.registrySha256, collectionVersion: fresh.collectionVersion }); }
    }
    console.log(JSON.stringify({ mode: args.includes("--apply") ? "SCIENTIFIC REVIEW RECORDED" : "PREVIEW ONLY", sources: ids }));
  } else if (command === "activate-review") {
    if (!corpus.documents.length || corpus.documents.length !== 11 || chunks.length === 0) throw new Error("Cannot activate an empty, unavailable or incomplete local corpus");
    if (!process.argv.includes("--confirm")) throw new Error("Use --confirm for this authorised local replacement");
    const old = readMinimalSelection(root);
    if (old?.id === id && old.collectionVersion === corpus.collectionVersion) { console.log("Already active; no duplicate backup or mutation."); process.exit(0); }
    const oldBytes = await fs.readFile(path.join(root, "registry.json")), oldRegistry = JSON.parse(oldBytes);
    const rollback = `archive/${id}-${sha256(oldBytes).slice(0, 12)}`, backup = bounded(rollback);
    await fs.mkdir(backup, { recursive: true });
    await fs.writeFile(path.join(backup, "registry.json"), oldBytes);
    await fs.copyFile(path.join(root, "index-manifest.json"), path.join(backup, "index-manifest.json"));
    const documents = oldRegistry.filter(r => r.documentPath).map(r => r.documentPath);
    // Archive only files referenced by the previous active registry. No globs/deletes.
    for (const filename of documents) { const origin = bounded(filename), target = path.join(backup, "documents", filename); await fs.mkdir(path.dirname(target), { recursive: true }); await fs.copyFile(origin, target); }
    await write(path.join(backup, "rollback.json"), { previousSelection: old, documents });
    const localIndex = { collectionId: id, collectionVersion: corpus.collectionVersion, method: "existing deterministic paragraph/concept retrieval; no neural embeddings", documents: corpus.documents.map(d => ({ sourceId: d.source.id, hash: d.hash, documentVersion: d.version, passages: chunks.filter(p => p.source.id === d.source.id).map(p => ({ id: p.id, section: p.source.section })) })) };
    await write(path.join(collection, "local-index.json"), localIndex);
    await fs.copyFile(path.join(collection, "registry.json"), path.join(root, "registry.json"));
    await write(path.join(root, "index-manifest.json"), { vectorStoreId: null, documents: [] });
    await write(activePath, { id, mode: "review", registryPath: `collections/${id}/registry.json`, registrySha256: corpus.registrySha256, collectionVersion: corpus.collectionVersion, rollback });
    for (const filename of documents) if (!corpus.records.some(r => r.documentPath === filename)) await fs.unlink(bounded(filename));
    await write(path.join(collection, "activation.json"), { activatedAt: new Date().toISOString(), localOnly: true, mode: "development-review", rollback, collectionVersion: corpus.collectionVersion, sources: 11, passages: chunks.length });
    console.log(JSON.stringify({ active: id, mode: "development-review", rollback, passages: chunks.length, remoteUploads: 0 }));
  } else if (command === "index-review") {
    const manifestPath = path.join(collection, "review-index-manifest.json");
    let manifest; try { manifest = validateManifest(await json(manifestPath)); } catch (e) { if (e.code !== "ENOENT") throw e; manifest = { vectorStoreId: null, documents: [] }; }
    const eligible = corpus.documents.filter(d => d.source.externalIndexingPermission?.cleared && d.source.licenseConfirmed);
    const changed = eligible.filter(d => !manifest.documents.some(entry => matchesIndex(d, entry)));
    console.log(JSON.stringify({ mode: process.argv.includes("--apply") ? "AUTHORISED TEXT-ONLY REVIEW UPLOAD / BILLABLE" : "DRY RUN / NO NETWORK", eligible: eligible.map(d => d.source.id), changed: changed.map(d => d.source.id), scientificReview: "pending records remain pending; this is not a production index" }));
    if (!process.argv.includes("--apply")) process.exit(0);
    if (!process.env.OPENAI_API_KEY) throw new Error("OPENAI_API_KEY missing; nothing uploaded");
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY, maxRetries: 0, timeout: 60000 });
    if (!manifest.vectorStoreId) { manifest.vectorStoreId = (await client.vectorStores.create({ name: `Development review ${id}` })).id; await write(manifestPath, manifest); }
    for (const d of changed) {
      const file = await client.files.create({ file: await toFile(d.bytes, path.basename(d.source.documentPath)), purpose: "assistants" });
      const indexed = await client.vectorStores.files.createAndPoll(manifest.vectorStoreId, { file_id: file.id, attributes: { source_id: d.source.id, collection_id: id, version: d.hash, document_version: d.version, metadata_hash: d.metadataHash, review_status: d.source.status } }, { pollIntervalMs: 1000, signal: AbortSignal.timeout(300000) });
      if (indexed.status !== "completed") throw new Error(`Indexing failed: ${d.source.id}; inspect remote file ${file.id}`);
      manifest.documents = manifest.documents.filter(e => e.sourceId !== d.source.id).concat({ sourceId: d.source.id, fileId: file.id, hash: d.hash, documentVersion: d.version, metadataHash: d.metadataHash });
      await write(manifestPath, manifest);
    }
    const probes=[];
    for (const d of eligible) {
      const search=await client.vectorStores.search(manifest.vectorStoreId,{query:d.source.title,max_num_results:2,filters:{type:"and",filters:[{type:"eq",key:"collection_id",value:id},{type:"eq",key:"source_id",value:d.source.id}]} });
      probes.push({sourceId:d.source.id,results:search.data.map(r=>({fileId:r.file_id,score:r.score,content:r.content})),pass:search.data.some(r=>manifest.documents.some(e=>e.sourceId===d.source.id&&e.fileId===r.file_id)&&r.content.some(c=>c.type==='text'&&c.text.length>=80))});
    }
    await write(path.join(collection,"remote-search-verification.json"),{collectionVersion:corpus.collectionVersion,results:probes});
    if(probes.some(p=>!p.pass))throw new Error("Remote source search probe failed; review index must not be activated");
    console.log(JSON.stringify({vectorStoreId:manifest.vectorStoreId,searchTested:probes.length,productionApproved:false}));
  } else console.log(JSON.stringify({ id, active: readMinimalSelection(root)?.id === id, sources: corpus.records.length, extracted: corpus.documents.length, passages: chunks.length, collectionVersion: corpus.collectionVersion, scientificStatuses: [...new Set(corpus.records.map(r => r.status))], sourceIDs: corpus.records.map(r => r.id) }, null, 2));
}
