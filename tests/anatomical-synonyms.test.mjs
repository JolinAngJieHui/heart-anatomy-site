import assert from "node:assert/strict";
import fs from "node:fs";
import { test } from "node:test";
import { load } from "./helpers/load-module.mjs";
const { HEART_PARTS } = load("lib/heart-parts.ts");
const { ANATOMICAL_SYNONYMS, WHOLE_VESSEL_SYNONYMS } = load("lib/knowledge-base/anatomical-synonyms.ts");
const { resolveAnatomicalTerms, canonicalText } = load("lib/tutor/terminology.ts");
const { LocalRetrievalProvider, syntheticToLocal, terminology } = load("lib/tutor/retrieval.ts");
const provider = new LocalRetrievalProvider(syntheticToLocal(JSON.parse(fs.readFileSync("tests/fixtures/knowledge-base/retrieval-evaluation.json", "utf8"))));
test("every alias resolves to its existing stable ID without changing canonical labels", async () => {
  assert.deepEqual(Object.keys(ANATOMICAL_SYNONYMS), HEART_PARTS.map(p => p.id));
  for (const part of HEART_PARTS) for (const alias of [...ANATOMICAL_SYNONYMS[part.id].aliases, part.name, part.id, part.shortName]) {
    const parsed = resolveAnatomicalTerms(alias);
    assert.equal(parsed.matches.length, 1, alias);
    assert.equal(parsed.matches[0].kind, "structure", alias);
    assert.deepEqual(parsed.matches[0].structureIds, [part.id], alias);
    assert.deepEqual(parsed.matches[0].canonicalNames, [part.name], alias);
    const passages = await provider.retrieve({ question: `Explain ${alias}`, selectedStructureId: null }, AbortSignal.timeout(5000));
    assert.ok(passages[0].source.structureIds.includes(part.id), alias);
  }
});
test("whole RCA/LAD remain whole-vessel concepts; segment aliases stay specific", () => {
  for (const whole of WHOLE_VESSEL_SYNONYMS) for (const alias of whole.aliases) {
    const match = resolveAnatomicalTerms(alias).matches[0];
    assert.equal(match.kind, "whole-vessel"); assert.deepEqual(match.structureIds, whole.structureIds);
  }
  for (const alias of ["pRCA", "mRCA", "dRCA", "pLAD", "mLAD", "apical LAD"]) assert.equal(resolveAnatomicalTerms(alias).matches[0].structureIds.length, 1);
  assert.equal(resolveAnatomicalTerms("distal LAD").matches[0].usable, false);
  assert.deepEqual(resolveAnatomicalTerms("distal LAD").matches[0].structureIds, []);
  assert.notEqual(canonicalText("distal LAD"), canonicalText("apical LAD"));
});
test("PDA origins and conditional conus origin are preserved rather than flattened", async () => {
  for (const [alias, qualifier] of [["R-PDA", "rca-origin"], ["L-PDA", "lcx-origin"]]) {
    const m = resolveAnatomicalTerms(alias).matches[0]; assert.deepEqual(m.structureIds, ["posterior-descending-artery"]); assert.equal(m.qualifier, qualifier);
  }
  assert.notEqual(canonicalText("R-PDA"), canonicalText("L-PDA"));
  assert.notEqual(canonicalText("R-PDA"), canonicalText("PDA"));
  assert.equal(resolveAnatomicalTerms("third coronary artery").matches[0].usable, false);
  assert.equal(resolveAnatomicalTerms("third coronary artery", { separateConusOriginConfirmed: true }).matches[0].usable, true);
  assert.notEqual(canonicalText("third coronary artery"), canonicalText("conus branch"));
  assert.deepEqual(await provider.retrieve({ question: "third coronary artery", selectedStructureId: null }, AbortSignal.timeout(5000)), []);
});
test("numbered OM branches and ambiguous AM pronoun never become unconditional vessel links", () => {
  for (const label of ["OM1", "OM2", "first obtuse marginal branch", "second obtuse marginal artery"]) assert.deepEqual(resolveAnatomicalTerms(label).matches[0].structureIds, []);
  assert.deepEqual(resolveAnatomicalTerms("I am learning").matches, []);
  assert.deepEqual(resolveAnatomicalTerms("AM").matches[0].structureIds, ["right-marginal-artery"]);
  assert.deepEqual(resolveAnatomicalTerms("scsinusprca").matches, []);
});
test("case, punctuation, multiple terms and managed-search normalization preserve intent", async () => {
  for (const alias of ["prca", "PRCA", "mid—RCA", "MID-LAD"]) assert.ok(resolveAnatomicalTerms(alias).matches[0].usable);
  assert.equal(resolveAnatomicalTerms("Compare pRCA and dRCA").matches.length, 2);
  const query = { question: "What does pRCA supply?", selectedStructureId: "left-anterior-descending-proximal" };
  assert.match(terminology(query), /rca proximal/);
  assert.ok((await provider.retrieve(query, AbortSignal.timeout(5000)))[0].source.structureIds.includes("right-coronary-proximal"));
});
