import assert from "node:assert/strict";
import { test } from "node:test";
import { load } from "./helpers/load-module.mjs";
const { learningIntent } = load("lib/learning/intent.ts");
const { unsafeQuestion } = load("lib/tutor/core.ts");
const { requestCategory } = load("lib/tutor/routing.ts");
const { answerNavigation } = load("lib/tutor/navigation.ts");
const S = load("lib/learning/session.ts"), R = load("lib/learning/lesson-review.ts");
const V = load("lib/learning/review-snapshot.ts"), Q = load("lib/learning/quiz-personalisation.ts");
const { loadLearningEvidence } = load("lib/learning/evidence-server.ts");
const { permittedEvidence } = load("lib/learning/evidence.ts");
const catalogue = permittedEvidence(await loadLearningEvidence());
const input = { question: "Focus on LCx", selectedStructureId: null, learningLevel: "basic", privacyConfirmed: true, conversation: [] };

test("study intents are distinct from medical summaries and do not waive privacy checks", () => {
  for (const q of ["Summarise my session", "Review what I explored", "Recap this lesson"]) {
    assert.equal(learningIntent(q).type, "review"); assert.equal(requestCategory(q), "review"); assert.equal(unsafeQuestion(q), false);
  }
  for (const q of ["Summarise RCA", "Review the function of the coronary sinus", "What does this vessel do?"]) assert.equal(learningIntent(q), null);
  assert.deepEqual(learningIntent("Quiz me on my review"), { type: "quiz", count: 5 });
  assert.deepEqual(learningIntent("Give me a 3-question quiz"), { type: "quiz", count: 5 });
  assert.equal(unsafeQuestion("Quiz me on my medication"), true);
  assert.equal(unsafeQuestion("Summarise my session about my symptoms"), true);
});

test("clear navigation targets resolve locally, even without an available model", async () => {
  let calls = 0;
  const reply = await answerNavigation(input, "live", { responses: { create: async () => { calls++; throw Error("No paid call expected"); } } }, "gpt-6-luna");
  assert.equal(calls, 0); assert.equal(reply.navigation.command.structureId, "left-circumflex-artery");
  assert.equal(requestCategory("Pan to LCx"), "navigation");
});

test("actual service routes mixed requests through Sol verification and locally resolved navigation; Sol never receives tools", async () => {
  const original = { ...process.env }, models = [];
  try {
    Object.assign(process.env, { TUTOR_MODE: "live", TUTOR_LIVE_ENABLED: "true", OPENAI_API_KEY: "test-only" });
    const { answerTutor } = load("lib/tutor/service.ts", { openai: class { responses = { create: async args => {
      models.push(args.model);
      if (args.model === "gpt-6-luna") {
        assert.ok(args.tools.length);
        assert.equal(JSON.parse(args.input).validatedCommand.structureId, "coronary-sinus");
        return { status: "completed", output: [{ type: "function_call", name: "focus_structure", arguments: '{"structureId":"coronary-sinus"}' }] };
      }
      assert.equal(args.tools, undefined);
      if (args.text.format.name === "verify_evidence") return { status: "completed", output_text: '{"supported":true}' };
      const p = JSON.parse(args.input).passages[0];
      return { status: "completed", output_text: JSON.stringify({ sufficient: true, claims: [{ text: "Fictional provider fixture.", passageIds: [p.id], quotes: [p.text.slice(0, 60)] }] }) };
    } }; } });
    const reply = await answerTutor({ ...input, question: "Explain the coronary sinus and show it" });
    assert.deepEqual(models, ["gpt-6.1-sol", "gpt-6.1-sol"]);
    assert.equal(reply.status, "supported"); assert.equal(reply.navigation.command.structureId, "coronary-sinus");
    assert.ok(reply.sources.length);
  } finally { for (const k of Object.keys(process.env)) if (!(k in original)) delete process.env[k]; Object.assign(process.env, original); }
});

test("review snapshots exclude workflow commands, invalidate changed content and constrain quiz evidence", () => {
  const session = S.newSession("snapshot-session", "2026-10-21T00:00:00.000Z");
  session.events.push({ ...S.stamp(), type: "card-opened", structureId: "left-circumflex-artery", level: "basic" });
  const original = R.collectReviewInput(session, "basic");
  session.events.push({ ...S.stamp(), type: "question-asked", question: "Summarise my session", structureId: null, level: "basic" });
  assert.deepEqual(R.collectReviewInput(session, "basic"), original);
  const snapshot = V.createReviewSnapshot(original, null, catalogue);
  assert.deepEqual(V.restoreReviewSnapshot(snapshot, catalogue).structures, ["left-circumflex-artery"]);
  assert.throws(() => V.restoreReviewSnapshot({ ...snapshot, input: { ...original, structures: ["ascending-aorta"] } }, catalogue));
  assert.throws(() => V.restoreReviewSnapshot(snapshot, { ...catalogue, sources: [] }));
  const qi = Q.collectQuizInput(session, "basic", 3, snapshot);
  const pool = Q.quizCandidates(qi, catalogue);
  assert.ok(pool.length); assert.ok(pool.every(q => q.structureId === "left-circumflex-artery"));
  assert.deepEqual(Q.quizCandidates({ ...qi, structures: ["ascending-aorta"], reviewed: [], topics: [] }, catalogue).map(q => q.id), pool.map(q => q.id));
  assert.throws(() => Q.quizCandidates({ ...qi, level: "advanced" }, catalogue));
  session.events.push({ ...S.stamp(), type: "card-opened", structureId: "ascending-aorta", level: "basic" });
  assert.notEqual(V.createReviewSnapshot(R.collectReviewInput(session, "basic"), null, catalogue).version, snapshot.version);
});

test("simplification follow-ups retrieve the original topic while current vessel selection takes precedence", async () => {
  const { loadMinimalCorpus } = load("lib/knowledge-base/minimal.ts");
  const c = await loadMinimalCorpus(undefined, undefined, true);
  const simpler = await c.provider.retrieve({ ...input, question: "Explain that more simply", conversation: [{ role: "user", content: "Where does the coronary sinus drain?" }] }, AbortSignal.timeout(5000));
  assert.ok(simpler.some(p => p.source.id === "R11"));
  const selected = await c.provider.retrieve({ ...input, question: "Where does this vessel drain?", selectedStructureId: "coronary-sinus", conversation: [{ role: "user", content: "Where is the RCA?" }] }, AbortSignal.timeout(5000));
  assert.ok(selected.some(p => p.source.id === "R11" && p.relevance.answerFit.direct));
});

test("diagnostics record actual returned model metadata without student content", () => {
  const { usageTracker } = load("lib/tutor/usage.ts");
  const saved = console.info, logs = [];
  console.info = s => logs.push(JSON.parse(s));
  try {
    const usage = usageTracker("navigation", "gpt-6-luna");
    usage.add({ model: "gpt-6-luna-snapshot", id: "resp-fixture", usage: { input_tokens: 11, output_tokens: 7 } });
    usage.finish("completed", "proposed");
  } finally { console.info = saved; }
  assert.equal(logs[0].requestedModel, "gpt-6-luna");
  assert.deepEqual(logs[0].returnedModels, ["gpt-6-luna-snapshot"]);
  assert.equal(logs[0].inputTokens, 11); assert.ok(logs[0].requestId);
  assert.doesNotMatch(JSON.stringify(logs), /question|conversation|API_KEY/);
});
