import assert from "node:assert/strict";
import { test } from "node:test";
import fs from "node:fs/promises";
import { loadTypeScript } from "../scripts/load-typescript.mjs";
const { validateRegistry, validateReference, selectApproved } = loadTypeScript("lib/knowledge-base/registry.ts");
const { buildCoverage } = loadTypeScript("lib/knowledge-base/coverage.ts");
const { prepareReviewInventory } = loadTypeScript("lib/knowledge-base/review.ts");
const { prepareDocuments, sha256 } = loadTypeScript("lib/knowledge-base/documents.ts");
// Historical reference curation remains testable after replacement activation.
const allRecords = validateRegistry(JSON.parse(await fs.readFile("knowledge-base/collections/replacement-2026-10-11/previous-registry.json", "utf8")));
const records = allRecords.filter(r => !r.teachingNote);

test("all supplied unique URLs are registered once and remain pending with no implied approval", () => {
  assert.equal(records.length, 23);
  assert.equal(new Set(records.map(r => r.location)).size, 23);
  assert.equal(records.filter(r => r.location.includes("PMC12060931")).length, 1);
  for (const r of records) {
    assert.equal(r.status, "pending_review"); assert.equal(r.licenseConfirmed, false);
    assert.equal(r.approvedBy, null); assert.equal(r.approvedVersion, null); assert.equal(r.approvedSha256, null);
    assert.equal(r.curation.reuse.externalIndexingCleared, false);
    assert.ok(r.curation.authors.length); assert.ok(r.curation.publicationDetails);
  }
  assert.deepEqual(selectApproved(records), []);
});

test("curation rejects unknown IDs, inconsistent mappings, unsafe evidence URLs and rare cases labelled normal", () => {
  const source = records.find(r => r.id === "pmc10749686");
  for (const mutate of [
    r => { r.curation.sectionMappings[0].structureIds = ["invented-id"]; },
    r => { r.structureIds = ["coronary-sinus"]; },
    r => { r.curation.metadataEvidenceUrls = ["javascript:alert(1)"]; },
    r => { r.curation.sectionMappings[0].anatomy = "normal"; },
    r => { r.curation.sectionMappings[0].notes = "This is routine."; },
  ]) { const r = structuredClone(source); mutate(r); assert.throws(() => validateReference(r)); }
});

test("coverage preserves 17 teaching IDs and excludes rare cases, clinical studies and provisional sections from normal levels", () => {
  const coverage = buildCoverage(records);
  assert.equal(coverage.length, 17); assert.equal(new Set(coverage.map(p => p.id)).size, 17);
  assert.ok(coverage.every(p => p.supporting.length && p.gap && p.approvedSourceCount === 0));
  const variants = records.filter(r => r.curation.scope === "variant-case");
  assert.ok(buildCoverage(variants).every(p => p.candidateNormalLevels.length === 0));
  assert.ok(buildCoverage(records.filter(r => r.id === "pmc10292609")).every(p => p.candidateNormalLevels.length === 0));
  assert.ok(buildCoverage(records.filter(r => r.id === "nbk470522")).every(p => p.candidateNormalLevels.length === 0));
  assert.ok(!coverage.find(p => p.id === "superior-vena-cava").candidateNormalLevels.includes("advanced"));
  assert.match(coverage.find(p => p.id === "left-anterior-descending-apical").gap, /not automatically equivalent/);
});

test("review-only preparation hashes one attributed pending file and production preparation excludes everything", async () => {
  const plan = await prepareReviewInventory(records, "knowledge-base");
  assert.equal(plan.staged.length, 1); assert.equal(plan.staged[0].sourceId, "pmc12060931");
  assert.equal(plan.staged[0].reviewOnly, true); assert.equal(plan.staged[0].productionEligible, false);
  assert.equal(plan.excluded.length, 22); assert.equal(plan.network, false);
  assert.equal(plan.staged[0].sha256, sha256(await fs.readFile("knowledge-base/pending_review/pmc12060931.md")));
  assert.deepEqual(await prepareDocuments(records, "does-not-exist"), []);
  const source = records.find(r => r.id === "pmc12060931");
  const approval = { status: "approved", licenseConfirmed: true, documentPath: "approved/review.md", approvedBy: "Test", approvalDate: "2026-10-11", approvedVersion: "1", approvedSha256: plan.staged[0].sha256 };
  assert.equal(validateReference({ ...source, ...approval }).status, "approved"); // Local scientific approval no longer grants remote indexing.
  assert.equal(validateReference({ ...source, ...approval, curation: { ...source.curation, reuse: { ...source.curation.reuse, externalIndexingCleared: true } } }).status, "approved");
});
