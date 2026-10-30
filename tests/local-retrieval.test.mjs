import assert from "node:assert/strict";
import { test } from "node:test";
import fs from "node:fs";
import { load } from "./helpers/load-module.mjs";
const { LocalRetrievalProvider, syntheticToLocal, preparedToLocal } = load("lib/tutor/retrieval.ts");
const { evaluateSupport } = load("lib/tutor/retrieval-evaluation.ts");
const { HEART_PARTS } = load("lib/heart-parts.ts");
const docs = syntheticToLocal(JSON.parse(fs.readFileSync("tests/fixtures/knowledge-base/retrieval-evaluation.json", "utf8")));
const provider = new LocalRetrievalProvider(docs);
const retrieve = question => provider.retrieve({ question, selectedStructureId: null }, AbortSignal.timeout(5000));
test("all 17 stable IDs and names rank their routing fixture first", async () => {
  for (const p of HEART_PARTS) for (const q of [p.id, p.name]) {
    const passages = await retrieve(q);
    assert.ok(passages[0].source.structureIds.includes(p.id), q);
    assert.equal(evaluateSupport(passages, [p.id]).sufficientScientificEvidence, false);
    assert.equal(evaluateSupport(passages).status, "synthetic-routing-only");
  }
});
test("synonyms, comparisons and dominance route without inventing anatomical answers", async () => {
  for (const [q, id] of [["first diagonal", "left-diagonal-d1"], ["second diagonal", "left-diagonal-d2"], ["acute marginal artery", "right-marginal-artery"], ["obtuse marginal branch", "left-marginal-artery"], ["superior caval vein", "superior-vena-cava"], ["conal artery", "right-conus-artery"], ["posterior interventricular artery", "posterior-descending-artery"]]) assert.ok((await retrieve(q))[0].source.structureIds.includes(id));
  for (const [q, ids] of [["proximal and distal RCA", [HEART_PARTS[0].id, HEART_PARTS[2].id]], ["D1 and D2", [HEART_PARTS[8].id, HEART_PARTS[9].id]]]) assert.deepEqual(evaluateSupport(await retrieve(q), ids).missingStructureIds, []);
  assert.ok((await retrieve("coronary dominance"))[0].source.structureIds.includes("posterior-descending-artery"));
});
test("unknown queries reject and topical but unsupported queries never establish sufficient evidence", async () => {
  assert.deepEqual(await retrieve("unmatchedxyz lunarbotany"), []);
  assert.deepEqual(await provider.retrieve({ question: "unmatchedxyz", selectedStructureId: HEART_PARTS[0].id }, AbortSignal.timeout(5000)), []);
  assert.equal(evaluateSupport(await retrieve("RCA quantum molecular mechanism")).sufficientScientificEvidence, false);
  assert.equal(evaluateSupport([]).status, "insufficient");
});
test("provenance, literal passages and reference/synthetic isolation are preserved", async () => {
  const source = { ...docs[0].source, materialKind: "reference", id: "test-only", title: "TEST ONLY", url: "https://example.org/test#section", section: "Test section; p. 2" };
  const reference = { source, text: "TEST ONLY: proximal RCA supply fictional violet fluid." };
  assert.throws(() => new LocalRetrievalProvider([docs[0], reference]), /cannot be mixed/);
  const p = (await new LocalRetrievalProvider([reference]).retrieve({ question: "proximal RCA supply", selectedStructureId: null }, AbortSignal.timeout(5000)))[0];
  assert.deepEqual(p.source, source); assert.equal(p.text, reference.text); assert.equal(p.relevance.method, "hybrid-concept-semantic");
  assert.throws(() => preparedToLocal([{ source: { documentPath: "test.pdf" } }]), /PDF extraction/);
});
