import type OpenAI from "openai";
import { HEART_PARTS, type HeartPartId } from "../heart-parts";
import { sha256, metadataHash, matchesIndex, type PreparedDocument, type IndexManifest } from "../knowledge-base/documents";
import { validateSyntheticDataset } from "../knowledge-base/mock";
import { approved, injection, processResults } from "./core";
import type { TutorRequest } from "./types";
import { canonicalText, lexicalTerms, resolveAnatomicalTerms } from "./terminology";
import { externalIndexingAllowed } from "../knowledge-base/registry";
import { semanticConcepts, conceptSimilarity } from "./semantic-concepts";
import { questionProfile, passageFit, passageFeatures } from "./question-relevance";

export type EvidenceSource = { id: string; title: string; url: string | null; section: string; structureIds: HeartPartId[]; documentVersion: string; materialKind: "reference" | "synthetic"; articleType?: string; teachingDocumentId?: string; teachingDocumentVersion?: string; domain?: string; anatomyPattern?: string; learningLevels?: string[]; authors?: string[]; year?: number; doi?: string; licenceUrl?: string; copyrightNotice?: string | null; changesNotice?: string; reviewStatus?: string; collectionId?: string; cautions?: string[]; supportingReferences?: { sourceId: string; title: string; url: string; section: string; page: string | null; publicationDetails: string; sourceVersion: string }[] };
export type LexicalRelevance = { method: "lexical-coverage" | "hybrid-concept-semantic"; queryTerms: string[]; textMatches: string[]; metadataMatches: string[]; contextMatch: boolean; textCoverage: number; questionMatch: boolean; semanticMatches?: string[]; semanticScore?: number; answerFit?: ReturnType<typeof passageFit>; scoreMeaning?: string };
export type EvidencePassage = { id: string; citationId: string; source: EvidenceSource; text: string; score: number; relevance?: LexicalRelevance };
export type RetrievalQuery = { question: string; selectedStructureId: HeartPartId | null; conversation?: TutorRequest["conversation"]; maxPassages?: number; expandRelatedVessels?: boolean };
export interface RetrievalProvider { readonly mode: "local" | "openai"; retrieve(query: RetrievalQuery, signal: AbortSignal): Promise<EvidencePassage[]> }
export type LocalDocument = { source: EvidenceSource; text: string };
const terms = lexicalTerms;
export function validateQuery(query: RetrievalQuery) {
  if (typeof query.question !== "string" || !query.question.trim() || query.question.length > 1200 || (query.selectedStructureId !== null && !HEART_PARTS.some(p => p.id === query.selectedStructureId))) throw new Error("Invalid retrieval query");
}
export function terminology(query: RetrievalQuery): string {
  validateQuery(query);
  const explicit = resolveAnatomicalTerms(query.question).matches.some(m => m.usable);
  const parts = explicit ? [] : HEART_PARTS.filter(p => p.id === query.selectedStructureId);
  const context = !query.selectedStructureId && /\b(it|its|that|this|they|them)\b/i.test(query.question) ? query.conversation?.filter(m => m.role === "user").slice(-1).map(m => m.content).join(" ") ?? "" : "";
  return [query.question, canonicalText(query.question), context, canonicalText(context), ...parts.map(p => `${p.name} ${p.shortName} ${p.id}`)].join(" ");
}
/** Deterministic overlapping character chunks; source version + chunk bytes
 * form stable passage IDs. Managed OpenAI indexing remains separate. */
