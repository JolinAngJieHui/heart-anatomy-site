import assert from "node:assert/strict";
import { test } from "node:test";
import fs from "node:fs";
import JSZip from "jszip";
import { createRequire } from "node:module";
import { loadTypeScript } from "../scripts/load-typescript.mjs";
const S = loadTypeScript("lib/learning/session.ts"), P = loadTypeScript("lib/learning/persistence.ts");
const { generateSummary } = loadTypeScript("lib/learning/summary.ts");
const Q = loadTypeScript("lib/learning/quiz.ts");
const { summaryDocument } = loadTypeScript("lib/learning/word-export.ts");
const { ordinaryTeachingPassage } = loadTypeScript("lib/learning/evidence.ts");
const { Packer } = createRequire(import.meta.url)("docx");
const at = "2026-10-12T10:00:00.000Z", structureId = "coronary-sinus";
// ISOLATED TEST FIXTURE: fictional source and facts; never loaded by the website.
const passage = { id: "fixture-passage", structureId, text: "SYNTHETIC TEST ONLY. The coronary sinus contains fictional violet teaching beads.", sourceId: "fixture-reference", title: "SYNTHETIC TEST ONLY", url: "https://example.org/fixture", section: "Fictional section", documentVersion: "fixture-v1", pattern: "Synthetic fixture, not academic evidence", levels: ["basic", "intermediate", "advanced"], domain: "anatomy", matchedTerm: "coronary sinus" };
const catalogue = { mode: "approved-local", generatedAt: at, passages: [passage], sources: [{ id: passage.sourceId, title: passage.title, url: passage.url, documentVersion: passage.documentVersion, available: true }], gaps: [] };
let seq = 0;
const event = value => ({ id: `test-event-${++seq}`, at, ...value });
const add = (h, e) => S.appendEvent(h, h.activeId, event(e));
function reviewed() {
  let h = S.newHistory("session-1", at);
  h = add(h, { type: "card-opened", structureId, level: "basic" });
  h = add(h, { type: "passage-reviewed", structureId, level: "basic", citation: { sourceId: passage.sourceId, documentVersion: passage.documentVersion, passageId: passage.id } });
  return h;
}
test("session tracks unique structures independently of repeated cards and learning levels", () => {
  let h = reviewed();
  h = add(h, { type: "card-opened", structureId, level: "advanced" });
  const a = S.sessionActivity(h.sessions[0]);
  assert.equal(a.structures.length, 1); assert.equal(a.cards.length, 2); assert.deepEqual(a.levels, ["basic", "advanced"]); assert.equal(a.reviews.length, 1);
  const e = event({ type: "level-used", level: "intermediate" });
  h = S.appendEvent(h, h.activeId, e); assert.deepEqual(S.appendEvent(h, h.activeId, e), h);
});
test("storage round trip, new session, resume and explicit clearing preserve earlier history", () => {
  const data = new Map(), storage = { getItem: k => data.get(k) ?? null, setItem: (k, v) => data.set(k, v), removeItem: k => data.delete(k) };
  let h = reviewed(); h = S.startSession(h, "session-2", at); assert.equal(h.sessions[0].events.length, 2);
  P.saveHistory(storage, h); assert.deepEqual(P.restoreHistory(storage), h);
  assert.equal(S.resumeSession(h, "session-1").activeId, "session-1");
  assert.equal(P.clearHistory(storage, false), false); assert.ok(P.restoreHistory(storage));
  assert.equal(P.clearHistory(storage, true), true); assert.equal(P.restoreHistory(storage), null);
  storage.setItem(S.SESSION_STORAGE_KEY, "broken"); assert.throws(() => P.restoreHistory(storage)); assert.equal(data.get(S.SESSION_STORAGE_KEY), "broken");
  assert.throws(() => S.startSession(h, "session-1", at));
});
test("malformed sessions and unknown structure IDs are rejected", () => {
  assert.throws(() => add(reviewed(), { type: "card-opened", structureId: "invented-vessel", level: "basic" }));
  assert.throws(() => S.historySchema.parse({ ...reviewed(), activeId: "missing" }));
  assert.throws(() => S.historySchema.parse({ ...reviewed(), version: 99 }));
});
test("session date and Word filename use the recorded local timezone, including UTC midnight boundaries", () => {
  assert.equal(S.calendarDate("2026-10-11T16:30:00.000Z", "Asia/Singapore"), "2026-10-12");
  assert.equal(generateSummary({ ...reviewed().sessions[0], startedAt: "2026-10-11T16:30:00.000Z", timeZone: "Asia/Singapore" }, null).date, "2026-10-12");
});
test("ordinary practice excludes congenital variants, clinical observations and procedural passages", () => {
  assert.equal(ordinaryTeachingPassage("The proximal RCA courses upwards before making a U-turn.", "Congenital Abnormalities Involving RCA"), false);
  assert.equal(ordinaryTeachingPassage("Angiography showed a 100% occlusion with thrombosis.", "Case"), false);
  assert.equal(ordinaryTeachingPassage("The superior vena cava is shown during balloon occlusion venography.", "Fluoroscopy and venography"), false);
  assert.equal(ordinaryTeachingPassage("The coronary sinus drains venous blood into the right atrium.", "Normal anatomy"), true);
  assert.equal(ordinaryTeachingPassage("Obstruction of the SVC can occur at various levels.", "Review"), false);
  assert.equal(ordinaryTeachingPassage("Cusp fusion phenotype changes the outflow jet orientation in BAV.", "Hemodynamic changes"), false);
  assert.equal(ordinaryTeachingPassage("Kugel's artery may also arise from the proximal RCA.", "Kugel’s Artery"), false);
});
test("original replies stay available with clear status; unsupported/mock/stale answers do not become takeaways", () => {
  let h = reviewed();
  const question = event({ type: "question-asked", question: "What is the coronary sinus?", structureId, level: "basic" }); h = S.appendEvent(h, h.activeId, question);
  const reply = { answer: "FICTIONAL VALIDATION ANSWER", sources: [{ id: "R1", sourceId: passage.sourceId, title: passage.title, url: passage.url, section: passage.section, documentVersion: passage.documentVersion, materialKind: "reference" }], status: "supported", mode: "live", evidenceStatus: "verified", selectedStructureId: structureId, learningLevel: "basic" };
  h = add(h, { type: "tutor-replied", questionId: question.id, reply });
  assert.equal(S.sessionActivity(h.sessions[0]).questions[0].reply.answer, reply.answer);
  assert.match(JSON.stringify(generateSummary(h.sessions[0], catalogue)), /FICTIONAL VALIDATION ANSWER/);
  const stale = { ...catalogue, sources: catalogue.sources.map(s => ({ ...s, documentVersion: "changed" })) };
  const staleReview = generateSummary(h.sessions[0], stale);
  assert.doesNotMatch(JSON.stringify(staleReview.sections.find(s => s.title === "Key takeaways")), /FICTIONAL VALIDATION ANSWER/);
  assert.match(JSON.stringify(staleReview), /could not be verified/);
  const unavailable = generateSummary(h.sessions[0], null); assert.match(JSON.stringify(unavailable.sections.find(s => s.title === "Original tutor answers")), /FICTIONAL VALIDATION ANSWER/);
  let mocked = reviewed(); const q = event({ type: "question-asked", question: "What is the coronary sinus?", structureId, level: "basic" }); mocked = S.appendEvent(mocked, mocked.activeId, q);
  mocked = add(mocked, { type: "tutor-replied", questionId: q.id, reply: { ...reply, answer: "UNSUPPORTED MEDICAL CLAIM", mode: "mock", status: "mock", evidenceStatus: "synthetic", sources: [] } });
  const mockReview = generateSummary(mocked.sessions[0], catalogue);
  assert.doesNotMatch(JSON.stringify(mockReview.sections.find(s => s.title === "Key takeaways")), /UNSUPPORTED MEDICAL CLAIM/);
  assert.match(JSON.stringify(mockReview), /Mock preview/);
});
test("summary contains only actual reviewed passages, explicit confusion, unanswered questions and quiz misses", () => {
  let h = reviewed(); h = add(h, { type: "confusion-noted", structureId, text: "Review this topic" });
  const summary = generateSummary(h.sessions[0], catalogue);
  assert.doesNotMatch(JSON.stringify(summary), /fictional violet/); assert.match(JSON.stringify(summary), /No AI summary has been generated/); assert.match(JSON.stringify(summary), /Review this topic/);
  assert.equal(summary.sections.some(s => s.title === "Clinical Correlations"), false);
  assert.doesNotMatch(JSON.stringify(generateSummary(h.sessions[0], { ...catalogue, passages: [{ ...passage, documentVersion: "changed" }] })), /fictional violet/);
});
test("quiz selection requires explicit reviewed evidence and exact learning level; stale versions fail closed", () => {
  const h = reviewed(), pool = Q.questionPool(h.sessions[0], [passage], "basic");
  assert.equal(pool.length, 2); assert.deepEqual(pool.map(q => q.kind).sort(), ["identification", "multiple-choice"]);
  assert.deepEqual(Q.questionPool(h.sessions[0], [passage], "advanced"), []);
  assert.deepEqual(Q.questionPool(h.sessions[0], [{ ...passage, documentVersion: "changed" }], "basic"), []);
  assert.deepEqual(Q.questionPool(S.newHistory("empty", at).sessions[0], [passage], "basic"), []);
  assert.equal(Q.selectQuestions(pool).length, 2); assert.throws(() => Q.selectQuestions(pool, 16));
  assert.doesNotMatch(pool.find(q => q.kind === "multiple-choice").prompt, /coronary sinus/i);
});
test("quiz validation, feedback, scores, missed prioritisation and completion are deterministic", () => {
  let h = reviewed(); const pool = Q.questionPool(h.sessions[0], [passage], "basic");
  const correct = Q.validateAnswer(pool[0], structureId), wrong = Q.validateAnswer(pool[1], "ascending-aorta");
  assert.equal(correct.correct, true); assert.equal(wrong.correct, false); assert.throws(() => Q.validateAnswer(pool[0], "invalid"));
  assert.deepEqual(Q.scoreQuiz([correct, wrong]), { correct: 1, total: 2, percentage: 50, demonstrated: [correct.concept], revisit: [wrong.concept] });
  h = add(h, { type: "quiz-completed", attemptId: "attempt-1", level: "basic", results: [correct, wrong] });
  assert.equal(Q.questionPool(h.sessions[0], [passage], "basic")[0].id, wrong.questionId);
  assert.equal(Q.selectQuestions(pool, 5, [wrong.questionId]).length, 1);
  assert.doesNotMatch(JSON.stringify(generateSummary(h.sessions[0], catalogue)), /50%|information-card openings/);
});
test("application questions require reviewed bank metadata and exact already-reviewed evidence", () => {
  const session = reviewed().sessions[0], base = Q.questionPool(session, [passage], "basic")[0];
  const bankQuestion = { ...base, id: "reviewed-application", kind: "application", reviewStatus: "reviewed", reviewedBy: "TEST REVIEWER ONLY", reviewedOn: "2026-10-12" };
  assert.ok(Q.questionPool(session, [passage], "basic", [bankQuestion]).some(q => q.id === bankQuestion.id));
  assert.ok(!Q.questionPool(session, [passage], "basic", [{ ...bankQuestion, reviewedBy: "" }]).some(q => q.id === bankQuestion.id));
});
test("one shared source passage can assess distinct visited structures without merging question IDs", () => {
  let h = reviewed(); h = add(h, { type: "card-opened", structureId: "ascending-aorta", level: "basic" });
  h = add(h, { type: "passage-reviewed", structureId: "ascending-aorta", level: "basic", citation: { sourceId: passage.sourceId, documentVersion: passage.documentVersion, passageId: passage.id } });
  const text = "SYNTHETIC TEST ONLY: The coronary sinus and ascending aorta are fictional practice labels.";
  const pool = Q.questionPool(h.sessions[0], [{ ...passage, text }, { ...passage, text, structureId: "ascending-aorta" }], "basic");
  assert.equal(pool.length, 4); assert.equal(new Set(pool.map(q => q.id)).size, 4);
});
test("Word export preserves all validated summary text and clickable source URLs", async () => {
  const session = reviewed().sessions[0];
  const R = loadTypeScript("lib/learning/lesson-review.ts"), input = R.collectReviewInput(session, "basic"), c = R.reviewChoices(input, catalogue);
  const review = R.applyReviewSelection(input, catalogue, { introduction:c.introductions[0], closing:c.closings[0], structures:input.structures, questions:[], takeawayIds:c.candidates.slice(0,4).map(t=>t.id), personalisation:{ introduction:"Your exploration recap.", closing:"", questions:[], takeaways:[{text:passage.text, evidenceIds:[passage.id], kind:"reference", questionIds:[]}] } });
  const summary = generateSummary(session, catalogue, review);
  const bytes = await Packer.toBuffer(summaryDocument(summary));
  const zip = await JSZip.loadAsync(bytes), xml = await zip.file("word/document.xml").async("string");
  assert.match(xml, /Your lesson review/); assert.match(xml, /fictional violet teaching beads/);
  for (const section of summary.sections) assert.ok(xml.includes(section.title));
  const links = await zip.file("word/_rels/document.xml.rels").async("string"); assert.ok(links.includes(passage.url));
  assert.ok(await zip.file("word/styles.xml").async("string"));
  fs.mkdirSync(".next/cache/learning-test-output", { recursive: true }); fs.writeFileSync(".next/cache/learning-test-output/fixture-summary.docx", bytes);
});
