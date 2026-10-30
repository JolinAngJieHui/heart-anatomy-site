import assert from "node:assert/strict";
import { test } from "node:test";
import { load } from "./helpers/load-module.mjs";
const Q = load("lib/learning/quiz-personalisation.ts"), S = load("lib/learning/session.ts");
const { createQuizHandler } = load("lib/learning/quiz-http.ts");
const { createQuizClient } = load("lib/learning/quiz-client.ts");
const { generateQuizSelection } = load("lib/learning/quiz-generation.ts");
const { loadLearningEvidence } = load("lib/learning/evidence-server.ts");
const { permittedEvidence } = load("lib/learning/evidence.ts");
const { createReviewSnapshot } = load("lib/learning/review-snapshot.ts");
const { collectReviewInput, reviewChoices } = load("lib/learning/lesson-review.ts");
const catalogue = permittedEvidence(await loadLearningEvidence());
const session = S.newSession("local-private-session", "2026-10-17T00:00:00.000Z");
let i = 0;
for (const p of catalogue.passages) session.events.push({ id: `s${i++}`, at: session.startedAt, type: "card-opened", level: "basic", structureId: p.structureId }, { id: `p${i++}`, at: session.startedAt, type: "passage-reviewed", level: "basic", structureId: p.structureId, citation: { sourceId: p.sourceId, passageId: p.id, documentVersion: p.documentVersion } });
const input = Q.collectQuizInput(session, "basic", 5, createReviewSnapshot(collectReviewInput(session, "basic"), null, catalogue)), pool = Q.quizCandidates(input, catalogue);
const selection = { questionIds: pool.slice(0, Math.min(5, pool.length)).map(q => q.id) };
const config = { enabled: true, model: "gpt-6.1-sol", timeout: 1000, minute: 10, daily: 100 };
const request = (body = input, headers = {}) => new Request("http://localhost/api/learning/quiz", { method: "POST", headers: { "Content-Type": "application/json", ...headers }, body: JSON.stringify(body) });
const handler = overrides => createQuizHandler({ config: () => config, evidence: async () => catalogue, reserve: async () => true, generate: async () => selection, ...overrides });

test("quiz candidates rebuild answer keys from reviewed approved evidence, never a recap or browser keys", () => {
  assert.ok(pool.length);
  assert.ok(pool.every(q => catalogue.passages.some(p => p.id === q.evidence.id && p.text === q.explanation && p.structureId === q.correctAnswer)));
  assert.equal(Q.quizCandidates({ ...input, review: undefined, reviewed: [] }, catalogue).length, 0);
  assert.equal(Q.quizCandidates({ ...input, review: undefined, reviewed: input.reviewed.map(r => ({ ...r, documentVersion: "stale" })) }, catalogue).length, 0);
  assert.throws(() => Q.quizRequestSchema.parse({ ...input, correctAnswers: ["invented"] }));
  assert.doesNotMatch(JSON.stringify(input), /local-private|startedAt|explanation|answer|API_KEY/);
  assert.throws(() => Q.applyQuizSelection(pool, 5, { questionIds: ["invented"] }));
  assert.throws(() => Q.applyQuizSelection(pool, 5, { questionIds: [pool[0].id, pool[0].id] }));
});
test("Sol writes structured questions and a separate pass audits answers and distractors", async () => {
  const evidence = load("lib/learning/lesson-review.ts").lessonEvidence(input.review.input, catalogue);
  const generated = { questions: [{ structureId: "coronary-sinus", kind: "multiple-choice", prompt: "FICTIONAL TEST: Which bead is present?", concept: "Fictional test", options: [{id:"a",label:"Violet",structureId:null},{id:"b",label:"Orange",structureId:null},{id:"c",label:"Blue",structureId:null}], correctAnswer:"a", explanation:"FICTIONAL TEST: violet beads.", evidenceIds:[evidence[0].key] }] };
  generated.questions = Array.from({length:5},(_,index)=>({...generated.questions[0],prompt:generated.questions[0].prompt+" TEST "+index,concept:"Fictional concept "+index}));
  let calls = 0;
  const selected = await generateQuizSelection({ responses: { parse: async args => {
    calls++; assert.equal(args.model, "gpt-6.1-sol"); assert.equal(args.store, false); assert.equal(args.text.format.type, "json_schema");
    const data = JSON.parse(args.input); assert.ok(data.evidence.length); assert.ok(data.session.scope.length);
    return { status: "completed", output_parsed: calls === 1 ? generated : { questions: Array.from({length:5},(_,index)=>({index,supported:true,issues:[]})) } };
  } } }, config.model, input, pool, new AbortController().signal, catalogue);
  assert.deepEqual(selected, generated); assert.equal(calls, 2);
});
test("quiz HTTP endpoint rejects invalid input, disables paid calls by default, and falls back on errors", async () => {
  const disabled = handler({ config: () => ({ ...config, enabled: false }), generate: () => assert.fail("Must not generate") });
  assert.equal((await (await disabled(request())).json()).reason, "disabled");
  assert.equal((await disabled(request({ ...input, review: undefined }))).status, 400);
  assert.equal((await disabled(request({ ...input, model: "untrusted" }))).status, 400);
  assert.equal((await disabled(request(input, { origin: "https://wrong.example" }))).status, 403);
  for (const overrides of [{ generate: async () => ({ questionIds: ["fake"] }) }, { generate: async () => { throw Error("private diagnostics"); } }, { reserve: async () => false }, { config: () => ({ ...config, timeout: 10 }), generate: async () => new Promise(r => setTimeout(r, 30)) }]) {
    const response = await handler(overrides)(request()); const data = await response.json();
    assert.equal(data.mode, "basic"); assert.doesNotMatch(JSON.stringify(data), /private diagnostics/);
  }
});
test("quiz requests coalesce, cache locally and cannot repopulate caches after reset", async () => {
  let calls = 0;
  const post = handler({ generate: async () => { calls++; await new Promise(r => setTimeout(r, 20)); return selection; } });
  await Promise.all([post(request()), post(request())]); assert.equal(calls, 1);
  const client = createQuizClient(async () => { calls++; return Response.json({ mode: "ai", selection }); });
  const one = await client.get(input, pool); assert.equal(one.ai, true);
  await client.get(input, pool); assert.equal(calls, 2);
  client.clear(); await client.get(input, pool); assert.equal(calls, 3);
  let finish, signal;
  const delayed = createQuizClient(async (_url, options) => { signal = options.signal; return new Promise(resolve => { finish = resolve; }); });
  const pending = delayed.get(input, pool); delayed.clear(); assert.equal(signal.aborted, true);
  finish(Response.json({ mode: "ai", selection })); assert.equal((await pending).ai, false);
});
test("review input includes actual quiz results and retains unanswered questions", () => {
  const s = structuredClone(session), q = pool[0];
  s.events.push({ id: "q1", at: session.startedAt, type: "question-asked", question: "An unresolved question", structureId: q.structureId, level: "basic" });
  s.events.push({ id: "a1", at: session.startedAt, type: "quiz-completed", attemptId: "attempt", level: "basic", results: [{ questionId: q.id, structureId: q.structureId, correct: false }] });
  const review = collectReviewInput(s, "basic"); assert.equal(review.questions.at(-1).reply, null); assert.equal(review.quizResults[0].correct, false);
  assert.ok(reviewChoices(review, catalogue).candidates.some(c => c.id === "quiz-revision"));
});
