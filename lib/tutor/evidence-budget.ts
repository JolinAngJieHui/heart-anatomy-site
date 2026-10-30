import type { EvidencePassage, RetrievalQuery } from "./retrieval";
import { questionProfile } from "./question-relevance";

export function ragSettings() {
  const read = (key: string, fallback: number, max: number) => {
    const value = Number(process.env[key] ?? fallback);
    if (!Number.isInteger(value) || value < 1 || value > max) throw new Error(`Invalid ${key}`);
    return value;
  };
  return { topK: read("RAG_TOP_K", 5, 10), maxTokens: read("RAG_MAX_CONTEXT_TOKENS", 3500, 16000) };
}
export const evidencePayload = (passages: EvidencePassage[]) => ({ passages: passages.map(p => ({
  id: p.citationId, sourceId: p.source.id, chunkId: p.id, title: p.source.title,
  section: p.source.section, url: p.source.url, structureIds: p.source.structureIds,
  text: p.text, anatomyPattern: p.source.anatomyPattern ?? "Preserve all qualifications in passage",
  cautions: p.source.cautions ?? [],
})) });
// A deliberately conservative bound for byte-level tokenization, not a claim
// about either model's exact tokenizer or billed tokens. Includes ALL JSON keys,
// metadata, escaping and headings. No chars/4 estimate or external counting call.
export const tokenUpperBound = (value: unknown) => new TextEncoder().encode(JSON.stringify(value)).length;
export const evidenceTokenCount = (passages: EvidencePassage[]) => tokenUpperBound(evidencePayload(passages));

export function selectEvidence(candidates: EvidencePassage[], query: RetrievalQuery, settings = ragSettings()) {
  const profile = questionProfile(query.question);
  const comparison = profile.comparison;
  const limit = Math.min(12, settings.topK + (comparison ? 2 : 0));
  const selected: EvidencePassage[] = [];
  const remaining = candidates.filter((p, i) => candidates.findIndex(q => q.id === p.id || q.text.trim() === p.text.trim()) === i);
  // Cover each comparison side before filling with further passages. A shorter
  // complementary passage can fit where another large single-side result cannot.
  const covered = new Set<number>(), facets = new Set<string>();
  while (remaining.length && selected.length < limit) {
    if (comparison || profile.facets.length > 1) remaining.sort((a, b) => {
      const gain = (p: EvidencePassage) => (p.relevance?.answerFit?.matchedTargets.filter((hit, i) => hit && !covered.has(i)).length ?? 0) + (p.relevance?.answerFit?.matchedFacets.filter(f => !facets.has(f)).length ?? 0);
      return gain(b) - gain(a) || b.score - a.score || Number(selected.some(p => p.source.id === a.source.id)) - Number(selected.some(p => p.source.id === b.source.id));
    });
    const next = remaining.shift()!;
    if (evidenceTokenCount([...selected, next]) > settings.maxTokens) continue;
    selected.push(next);
    next.relevance?.answerFit?.matchedFacets.forEach(f => facets.add(f));
    next.relevance?.answerFit?.matchedTargets.forEach((hit, i) => { if (hit) covered.add(i); });
  }
  return selected;
}
