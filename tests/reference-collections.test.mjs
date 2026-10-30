import assert from "node:assert/strict";
import { test } from "node:test";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { loadTypeScript } from "../scripts/load-typescript.mjs";
const { buildCollection, stageCollection, activateCollection } = loadTypeScript("lib/knowledge-base/collections.ts");
const { validateRegistry, externalIndexingAllowed } = loadTypeScript("lib/knowledge-base/registry.ts");
const { prepareAvailableDocuments, sha256 } = loadTypeScript("lib/knowledge-base/documents.ts");
const { LocalRetrievalProvider, preparedToLocal } = loadTypeScript("lib/tutor/retrieval.ts");
const options = { id: "test-only-collection", reviewer: "TEST ONLY reviewer", date: "2026-10-11" };
const url = "https://example.org/test-only-reference";
const entry = { url, categories: ["TEST ONLY RCA filing category"], structureIds: ["right-coronary-proximal"] };
const metadata = { url, title: "TEST ONLY synthetic semantic routing text", authors: ["TEST ONLY"], publicationYear: 2026, doi: "10.test/only", publicationDetails: "TEST ONLY", identityVerified: true, access: "test-only", verificationUrl: url, license: "TEST ONLY CC BY", licenseUrl: "https://creativecommons.org/licenses/by/4.0/", articleType: "case-report", text: "## TEST ONLY section\n\nTEST ONLY: oxygen delivery in the fictional violet pump changes during reduced blood flow. This is an individual case, not normal anatomy.", sections: ["TEST ONLY section"], issues: [] };
async function workspace(t) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "heart-collection-test-"));
  t.after(async () => { assert.ok(path.basename(root).startsWith("heart-collection-test-")); await fs.rm(root, { recursive: true, force: true }); });
  const legacy = JSON.parse(await fs.readFile("knowledge-base/reference-template.json", "utf8"));
  await fs.writeFile(path.join(root, "registry.json"), JSON.stringify([{ ...legacy, id: "test-only-archived-original", title: "TEST ONLY legacy original" }]) + "\n");
  await fs.writeFile(path.join(root, "index-manifest.json"), JSON.stringify({ vectorStoreId: null, documents: [] }));
  return root;
}
test("bulk registration deduplicates URL and DOI, unions categories and retains all original URLs", () => {
  const secondUrl = "https://example.org/test-only-mirror";
  const built = buildCollection([entry, { ...entry, url: url + "/" }, { ...entry, url: secondUrl, categories: ["TEST ONLY LCx category"], structureIds: ["left-circumflex-artery"] }], [metadata, { ...metadata, url: secondUrl }], [], options);
  assert.equal(built.records.length, 1); assert.equal(built.summary.duplicatesRemoved, 2);
  assert.equal(built.records[0].collection.categories.length, 2);
  assert.equal(built.records[0].collection.originalUrls.length, 3);
  assert.deepEqual(built.records[0].structureIds, ["right-coronary-proximal", "left-circumflex-artery"]);
  assert.ok(built.records[0].collection.issues.some(issue => issue.includes("Case report")));
  assert.equal(externalIndexingAllowed(built.records[0]), false);
});
test("scientific approval remains separate from extraction, missing metadata and reuse permission", () => {
  for (const patch of [{ identityVerified: false }, { text: null }, { licenseUrl: null }, { licenseUrl: "https://creativecommons.org/licenses/by-nc/4.0/" }]) {
    const { records, files } = buildCollection([entry], [{ ...metadata, ...patch, publicationYear: null, authors: [] }], [], options);
    assert.equal(validateRegistry(records)[0].status, "approved");
    assert.equal(records[0].collection.contentStatus, "metadata-only"); assert.equal(records[0].approvedSha256, null);
    assert.equal(files.length, 0); assert.equal(externalIndexingAllowed(records[0]), false);
  }
  assert.throws(() => buildCollection([entry], [metadata], [], { ...options, reviewer: "" }));
  assert.throws(() => validateRegistry([{ ...buildCollection([entry], [metadata], [], options).records[0], sourceType: "educational-summary" }]), /original/);
  assert.equal(buildCollection([{ url: "file:///secret" }], [], [], options).summary.invalid.length, 1);
  const partial = buildCollection([entry, { ...entry, url: url + "-invalid", structureIds: ["invented-vessel"] }], [metadata], [], options);
  assert.equal(partial.records.length, 1); assert.equal(partial.summary.invalid.length, 1);
  const malformedMetadata = buildCollection([entry], [{ ...metadata, text: 42 }], [], options);
  assert.equal(malformedMetadata.records[0].collection.contentStatus, "metadata-only");
});
test("automatic content versions are stable and change when extracted bytes change", () => {
  const first = buildCollection([entry], [metadata], [], options);
  assert.equal(first.records[0].documentVersion, buildCollection([entry], [metadata], [], options).records[0].documentVersion);
  assert.notEqual(first.records[0].documentVersion, buildCollection([entry], [{ ...metadata, text: metadata.text + "\nDifferent TEST ONLY bytes." }], [], options).records[0].documentVersion);
  assert.equal(first.records[0].approvedSha256, sha256(first.files[0].text));
});
test("staging leaves active registry intact; activation requires confirmation, archives old records, excludes old corpus", async t => {
  const root = await workspace(t);
  const before = await fs.readFile(path.join(root, "registry.json"), "utf8");
  const report = await stageCollection(root, [entry], [metadata], options);
  assert.equal(await fs.readFile(path.join(root, "registry.json"), "utf8"), before);
  await assert.rejects(activateCollection(root, options.id, false), /confirmation/);
  const result = await activateCollection(root, options.id, true);
  assert.equal(await fs.readFile(path.join(result.archive, "registry.json"), "utf8"), before);
  const records = JSON.parse(await fs.readFile(path.join(root, "registry.json"), "utf8"));
  assert.deepEqual(records.map(r => r.id), report.added);
  assert.ok(report.archived.includes("test-only-archived-original"));
  assert.ok(!records.some(r => r.id === "test-only-archived-original"));
  await assert.rejects(stageCollection(root, [entry], [metadata], options), /fresh collection ID/);
  const { documents } = await prepareAvailableDocuments(records, root);
  const local = preparedToLocal(documents);
  assert.equal(local[0].source.section, "TEST ONLY section");
  assert.equal(local[0].source.url, url); assert.equal(local[0].source.title, metadata.title);
  assert.equal(local[0].text.includes("License:"), false);
});
test("changed or unavailable content fails closed per document and blocks stale collection activation", async t => {
  const root = await workspace(t);
  await stageCollection(root, [entry, { ...entry, url: url + "-unavailable" }], [metadata], options);
  const filename = path.join(root, "collections", options.id, "registry.json");
  const records = JSON.parse(await fs.readFile(filename, "utf8"));
  let readiness = await prepareAvailableDocuments(records, root);
  assert.equal(readiness.documents.length, 1); assert.equal(readiness.excluded.length, 1);
  await fs.writeFile(path.join(root, records[0].documentPath), "Changed test bytes");
  readiness = await prepareAvailableDocuments(records, root);
  assert.equal(readiness.documents.length, 0); assert.equal(readiness.excluded.length, 2);
  await assert.rejects(activateCollection(root, options.id, true), /changed or unavailable/);
});
test("global semantic concept search retrieves across a different selected vessel; exact duplicate passages collapse", async () => {
  const source = { id: "synthetic-concept", title: "SYNTHETIC TEST ONLY", url: null, section: "Fictional section", structureIds: ["right-coronary-proximal"], documentVersion: "1", materialKind: "synthetic" };
  const document = { source, text: "SYNTHETIC TEST ONLY: Oxygen delivery follows perfusion through the fictional violet pump." };
  const provider = new LocalRetrievalProvider([document, document]);
  const passages = await provider.retrieve({ question: "blood supply", selectedStructureId: "coronary-sinus" }, AbortSignal.timeout(5000));
  assert.equal(passages.length, 1); assert.equal(passages[0].source.id, source.id);
  assert.ok(passages[0].relevance.semanticMatches.includes("perfusion"));
  assert.deepEqual(await provider.retrieve({ question: "lunarbotany unmatchedxyz", selectedStructureId: "right-coronary-proximal" }, AbortSignal.timeout(5000)), []);
});
test("overlapping character chunks are deduplicated at their exact repeated boundary", async () => {
  const source = { id: "synthetic-overlap", title: "SYNTHETIC TEST ONLY", url: null, section: "Fictional long section", structureIds: ["right-coronary-proximal"], documentVersion: "1", materialKind: "synthetic" };
  const text = "SYNTHETIC TEST ONLY: blood supply of fictional violet pump. " + Array.from({ length: 260 }, (_, i) => `token${i}`).join(" ") + " blood supply";
  const provider = new LocalRetrievalProvider([{ source, text }]);
  const passages = await provider.retrieve({ question: "blood supply", selectedStructureId: null }, AbortSignal.timeout(5000));
  for (const first of passages) for (const second of passages) if (first.id !== second.id) assert.ok(!first.text.endsWith(second.text.slice(0, 80)));
});
test("real staged import has 77 original sources, excludes legacy notes and all external uploads", async () => {
  const records = validateRegistry(JSON.parse(await fs.readFile("knowledge-base/collections/replacement-2026-10-11/registry.json", "utf8")));
  assert.equal(records.length, 77); assert.equal(records.filter(r => r.teachingNote).length, 0);
  assert.ok(records.every(r => r.status === "approved" && !externalIndexingAllowed(r)));
  let historicalRoot = path.resolve("knowledge-base");
  try { const active = JSON.parse(await fs.readFile("knowledge-base/active-collection.json", "utf8")); if (active.rollback) historicalRoot = path.join(historicalRoot, active.rollback, "documents"); } catch (error) { if (error.code !== "ENOENT") throw error; }
  const { documents, excluded } = await prepareAvailableDocuments(records, historicalRoot);
  assert.equal(documents.length, 27); assert.equal(excluded.length, 50);
  const corpus = preparedToLocal(documents), provider = new LocalRetrievalProvider(corpus);
  const passages = await provider.retrieve({ question: "What determines coronary dominance?", selectedStructureId: "superior-vena-cava", expandRelatedVessels: true }, AbortSignal.timeout(5000));
  assert.ok(passages.some(p => p.source.id === "pmc12060931" && /dominance/i.test(p.text)));
  assert.ok(passages.every(p => records.some(r => r.id === p.source.id && r.location === p.source.url)));
  assert.ok(passages.every(p => !p.source.teachingDocumentId));
});
