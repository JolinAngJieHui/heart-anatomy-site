import assert from "node:assert/strict";
import { test } from "node:test";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { loadTypeScript } from "../scripts/load-typescript.mjs";
const { loadRegistry, prepareDocuments, sha256, metadataHash } = loadTypeScript("lib/knowledge-base/documents.ts");
const { validateRegistry, validateReference, externalIndexingAllowed } = loadTypeScript("lib/knowledge-base/registry.ts");
const { renderTeachingDocument } = loadTypeScript("lib/knowledge-base/teaching.ts");
const { approveTeachingDocument } = loadTypeScript("lib/knowledge-base/approval.ts");
const { preparedToLocal, LocalRetrievalProvider, OpenAIRetrievalProvider } = loadTypeScript("lib/tutor/retrieval.ts");
const { resolveAnatomicalTerms } = loadTypeScript("lib/tutor/terminology.ts");
// Original generated-note safeguards are preserved against the historical snapshot.
const records = await loadRegistry("knowledge-base/collections/replacement-2026-10-11/previous-registry.json"), notes = records.filter(r => r.teachingNote);
const { HEART_PARTS } = loadTypeScript("lib/heart-parts.ts");
const review = (source, bytes) => ({ reviewer: "ISOLATED TECHNICAL TEST ONLY", date: "2026-10-11", expectedSha256: sha256(bytes), expectedMetadataHash: metadataHash(source), scientificReviewed: true, localReuseConfirmed: true });
test("17 teaching documents are pending, cited and byte-consistent, with evidence shared across learning levels", async () => {
  assert.equal(notes.length, 17);
  assert.deepEqual(new Set(notes.map(r => r.teachingNote.structureId)), new Set(HEART_PARTS.map(p => p.id)));
  for (const note of notes) {
    assert.equal(note.status, "pending_review"); assert.equal(note.approvedBy, null); assert.equal(externalIndexingAllowed(note), false);
    assert.equal(await fs.readFile(`knowledge-base/${note.documentPath}`, "utf8"), renderTeachingDocument(note));
    assert.ok(note.teachingNote.gaps.length);
    for (const p of note.teachingNote.passages) assert.ok(p.evidence.every(e => records.some(r => r.id === e.sourceId && r.location === e.url)));
  }
  assert.deepEqual(await prepareDocuments(records, "knowledge-base"), []);
});
test("approval requires explicit review, exact content and metadata, independently from indexing", async () => {
  const source = notes[0], bytes = Buffer.from(renderTeachingDocument(source)), valid = review(source, bytes);
  for (const patch of [{ reviewer: "" }, { date: "2026-02-30" }, { scientificReviewed: false }, { localReuseConfirmed: false }, { expectedSha256: "0".repeat(64) }, { expectedMetadataHash: "0".repeat(64) }]) assert.throws(() => approveTeachingDocument(source, bytes, { ...valid, ...patch }));
  assert.throws(() => approveTeachingDocument(source, Buffer.concat([bytes, Buffer.from("changed")]), valid));
  const approved = approveTeachingDocument(source, bytes, valid);
  assert.equal(approved.status, "approved"); assert.equal(externalIndexingAllowed(approved), false);
  assert.throws(() => validateReference({ ...approved, externalIndexingPermission: { cleared: true, reviewedBy: null, reviewedOn: null, evidence: null } }), /clearance/);
  assert.equal(externalIndexingAllowed(validateReference({ ...approved, externalIndexingPermission: { cleared: true, reviewedBy: "TEST", reviewedOn: "2026-10-11", evidence: "TEST permission evidence" } })), true);
});
test("technical approval simulation enables all 17 local targets and preserves original citation provenance", async t => {
  // Temporary clones ONLY: no repository source is approved and no scientific conclusion is tested.
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "heart-teaching-test-"));
  t.after(async () => { assert.ok(root.startsWith(path.join(os.tmpdir(), "heart-teaching-test-"))); await fs.rm(root, { recursive: true, force: true }); });
  await fs.mkdir(path.join(root, "approved"));
  const approved = [];
  for (const source of notes) {
    const bytes = Buffer.from(renderTeachingDocument(source)), clone = approveTeachingDocument(source, bytes, review(source, bytes));
    await fs.writeFile(path.join(root, clone.documentPath), bytes); approved.push(clone);
  }
  const prepared = await prepareDocuments(approved, root), local = preparedToLocal(prepared), provider = new LocalRetrievalProvider(local);
  const manifest = { vectorStoreId: "vs-isolated-test", documents: prepared.map((d, i) => ({ sourceId: d.source.id, fileId: `file-${i}`, hash: d.hash, documentVersion: d.version, metadataHash: d.metadataHash })) };
  const remote = new OpenAIRetrievalProvider({ vectorStores: { search: () => { assert.fail("Local-only approval must never call OpenAI"); } } }, manifest.vectorStoreId, prepared, manifest);
  assert.deepEqual(await remote.retrieve({ question: "RCA", selectedStructureId: null }, AbortSignal.timeout(5000)), []);
  for (const part of HEART_PARTS) {
    const passages = await provider.retrieve({ question: part.id, selectedStructureId: part.id }, AbortSignal.timeout(5000));
    assert.ok(passages.length && passages.some(p => p.source.structureIds.includes(part.id)), part.id);
    assert.ok(resolveAnatomicalTerms(passages[0].text).matches.some(m => m.usable && m.structureIds.includes(part.id)), `Top result must mention the requested structure in its body: ${part.id}`);
    for (const p of passages) {
      assert.ok(!p.text.includes("Outstanding questions")); assert.ok(p.source.teachingDocumentId);
      assert.ok(records.some(r => r.id === p.source.id && r.location === p.source.url));
      assert.ok(p.source.supportingReferences.every(e => e.section && e.publicationDetails));
    }
  }
  assert.deepEqual(await provider.retrieve({ question: "unmatchedxyz lunarbotany", selectedStructureId: null }, AbortSignal.timeout(5000)), []);
  const edited = structuredClone(approved[0]); edited.teachingNote.passages[0].text += " changed metadata";
  await assert.rejects(prepareDocuments([edited], root), /metadata and file differ/);
});
test("unknown/stale citation metadata, inappropriate structure mappings and unqualified rare cases are rejected", () => {
  for (const mutate of [r => r.teachingNote.passages[0].evidence[0].sourceId = "unknown", r => r.teachingNote.passages[0].evidence[0].url = "https://example.org/mismatch", r => r.teachingNote.passages[0].evidence[0].sourceVersion = "stale", r => r.teachingNote.passages[0].structureIds = ["coronary-sinus"], r => r.teachingNote.passages[0].pattern = "rare-anomaly"]) {
    const source = structuredClone(notes[0]); mutate(source); assert.throws(() => validateRegistry(records.map(r => r.id === source.id ? source : r)));
  }
});
