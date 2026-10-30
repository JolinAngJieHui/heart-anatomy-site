import { z } from "zod";
import { HEART_PARTS, getHeartPart } from "../heart-parts";
import { ANATOMICAL_SYNONYMS } from "../knowledge-base/anatomical-synonyms";
import { lessonScope } from "./lesson-review";
import type { EvidenceCatalogue } from "./evidence";
import type { QuizInput } from "./quiz-personalisation";
import type { QuizQuestion } from "./quiz";
import { QuizPreparationError } from "./quiz-status";
import { retrieveQuizEvidence } from "./quiz-evidence";
import installedModel from "../../public/models/heart-model.json";

const structure = z.enum(HEART_PARTS.map(p => p.id));
const option = z.object({ id: z.string().min(1).max(100), label: z.string().min(1).max(300), structureId: structure.nullable() }).strict();
export const generatedQuestionSchema = z.object({
  structureId: structure, kind: z.enum(["multiple-choice", "identify-vessel", "locate-vessel"]),
  prompt: z.string().min(8).max(800), concept: z.string().min(1).max(300),
  // Visual choices and key are derived from the verified production mapping.
  options: z.array(option).min(3).max(5).nullable(),
  correctAnswer: z.string().min(1).max(100).nullable(), explanation: z.string().min(8).max(1000),
  evidenceIds: z.array(z.string().min(1).max(250)).min(1).max(6),
}).strict();
export const generatedQuizSchema = z.object({ questions: z.array(generatedQuestionSchema).min(1).max(5) }).strict();
const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const canonical = (label: string) => HEART_PARTS.find(p => [p.name, p.shortName, ...ANATOMICAL_SYNONYMS[p.id].aliases].some(a => normalize(a) === normalize(label)))?.id ?? normalize(label);
export function validateQuizCandidates(input: QuizInput, catalogue: EvidenceCatalogue, value: unknown): QuizQuestion[] {
  const candidate = value as { questions?: Record<string,unknown>[] };
  const parsed = generatedQuizSchema.parse({ ...candidate, questions: candidate?.questions?.map(q => q.kind !== "multiple-choice" ? { ...q, options: q.options ?? null, correctAnswer: q.correctAnswer ?? null } : q) });
  if (!input.review || input.count !== 5) throw Error("Quiz requires exactly five questions");
  const scope = input.focusIds ?? lessonScope(input.review.input), evidence = retrieveQuizEvidence(input, catalogue);
  const groups = Object.values(installedModel.highlightGroups);
  const seen = new Set<string>();
  return parsed.questions.map((raw, index) => {
    const q = { ...raw, options: raw.options ?? (raw.kind !== "multiple-choice" ? HEART_PARTS.filter(p => p.id === raw.structureId || p.id === "ascending-aorta" || p.id === "superior-vena-cava" || p.id === "coronary-sinus").map(p => ({ id: p.id, label: p.name, structureId: p.id })) : []), correctAnswer: raw.correctAnswer ?? (raw.kind !== "multiple-choice" ? raw.structureId : "") };
    if (q.options.length < 3) throw Error("Missing multiple-choice options");
    if (!scope.includes(q.structureId)) throw new QuizPreparationError("schema", "Assessed structure was not studied");
    if (seen.has(normalize(q.prompt))) throw new QuizPreparationError("duplicate", "Duplicate question"); seen.add(normalize(q.prompt));
    if (new Set(q.options.map(o => o.id)).size !== q.options.length || new Set(q.options.map(o => o.structureId ?? canonical(o.label))).size !== q.options.length) throw new QuizPreparationError("duplicate", "Duplicate or synonymous options");
    if (q.options.filter(o => o.id === q.correctAnswer).length !== 1) throw new QuizPreparationError("schema", "Invalid answer key");
    for (const o of q.options) if (o.structureId && canonical(o.label) !== o.structureId) throw new QuizPreparationError("schema", "Option label disagrees with anatomical ID");
    if (q.kind !== "multiple-choice") {
      if (!installedModel.structures[q.structureId]?.anchor) throw new QuizPreparationError("mapping", "No verified model anchor");
      if (q.options.some(o => o.structureId !== o.id) || q.correctAnswer !== q.structureId) throw new QuizPreparationError("mapping", "Model questions must score canonical anatomy IDs");
      if (q.kind === "identify-vessel" && groups.some(g => (g.structures as string[]).includes(q.structureId))) throw new QuizPreparationError("mapping", "A whole vessel highlight cannot identify one segment");
    }
    if (q.evidenceIds.some(id => !evidence.some(p => p.key === id))) throw new QuizPreparationError("schema", "Unknown evidence");
    const passages = q.evidenceIds.map(id => catalogue.passages.find(p => p.id === id)!);
    return { ...q, id: `generated-${input.generationId ?? "session"}-${index}`, level: input.level,
      options: q.options.map(o => ({ id: o.id, label: o.structureId ? getHeartPart(o.structureId)!.name : o.label })),
      evidence: passages[0], supportingEvidence: passages, reviewStatus: "ai-verified" };
  });
}

/** Only this final boundary may expose a complete attempt. */
export function validateGeneratedQuiz(input: QuizInput, catalogue: EvidenceCatalogue, value: unknown): QuizQuestion[] {
  const questions = validateQuizCandidates(input, catalogue, value);
  if (questions.length !== 5) throw Error("Quiz requires exactly five validated questions");
  return questions;
}