export function chunkDocument(document: LocalDocument): Omit<EvidencePassage, "score" | "citationId">[] {
  const text = document.text.replace(/\r\n/g, "\n").trim();
  if (document.source.collectionId) {
    // Scoped extraction is already paragraph-sized. Preserve complete sentences
    // and divide only at complete sentence boundaries for large paragraphs.
    const groups: string[] = []; let current = "";
    for (const sentence of text.match(/[^.!?]+(?:[.!?](?=\s|$)|$)/g) ?? [text]) {
      const next = sentence.trim();
      if (current && current.length + next.length > 3500) { groups.push(current); current = next; }
      else current += (current ? " " : "") + next;
    }
    if (current) groups.push(current);
    return groups.filter(t => t.length >= 60 && t.length <= 5000 && !injection(t)).map(content => ({ id: `${document.source.id}:${document.source.documentVersion}:${sha256(content).slice(0, 20)}`, source: document.source, text: content }));
  }
  const chunks = [];
  for (let start = 0; start < text.length; start += 1000) {
    const content = text.slice(start, start + 1200);
    if (content.trim() && !injection(content)) chunks.push({ id: `${document.source.teachingDocumentId ?? document.source.id}:${document.source.teachingDocumentVersion ?? document.source.documentVersion}:${sha256(content).slice(0, 20)}`, source: document.source, text: content });
    if (start + 1200 >= text.length) break;
  }
  return chunks;
}
export function preparedToLocal(documents: PreparedDocument[]): LocalDocument[] {
  return documents.flatMap<LocalDocument>(d => {
    if (d.source.extraction) {
      const e = d.source.extraction;
      const units = new TextDecoder("utf-8", { fatal: true }).decode(d.bytes).split(/^## /m).slice(1);
      if (units.length !== e.locators.length) throw new Error(`Extraction paragraph inventory differs: ${d.source.id}`);
      return units.map((unit, i) => {
        const end = unit.indexOf("\n"), section = unit.slice(0, end).trim(), text = unit.slice(end + 1).trim(), locator = e.locators[i];
        if (section !== `${locator.section} | ${locator.locator}` || sha256(text) !== locator.sha256) throw new Error(`Extraction locator/text mismatch: ${d.source.id}`);
        return { source: { id: d.source.id, title: d.source.title, url: d.source.location, section, structureIds: d.source.structureIds, documentVersion: d.version, materialKind: "reference" as const, articleType: e.articleType ?? undefined, anatomyPattern: /case/i.test(e.articleType ?? "") ? "Individual case observations; not universal normal anatomy" : "Preserve source qualifications and study limitations", authors: e.authors, year: d.source.publicationYear ?? undefined, doi: e.doi, licenceUrl: e.licenceUrl ?? undefined, copyrightNotice: e.copyrightNotice, changesNotice: e.changesNotice, reviewStatus: d.source.status, collectionId: e.collectionId, cautions: e.cautions }, text };
      });
    }
    if (d.source.documentPath?.endsWith(".pdf")) throw new Error("Local PDF extraction is not enabled; use an approved TXT/Markdown extraction with its own reviewed hash");
    if (d.source.teachingNote) return d.source.teachingNote.passages.map(p => ({ source: { id: p.evidence[0].sourceId, title: p.evidence[0].title, url: p.evidence[0].url, section: `${p.evidence[0].section}${p.evidence[0].page ? `; page ${p.evidence[0].page}` : ""}`, structureIds: p.structureIds as HeartPartId[], documentVersion: p.evidence[0].sourceVersion, materialKind: "reference" as const, teachingDocumentId: d.source.id, teachingDocumentVersion: d.version, domain: p.domain, anatomyPattern: p.pattern, learningLevels: p.levels, supportingReferences: p.evidence }, text: p.text }));
    const source: EvidenceSource = { id: d.source.id, title: d.source.title, url: d.source.location, section: d.source.section, structureIds: d.source.structureIds, documentVersion: d.version, materialKind: "reference", articleType: d.source.collection?.articleType ?? undefined, anatomyPattern: d.source.collection?.articleType === "case-report" ? "case-report; not universal normal anatomy" : "Preserve qualifications in source text" };
    const text = new TextDecoder("utf-8", { fatal: true }).decode(d.bytes);
    if (d.source.collection) {
      // Ignore attribution preamble as claim evidence; preserve each original heading.
      const sections = text.split(/^## /m).slice(1);
      return sections.map(section => {
        const end = section.indexOf("\n"), text = section.slice(end + 1).trim();
        const caseSection = ["case presentation", "case report", "case description"].some(label => section.slice(0, end).toLowerCase().includes(label));
        const possibleVariant = /\b(rare|anomal\w*|variant\w*|congenital|ectopic|unroofed|atresia)\b/i.test(text);
        return { source: { ...source, section: section.slice(0, end).trim(), anatomyPattern: caseSection ? "Individual case observations; not universal normal anatomy" : source.anatomyPattern?.startsWith("case-report") ? source.anatomyPattern : possibleVariant ? "Possible variation/pathology; preserve source qualifications, do not assume normal anatomy" : source.anatomyPattern }, text };
      }).filter(d => d.text);
    }
    return [{ source, text }];
  });
}
export function syntheticToLocal(value: unknown): LocalDocument[] {
  return validateSyntheticDataset(value).documents.map(d => ({ source: { id: d.id, title: `SYNTHETIC TEST ONLY: ${d.id}`, url: null, section: "Fictional local fixture; not academic evidence", structureIds: d.structureIds, documentVersion: d.version, materialKind: "synthetic" }, text: d.text }));
}
export class LocalRetrievalProvider implements RetrievalProvider {
  readonly mode = "local" as const;
  private readonly chunks;
  constructor(documents: LocalDocument[]) {
    const kinds = new Set(documents.map(d => d.source.materialKind));
    if (kinds.size > 1) throw new Error("Synthetic and reference corpora cannot be mixed");
    this.chunks = documents.flatMap(chunkDocument).map(chunk => ({ ...chunk, features: passageFeatures(chunk.text), concepts: semanticConcepts(chunk.text), metadataWords: terms(chunk.source.structureIds.flatMap(id => { const p = HEART_PARTS.find(p => p.id === id)!; return [p.name, p.shortName, p.id]; }).join(" ") + " " + chunk.source.title) }));
  }
  async retrieve(query: RetrievalQuery, signal: AbortSignal): Promise<EvidencePassage[]> {
    signal.throwIfAborted();
    // Rephrase follow-ups retrieve the preceding question, never a prior answer
    // as evidence. Explicit named questions and current-vessel questions win.
    if (!resolveAnatomicalTerms(query.question).matches.length && /\b(simpler|simply|simplify|rephrase|again|more detail)\b/i.test(query.question)) {
      const previous = query.conversation?.filter(m => m.role === "user").at(-1)?.content.replace(/\s*\(Study context:[\s\S]*$/, "");
      if (previous && previous.length <= 1200) query = { ...query, question: previous };
    }
    const maxPassages = Math.min(12, Math.max(1, query.maxPassages ?? 6));
    const words = terms(terminology(query));
    const resolvedQuestion = /\b(it|its|this|that)\b/i.test(query.question) ? query.question + " " + (HEART_PARTS.find(p => p.id === query.selectedStructureId)?.name ?? query.conversation?.filter(m => m.role === "user").at(-1)?.content ?? "") : query.question;
    const profile = questionProfile(resolvedQuestion);
    // For broad definitions, equally relevant anatomy sections should precede
    // clinical/procedural paragraphs whose IDs merely sort earlier. The body
    // still has to pass the same target and evidence-fit checks.
    const definitionSection = (section: string) => !profile.facets.length && profile.domain === "normal-anatomy"
      && /\b(anatomy|function|physiology|introduction)\b/i.test(section.split(">").at(-1) ?? "");
    const questionWords = terms(query.question);
    const queryConcepts = semanticConcepts(query.question);
    const mentions = resolveAnatomicalTerms(query.question).matches;
    if (mentions.some(m => m.qualifier === "separate-aortic-origin" && !m.usable) && !mentions.some(m => m.usable)) return [];
    const explicitIds = mentions.filter(m => m.usable).flatMap(m => m.structureIds);
    const targetIds = explicitIds.length ? explicitIds : query.selectedStructureId ? [query.selectedStructureId] : [];
    const relatedWords = query.expandRelatedVessels && queryConcepts.has("dominance") ? terms("RCA PDA LCx") : new Set<string>();
    const scored = this.chunks.map(chunk => {
      const textWords = chunk.features.words, metadataWords = chunk.metadataWords;
      const textMatches = [...words].filter(word => textWords.has(word));
      const metadataMatches = [...words].filter(word => !textWords.has(word) && metadataWords.has(word));
      const semantic = conceptSimilarity(queryConcepts, chunk.concepts);
      const questionMatch = semantic.matches.length > 0 || !questionWords.size || [...questionWords].some(word => textWords.has(word) || metadataWords.has(word)) || (!!query.selectedStructureId && /\b(it|its|this|that)\b/i.test(query.question) && [...questionWords].every(word => ["supply", "drain"].includes(word)));
      const hits = textMatches.length + .5 * metadataMatches.length;
      const contextMatch = targetIds.some(id => chunk.source.structureIds.includes(id));
      const contextBoost = hits > 0 && contextMatch ? .25 : 0;
      const expansionBoost = [...relatedWords].some(w => textWords.has(w)) && (textMatches.length || semantic.matches.length) ? .05 : 0;
      const fit = passageFit(profile, chunk.text, chunk.source, chunk.features);
      const targetCoverage = fit.matchedTargets.length ? fit.matchedTargets.filter(Boolean).length / fit.matchedTargets.length : 0;
      const facetCoverage = profile.facets.length ? fit.matchedFacets.length / profile.facets.length : 0;
      const relevanceScore = words.size ? Math.max(0, Math.min(1, .35 * textMatches.length / words.size + .05 * metadataMatches.length / words.size
        + .04 * contextBoost + .1 * semantic.score + expansionBoost + .2 * Number(fit.direct)
        + .15 * targetCoverage + .15 * facetCoverage + fit.sourcePreference - fit.penalty)) : 0;
      const routingOnly = chunk.source.materialKind === "synthetic";
      const score = routingOnly ? (words.size ? Math.min(1, .7 * hits / words.size + .4 * contextBoost + .2 * semantic.score + expansionBoost) : 0) : relevanceScore;
      return { id: chunk.id, text: chunk.text, source: chunk.source, score, relevance: { method: "hybrid-concept-semantic" as const, queryTerms: [...words].sort(), textMatches: textMatches.sort(), metadataMatches: metadataMatches.sort(), contextMatch, textCoverage: words.size ? textMatches.length / words.size : 0, questionMatch, semanticMatches: semantic.matches, semanticScore: semantic.score, answerFit: fit, scoreMeaning: "Deterministic relevance ranking; not scientific confidence or probability." } };
    }).filter(p => p.score >= .2 && (p.source.materialKind === "synthetic" ? p.relevance.questionMatch : p.relevance.questionMatch && p.relevance.answerFit.eligible)).sort((a, b) => (a.source.materialKind === "reference" && profile.facets.length ? Number(b.relevance.answerFit.direct) - Number(a.relevance.answerFit.direct) : 0) || b.score - a.score || Number(definitionSection(b.source.section)) - Number(definitionSection(a.source.section)) || Number(b.relevance.contextMatch) - Number(a.relevance.contextMatch) || a.id.localeCompare(b.id));
    const deduplicated: typeof scored = [];
    for (const passage of scored) {
      const tokens = terms(passage.text);
      const duplicate = deduplicated.some(previous => {
        const previousTokens = terms(previous.text);
        const overlap = [...tokens].filter(t => previousTokens.has(t)).length;
        const sameLocation = previous.source.id === passage.source.id && previous.source.section === passage.source.section;
        const characterOverlap = sameLocation && [passage.text, previous.text].some((text, index) => {
          const other = index ? passage.text : previous.text;
          // Adjacent overlapping chunks repeat a sizeable exact boundary span.
          for (let length = Math.min(text.length, other.length, 1200); length >= 80; length--) if (text.endsWith(other.slice(0, length))) return true;
          return false;
        });
        return characterOverlap || passage.text.trim() === previous.text.trim() || (tokens.size > 12 && overlap / Math.max(tokens.size, previousTokens.size) > .85);
      });
      if (!duplicate) deduplicated.push(passage);
      if (deduplicated.length === maxPassages) break;
    }
    // Comparisons may need complementary passages, not six repeats of one vessel.
    if (profile.comparison) {
      const covered = profile.targets.map((_, index) => deduplicated.some(p => p.relevance.answerFit.matchedTargets[index]));
      for (let index = 0; index < covered.length; index++) {
        if (covered[index]) continue;
        const complement = scored.find(p => p.relevance.answerFit.matchedTargets[index] && !deduplicated.some(d => d.id === p.id));
        if (!complement) continue;
        if (deduplicated.length >= maxPassages) {
          // Replace a redundant result without losing an earlier comparison side.
          const replace = deduplicated.findLastIndex((_, remove) => covered.every((present, target) => !present
            || deduplicated.some((p, position) => position !== remove && p.relevance.answerFit.matchedTargets[target])));
          if (replace < 0) continue;
          deduplicated.splice(replace, 1);
        }
        deduplicated.push(complement);
        covered.forEach((_, i) => { covered[i] = deduplicated.some(p => p.relevance.answerFit.matchedTargets[i]); });
      }
    }
    return deduplicated.map((p, i) => ({ ...p, citationId: `P${i + 1}` }));
  }
}
export class OpenAIRetrievalProvider implements RetrievalProvider {
  readonly mode = "openai" as const;
  constructor(private client: OpenAI, private vectorStoreId: string, private documents: PreparedDocument[], private manifest: IndexManifest) {
    this.documents = documents.filter(d => approved(d.source) && externalIndexingAllowed(d.source) && sha256(d.bytes) === d.hash && d.hash === d.source.approvedSha256 && d.version === d.source.documentVersion && d.metadataHash === metadataHash(d.source) && manifest.documents.some(entry => matchesIndex(d, entry)));
  }
  async retrieve(query: RetrievalQuery, signal: AbortSignal): Promise<EvidencePassage[]> {
    signal.throwIfAborted(); validateQuery(query);
    if (!this.documents.length || this.manifest.vectorStoreId !== this.vectorStoreId) return [];
    const search = await this.client.vectorStores.search(this.vectorStoreId, { query: terminology(query), max_num_results: 12, rewrite_query: false, filters: { type: "eq", key: "review_status", value: "approved" } }, { signal });
    return processResults(search.data, this.documents.map(d => d.source), this.manifest.documents).map(p => ({
      id: `${p.source.id}:${p.source.documentVersion}:${sha256(p.text).slice(0, 20)}`, citationId: p.id, text: p.text, score: p.score,
      source: { id: p.source.id, title: p.source.title, url: p.source.location, section: p.source.section, structureIds: p.source.structureIds, documentVersion: p.source.documentVersion, materialKind: "reference", anatomyPattern: p.source.collection?.articleType === "case-report" ? "case-report; not universal normal anatomy" : "Preserve source qualifications" },
    }));
  }
}
