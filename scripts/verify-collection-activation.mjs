import fs from "node:fs/promises";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { loadTypeScript } from "./load-typescript.mjs";
import { loadLocalCorpus } from "./local-retrieval-corpus.mjs";

// Read-only local integrity and retrievability checks; writes only its audit report.
const id = process.argv[2] ?? "replacement-2026-10-11";
assert.match(id, /^[a-z0-9][a-z0-9-]{0,79}$/);
const base = `knowledge-base/collections/${id}`;
const read = async file => JSON.parse(await fs.readFile(file, "utf8"));
const hash = bytes => createHash("sha256").update(bytes).digest("hex");
const report = await read(`${base}/report.json`);
const activation = await read(`${base}/activation.json`);
const activeBytes = await fs.readFile("knowledge-base/registry.json");
const candidateBytes = await fs.readFile(`${base}/registry.json`);
const archiveBytes = await fs.readFile(`${activation.archive}/registry.json`);
assert.equal(report.activation, "active");
assert.equal(hash(activeBytes), report.registrySha256);
assert.equal(hash(candidateBytes), report.registrySha256);
assert.equal(hash(archiveBytes), report.activeRegistrySha256);
assert.equal(hash(await fs.readFile(`${base}/previous-registry.json`)), hash(archiveBytes));
await fs.access(`${activation.archive}/index-manifest.json`);
const active = JSON.parse(activeBytes);
assert.equal(active.length, report.imported);
assert.ok(active.every(r => r.status === "approved" && r.collection.id === id));
assert.ok(report.archived.every(old => !active.some(r => r.id === old)));
assert.ok(report.retained.every(old => active.some(r => r.id === old)));
assert.ok(active.every(r => !r.externalIndexingPermission.cleared));
assert.deepEqual(await read("knowledge-base/index-manifest.json"), { vectorStoreId: null, documents: [] });
const { HEART_PARTS } = loadTypeScript("lib/heart-parts.ts");
const { LocalRetrievalProvider } = loadTypeScript("lib/tutor/retrieval.ts");
const corpus = await loadLocalCorpus("--approved");
const sourceIds = [...new Set(corpus.map(d => d.source.id))].sort();
assert.deepEqual(sourceIds, [...report.searchable].sort());
const provider = new LocalRetrievalProvider(corpus);
const probes = [];
for (const sourceId of sourceIds) {
  let probe;
  // An exact excerpt is an integrity/retrievability probe, not an educational question.
  for (const document of corpus.filter(d => d.source.id === sourceId)) {
    const question = document.text.slice(0, 900);
    const passages = await provider.retrieve({ question, selectedStructureId: null }, AbortSignal.timeout(10000));
    const match = passages.find(p => p.source.id === sourceId);
    if (match) {
      assert.ok(match.source.title && match.source.url && match.source.section && match.source.documentVersion);
      probe = { sourceId, query: question, passage: match };
      break;
    }
  }
  assert.ok(probe, `Global retrieval did not return ${sourceId}`);
  probes.push(probe);
}
const mapping = HEART_PARTS.map(part => ({ id: part.id, name: part.name,
  referenceIds: active.filter(r => r.structureIds.includes(part.id)).map(r => r.id) }));
assert.equal(mapping.length, 17);
assert.ok(mapping.every(p => p.referenceIds.length));
assert.ok(active.every(r => r.structureIds.every(id => HEART_PARTS.some(p => p.id === id))));
const result = { collectionId: id, checkedAt: new Date().toISOString(), network: false,
  registryHash: hash(activeBytes), previousRegistryHash: hash(archiveBytes), archive: activation.archive,
  approved: active.length, searchable: sourceIds.length, metadataOnly: report.metadataOnly.length,
  archivedIds: report.archived, retainedIds: report.retained, passageUnits: corpus.length,
  structureMapping: mapping, probePurpose: "Exact-excerpt global retrievability checks, not scientific sufficiency", probes };
await fs.writeFile("docs/reference-collection-activation-verification.json", JSON.stringify(result, null, 2) + "\n");
console.log(JSON.stringify({ approved: result.approved, searchable: result.searchable,
  successfulGlobalSourceProbes: probes.length, archived: result.archivedIds.length,
  structuresMapped: mapping.length, passageUnits: corpus.length, network: false }, null, 2));
