import assert from "node:assert/strict";
import { test } from "node:test";
import { load } from "./helpers/load-module.mjs";
import { auditRag } from "../scripts/audit-rag.mjs";
import { referenceProbes } from "../scripts/rag-reference-probes.mjs";

const { loadMinimalCorpus } = load("lib/knowledge-base/minimal.ts");
const { chunkDocument } = load("lib/tutor/retrieval.ts");
const { questionProfile } = load("lib/tutor/question-relevance.ts");
const { resolveAnatomicalTerms } = load("lib/tutor/terminology.ts");
const corpus = await loadMinimalCorpus(undefined, undefined, true);

test("reference audit distinguishes validated local extracts from unverified remote storage", async () => {
  const report = await auditRag();
  assert.equal(report.network, false);
  assert.equal(report.paidApiCalls, 0);
  assert.equal(report.supabase.verified, false);
  assert.equal(report.supabase.schema, null);
  assert.equal(report.supabase.tables, null);
  assert.equal(report.localChecksPassed, true);
  assert.equal(report.sourceCount, 11);
  assert.equal(report.chunkCount, 137);
  for (const field of ["excluded", "duplicateSourceIds", "duplicateDois", "duplicatePassageIds", "duplicateTexts"]) assert.deepEqual(report[field], []);
  for (const row of report.references) {
    assert.equal(row.supabase, "not used");
    assert.equal(row.remoteEmbeddingStatus, "not verified");
    assert.equal(row.locallyEmbedded, false);
    assert.equal(row.scope, "selected article sections, not full text");
    assert.equal(row.emptyParagraphs, 0);
    assert.equal(row.probe.direct, true, row.id);
    assert.equal(row.probe.question, referenceProbes.find(p => p.sourceId === row.id).question);
  }
});

test("R2 marginal wording and investigation intent resolve without broadening unrelated targets", async () => {
  for (const name of ["right ventricular marginal branch", "right ventricular marginal artery", "RV marginal artery"])
    assert.deepEqual(resolveAnatomicalTerms(name).matches[0].structureIds, ["right-marginal-artery"]);
  assert.deepEqual(resolveAnatomicalTerms("right ventricular branch").matches, []);
  for (const word of ["investigated", "investigate", "investigations"])
    assert.equal(questionProfile(`SVC obstruction ${word}`).domain, "procedure");
  for (const question of ["What is the right marginal artery quantum molecular mechanism?", "What is the weather near the SVC?", "How is superior vena cava obstruction investigated on Mars?"])
    assert.deepEqual(await corpus.provider.retrieve({ question, selectedStructureId: null }, AbortSignal.timeout(5000)), [], question);
});

test("all 11 fixed source probes reach the real chat handler as original excerpts and citations without OpenAI", async t => {
  const saved = { NODE_ENV: process.env.NODE_ENV, TUTOR_REVIEW_BACKEND: process.env.TUTOR_REVIEW_BACKEND };
  process.env.NODE_ENV = "development";
  process.env.TUTOR_REVIEW_BACKEND = "local";
  t.after(() => { for (const [key, value] of Object.entries(saved)) { if (value === undefined) delete process.env[key]; else process.env[key] = value; } });
  const NoNetworkOpenAI = class { constructor() { throw new Error("No OpenAI client may be created during this local test"); } };
  const { answerMinimalReview } = load("lib/tutor/minimal-review.ts", { openai: NoNetworkOpenAI });
  const { createChatHandler } = load("lib/tutor/http.ts");
  const POST = createChatHandler({ answer: answerMinimalReview, config: () => ({ mode: "review", minute: 60, daily: 100 }), limiter: { reserve: async () => true } });
  const chunks = corpus.corpus.flatMap(chunkDocument);
  for (const probe of referenceProbes) {
    const response = await POST(new Request("http://localhost/api/chat", { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question: probe.question, selectedStructureId: null, learningLevel: "basic", privacyConfirmed: true, conversation: [] }) }));
    assert.equal(response.status, 200, probe.sourceId);
    const result = await response.json();
    assert.equal(result.mode, "review");
    assert.equal(result.evidenceStatus, "review");
    assert.match(result.answer, /literal article excerpts; source records marked approved/);
    assert.ok(result.sources.some(s => s.sourceId === probe.sourceId), probe.sourceId);
    for (const citation of result.sources) {
      const original = chunks.find(p => p.id === citation.passageId);
      assert.ok(original, "Citation must identify an actual validated passage");
      assert.equal(citation.url, original.source.url);
      assert.equal(citation.documentVersion, original.source.documentVersion);
      assert.ok(result.answer.includes(original.text), "The original paragraph and its qualifications must be retained");
    }
  }
});

test("retrieved approved evidence reaches generation with its original locators using a mock client", async () => {
  const { runPipeline } = load("lib/tutor/pipeline.ts");
  const input = { question: "Where does the coronary sinus drain?", selectedStructureId: null, learningLevel: "basic", privacyConfirmed: true, conversation: [] };
  let called = false;
  const response = await runPipeline(input, corpus.provider, { mode: "live", generate: async (_input, passages) => {
    called = true;
    assert.ok(passages.every(p => p.source.reviewStatus === "approved"));
    for (const p of passages) assert.ok(corpus.corpus.some(unit => unit.source.section === p.source.section && unit.text === p.text));
    // A deliberately insufficient mocked answer proves handoff without inventing
    // an anatomical explanation or implying live generation was verified.
    return { value: { sufficient: false, claims: [] }, verified: false };
  } }, AbortSignal.timeout(5000));
  assert.equal(called, true);
  assert.equal(response.status, "insufficient_evidence");
  assert.deepEqual(response.sources, []);
});
