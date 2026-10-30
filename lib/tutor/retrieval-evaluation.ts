import type { EvidencePassage } from "./retrieval";
import type { HeartPartId } from "../heart-parts";
import { resolveAnatomicalTerms } from "./terminology";

/** A conservative retrieval diagnostic, never a scientific approval or answer. */
export function evaluateSupport(passages: EvidencePassage[], requiredIds: readonly HeartPartId[] = []) {
  const synthetic = passages.some(p => p.source.materialKind === "synthetic");
  const missingStructureIds = requiredIds.filter(id => !passages.some(p => resolveAnatomicalTerms(p.text).matches.some(m => m.usable && m.kind !== "whole-vessel" && m.structureIds.includes(id))));
  const textSupported = passages.some(p => p.relevance?.answerFit?.evidenceStrength === "direct-text-candidate");
  return {
    status: synthetic ? "synthetic-routing-only" : !passages.length ? "insufficient" : missingStructureIds.length || !textSupported ? "weak-support" : "possible-support-needs-review",
    sufficientScientificEvidence: false,
    missingStructureIds,
    relevanceScoresAreScientificConfidence: false,
    warnings: [...new Set(passages.flatMap(p => p.relevance?.answerFit?.warnings ?? []))],
    missingQuestionAspects: passages.length ? [...new Set(passages.flatMap(p => p.relevance?.answerFit?.missedFacets ?? []))].filter(facet => passages.every(p => p.relevance?.answerFit?.missedFacets.includes(facet))) : [],
    missingComparisonTargets: [...new Set(passages.flatMap(p => p.relevance?.answerFit?.targetLabels ?? []))].filter(label => !passages.some(p => {
      const fit = p.relevance?.answerFit;
      return fit && fit.matchedTargets[fit.targetLabels.indexOf(label)];
    })),
    explanation: synthetic ? "Fictional fixtures test routing only; no anatomical answer is supported." : !passages.length ? "No eligible local passages matched the requested structures and aspects." : "Directness is a text-feature diagnostic, not proof of correctness or completeness. Ranking scores are not scientific confidence. Review unanswered aspects and case qualifications.",
  };
}
