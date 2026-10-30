import assert from "node:assert/strict";
import { test } from "node:test";
import { load } from "./helpers/load-module.mjs";
const R = load("lib/learning/lesson-review.ts");
const { generateSummary } = load("lib/learning/summary.ts");
const { newSession } = load("lib/learning/session.ts");
const { generateLessonReview } = load("lib/learning/review-generation.ts");
const source = { id: "fixture", sourceId: "fixture", title: "Synthetic test reference", url: "https://example.org/fixture", section: "Test", documentVersion: "1", materialKind: "reference", available: true, reviewStatus: "approved", externalProcessingAllowed: true };
const catalogue = { sources: [source], passages: [{ id: "p1", structureId: "coronary-sinus", text: "Synthetic fixture content, not anatomy.", pattern: "Test only.", sourceId: source.id, documentVersion: "1", title: source.title, url: source.url, section: source.section, levels: ["basic", "intermediate", "advanced"], domain: "anatomy", reviewStatus: "approved" }], gaps: [], mode: "approved-local", generatedAt: "test" };
const input = { structures: ["coronary-sinus"], questions: [], level: "basic", levels: ["basic"] };
const point = { text: "Synthetic fixture content, not anatomy.", evidenceIds: ["p1"], kind: "reference", questionIds: [] };
function selection(prose = {}, data = input) {
  const c = R.reviewChoices(data, catalogue);
  return { introduction: c.introductions[0], closing: c.closings[0], structures: data.structures, questions: data.questions.map(q => ({ id: q.id, paragraphIndexes: [] })), takeawayIds: c.candidates.slice(0, 4).map(t => t.id), personalisation: { title: "A fixture lesson", introduction: "You explored a structure in this test.", overview: { ...point, text: "A supported fixture overview." }, closing: "", questions: [], takeaways: [{ ...point, heading: "A fixture point" }], ...prose } };
}
test("generated title, overview, headings, full explanations and citations survive rendering data and export", () => {
  for (const count of [1, 2, 5]) {
    const text = "Full fixture explanation. ".repeat(25);
    const review = R.applyReviewSelection(input, catalogue, selection({ takeaways: Array.from({ length: count }, (_, i) => ({ ...point, heading: `Actual heading ${i + 1}`, text })) }));
    assert.equal(review.title, "A fixture lesson");
    assert.equal(review.takeaways.length, count);
    assert.equal(review.takeaways.at(-1).text, text);
    assert.equal(review.overview.sources[0].sourceId, source.id);
    const summary = generateSummary(newSession("current", "2026-10-22T01:00:00Z"), catalogue, { ...review, structures: [...review.structures, ...review.structures] });
    assert.equal(summary.title, review.title);
    assert.match(summary.sections.find(s => s.title === "Overview").paragraphs[0], /A supported fixture overview/);
    const takeaways = summary.sections.find(s => s.title === "Key takeaways").paragraphs;
    assert.equal(takeaways.length, count);
    assert.ok(takeaways.at(-1).includes(text));
    assert.ok(takeaways.at(-1).includes(`Actual heading ${count}`));
    assert.ok(takeaways.at(-1).includes(source.url));
    assert.deepEqual(summary.sections.find(s => s.title === "Vessels explored").paragraphs, ["Coronary Sinus"]);
  }
});
test("legacy cached output needs no formatting request; absent or repeated overview is omitted", () => {
  const chosen = selection(); delete chosen.personalisation.title; delete chosen.personalisation.overview; delete chosen.personalisation.takeaways[0].heading;
  const review = R.applyReviewSelection(input, catalogue, chosen);
  assert.equal(review.title, undefined); assert.equal(review.overview, undefined); assert.equal(review.takeaways[0].heading, undefined);
  const exported = generateSummary(newSession("current", "2026-10-22T01:00:00Z"), catalogue, review);
  assert.equal(exported.title, "Your lesson review"); assert.ok(!exported.sections.some(s => s.title === "Overview"));
  for (const overview of [null, { ...point, text: chosen.personalisation.introduction }]) assert.equal(R.applyReviewSelection(input, catalogue, selection({ overview })).overview, undefined);
});
test("malformed layout fields and unsupported overview provenance are rejected", () => {
  for (const patch of [{ title: 7 }, { title: " " }, { title: "x".repeat(161) }, { overview: { ...point, evidenceIds: ["invented"] } }, { overview: { ...point, text: "Forged [R12] citation" } }, { overview: { ...point, kind: "general", evidenceIds: [] } }, { takeaways: [{ ...point, heading: [] }] }]) assert.throws(() => R.applyReviewSelection(input, catalogue, selection(patch)));
});
test("general overview retains its notice and never gains reference citations", () => {
  const data = { ...input, questions: [{ id: "q1", question: "A synthetic general question", level: "basic", reply: { mode: "live", status: "general_knowledge", evidenceStatus: "unverified", answer: "A synthetic general explanation with uncertainty.", sources: [], sections: [{ kind: "general", text: "A synthetic general explanation with uncertainty.", sourceIds: [] }] } }] };
  const review = R.applyReviewSelection(data, catalogue, selection({ overview: { text: "A synthetic general explanation with uncertainty.", kind: "general", questionIds: ["q1"], evidenceIds: [] } }, data));
  assert.deepEqual(review.overview.sources, []);
  const summary = generateSummary(newSession("current", "2026-10-22T01:00:00Z"), catalogue, review);
  assert.match(summary.sections.find(s => s.title === "Overview").paragraphs[0], /Not verified against this website/);
});
test("all presentation fields use the existing generation and audit calls at every learning level", async () => {
  for (const level of ["basic", "intermediate", "advanced"]) {
    let calls = 0;
    const client = { responses: { parse: async args => {
      calls++;
      if (calls === 1) {
        const schema = args.text.format.schema;
        assert.ok(schema.required.includes("title")); assert.ok(schema.required.includes("overview"));
        assert.ok(schema.properties.takeaways.items.required.includes("heading"));
        assert.equal(JSON.parse(args.input).session.level, level);
        assert.match(args.instructions, /return overview null/);
        return { status: "completed", output_parsed: selection().personalisation };
      }
      assert.match(args.instructions, /headings/);
      return { status: "completed", output_parsed: { supported: true, issues: [] } };
    } } };
    const generated = await generateLessonReview(client, "mocked-model", { ...input, level }, catalogue, new AbortController().signal);
    assert.equal(calls, 2); assert.equal(generated.personalisation.title, "A fixture lesson");
  }
});
