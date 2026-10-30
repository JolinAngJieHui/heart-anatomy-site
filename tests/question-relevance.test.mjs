import assert from "node:assert/strict";
import { test } from "node:test";
import { load } from "./helpers/load-module.mjs";
const { LocalRetrievalProvider } = load("lib/tutor/retrieval.ts");
const { questionProfile } = load("lib/tutor/question-relevance.ts");
const { evaluateSupport } = load("lib/tutor/retrieval-evaluation.ts");
const { resolveAnatomicalTerms, canonicalText } = load("lib/tutor/terminology.ts");
// Explicit fictional routing material, isolated from approved production documents.
const document = (id, text, extra = {}) => ({ source: { id, title: "TEST ONLY fictional routing study", url: "https://example.org/test-only/" + id,
  section: "TEST ONLY locator; page 3", documentVersion: "fixture-1", materialKind: "reference", structureIds: [], ...extra }, text: "TEST ONLY FICTIONAL ROUTING, NOT ANATOMICAL EVIDENCE. " + text });
const retrieve = (documents, question, selectedStructureId = null) => new LocalRetrievalProvider(documents).retrieve({ question, selectedStructureId }, AbortSignal.timeout(5000));

test("question domains separate anatomy, physiology, pathology, procedures and variants", () => {
  for (const [q, domain] of [["Where does LCx run?", "normal-anatomy"], ["What does RCA supply?", "physiology"],
    ["How does RCA occlusion cause ischemia?", "pathology"], ["How is SVC stenting performed?", "procedure"],
    ["What are coronary sinus congenital anomalies?", "variation"]]) assert.equal(questionProfile(q).domain, domain);
  assert.deepEqual(questionProfile("Explain conus branch").facets, []);
  assert.equal(questionProfile("How does coronary pressure affect blood flow?").domain, "physiology");
  assert.equal(questionProfile("What is the clinical significance of LAD?").domain, "pathology");
});
test("direct general descriptions outrank mentions and individual cases for ordinary questions", async () => {
  const docs = [document("mention", "The RCA was mentioned repeatedly: RCA, RCA, RCA.", { structureIds: ["right-coronary-proximal"] }),
    document("case", "Our patient had a rare anomaly. RCA supplies the fictional purple pump.", { articleType: "case-report" }),
    document("general", "Normally RCA supplies the fictional violet pump.", { articleType: "review-article" })];
  const results = await retrieve(docs, "What does RCA supply?");
  assert.equal(results[0].source.id, "general");
  assert.ok(!results.some(p => p.source.id === "mention"));
  const rare = results.find(p => p.source.id === "case");
  assert.ok(rare.relevance.answerFit.warnings.some(w => /case/i.test(w)));
  assert.equal(rare.relevance.answerFit.evidenceStrength, "weak-text-match");
});
test("clinical requests retain specialised evidence and requested modalities", async () => {
  const docs = [document("general", "Normally SVC returns fictional violet fluid."),
    document("procedure", "SVC stenting uses a fictional violet catheter.", { articleType: "case-report" }),
    document("ct", "SVC is evaluated with computed tomography imaging."), document("angiogram", "SVC is evaluated with angiography.")];
  assert.equal((await retrieve(docs, "How is SVC stenting performed?"))[0].source.id, "procedure");
  assert.deepEqual((await retrieve(docs, "How is SVC evaluated with CT imaging?")).map(p => p.source.id), ["ct"]);
});
test("global retrieval uses body evidence even when metadata files a different vessel", async () => {
  const docs = [document("global", "Normally the coronary sinus drains into the fictional violet chamber.", { structureIds: ["right-coronary-proximal"] }),
    document("tag-only", "The fictional chamber is purple.", { structureIds: ["coronary-sinus"], title: "Coronary sinus drainage" })];
  const results = await retrieve(docs, "Where does CS drain?", "superior-vena-cava");
  assert.equal(results[0].source.id, "global"); assert.equal(results.length, 1);
  assert.deepEqual(evaluateSupport(results, ["coronary-sinus"]).missingStructureIds, []);
});
test("comparisons reserve complementary passage slots and flag a missing target", async () => {
  const docs = Array.from({ length: 7 }, (_, i) => document("lad" + i, `Normally LAD supplies fictional territory${i} and its violet pump. ${Array.from({ length: 30 }, (_, j) => `uniqueword${i}token${j}`).join(" ")}.`));
  docs.push(document("lcx", "LCx supplies a fictional amber pump."));
  const results = await retrieve(docs, "Compare the blood supply of LAD and LCx.");
  assert.ok(results.some(p => p.source.id === "lcx"));
  assert.ok(results.some(p => p.source.id.startsWith("lad")));
  assert.deepEqual(evaluateSupport(results).missingComparisonTargets, []);
  assert.deepEqual(evaluateSupport(await retrieve(docs.slice(0, 7), "Compare the blood supply of LAD and LCx.")).missingComparisonTargets, ["lcx"]);
});
test("three-sided comparisons retain earlier complementary sides", async () => {
  const docs = Array.from({ length: 7 }, (_, i) => document("lad" + i, `Normally LAD supplies a fictional violet pump. ${Array.from({ length: 30 }, (_, j) => `uniqueword${i}token${j}`).join(" ")}.`));
  docs.push(document("lcx", "LCx supplies a fictional amber pump."), document("rca", "RCA supplies a fictional bronze pump."));
  const results = await retrieve(docs, "Compare the supply of LAD, LCx and RCA.");
  for (const id of ["lcx", "rca"]) assert.ok(results.some(p => p.source.id === id));
  assert.deepEqual(evaluateSupport(results).missingComparisonTargets, []);
});
test("unsupported specific requests cannot ride on a vessel match", async () => {
  const docs = [document("match", "Normally RCA supplies a fictional pump. CS is near a fictional chamber. SVC stenting uses a fictional catheter.")];
  for (const q of ["RCA quantum molecular mechanism", "What is the weather near CS?", "What is the price of an SVC stent?"])
    assert.deepEqual(await retrieve(docs, q), [], q);
});
test("shared-segment grammar and abbreviations retain anatomical distinctions", () => {
  assert.deepEqual(questionProfile("Compare proximal and distal RCA").targets, [["rca", "proximal"], ["rca", "distal"]]);
  assert.equal(resolveAnatomicalTerms("distal LAD").matches[0].usable, false);
  assert.equal(resolveAnatomicalTerms("OM1").matches[0].usable, false);
  assert.equal(resolveAnatomicalTerms("third coronary artery").matches[0].usable, false);
  assert.notEqual(canonicalText("R-PDA"), canonicalText("L-PDA"));
  assert.equal(canonicalText("computed tomography"), canonicalText("CT"));
  assert.equal(canonicalText("percutaneous coronary intervention"), canonicalText("PCI"));
});
test("segment words attached to another vessel cannot establish a segment match", async () => {
  assert.deepEqual(await retrieve([document("wrong-segment", "Proximal LAD supplies a fictional violet pump; distal RCA supplies a fictional amber pump.")], "What does proximal RCA supply?"), []);
});
test("individual occlusion observations do not answer ordinary anatomy questions", async () => {
  const docs = [document("patient", "Our patient had a first diagonal branch occlusion and distal RCA infarction. The supplied fictional purple pump was assessed by CT.", { articleType: "case-report" })];
  assert.deepEqual(await retrieve(docs, "What are the D1 and D2 diagonal branches?"), []);
  assert.deepEqual(await retrieve(docs, "What is the function of distal RCA?"), []);
});
test("a whole-vessel mention does not certify segment-specific coverage", async () => {
  const results = await retrieve([document("whole", "Normally RCA supplies a fictional violet pump.")], "What does RCA supply?");
  assert.deepEqual(evaluateSupport(results, ["right-coronary-proximal"]).missingStructureIds, ["right-coronary-proximal"]);
});
test("ascending-aorta queries exclude other portions of the aorta", async () => {
  const docs = [document("arch", "Normally the aortic arch carries fictional violet fluid."), document("ascending", "Normally the ascending aorta carries fictional amber fluid.")];
  assert.deepEqual((await retrieve(docs, "What is the function of AAo?")).map(p => p.source.id), ["ascending"]);
});
test("literal passages and citations survive ranking; scores cannot certify evidence", async () => {
  const doc = document("provenance", "Normally RCA supplies the fictional violet pump.");
  const first = await retrieve([doc], "What does RCA supply?");
  assert.deepEqual(first, await retrieve([doc], "What does RCA supply?"));
  assert.equal(first[0].text, doc.text); assert.deepEqual(first[0].source, doc.source);
  assert.match(first[0].relevance.scoreMeaning, /not scientific confidence/);
  const support = evaluateSupport(first);
  assert.equal(support.sufficientScientificEvidence, false);
  assert.equal(support.relevanceScoresAreScientificConfidence, false);
});
