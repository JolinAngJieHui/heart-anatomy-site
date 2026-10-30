import assert from "node:assert/strict";
import { test } from "node:test";
import { loadTypeScript } from "../scripts/load-typescript.mjs";
const R = loadTypeScript("lib/learning/lesson-review.ts");
const { createLessonReviewHandler, lessonReviewConfig } = loadTypeScript("lib/learning/review-http.ts");
const { createReviewClient } = loadTypeScript("lib/learning/review-client.ts");
const { generateLessonReview } = loadTypeScript("lib/learning/review-generation.ts");
const { permittedEvidence } = loadTypeScript("lib/learning/evidence.ts");
const S = loadTypeScript("lib/learning/session.ts");
const source = { id: "fixture", sourceId: "fixture", title: "TEST ONLY", url: "https://example.org/test", section: "Synthetic", documentVersion: "1", materialKind: "reference", available: true, reviewStatus: "approved", externalProcessingAllowed: true };
const catalogue = { mode: "approved-local", generatedAt: "test", sources: [source], gaps: [], passages: [{ id: "p1", structureId: "coronary-sinus", text: "FICTIONAL TEST: violet beads.", pattern: "Not medical evidence.", sourceId: "fixture", documentVersion: "1", title: source.title, url: source.url, section: source.section, levels: ["basic"], reviewStatus: "approved" }] };
const input = { structures: ["coronary-sinus"], level: "basic", levels: ["basic"], questions: [{ id: "q1", question: "A fixture question?", level: "basic", reply: { answer: "FICTIONAL TEST first paragraph.\n\nAnother fictional paragraph.\n\nHowever, this may vary; evidence is limited.", mode: "live", status: "supported", evidenceStatus: "verified", sources: [source] } }] };
function selection(value = input, evidence = catalogue) { const choices = R.reviewChoices(value, evidence); return { introduction: choices.introductions[0], closing: choices.closings[0], structures: value.structures, questions: value.questions.map(q => ({ id: q.id, paragraphIndexes: q.reply ? [0] : [] })), takeawayIds: choices.candidates.slice(0, 4).map(c => c.id) }; }
const config = { enabled: true, model: "mocked-model", timeout: 1000, minute: 10, daily: 100 };
const request = (value = input, headers = {}) => new Request("http://localhost/api/learning/review", { method: "POST", headers: { "content-type": "application/json", ...headers }, body: JSON.stringify(value) });
function handler(overrides = {}) { return createLessonReviewHandler({ config: () => config, evidence: async () => catalogue, reserve: async () => true, generate: async value => selection(value), ...overrides }); }

