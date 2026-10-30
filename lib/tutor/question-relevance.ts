import { canonicalText, lexicalTerms, resolveAnatomicalTerms } from "./terminology";

export type QuestionDomain = "normal-anatomy" | "physiology" | "pathology" | "procedure" | "variation";
const cues = {
  supply: /\b(suppl\w*|perfus\w*|oxygen\w*|blood flow|irrigat\w*)\b/i,
  drainage: /\b(drain\w*|empt\w*|tributar\w*|venous return|returns? blood)\b/i,
  origin: /\b(origin\w*|aris\w*|arose|arise|branch\w*|bifurcat\w*|trifurcat\w*)\b/i,
  course: /\b(course|cours\w*|runs?|travel\w*|locat\w*|situat\w*|groove|sulcus|connect\w*|position|lies|lie|along|between)\b/i,
  dominance: /\b(dominan\w*|codominan\w*|co.dominan\w*)\b/i,
  function: /\b(suppl\w*|drain\w*|empt\w*|carr\w*|transport\w*|returns?|distribut\w*|perfus\w*|receives?|deliver\w*|collect\w*)\b/i,
  physiology: /\b(physiolog\w*|pressure|haemodynam\w*|hemodynam\w*|resistance|oxygen delivery|blood flow)\b/i,
  pathology: /\b(stenos\w*|occlu\w*|blockage\w*|blocked|obstruct\w*|thromb\w*|disease|syndrome|plaque|atherosclero\w*|infarct\w*|ischem\w*|ischaem\w*|dissect\w*|impair\w*|clinical significance|clinical correlation\w*|clinical implication\w*)\b/i,
  procedure: /\b(angiogra\w*|imaging|computed tomography|\bCT\b|\bCTA\b|\bPCI\b|\bCABG\b|stent\w*|catheter\w*|intervention\w*|surg\w*|treat\w*|diagnos\w*|detect\w*|assess\w*|evaluat\w*|investigat\w*)\b/i,
  variation: /\b(variant\w*|variation\w*|anomal\w*|congenital|ectopic|rare|unusual)\b/i,
};
type Facet = keyof typeof cues;
export type QuestionProfile = { domain: QuestionDomain; facets: Facet[]; targets: string[][]; comparison: boolean; contentTerms: string[] };
const vocabularyOnly = new Set("normal contribute normality connection connections anatomical cardiac heart coronary blood segment portion part mechanism detail details basic intermediate advanced occur occurs affect affects assessed evaluated during assessed difference differ means mean exactly contribute evaluates performed performing perform demonstrated demonstrate explained significance importance correlations implications dangerous consequences happen happens reduced reduction investigate investigations tests test investigation describe main".split(" "));
export function questionProfile(question: string): QuestionProfile {
  const canonical = canonicalText(question);
  const matches = resolveAnatomicalTerms(question).matches;
  const targets = [...new Map(matches.filter(m => m.usable || m.kind === "unmapped-region")
    .map(m => { const words = [...lexicalTerms(canonicalText(m.term))]; return [words.join(" "), words] as const; })).values()];
  // A vessel's name (e.g. "conus branch") is not a request about branching.
  let intentText = canonical;
  for (const target of targets) intentText = intentText.replace(new RegExp(`\\b${target.join("\\s+")}\\b`, "g"), " ");
  const facets: Facet[] = [];
  if (/\b(function|role|purpose)\b/i.test(intentText) || /\bwhat does\b.*\bdo\b/i.test(question)) facets.push("function");
  for (const facet of ["supply", "drainage", "origin", "course", "dominance", "physiology", "pathology", "procedure", "variation"] as Facet[]) {
    if (cues[facet].test(intentText)) facets.push(facet);
  }
  if (/\b(where|location)\b/i.test(intentText) && !facets.some(f => ["origin", "drainage"].includes(f))) facets.push("course");
  const targetWords = new Set(targets.flat());
  const contentTerms = [...lexicalTerms(canonical)].filter(w => !targetWords.has(w) && !vocabularyOnly.has(w)
    && (["ct", "cta", "pci", "cabg", "stent"].includes(w) || !Object.values(cues).some(expression => expression.test(w))));
  const domain = facets.includes("procedure") ? "procedure" : facets.includes("pathology") ? "pathology" : facets.includes("variation") ? "variation"
    : facets.some(f => ["supply", "drainage", "function", "physiology"].includes(f)) ? "physiology" : "normal-anatomy";
  return { domain, facets: [...new Set(facets)], targets, comparison: /\b(compare|versus|vs|difference|differ|between)\b/i.test(question) || targets.length > 1, contentTerms };
}

