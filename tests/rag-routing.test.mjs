import assert from "node:assert/strict";
import { test } from "node:test";
import { load } from "./helpers/load-module.mjs";
import { referenceProbes } from "../scripts/rag-reference-probes.mjs";
const { requestCategory, resolveNavigation, resolveMixedNavigation } = load("lib/tutor/routing.ts");
const { createActionLedger, parseNavigationCall } = load("lib/tutor/scene-actions.ts");
const { answerNavigation } = load("lib/tutor/navigation.ts");
const { OpenAIGenerationProvider } = load("lib/tutor/generation.ts");
const { selectEvidence, evidencePayload, evidenceTokenCount } = load("lib/tutor/evidence-budget.ts");
const { loadMinimalCorpus } = load("lib/knowledge-base/minimal.ts");
const { tutorModels } = load("lib/tutor/models.ts");
const collection = await loadMinimalCorpus(undefined, undefined, true);
const input = { question: "Where does the coronary sinus drain?", selectedStructureId: null, learningLevel: "basic", privacyConfirmed: true, conversation: [] };
const signal = () => AbortSignal.timeout(5000);

test("routing reserves all teaching and function-based navigation for Sol", () => {
  for (const q of ["What does the RCA do?", "Compare the RCA and LCx", "SVC function?", "Why?"]) assert.equal(requestCategory(q), "anatomy", q);
  for (const q of ["Explain the RCA and show it", "Show the vessel that drains into the right atrium", "Find the artery supplying the lateral wall", "Show how the RCA supplies blood"]) assert.equal(requestCategory(q), "mixed", q);
  for (const q of ["Show me the RCA", "Find the coronary sinus", "Reset the view", "Focus on the LCx"]) assert.equal(requestCategory(q), "navigation", q);
  assert.deepEqual(tutorModels(), { tutor: "gpt-6.1-sol", navigation: "gpt-6-luna" });
});
test("whole-vessel aliases open registered segment choices without selecting a segment; selected pronouns are explicit", async () => {
  for (const question of ["Show me RCA", "Show LAD"]) assert.equal(resolveNavigation({ ...input, question }).command.type, "select_vessel_group");
  assert.match(resolveNavigation({ ...input, question: "Show this vessel" }).message, /Which structure/);
  assert.equal(resolveNavigation({ ...input, question: "Show this vessel", selectedStructureId: "coronary-sinus" }).command.structureId, "coronary-sinus");
  assert.match(resolveNavigation({ ...input, question: "Show OM1" }).message, /not separately available/);
  const response = await answerNavigation({ ...input, question: "Find the coronary sinus" }, "live", { responses: { create: async args => { assert.equal(args.model, "gpt-6-luna"); return { status: "completed", output: [{ type: "function_call", name: "focus_structure", arguments: JSON.stringify({ structureId: "coronary-sinus" }) }] }; } } }, "gpt-6-luna", signal());
  assert.equal(response.navigation.command.structureId, "coronary-sinus");
  assert.match(response.answer, /Waiting/); assert.deepEqual(response.sources, []);
});
test("Luna receives a small registry and strict tools, never reference evidence", async () => {
  let count = 0;
  const client = { responses: { create: async args => {
    count++; assert.equal(args.model, "gpt-6-luna"); assert.equal(args.store, false);
    const payload = JSON.parse(args.input); assert.equal(payload.structures.length, 17);
    assert.equal(payload.passages, undefined); assert.equal(payload.recentContext.length, 1);
    assert.ok(args.tools.every(t => t.strict && t.parameters.additionalProperties === false));
    return { status: "completed", output: [{ type: "function_call", name: "reset_view", arguments: "{}", call_id: "call1" }] };
  } } };
  const r = await answerNavigation({ ...input, question: "Could you return the camera to the starting view?", conversation: [{ role: "user", content: "Previous request" }] }, "live", client, "gpt-6-luna", signal());
  assert.equal(count, 1); assert.equal(r.navigation.command.type, "reset_view");
});
test("unsupported, duplicate, injected and stale tools never dispatch", () => {
  for (const [name, args] of [["execute", '{}'], ["focus_structure", '{"structureId":"invented"}'], ["reset_view", '{"camera":[1,2,3]}'], ["reset_view", '{"type":"clear_selection"}'], ["reset_view", '{']]) assert.throws(() => parseNavigationCall(name, args));
  const ledger = createActionLedger(), epoch = ledger.epoch(), p = { id: "one", command: { type: "reset_view" } };
  assert.deepEqual(ledger.accept(p, epoch), { type: "camera", kind: "reset" });
  assert.equal(ledger.accept(p, epoch), null); ledger.reset();
  assert.equal(ledger.accept({ ...p, id: "late" }, epoch), null);
  assert.ok(ledger.accept(p, ledger.epoch()));
});
test("bounded selection measures all evidence metadata and retains whole qualified passages", async () => {
  for (const question of ["What does the RCA do?", "Compare the RCA and LCx", "Where does the coronary sinus drain?"]) {
    const q = { ...input, question, maxPassages: 12 }, candidates = await collection.provider.retrieve(q, signal());
    const selected = selectEvidence(candidates, q);
    assert.ok(selected.length > 0 && selected.length <= (/Compare/.test(question) ? 7 : 5));
    assert.ok(evidenceTokenCount(selected) <= 3500);
    assert.equal(evidenceTokenCount(selected), Buffer.byteLength(JSON.stringify(evidencePayload(selected))));
    assert.ok(selected.every(p => candidates.some(c => c.id === p.id && c.text === p.text)));
    assert.ok(evidencePayload(selected).passages.every(p => p.sourceId && p.chunkId && p.section && p.url));
    if (/Compare/.test(question)) { assert.ok(new Set(selected.map(p => p.source.id)).size >= 2); assert.ok([0, 1].every(i => selected.some(p => p.relevance.answerFit.matchedTargets[i]))); }
    assert.equal(selectEvidence(candidates, q, { topK: 5, maxTokens: 10 }).length, 0);
  }
});
test("follow-up retrieval uses prior named vessel and explicit questions override selected vessel", async () => {
  const follow = await collection.provider.retrieve({ ...input, question: "What about its branches?", conversation: [{ role: "user", content: "Where is the RCA?" }] }, signal());
  assert.ok(follow.some(p => /right coronary artery/i.test(p.text)));
  const explicit = await collection.provider.retrieve({ ...input, question: "Where does the coronary sinus drain?", selectedStructureId: "right-coronary-proximal" }, signal());
  assert.ok(explicit.some(p => p.source.id === "R11"));
  assert.deepEqual(await collection.provider.retrieve({ ...input, question: "What is the weather near SVC?" }, signal()), []);
});
test("all 11 fixed source probes remain retrievable inside the complete evidence budget", async () => {
  for (const probe of referenceProbes) {
    const q = { ...input, question: probe.question, maxPassages: 12 };
    const selected = selectEvidence(await collection.provider.retrieve(q, signal()), q);
    assert.ok(selected.some(p => p.source.id === probe.sourceId && p.relevance.answerFit.direct), probe.sourceId);
    assert.ok(evidenceTokenCount(selected) <= 3500);
  }
});
test("function descriptions use evidence and cannot navigate to an unrelated registered vessel", async () => {
  const q = { ...input, question: "Show the vessel that drains into the right atrium" };
  assert.equal(resolveNavigation(q), null);
  assert.equal(resolveMixedNavigation({ ...q, question: "Show the artery that branches from the left main coronary artery" }).command.structureId, "left-coronary-artery");
  assert.equal(resolveMixedNavigation({ ...q, question: "Compare RCA and LCx then focus LCx" }).command.groupId, "right-coronary-artery");
  const passages = selectEvidence(await collection.provider.retrieve(q, signal()), q);
  assert.ok(passages.some(p => p.source.id === "R11"));
  for (const target of ["coronary-sinus", "ascending-aorta"]) {
    let calls = 0;
    const client = { responses: { create: async () => {
      calls++;
      return { status: "completed", output: [], output_text: calls === 2 ? '{"supported":true}' : JSON.stringify({ sufficient: true, targetId: target, claims: [{ text: "The coronary sinus is the fixture target for this navigation test.", passageIds: [passages[0].citationId], quotes: [passages[0].text.slice(0, 80)] }] }) };
    } } };
    const provider = new OpenAIGenerationProvider(client, "gpt-6.1-sol", 1600);
    await provider.generate(q, passages, signal());
    assert.equal(provider.resolvedTarget, undefined);
  }
});
test("mixed teaching uses Sol without viewer tools; execution is separately routed to Luna", async () => {
  const q = { ...input, question: "Explain the coronary sinus and show it" };
  const passages = selectEvidence(await collection.provider.retrieve(q, signal()), q), first = passages[0]; let calls = 0;
  const client = { responses: { create: async args => {
    assert.equal(args.model, "gpt-6.1-sol"); assert.equal(args.tools, undefined); calls++;
    return { status: "completed", output: [], output_text: calls === 2 ? '{"supported":true}' : JSON.stringify({ sufficient: true, claims: [{ text: "Fixture claim.", passageIds: [first.citationId], quotes: [first.text.slice(0, 80)] }] }) };
  } } };
  const answer = await new OpenAIGenerationProvider(client, "gpt-6.1-sol", 1600).generate(q, passages, signal());
  assert.equal(calls, 2); assert.equal(answer.verified, true); assert.equal(answer.navigation, undefined);
});

