import { selectEvidence, ragSettings } from "./evidence-budget";
import { sha256 } from "../knowledge-base/documents";
import { injection, REFUSAL, result, unsafeQuestion, validateClaims, validateTutorDraft, validateRequest } from "./core";
import type { GenerationProvider } from "./generation";
import type { EvidencePassage, RetrievalProvider } from "./retrieval";
import type { TutorAnswerSection, TutorRequest, TutorResponse } from "./types";
import { withSignal } from "./deadline";
import { answerWithProvenance } from "./answer-provenance";

export function assessEvidence(passages: EvidencePassage[], mode: "mock" | "live") {
  if (!passages.length) return false;
  // A preflight gate only. Scientific sufficiency still needs claim validation
  // and conservative entailment verification; scores never establish truth.
  return passages.length <= 12 && new Set(passages.map(p => p.citationId)).size === passages.length && passages.every(p => p.text.length >= 80 && p.text.length <= 5000 && !injection(p.text) && Number.isFinite(p.score) && (mode === "live" && p.relevance?.answerFit ? p.relevance.answerFit.eligible && p.relevance.questionMatch : p.score >= (mode === "live" ? .65 : .2)) && p.source.materialKind === (mode === "mock" ? "synthetic" : "reference"));
}
export async function runPipeline(raw: TutorRequest, retrieval: RetrievalProvider, generation: GenerationProvider, signal: AbortSignal): Promise<TutorResponse> {
  const input = validateRequest(raw), mode = generation.mode;
  const wrap = (response: TutorResponse, evidenceStatus: TutorResponse["evidenceStatus"]): TutorResponse => ({ ...response, evidenceStatus, schemaVersion: 1, responseId: `chat-${sha256(JSON.stringify({ input, mode, answer: response.answer, sources: response.sources })).slice(0, 24)}` });
  if ([input.question, ...(input.conversation ?? []).map(m => m.content)].some(unsafeQuestion)) return wrap(result(input, mode, "unsupported", "Please ask a general educational question without personal or patient information. This tutor cannot diagnose or recommend treatment."), "insufficient");
  let candidates: EvidencePassage[];
  try {
    candidates = await withSignal(retrieval.retrieve({ ...input, maxPassages: 12 }, signal), signal);
    // A multi-part question can contain terms absent from every passage. Search
    // its explicit subquestions locally so a covered part is not lost to the
    // strict whole-question relevance filter. Never add remote/API searches.
    const parts = input.question.split(/[?;]\s+|(?:,\s*)?\b(?:and|also)\s+(?=(?:what|how|why|where|when|which|explain|describe|compare)\b)/i).map(s => s.trim()).filter(s => s.length >= 8).slice(0, 3);
    if (mode === "live" && retrieval.mode === "local" && parts.length > 1) {
      const groups = await Promise.all(parts.map(question => withSignal(retrieval.retrieve({ ...input, question, maxPassages: 6 }, signal), signal)));
      candidates = [...new Map([...candidates, ...groups.flat()].map(p => [p.id, p])).values()].map((p, i) => ({ ...p, citationId: `P${i + 1}` }));
    }
  }
  catch (error) { if (error instanceof Error && !signal.aborted) Object.assign(error, { retrievalFailed: true }); throw error; }
  const settings = ragSettings();
  if (mode === "live") candidates = candidates.filter(p => assessEvidence([p], mode));
  let passages = selectEvidence(candidates, input, settings);
  // Retrieve locally across the entire approved collection. If the compact first
  // bundle drops a complementary target/facet, expand once before generation.
  const coverage = (items: EvidencePassage[]) => new Set(items.flatMap(p => [
    ...(p.relevance?.answerFit?.matchedTargets.flatMap((hit, i) => hit ? [`target:${i}`] : []) ?? []),
    ...(p.relevance?.answerFit?.matchedFacets.map(f => `facet:${f}`) ?? []),
  ]));
  if (coverage(passages).size < coverage(candidates).size || (!passages.length && candidates.length))
    passages = selectEvidence(candidates, input, { topK: Math.max(settings.topK, 8), maxTokens: Math.max(settings.maxTokens, 12000) });
  const prefix = "Mock mode — no API call or anatomical answer was generated. SYNTHETIC TEST ONLY. ";
  if (!assessEvidence(passages, mode)) {
    if (mode === "mock") return wrap(result(input, mode, "insufficient_evidence", prefix + "No relevant synthetic test evidence was found. Production references were not substituted."), "insufficient");
    passages = [];
  }
  const generated = await withSignal(generation.generate(input, passages, signal), signal);
  const evidence = passages.map(p => ({ id: p.citationId, text: p.text }));
  const draft = mode === "live" ? validateTutorDraft(generated.value, evidence) : null;
  const claims = mode === "live" ? generated.verified ? draft?.claims : [] : validateClaims(generated.value, evidence);
  if (!claims || (mode === "live" && !draft)) return wrap(result(input, mode, "insufficient_evidence", mode === "mock" ? prefix + "Synthetic evidence was insufficient." : "I could not produce a reliable answer to this question. Please try a more specific anatomy question."), "insufficient");
  const ids = [...new Set(claims.flatMap(c => c.ids))];
  const sections: TutorAnswerSection[] = claims.map(c => ({ kind: "reference", text: c.text, sourceIds: [...new Set(c.ids)] }));
  if (draft?.generalExplanation) sections.push({ kind: "general", text: draft.generalExplanation, sourceIds: [] });
  if (draft?.uncertainty) sections.push({ kind: "uncertainty", text: draft.uncertainty, sourceIds: [] });
  if (draft?.claims.length && !generated.verified) sections.push({ kind: "uncertainty", text: "Some proposed reference-based statements could not be verified and have been omitted.", sourceIds: [] });
  if (!sections.length) return wrap(result(input, mode, "insufficient_evidence", REFUSAL), "insufficient");
  const status = mode === "mock" ? "mock" : draft?.generalExplanation ? claims.length ? "partially_supported" : "general_knowledge" : claims.length ? "supported" : "insufficient_evidence";
  const response = result(input, mode, status, (mode === "mock" ? prefix : "") + answerWithProvenance(sections));
  if (mode === "live") response.sections = sections;
  response.sources = ids.map(id => {
    const passage = passages.find(p => p.citationId === id)!;
    return { id, title: passage.source.title.slice(0, 500), url: passage.source.url, section: passage.source.section.slice(0, 1000), sourceId: passage.source.id, passageId: passage.id, documentVersion: passage.source.documentVersion, materialKind: passage.source.materialKind, ...(passage.source.collectionId ? { collectionId: passage.source.collectionId, authors: passage.source.authors, year: passage.source.year, doi: passage.source.doi, licenceUrl: passage.source.licenceUrl, copyrightNotice: passage.source.copyrightNotice, changesNotice: passage.source.changesNotice, reviewStatus: passage.source.reviewStatus } : {}) };
  });
  if (generated.navigationNotice) response.navigationNotice = generated.navigationNotice;
  return wrap(response, mode === "mock" ? "synthetic" : draft?.generalExplanation ? claims.length ? "partial" : "unverified" : claims.length ? "verified" : "insufficient");
}
