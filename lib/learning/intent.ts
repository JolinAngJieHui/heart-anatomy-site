import { resolveAnatomicalTerms } from "../tutor/terminology";
import type { HeartPartId } from "../heart-parts";
export type LearningIntent = { type: "review" } | { type: "quiz"; count: number; focusIds?: HeartPartId[] };

/** Workflow requests are application commands, not medical questions. */
export function learningIntent(text: string): LearningIntent | null {
  const q = text.trim();
  // Do not exempt a personal medical request merely because it mentions a quiz.
  if (/\b(symptom|patient|diagnos|prescrib|chest pain|medical record)\w*\b|@|\d{7}/i.test(q)) return null;
  if (/^(?:please\s+)?(?:(?:can|could|would) you\s+)?(?:quiz me|test me|(?:give|make|create|start|generate)(?: me)?(?: a)?(?: \d+[- ]question)?(?: personalised| personalized)? quiz)\b/i.test(q)) {
    const focusIds = resolveAnatomicalTerms(q).matches.find(m => m.usable)?.structureIds;
    return { type: "quiz", count: 5, ...(focusIds?.length ? { focusIds } : {}) };
  }
  if (/\b(summari[sz]e|review|recap)\b/i.test(q)
    && /\b(my|this|the|our)\s+(session|lesson|learning|activity|exploration)\b|\bwhat (?:I|we) (?:explored|learned|learnt|covered)\b/i.test(q)
    && !/\b(explain|pain|disease|treatment)\b/i.test(q)) return { type: "review" };
  return null;
}
