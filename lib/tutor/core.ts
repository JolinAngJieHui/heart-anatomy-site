import { HEART_PARTS } from "../heart-parts";
import { chatRequestSchema } from "./schema";
import type { Passage, Source, TutorRequest, TutorResponse } from "./types";
import { validateReference, externalIndexingAllowed } from "../knowledge-base/registry";
import { learningIntent } from "../learning/intent";

export const REFUSAL = "I could not find enough supporting passages in the approved collection for this question. Try a narrower question; this search does not establish that the full articles contain no answer.";
export function validateRequest(value: unknown): TutorRequest {
  const parsed = chatRequestSchema.safeParse(value);
  if (!parsed.success) throw new Error("Invalid question, anatomy context or conversation.");
  return parsed.data;
}
export function approved(source: Source): boolean {
  try { return validateReference(source).status === "approved"; } catch { return false; }
}
export function unsafeQuestion(question: string): boolean {
  if (learningIntent(question)) question = question.replace(/\bmy\s+(session|lesson|learning|activity|exploration|review)\b/gi, "the $1");
  return /\b(my|i have|i am|i'm|patient|medical record|date of birth|diagnose me|prescribe|dosage)\b|[\w.+-]+@[\w.-]+\.[a-z]{2,}|\b\d{7,}\b/i.test(question);
}
export function injection(text: string): boolean {
  return /ignore.{0,40}(instructions|rules|previous)|system prompt|developer message|api[_ -]?key|execute.{0,20}(code|javascript)|follow these instructions/i.test(text);
}
export function queryFor(input: TutorRequest): string {
  const part = HEART_PARTS.find(p => p.id === input.selectedStructureId);
  return [input.question, part ? `Selected structure: ${part.name} (${part.shortName})` : "Cardiovascular anatomy and physiology"].join("\n");
}
export function processResults(data: unknown[], sources: Source[], indexed: { sourceId: string; fileId: string }[]): Passage[] {
  const result: Passage[] = [];
  for (const raw of data) {
    if (!raw || typeof raw !== "object") continue;
    const row = raw as { file_id?: string; score?: number; content?: { type: string; text?: string }[] };
    const entry = indexed.find(i => i.fileId === row.file_id);
    const source = sources.find(s => s.id === entry?.sourceId);
    if (!source || !approved(source) || !externalIndexingAllowed(source) || typeof row.score !== "number" || row.score < .65) continue;
    const text = (Array.isArray(row.content) ? row.content : []).filter(c => c.type === "text" && typeof c.text === "string").map(c => c.text).join("\n").slice(0, 5000);
    if (text.length < 80 || injection(text)) continue;
    result.push({ id: `P${result.length + 1}`, source, text, score: row.score });
    if (result.length === 6) break;
  }
  return result;
}
export function validateClaims(value: unknown, passages: Pick<Passage, "id" | "text">[]): { text: string; ids: string[] }[] | null {
  if (!value || typeof value !== "object") return null;
  const v = value as { sufficient?: boolean; claims?: { text?: unknown; passageIds?: unknown; quotes?: unknown }[] };
  if (v.sufficient !== true || !Array.isArray(v.claims) || !v.claims.length || v.claims.length > 10) return null;
  const claims: { text: string; ids: string[] }[] = [];
  for (const c of v.claims) {
    if (typeof c.text !== "string" || !c.text.trim() || c.text.length > 1000 || /https?:\/\/|\[[^\]]+\]/.test(c.text) || injection(c.text)) return null;
    if (!Array.isArray(c.passageIds) || !Array.isArray(c.quotes) || !c.passageIds.length || !c.quotes.length) return null;
    const passageIds = c.passageIds;
    const quotes = c.quotes;
    // Multiple quotations can unambiguously support one cited passage. For
    // multiple passage IDs, retain strict positional pairing; never guess.
    if (passageIds.length !== 1 && passageIds.length !== quotes.length) return null;
    for (let i = 0; i < quotes.length; i++) {
      const p = passages.find(p => p.id === passageIds[passageIds.length === 1 ? 0 : i]);
      const quote = quotes[i];
      if (!p || typeof quote !== "string" || quote.length < 20 || !p.text.includes(quote)) return null;
    }
    claims.push({ text: c.text, ids: c.passageIds as string[] });
  }
  return claims.reduce((n, c) => n + c.text.length, 0) <= 5000 ? claims : null;
}
export function result(input: TutorRequest, mode: TutorResponse["mode"], status: TutorResponse["status"], answer = REFUSAL): TutorResponse {
  return { answer, sources: [], status, mode, selectedStructureId: input.selectedStructureId, learningLevel: input.learningLevel };
}

/** References and uncited explanations have separate validation paths. Legacy
 * grounded-only drafts remain readable, but cannot become general AI answers. */
export function validateTutorDraft(value: unknown, passages: Pick<Passage, "id" | "text">[]) {
  if (!value || typeof value !== "object") return null;
  const v = value as Record<string, unknown>;
  if (typeof v.sufficient !== "boolean" || !Array.isArray(v.claims) || Object.keys(v).some(k => !["sufficient", "claims", "generalExplanation", "uncertainty", "targetId"].includes(k))) return null;
  const generalExplanation = v.generalExplanation ?? "", uncertainty = v.uncertainty ?? "";
  const validProse = (text: unknown, max: number): text is string => typeof text === "string" && text.length <= max && !/https?:\/\/|www\.|\[[^\]]+\]/i.test(text) && !injection(text);
  if (!validProse(generalExplanation, 4000) || !validProse(uncertainty, 900)) return null;
  const claims = v.claims.length ? validateClaims({ sufficient: true, claims: v.claims }, passages) : [];
  if (!claims || (!v.sufficient && (claims.length || generalExplanation.trim())) || (v.sufficient && !claims.length && !generalExplanation.trim())) return null;
  if (claims.reduce((n, c) => n + c.text.length, 0) + generalExplanation.length + uncertainty.length > 5800) return null;
  return { claims, generalExplanation: generalExplanation.trim(), uncertainty: uncertainty.trim() };
}
