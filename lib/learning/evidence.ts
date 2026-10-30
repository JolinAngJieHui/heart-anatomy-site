import type { HeartPartId } from "../heart-parts";
import type { LearningLevel } from "../education";
import { questionProfile } from "../tutor/question-relevance";
export type LearningPassage = {
  id: string; structureId: HeartPartId; text: string; sourceId: string; title: string; url: string;
  section: string; documentVersion: string; pattern: string; domain: "anatomy" | "physiology" | "clinical";
  levels: LearningLevel[]; matchedTerm: string;
  reviewStatus?: string;
};
export type EvidenceCatalogue = { passages: LearningPassage[]; sources: { id: string; title: string; url: string; documentVersion: string; available: boolean; reviewStatus?: string; externalProcessingAllowed?: boolean }[]; gaps: { structureId: HeartPartId; reason: string }[]; mode: "approved-local" | "review-local"; generatedAt: string; quizLimits?: { topK: number; maxTokens: number } };
export function citationMatches(p: LearningPassage, c: { sourceId: string; documentVersion: string; passageId: string }) {
  return p.sourceId === c.sourceId && p.documentVersion === c.documentVersion && p.id === c.passageId;
}
export function permittedEvidence(catalogue: EvidenceCatalogue | null): EvidenceCatalogue | null {
  if (!catalogue) return null;
  const sources = catalogue.sources.filter(s => s.available && s.externalProcessingAllowed && (!s.reviewStatus || s.reviewStatus === "approved"));
  return { ...catalogue, sources, passages: catalogue.passages.filter(p => sources.some(s => s.id === p.sourceId && s.documentVersion === p.documentVersion)), gaps: [] };
}
export function ordinaryTeachingPassage(text: string, section: string, articleType = "", pattern = "") {
  if (/case\b|case.report|individual case|variation\/pathology/i.test(`${section} ${articleType} ${pattern}`)) return false;
  // These clinical abbreviations and observations are missed by ordinary question
  // vocabulary. Keep entire qualified passages intact instead of dropping context.
  if (/\b(obstruct\w*|blockage\w*|blocks|SVCS|BAV|TAV|CRT|pacing|collaterals?|\d{1,3}.year.old|patient)\b|AS\/AI|cusp fusion|may also arise|Kugel/i.test(`${section} ${text}`)) return false;
  const domain = questionProfile(`${section} ${text}`).domain;
  return domain === "normal-anatomy" || domain === "physiology";
}