export function passageFeatures(text: string) {
  return { words: lexicalTerms(text), canonical: canonicalText(text), facets: (Object.keys(cues) as Facet[]).filter(facet => cues[facet].test(text)),
    sentences: text.split(/(?<=[.!?])\s+|\n+/).map(sentence => ({ words: lexicalTerms(sentence), canonical: canonicalText(sentence),
      facets: (Object.keys(cues) as Facet[]).filter(facet => cues[facet].test(sentence)),
      clinicalObservation: cues.pathology.test(sentence) || /\bpatient\b|\b\d{1,3}.year.old\b/i.test(sentence),
      generalStatement: /\b(normally|usually|typically|generally|normal anatomy)\b/i.test(sentence),
      predicate: /\b(is|are|arises?|originate\w*|runs?|lies|suppl\w*|drain\w*|empt\w*|carr\w*|receives?|returns?|deliver\w*|branch\w*|dominance|defined|connect\w*|stenos\w*|occlu\w*|imaging|CT|angiogra\w*|detect\w*|prevent\w*|stent\w*|catheter\w*)\b/i.test(sentence) })) };
}
/** Observable text features, not a truth assessment or anatomical answer generator. */
export function passageFit(profile: QuestionProfile, text: string, source: { anatomyPattern?: string; articleType?: string; section: string }, features = passageFeatures(text)) {
  const { words } = features;
  const matchesTarget = (target: string[], canonical: string) => new RegExp(`\\b${target.join("\\s+")}\\b`).test(canonical);
  const matchedTargets = profile.targets.map(target => matchesTarget(target, features.canonical));
  const matchedFacets = profile.facets.filter(facet => features.facets.includes(facet));
  const missedFacets = profile.facets.filter(facet => !matchedFacets.includes(facet));
  const contentCoverage = profile.contentTerms.length ? profile.contentTerms.filter(word => words.has(word)).length / profile.contentTerms.length : 1;
  const ordinary = profile.domain === "normal-anatomy" || profile.domain === "physiology";
  const primary = ["procedure", "pathology", "variation"].includes(profile.domain) ? profile.domain as Facet : null;
  const direct = features.sentences.some(sentence => {
    const subject = !profile.targets.length || profile.targets.some(target => matchesTarget(target, sentence.canonical));
    return subject && sentence.predicate && (!ordinary || !sentence.clinicalObservation || sentence.generalStatement)
      && (!primary || sentence.facets.includes(primary))
      && !/\bregardless of\b/i.test(sentence.canonical)
      && (!profile.facets.length || profile.facets.some(facet => sentence.facets.includes(facet)));
  });
  const individualCase = /case-report|individual case/i.test(source.anatomyPattern ?? "")
    || source.articleType === "case-report" || /case (presentation|description|report)/i.test(source.section)
    || /\b\d{1,3}.year.old\b|\bour patient\b/i.test(text);
  const pathological = cues.pathology.test(text);
  const generalStatement = /\b(normally|usually|typically|generally|anatomically|normal anatomy)\b/i.test(text);
  const penalty = ordinary ? (individualCase ? .22 : 0) + (pathological && !generalStatement ? .08 : 0) : 0;
  const sourcePreference = ordinary && !individualCase && (source.articleType === "review-article" || generalStatement) ? .08 : 0;
  const warnings = [
    ...(individualCase ? ["Individual case evidence; do not generalise to normal anatomy."] : []),
    ...(ordinary && pathological && !generalStatement ? ["Pathology context appears; verify that the requested normal anatomy is actually described."] : []),
    ...(missedFacets.length ? [`Requested aspects absent: ${missedFacets.join(", ")}.`] : []),
    ...(matchedTargets.some(hit => !hit) ? ["Only some requested structures/segments appear in the passage body."] : []),
    ...(contentCoverage < .6 ? ["Question-specific terms are missing from this passage."] : []),
  ];
  const eligible = (!profile.targets.length || matchedTargets.some(Boolean))
    && (!profile.facets.length || matchedFacets.length > 0) && contentCoverage >= .8
    && !(ordinary && individualCase && !direct);
  return { domain: profile.domain, direct, targetLabels: profile.targets.map(target => target.join(" ")), matchedTargets, matchedFacets, missedFacets, contentCoverage,
    individualCase, penalty, sourcePreference, eligible, warnings,
    evidenceStrength: direct && !missedFacets.length && matchedTargets.every(Boolean) && contentCoverage >= .8 && !(ordinary && individualCase) ? "direct-text-candidate" as const : "weak-text-match" as const };
}
