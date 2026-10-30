import { HEART_PARTS, type HeartPartId } from "../heart-parts";
import type { LearningLevel } from "../education";
import { sessionActivity, type LearningSession } from "./session";
import { citationMatches, type LearningPassage } from "./evidence";
import { ANATOMICAL_SYNONYMS } from "../knowledge-base/anatomical-synonyms";
import { resolveAnatomicalTerms } from "../tutor/terminology";
import { z } from "zod";
export type QuizQuestion = {
  id: string; structureId: HeartPartId; level: LearningLevel; kind: "multiple-choice" | "identification" | "application" | "identify-vessel" | "locate-vessel";
  prompt: string; options: { id: string; label: string }[]; correctAnswer: string; concept: string;
  explanation: string; evidence: LearningPassage; supportingEvidence?: LearningPassage[]; reviewStatus: "reviewed" | "source-template-practice" | "ai-verified";
};
export type ReviewedQuestion = QuizQuestion & { reviewedBy: string; reviewedOn: string };
const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
function maskTerm(text: string, partId: HeartPartId) {
  const part = HEART_PARTS.find(p => p.id === partId)!;
  const terms = [part.name, part.shortName, ...ANATOMICAL_SYNONYMS[partId].aliases].filter(t => t.length > 2).sort((a, b) => b.length - a.length);
  const pattern = new RegExp(`\\b(?:${terms.map(t => t.split(/[\s–—-]+/).map(escape).join("[\\s–—-]+")).join("|")})\\b`, "gi");
  return text.replace(pattern, "[structure]");
}
/** Literal source recall and inventory identification; no generated medical claims.
 * Application questions can enter only through an explicitly reviewed bank. */
