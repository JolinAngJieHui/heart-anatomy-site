import type { QuizInput } from "./quiz-personalisation";
import type { EvidenceCatalogue } from "./evidence";
import { lessonEvidence, lessonScope } from "./lesson-review";
import { resolveAnatomicalTerms } from "../tutor/terminology";
import { questionProfile, passageFit } from "../tutor/question-relevance";

const terms = new WeakMap<EvidenceCatalogue["passages"][number], string[]>();
const mentionsIn = (p:EvidenceCatalogue["passages"][number]) => {
  let ids=terms.get(p); if(!ids){ids=resolveAnatomicalTerms(`${p.section}\n${p.text}`).matches.filter(m=>m.usable).flatMap(m=>m.structureIds);terms.set(p,ids);}return ids;
};
const memo = new WeakMap<QuizInput, { catalogue:EvidenceCatalogue; result:ReturnType<typeof searchQuizEvidence> }>();
export function retrieveQuizEvidence(input:QuizInput,catalogue:EvidenceCatalogue) {
  const cached=memo.get(input); if(cached?.catalogue===catalogue)return cached.result;
  const result=searchQuizEvidence(input,catalogue); memo.set(input,{catalogue,result}); return result;
}
/** Global passage search: metadata is provenance, never a vessel-category filter. */
function searchQuizEvidence(input: QuizInput, catalogue: EvidenceCatalogue) {
  if (!input.review) return [];
  const scope = input.focusIds ?? lessonScope(input.review.input);
  const profiles = input.review.input.questions.map(q => questionProfile(q.question));
  const eligible = catalogue.passages.filter(p => p.levels.includes(input.level) && p.reviewStatus === "approved"
    && catalogue.sources.some(s => s.id === p.sourceId && s.documentVersion === p.documentVersion && s.available && s.reviewStatus === "approved" && s.externalProcessingAllowed));
  const score = (p: typeof eligible[number]) => {
    const mentions = mentionsIn(p);
    const topical = scope.filter(id => mentions.includes(id)).length;
    if (!topical) return 0;
    return topical * 10 + Math.max(0, ...profiles.map(q => {
      const fit = passageFit(q, p.text, { section: p.section, anatomyPattern: p.pattern });
      return Number(fit.direct) * 12 + fit.matchedFacets.length * 2;
    })) + (/case|variant|patholog/i.test(p.pattern + p.section) ? 0 : 5);
  };
  // A chunk may carry several structure mappings; score its text only once.
  const unique = [...new Map(eligible.map(p=>[p.id,p])).values()];
  const ranked = unique.map(p => ({ p, score: score(p) })).filter(x => x.score > 0).sort((a,b) => b.score-a.score || a.p.id.localeCompare(b.p.id));
  // Keep original cited discussion passages, then diversify across studied vessels.
  const prior = lessonEvidence(input.review.input, catalogue).filter(p => eligible.some(e => e.id === p.key));
  const chosen: typeof eligible = []; let chars = 0;
  const add = (p: typeof eligible[number]) => {
    if (chosen.some(c => c.id === p.id) || chosen.length >= 14 || chars + p.text.length > 20000) return;
    chosen.push(p); chars += p.text.length;
  };
  for (const q of input.review.input.questions) for (const c of q.reply?.sources ?? []) {
    const p = eligible.find(p => p.id === c.passageId && p.documentVersion === c.documentVersion && p.sourceId === c.sourceId);
    if (p && (!input.focusIds || score(p) > 0)) add(p);
  }
  for (const p of prior) { const original=eligible.find(e=>e.id===p.key); if(original && scope.includes(original.structureId))add(original); }
  for (const id of scope) for (const { p } of ranked.filter(x => mentionsIn(x.p).includes(id)).slice(0,2)) add(p);
  for (const { p } of ranked) add(p);
  return chosen.map(p => ({ key: p.id, text: p.text, qualifications: p.pattern, structureId: p.structureId, domain: p.domain,
    sources: [{ id: p.sourceId, sourceId: p.sourceId, title: p.title, section: p.section, url: p.url, documentVersion: p.documentVersion, passageId: p.id, materialKind: "reference" as const }] }));
}