test("multi-vessel mixed requests retain teaching without a redundant navigation model call", async () => {
  const q = { ...input, question: "Explain RCA and LCx and show them" }, passages = selectEvidence(await collection.provider.retrieve(q, signal()), q);
  const client = { responses: { create: async args => { assert.equal(args.tools, undefined); return { status: "completed", output: [], output_text: args.text.format.name === "verify_evidence" ? '{"supported":true}' : JSON.stringify({ sufficient: true, claims: [{ text: "A fixture claim, not a medical assertion.", passageIds: [passages[0].citationId], quotes: [passages[0].text.slice(0, 60)] }] }) }; } } };
  const answer = await new OpenAIGenerationProvider(client, "gpt-6.1-sol", 1600).generate(q, passages, signal());
  assert.equal(answer.navigation, undefined); assert.equal(answer.navigationNotice, undefined);
});
test("real approved local evidence reaches mocked Sol without a vector store", async () => {
  const original = { ...process.env }; let calls = 0;
  try {
    Object.assign(process.env, { TUTOR_MODE: "live", TUTOR_LIVE_ENABLED: "true", OPENAI_API_KEY: "test-only" }); delete process.env.OPENAI_VECTOR_STORE_ID;
    const { answerTutor } = load("lib/tutor/service.ts", { openai: class { responses = { create: async args => {
      calls++; assert.equal(args.model, "gpt-6.1-sol");
      if (args.text.format.name === "verify_evidence") return { status: "completed", output_text: '{"supported":true}' };
      const p = JSON.parse(args.input).passages; assert.ok(p.length && p.length <= 5); assert.ok(p.every(p => p.sourceId));
      return { status: "completed", output: [], output_text: JSON.stringify({ sufficient: true, claims: [{ text: "Fictional provider test claim.", passageIds: [p[0].id], quotes: [p[0].text.slice(0, 60)] }] }) };
    } }; } });
    const r = await answerTutor(input); assert.equal(r.status, "supported"); assert.equal(calls, 2); assert.equal(r.sources[0].sourceId, "R11");
  } finally { for (const k of Object.keys(process.env)) if (!(k in original)) delete process.env[k]; Object.assign(process.env, original); }
});
