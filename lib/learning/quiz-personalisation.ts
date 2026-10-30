import { z } from "zod";
import { LEARNING_INSTRUCTIONS } from "./level-instructions";
import { HEART_PARTS } from "../heart-parts";
import { LEARNING_LEVELS } from "../education";
import { newSession, sessionActivity, type LearningSession } from "./session";
import { questionPool, type QuizQuestion, type ReviewedQuestion } from "./quiz";
import type { EvidenceCatalogue } from "./evidence";
import { ragSettings, tokenUpperBound } from "../tutor/evidence-budget";
import { reviewSnapshotSchema, restoreReviewSnapshot, type ReviewSnapshot } from "./review-snapshot";
import { verifiedReply, lessonScope } from "./lesson-review";

const structure = z.enum(HEART_PARTS.map(p => p.id));
export const quizRequestSchema = z.object({
  levelInstructions: z.string().max(500).optional(),
  generationId: z.string().max(64).regex(/^[a-zA-Z0-9-]+$/).optional(),
  level: z.enum(LEARNING_LEVELS), count: z.literal(5),
  focusIds: z.array(structure).min(1).max(17).optional(),
  review: reviewSnapshotSchema.optional(),
  structures: z.array(structure).max(17),
  reviewed: z.array(z.object({ structureId: structure, sourceId: z.string().max(100), passageId: z.string().max(250), documentVersion: z.string().max(64) }).strict()).max(200),
  topics: z.array(structure).max(17),
  results: z.array(z.object({ questionId: z.string().max(120), correct: z.boolean() }).strict()).max(150),
}).strict();
export type QuizInput = z.infer<typeof quizRequestSchema>;
export function collectQuizInput(session: LearningSession, level: QuizInput["level"], count: QuizInput["count"], review?: ReviewSnapshot): QuizInput {
  const activity = sessionActivity(session);
  return { level, count, levelInstructions: LEARNING_INSTRUCTIONS[level], ...(review ? { review } : {}), structures: activity.structures.map(p => p.id),
    reviewed: activity.reviews.filter(r => r.level === level).map(r => ({ structureId: r.structureId, ...r.citation })).slice(-200),
    topics: [...new Set(activity.questions.flatMap(q => q.topicIds))],
    results: activity.attempts.flatMap(a => a.results.map(r => ({ questionId: r.questionId, correct: r.correct }))).slice(-150) };
}
export function quizCandidates(input: QuizInput, catalogue: EvidenceCatalogue, bank: ReviewedQuestion[] = []) {
  let structures = input.structures, reviewed = input.reviewed;
  if (input.review) {
    const review = restoreReviewSnapshot(input.review, catalogue);
    if (review.level !== input.level) throw new Error("Quiz level differs from its review");
    // Review controls scope; only original, approved source text supplies answers.
    const citations = [...review.takeaways.flatMap(t => t.sources), ...input.review.input.questions.filter(q => verifiedReply(q.reply, catalogue)).flatMap(q => q.reply!.sources)];
    const scope = input.focusIds ?? lessonScope(input.review.input);
    const passages = catalogue.passages.filter(p => scope.includes(p.structureId) && (p.domain !== "clinical" || citations.some(c => c.sourceId === p.sourceId && c.documentVersion === p.documentVersion && c.passageId === p.id)));
    structures = scope;
    reviewed = passages.map(p => ({ structureId: p.structureId, sourceId: p.sourceId, passageId: p.id, documentVersion: p.documentVersion }));
  }
  // Rebuild from trusted, hash-validated source text; never accept browser keys,
  // model-written review claims or supplied explanation text as quiz evidence.
  const session = newSession("quiz-input", "2000-01-01T00:00:00.000Z");
  session.events = [
    ...structures.map((structureId, i) => ({ id: `s${i}`, at: session.startedAt, type: "card-opened" as const, structureId, level: input.level })),
    ...reviewed.map(({ structureId, ...citation }, i) => ({ id: `r${i}`, at: session.startedAt, type: "passage-reviewed" as const, structureId, level: input.level, citation })),
  ];
  const latest = new Map(input.results.map(r => [r.questionId, r.correct]));
  const pool = questionPool(session, catalogue.passages, input.level, bank).sort((a, b) => Number(latest.get(b.id) === false) - Number(latest.get(a.id) === false) || Number(input.topics.includes(b.structureId)) - Number(input.topics.includes(a.structureId)));
  const selected: QuizQuestion[] = [];
  const settings = catalogue.quizLimits ?? ragSettings(), passages = new Set<string>();
  for (const q of pool) {
    if (selected.length >= 30 || (!passages.has(q.evidence.id) && passages.size >= settings.topK)) continue;
    if (tokenUpperBound(quizEvidence([...selected, q])) > settings.maxTokens) continue;
    selected.push(q); passages.add(q.evidence.id);
  }
  return selected;
}
export function quizEvidence(pool: QuizQuestion[]) {
  return { passages: pool.filter((q, i) => pool.findIndex(p => p.evidence.id === q.evidence.id) === i).map(q => ({
    id: q.evidence.id, sourceId: q.evidence.sourceId, title: q.evidence.title, url: q.evidence.url,
    section: q.evidence.section, text: q.evidence.text, qualifications: q.evidence.pattern,
  })) };
}
export const quizSelectionSchema = z.object({ questionIds: z.array(z.string()).min(1).max(15) }).strict();
export function applyQuizSelection(pool: QuizQuestion[], count: number, value: unknown) {
  const selection = quizSelectionSchema.parse(value);
  if (count !== 5 || selection.questionIds.length !== 5 || pool.length < 5 || new Set(selection.questionIds).size !== selection.questionIds.length) throw new Error("A quiz requires exactly five validated questions");
  return selection.questionIds.map(id => { const q = pool.find(q => q.id === id); if (!q) throw new Error("Unknown quiz question"); return q; });
}