test("minimal request contains actual selections, originals and levels, never tracking metadata", () => {
  const session = S.newSession("private-session-id", "2026-10-14T10:00:00.000Z");
  session.events = [{ id: "card", at: session.startedAt, type: "card-opened", structureId: "coronary-sinus", level: "basic" }, { id: "note", at: session.startedAt, type: "confusion-noted", text: "private note", structureId: null }, { id: "q1", at: session.startedAt, type: "question-asked", question: input.questions[0].question, level: "basic", structureId: "coronary-sinus" }, { id: "reply", at: session.startedAt, type: "tutor-replied", questionId: "q1", reply: { ...input.questions[0].reply, selectedStructureId: "coronary-sinus", learningLevel: "basic", responseId: "private-provider-id", retrieval: [] } }];
  const result = R.collectReviewInput(session, "advanced");
  assert.deepEqual(result.structures, ["coronary-sinus"]); assert.equal(result.level, "advanced");
  assert.equal(result.questions[0].reply.answer, input.questions[0].reply.answer);
  assert.doesNotMatch(JSON.stringify(result), /private|startedAt|retrieval|2026-/);
});
test("basic and AI reviews preserve original questions, answers, citations and remote caveats", () => {
  const original = structuredClone(input);
  const basic = R.basicReview(input, catalogue), ai = R.applyReviewSelection(input, catalogue, selection());
  for (const review of [basic, ai]) { assert.equal(review.questions[0].answer, input.questions[0].reply.answer); assert.equal(review.questions[0].question, input.questions[0].question); assert.match(review.questions[0].summary, /However, this may vary/); assert.deepEqual(review.questions[0].sources, input.questions[0].reply.sources); }
  assert.equal(basic.mode, "basic"); assert.equal(ai.mode, "ai"); assert.deepEqual(input, original);
});
test("invented activity, achievements, claims, paragraph indexes and missing questions are rejected", () => {
  for (const patch of [{ structures: ["ascending-aorta"] }, { introduction: "You mastered cardiac anatomy." }, { closing: "An unsupported medical claim." }, { takeawayIds: ["invented"] }, { questions: [] }, { questions: [{ id: "q1", paragraphIndexes: [99] }] }, { questions: [{ id: "q1", paragraphIndexes: [0, 0] }] }]) assert.throws(() => R.applyReviewSelection(input, catalogue, { ...selection(), ...patch }));
  assert.throws(() => R.reviewRequestSchema.parse({ ...input, browserHistory: [] }));
});
test("empty sessions and unanswered, mock, pending and stale replies remain honest", () => {
  const empty = R.basicReview({ structures: [], questions: [], level: "basic", levels: [] }, null);
  assert.equal(empty.takeaways.length, 0); assert.equal(empty.questions.length, 0); assert.doesNotMatch(empty.introduction, /explored|mastered/);
  for (const reply of [null, { ...input.questions[0].reply, mode: "mock" }, { ...input.questions[0].reply, mode: "review" }, { ...input.questions[0].reply, status: "insufficient_evidence" }]) {
    const review = R.basicReview({ ...input, questions: [{ ...input.questions[0], reply }] }, null);
    assert.equal(review.questions[0].answer, reply?.answer ?? null); assert.equal(review.takeaways.some(t => t.id.startsWith("answer:")), false);
  }
  const stale = { ...catalogue, sources: [{ ...source, documentVersion: "changed" }] };
  assert.equal(R.basicReview(input, stale).takeaways.some(t => t.id.startsWith("answer:")), false);
  assert.equal(permittedEvidence({ ...catalogue, sources: [{ ...source, externalProcessingAllowed: false }] }).passages.length, 0);
});
test("review generation summarises originals then separately audits grounding", async () => {
  let called = 0;
  const narrative = { introduction: "Here is your recap.", closing: "Revisit your question when ready.", questions: [{ id: "q1", summary: "FICTIONAL TEST: evidence is limited and may vary.", evidenceIds: ["p1"] }], takeaways: [{ text: "FICTIONAL TEST: violet beads; not medical evidence.", evidenceIds: ["p1"] }] };
  const client = { responses: { parse: async (args, opts) => { called++; assert.equal(args.store, false); assert.equal(args.text.format.type, "json_schema"); assert.equal(args.model, "mocked-model"); assert.ok(opts.signal); const data = JSON.parse(args.input); assert.equal(data.session.questions[0].question, input.questions[0].question); assert.doesNotMatch(args.input, /private-session|startedAt|responseId/); return { status: "completed", output_parsed: called === 1 ? narrative : { supported: true, issues: [] } }; } } };
  const selection = await generateLessonReview(client, "mocked-model", input, catalogue, new AbortController().signal);
  assert.equal(called, 2); assert.deepEqual(selection.personalisation, narrative);
  const rendered = R.applyReviewSelection(input, catalogue, selection);
  assert.equal(rendered.questions[0].answer, input.questions[0].reply.answer);
  assert.equal(rendered.questions[0].summary, narrative.questions[0].summary);
  await assert.rejects(generateLessonReview({ responses: { parse: async args => ({ status: "completed", output_parsed: args.text.format.name === "learning_content_audit" ? { supported: false, issues: ["Unsupported qualification"] } : narrative }) } }, "mocked-model", input, catalogue, new AbortController().signal));
});
test("disabled or missing configuration cannot invoke a provider even with an API key present", async () => {
  const old = { ...process.env };
  try {
    process.env.OPENAI_API_KEY = "test-not-real"; process.env.OPENAI_MODEL = "mocked-model"; delete process.env.LESSON_REVIEW_LIVE_ENABLED;
    assert.equal(lessonReviewConfig().enabled, false);
    const response = await handler({ config: lessonReviewConfig, generate: async () => assert.fail("provider forbidden") })(request());
    assert.equal((await response.json()).mode, "basic");
    process.env.LESSON_REVIEW_LIVE_ENABLED = "true"; delete process.env.OPENAI_API_KEY; assert.equal(lessonReviewConfig().enabled, false);
  } finally { for (const k of Object.keys(process.env)) if (!(k in old)) delete process.env[k]; Object.assign(process.env, old); }
});