export function questionPool(session: LearningSession, passages: LearningPassage[], level: LearningLevel, bank: ReviewedQuestion[] = []): QuizQuestion[] {
  const a = sessionActivity(session), visited = new Set(a.structures.map(p => p.id));
  const reviewed = passages.filter(p => typeof p.text === "string" && p.text.length <= 2000 && (!p.reviewStatus || p.reviewStatus === "approved") && visited.has(p.structureId) && p.levels.includes(level) && p.domain !== "clinical" && resolveAnatomicalTerms(p.text).matches.some(m => m.usable && m.structureIds.length === 1 && m.structureIds[0] === p.structureId) && a.reviews.some(r => r.level === level && r.structureId === p.structureId && citationMatches(p, r.citation)));
  const approvedBank = bank.filter(q => q && q.reviewStatus === "reviewed" && typeof q.reviewedBy === "string" && q.reviewedBy.trim() && z.iso.date().safeParse(q.reviewedOn).success && q.level === level && q.evidence && typeof q.prompt === "string" && typeof q.explanation === "string" && ["multiple-choice", "identification", "application"].includes(q.kind) && reviewed.some(p => p.id === q.evidence.id && p.documentVersion === q.evidence.documentVersion && p.sourceId === q.evidence.sourceId && p.text === q.evidence.text && p.structureId === q.structureId) && Array.isArray(q.options) && q.options.length >= 2 && new Set(q.options.map(o => o.id)).size === q.options.length && q.options.every(o => HEART_PARTS.some(p => p.id === o.id && p.name === o.label)) && q.options.some(o => o.id === q.correctAnswer));
  const generated = reviewed.flatMap(p => {
    const part = HEART_PARTS.find(s => s.id === p.structureId)!;
    const masked = maskTerm(p.text, part.id);
    const first = masked.indexOf("[structure]");
    if (first < 0) return [];
    // Mask all answer aliases, including short abbreviations that would give it away.
    const short = ANATOMICAL_SYNONYMS[part.id].aliases.filter(t => t.length <= 2);
    const hidden = short.length ? masked.replace(new RegExp(`\\b(?:${short.map(escape).join("|")})\\b`, "g"), "[structure]") : masked;
    const start = Math.max(0, first - 90), end = Math.min(hidden.length, first + 300);
    const snippet = `${start ? "…" : ""}${hidden.slice(start, end)}${end < hidden.length ? "…" : ""}`;
    const candidates = HEART_PARTS.filter(s => s.id !== part.id);
    const distractors = candidates.slice(0, 3);
    const options = [part, ...distractors].sort((x, y) => x.id.localeCompare(y.id)).map(s => ({ id: s.id, label: s.name }));
    const common = { structureId: part.id, level, options, correctAnswer: part.id, explanation: p.text, evidence: p, reviewStatus: "source-template-practice" as const };
    return [
      { ...common, id: `recall-${part.id}-${p.id.slice(-45)}`, kind: "multiple-choice" as const, concept: `${part.name} · source passage recall`, prompt: `Which structure replaces [structure] in this passage you reviewed?\n\n${snippet}` },
      { ...common, id: `identify-${part.id}-${p.id.slice(-45)}`, kind: "identification" as const, concept: `${part.name} · numbered marker association`, prompt: `Select the numbered marker associated with ${part.name}.` },
    ];
  });
  const unique = [...approvedBank, ...generated].filter((q, i, all) => all.findIndex(x => x.id === q.id || (q.kind === "identification" && x.kind === q.kind && x.structureId === q.structureId)) === i);
  const latest = new Map(a.attempts.flatMap(t => t.results.map(r => [r.questionId, r.correct] as const)));
  const missed = new Set([...latest].filter(([, correct]) => !correct).map(([id]) => id));
  const discussed = new Set(a.questions.flatMap(q => q.topicIds));
  // Stable, fair interleaving gives multiple structures priority before repeated sources.
  return unique.sort((x, y) => Number(missed.has(y.id)) - Number(missed.has(x.id)) || Number(y.reviewStatus === "reviewed") - Number(x.reviewStatus === "reviewed") || Number(discussed.has(y.structureId)) - Number(discussed.has(x.structureId)) || Number(x.kind === "identification") - Number(y.kind === "identification") || x.id.localeCompare(y.id));
}
export function selectQuestions(pool: QuizQuestion[], count = 5, missedOnly: string[] | null = null) {
  if (!Number.isInteger(count) || count < 1 || count > 15) throw new Error("Choose between 1 and 15 questions");
  const source = missedOnly ? pool.filter(q => missedOnly.includes(q.id)) : pool;
  const chosen: QuizQuestion[] = [], used = new Set<string>();
  for (const q of source) { const key = `${q.structureId}:${q.kind}`; if (!used.has(key)) { chosen.push(q); used.add(key); } if (chosen.length === count) break; }
  if (chosen.length < count) chosen.push(...source.filter(q => !chosen.some(s => s.id === q.id)).slice(0, count - chosen.length));
  const identification = source.find(q => q.kind === "identification" && !chosen.some(s => s.id === q.id));
  if (identification && chosen.length > 1 && !chosen.some(q => q.kind === "identification") && chosen.at(-1)?.reviewStatus === "source-template-practice") chosen[chosen.length - 1] = identification;
  return chosen;
}
export function validateAnswer(question: QuizQuestion, chosen: string) {
  if (!((question.kind === "identification" || question.kind === "locate-vessel") ? HEART_PARTS.some(s => s.id === chosen) : question.options.some(o => o.id === chosen))) throw new Error("Invalid answer option");
  return { questionId: question.id, structureId: question.structureId, concept: question.concept, conceptId:`${question.structureId}:${question.kind}:${question.concept.toLowerCase().replace(/[^a-z0-9]+/g,"-")}`.slice(0,500), chosen, correct: chosen === question.correctAnswer,
    prompt: question.prompt, correctAnswer: question.correctAnswer, chosenLabel: question.options.find(o => o.id === chosen)?.label ?? getHeartPartName(chosen), correctLabel: question.options.find(o => o.id === question.correctAnswer)?.label ?? getHeartPartName(question.correctAnswer),
    explanation: question.explanation, kind: question.kind, options:question.options, supportingCitations:(question.supportingEvidence ?? [question.evidence]).map(p=>({sourceId:p.sourceId,documentVersion:p.documentVersion,passageId:p.id,title:p.title,url:p.url,section:p.section})), citation: { sourceId: question.evidence.sourceId, documentVersion: question.evidence.documentVersion, passageId: question.evidence.id, title:question.evidence.title,url:question.evidence.url,section:question.evidence.section } };
}
function getHeartPartName(id: string) { return HEART_PARTS.find(p => p.id === id)?.name ?? id; }
export function scoreQuiz(results: ReturnType<typeof validateAnswer>[]) {
  const correct = results.filter(r => r.correct).length;
  return { correct, total: results.length, percentage: results.length ? Math.round(correct / results.length * 100) : 0,
    demonstrated: [...new Set(results.filter(r => r.correct).map(r => r.concept))], revisit: [...new Set(results.filter(r => !r.correct).map(r => r.concept))] };
}
