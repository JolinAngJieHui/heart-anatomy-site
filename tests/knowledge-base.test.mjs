import assert from "node:assert/strict";
import { test } from "node:test";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { loadTypeScript } from "../scripts/load-typescript.mjs";
const registry = loadTypeScript("lib/knowledge-base/registry.ts");
const documents = loadTypeScript("lib/knowledge-base/documents.ts");
const mock = loadTypeScript("lib/knowledge-base/mock.ts");
const { HEART_PARTS } = loadTypeScript("lib/heart-parts.ts");
const template = JSON.parse(await fs.readFile("knowledge-base/reference-template.json", "utf8"));
const fixture = JSON.parse(await fs.readFile("tests/fixtures/knowledge-base/synthetic.json", "utf8"));
const text = "Test-only bytes used to exercise approval integrity. Not production anatomical evidence.\n";
const approved = { ...template, id: "test-reference", institution: "Test reviewer organisation", publicationYear: 2026, edition: "Test edition", location: "https://example.org/test", documentPath: "approved/reference.md", status: "approved", approvedBy: "Test reviewer", approvalDate: "2026-10-10", approvedVersion: "1", approvedSha256: documents.sha256(text), licenseConfirmed: true, publicCitation: true };
async function workspace(t) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "heart-kb-test-"));
  t.after(async () => {
    assert.ok(path.resolve(root).startsWith(path.resolve(os.tmpdir()) + path.sep + "heart-kb-test-"));
    await fs.rm(root, { recursive: true, force: true });
  });
  await fs.mkdir(path.join(root, "approved"));
  await fs.writeFile(path.join(root, "approved/reference.md"), text);
  return root;
}
test("draft and complete approved reference metadata validate", () => {
  assert.equal(registry.validateReference(template).status, "draft");
  assert.equal(registry.validateReference(approved).status, "approved");
  assert.equal(registry.validateRegistry([]).length, 0);
});
test("malformed records, incomplete approval, invalid dates and duplicate IDs fail", () => {
  for (const patch of [{ title: "" }, { institution: null }, { publicationYear: "2026" }, { edition: null }, { sourceType: "unknown" }, { status: "unverified" }, { topics: ["unknown"] }, { approvedBy: null }, { approvalDate: "2026-02-30" }, { approvedSha256: "wrong" }, { approvedVersion: "2" }, { licenseConfirmed: false }, { publicCitation: false }, { location: "javascript:alert(1)" }, { documentPath: "approved/../secret.txt" }, { documentPath: "C:/secret.txt" }]) assert.throws(() => registry.validateReference({ ...approved, ...patch }), JSON.stringify(patch));
  assert.throws(() => registry.validateRegistry([approved, approved]), /Duplicate/);
  assert.throws(() => registry.validateRegistry({ records: [] }));
});
test("all 17 existing structure IDs map without inventing IDs", () => {
  assert.equal(HEART_PARTS.length, 17);
  for (const part of HEART_PARTS) assert.equal(registry.validateReference({ ...template, structureIds: [part.id] }).structureIds[0], part.id);
  for (const structureIds of [[], ["left-ventricle"], [HEART_PARTS[0].id, HEART_PARTS[0].id]]) assert.throws(() => registry.validateReference({ ...template, structureIds }));
});
test("only approved records are selected; drafts, pending and rejected files are never opened", async t => {
  const root = await workspace(t);
  const records = [approved, ...["draft", "pending_review", "rejected"].map(status => ({ ...template, id: status.replaceAll("_", "-"), status, documentPath: `${status}/absent.md` }))];
  assert.deepEqual(registry.selectApproved(records).map(r => r.id), [approved.id]);
  assert.equal((await documents.prepareDocuments(records, root)).length, 1);
  assert.deepEqual(await documents.prepareDocuments(records.slice(1), "does-not-exist"), []);
});
test("document byte edits and declared version edits invalidate approval", async t => {
  const root = await workspace(t);
  await fs.writeFile(path.join(root, "approved/reference.md"), text + "Edited bytes");
  await assert.rejects(documents.prepareDocuments([approved], root), /renewed approval/);
  assert.throws(() => registry.validateReference({ ...approved, documentVersion: "2" }), /stale approval/);
});
test("index plans identify new, unchanged, metadata/version updates and obsolete files", async t => {
  const root = await workspace(t);
  const [prepared] = await documents.prepareDocuments([approved], root);
  const entry = { sourceId: approved.id, fileId: "file-test", hash: prepared.hash, documentVersion: prepared.version, metadataHash: prepared.metadataHash };
  const manifest = { vectorStoreId: "vs-test", documents: [entry] };
  assert.equal(documents.planIndex([prepared], { vectorStoreId: null, documents: [] }).changed.length, 1);
  assert.equal(documents.planIndex([prepared], manifest).unchanged.length, 1);
  const [newVersion] = await documents.prepareDocuments([{ ...approved, documentVersion: "2", approvedVersion: "2" }], root);
  assert.equal(documents.planIndex([newVersion], manifest).changed.length, 1);
  const [newMetadata] = await documents.prepareDocuments([{ ...approved, section: "Another reviewed section" }], root);
  assert.equal(documents.planIndex([newMetadata], manifest).changed.length, 1);
  assert.equal(documents.planIndex([], manifest).obsolete.length, 1);
  assert.equal(documents.matchesIndex(prepared, { sourceId: approved.id, fileId: "legacy", hash: prepared.hash }), false);
  assert.equal(documents.metadataHash(approved), documents.metadataHash(Object.fromEntries(Object.entries(approved).reverse())));
  assert.throws(() => documents.validateManifest({ ...manifest, documents: [entry, entry] }));
});
test("file preparation refuses symlink escapes, missing files and malformed text/PDF", async t => {
  const root = await workspace(t);
  await assert.rejects(documents.prepareDocuments([{ ...approved, documentPath: "approved/missing.md" }], root));
  const outside = path.join(root, "outside"); await fs.mkdir(outside); await fs.writeFile(path.join(outside, "reference.md"), text);
  await fs.symlink(outside, path.join(root, "approved/linked"), "junction");
  await assert.rejects(documents.prepareDocuments([{ ...approved, documentPath: "approved/linked/reference.md" }], root), /escapes/);
  const bytes = Buffer.from([0xff, 0xfe]); await fs.writeFile(path.join(root, "approved/reference.md"), bytes);
  await assert.rejects(documents.prepareDocuments([{ ...approved, approvedSha256: documents.sha256(bytes) }], root));
  await fs.writeFile(path.join(root, "approved/not-a-pdf.pdf"), text);
  await assert.rejects(documents.prepareDocuments([{ ...approved, documentPath: "approved/not-a-pdf.pdf" }], root), /PDF/);
});
test("synthetic retrieval is deterministic, contextual, key-free and isolated from production", () => {
  const result = mock.mockRetrieve(fixture, "blue conduit", "right-coronary-proximal");
  assert.deepEqual(result, mock.mockRetrieve(fixture, "blue conduit", "right-coronary-proximal"));
  assert.equal(result.passages[0].id, "synthetic-blue-conduit"); assert.equal(result.mode, "synthetic-test-only");
  assert.equal(mock.mockRetrieve(fixture, "unmatchedphrase").passages.length, 0);
  assert.throws(() => registry.validateRegistry(fixture.documents));
  assert.throws(() => registry.validateReference({ ...approved, materialKind: "synthetic" }));
  assert.throws(() => registry.validateReference({ ...approved, id: "synthetic-blue-conduit" }));
  assert.throws(() => mock.mockRetrieve({ kind: "production", documents: [] }, "test"));
  assert.throws(() => mock.mockRetrieve(fixture, "test", "invented-id"));
});
test("repository registry and candidate inventory are valid and never implicitly approved", async () => {
  const production = await documents.loadRegistry("knowledge-base/registry.json");
  const candidates = await documents.loadRegistry("knowledge-base/draft-registry.json");
  const raw = JSON.parse(await fs.readFile("knowledge-base/registry.json", "utf8"));
  assert.deepEqual(production.map(r => [r.id, r.status]), raw.map(r => [r.id, r.status]), "Loading must preserve recorded approval status");
  const pending = production.map(r => ({ ...r, status: "pending_review", approvedBy: null, approvalDate: null, approvedVersion: null, approvedSha256: null }));
  assert.equal(registry.selectApproved(pending).length, 0);
  assert.equal(registry.selectApproved(candidates).length, 0);
  assert.equal(candidates.filter(r => r.id.startsWith("website-")).length, 17);
});
test("planning CLI and existing indexer default to no-network dry runs", async () => {
  const before = await fs.readFile("knowledge-base/index-manifest.json", "utf8");
  const records = await documents.loadRegistry("knowledge-base/registry.json");
  const ready = await documents.prepareAvailableDocuments(records, path.resolve("knowledge-base"));
  const eligible = ready.documents.filter(d => registry.externalIndexingAllowed(d.source));
  const plan = JSON.parse(execFileSync(process.execPath, ["scripts/knowledge-base.mjs", "plan"], { encoding: "utf8" }));
  assert.equal(plan.mode, "DRY RUN / NO NETWORK");
  const expected = documents.planIndex(eligible, documents.validateManifest(JSON.parse(before)));
  assert.deepEqual(plan.changed.map(d => d.id), expected.changed.map(d => d.source.id));
  const indexing = JSON.parse(execFileSync(process.execPath, ["scripts/tutor-index.mjs"], { encoding: "utf8" }));
  assert.equal(indexing.mode, "DRY RUN / NO NETWORK"); assert.equal(indexing.approved, eligible.length);
  assert.equal(await fs.readFile("knowledge-base/index-manifest.json", "utf8"), before, "Dry run must never publish an index");
});