test("assessment opt-in enables production review and quiz without weakening their API key or live gates", () => {
  const old = { ...process.env };
  try {
    Object.assign(process.env, { NODE_ENV: "production", OPENAI_API_KEY: "synthetic-test-only", OPENAI_TUTOR_MODEL: "mocked-model", LESSON_REVIEW_LIVE_ENABLED: "true", QUIZ_LIVE_ENABLED: "true" });
    delete process.env.TUTOR_REDIS_REST_URL; delete process.env.TUTOR_REDIS_REST_TOKEN;
    for (const flag of ["LESSON_REVIEW_LIVE_ENABLED", "QUIZ_LIVE_ENABLED"]) {
      delete process.env.ASSESSMENT_DISABLE_USAGE_LIMITS;
      assert.throws(() => lessonReviewConfig(flag), /Shared limiter/);
      process.env.ASSESSMENT_DISABLE_USAGE_LIMITS = "false";
      assert.throws(() => lessonReviewConfig(flag), /Shared limiter/);
      process.env.ASSESSMENT_DISABLE_USAGE_LIMITS = "true";
      assert.equal(lessonReviewConfig(flag).enabled, true);
      assert.equal(lessonReviewConfig(flag).model, "mocked-model");
      process.env[flag] = "false"; assert.equal(lessonReviewConfig(flag).enabled, false);
      process.env[flag] = "true";
      delete process.env.OPENAI_API_KEY; assert.equal(lessonReviewConfig(flag).enabled, false);
      process.env.OPENAI_API_KEY = "synthetic-test-only";
    }
  } finally { for (const key of Object.keys(process.env)) if (!(key in old)) delete process.env[key]; Object.assign(process.env, old); }
});
test("route validates input, origin and content type before any generation", async () => {
  const post = handler({ generate: async () => assert.fail("provider forbidden") });
  assert.equal((await post(request({ ...input, structures: ["invented"] }))).status, 400);
  assert.equal((await post(request(input, { origin: "https://evil.example" }))).status, 403);
  assert.equal((await post(request(input, { "content-type": "text/plain" }))).status, 415);
  assert.equal((await post(request({ ...input, extra: "x".repeat(520000) }))).status, 400);
  assert.equal((await (await post(request({ ...input, questions: [], structures: [] }))).json()).reason, "empty");
});
test("server coalesces concurrent requests but retains no completed student review cache", async () => {
  let count = 0;
  const post = handler({ generate: async value => { count++; await new Promise(r => setTimeout(r, 15)); return selection(value); } });
  const responses = await Promise.all([post(request()), post(request()), post(request())]);
  for (const r of responses) assert.equal((await r.json()).mode, "ai"); assert.equal(count, 1);
  await post(request()); assert.equal(count, 2);
  await post(request(input, { "x-review-refresh": "true" })); assert.equal(count, 3);
  await post(request({ ...input, level: "advanced" })); assert.equal(count, 4);
});
test("clearing reviews aborts in-flight work and a late response cannot refill the cache", async () => {
  let finish, signal, calls = 0;
  const client = createReviewClient(async (_url, options) => { calls++; signal = options.signal; return new Promise(resolve => { finish = resolve; }); });
  const old = client.get(input, catalogue); client.clear(); assert.equal(signal.aborted, true);
  finish(Response.json({ mode: "ai", selection: selection() })); assert.equal((await old).review.mode, "basic");
  const next = client.get(input, catalogue); assert.equal(calls, 2); finish(Response.json({ mode: "ai", selection: selection() })); assert.equal((await next).review.mode, "ai");
});
test("provider errors, rate limits, timeouts and malformed generation return a safe fallback", async () => {
  for (const overrides of [{ generate: async () => { throw Error("secret-provider-detail"); } }, { reserve: async () => false }, { generate: async () => ({ forged: true }) }, { config: () => ({ ...config, timeout: 10 }), generate: async () => new Promise(r => setTimeout(() => r(selection()), 50)) }]) {
    const response = await handler(overrides)(request()); const value = await response.json(); assert.equal(value.mode, "basic"); assert.doesNotMatch(JSON.stringify(value), /secret-provider-detail/);
  }
});
test("frontend validates AI response, caches successes and failures, retries explicitly, and handles no network", async () => {
  let calls = 0;
  const client = createReviewClient(async () => { calls++; return Response.json({ mode: "ai", selection: selection() }); });
  const [a, b] = await Promise.all([client.get(input, catalogue), client.get(input, catalogue)]);
  assert.equal(a.review.mode, "ai"); assert.deepEqual(a, b); assert.equal(calls, 1);
  await client.get(input, catalogue); assert.equal(calls, 1); await client.get(input, catalogue, true); assert.equal(calls, 2);
  client.clear(); await client.get(input, catalogue); assert.equal(calls, 3);
  for (const fetcher of [async () => { throw Error("offline"); }, async () => new Response("broken"), async () => Response.json({ mode: "ai", selection: { ...selection(), structures: [] } }), async () => Response.json({ mode: "basic", reason: "rate_limit" }, { status: 429 })]) {
    const fallback = await createReviewClient(fetcher).get(input, catalogue); assert.equal(fallback.review.mode, "basic"); assert.equal(fallback.review.questions[0].answer, input.questions[0].reply.answer);
  }
  const empty = createReviewClient(async () => assert.fail("empty session must stay local"));
  assert.equal((await empty.get({ ...input, structures: [], questions: [] }, catalogue)).review.mode, "basic");
});
