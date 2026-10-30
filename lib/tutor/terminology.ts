import { HEART_PARTS, type HeartPartId } from "../heart-parts";
import { ANATOMICAL_SYNONYMS, WHOLE_VESSEL_SYNONYMS } from "../knowledge-base/anatomical-synonyms";
const canonicalTerms: Record<HeartPartId, string> = {
  "right-coronary-proximal": "rca proximal", "right-coronary-middle": "rca mid", "right-coronary-distal": "rca distal",
  "posterior-descending-artery": "pda", "left-coronary-artery": "lm",
  "left-anterior-descending-proximal": "lad proximal", "left-anterior-descending-mid": "lad mid", "left-anterior-descending-apical": "lad apical",
  "left-diagonal-d1": "d1", "left-diagonal-d2": "d2", "left-circumflex-artery": "lcx", "right-marginal-artery": "rma", "right-conus-artery": "conus",
  "left-marginal-artery": "om", "ascending-aorta": "aorta ascending", "superior-vena-cava": "svc", "coronary-sinus": "cs",
};
const normalize = (value: string) => value.replace(/[()\-–—]/g, " ").replace(/\s+/g, " ").trim();
type Alias = { phrase: string; replacement: string; structureIds: HeartPartId[]; kind: "structure" | "whole-vessel" | "qualified" | "unmapped-region"; qualifier?: string; requiresConfirmation?: boolean };
const aliases: Alias[] = HEART_PARTS.flatMap(p => {
  const entry = ANATOMICAL_SYNONYMS[p.id];
  return [
    ...[p.id, p.name, p.shortName, ...entry.aliases].map(phrase => ({ phrase, replacement: canonicalTerms[p.id], structureIds: [p.id], kind: "structure" as const })),
    ...(entry.qualifiedAliases ?? []).flatMap(q => q.aliases.map(phrase => ({ phrase, replacement: `${canonicalTerms[p.id]} ${q.qualifier.replaceAll("-", "")}`, structureIds: [p.id], kind: "qualified" as const, qualifier: q.qualifier, requiresConfirmation: q.requiresConfirmation }))),
  ];
});
aliases.push(...WHOLE_VESSEL_SYNONYMS.flatMap(v => v.aliases.map(phrase => ({ phrase, replacement: v.family, structureIds: v.structureIds, kind: "whole-vessel" as const }))));
// No exact apical/OM mapping is inferred from an unsupported distal or numbered-branch label.
aliases.push(...["distal LAD", "dLAD", "distal left anterior descending artery"].map(phrase => ({ phrase, replacement: "lad distal", structureIds: [], kind: "unmapped-region" as const, qualifier: "distal-lad-not-apical" })));
aliases.push(...["OM1", "OM2", "first obtuse marginal", "second obtuse marginal", "first obtuse marginal artery", "second obtuse marginal artery", "first obtuse marginal branch", "second obtuse marginal branch"].map(phrase => ({ phrase, replacement: phrase.toLowerCase().replaceAll(" ", ""), structureIds: [], kind: "unmapped-region" as const, qualifier: "specific-om-branch-not-confirmed" })));
const byPhrase = new Map<string, Alias>();
for (const alias of aliases) {
  const key = normalize(alias.phrase).toLowerCase(), previous = byPhrase.get(key);
  if (previous && JSON.stringify(previous.structureIds) !== JSON.stringify(alias.structureIds)) throw new Error(`Ambiguous anatomical alias: ${alias.phrase}`);
  byPhrase.set(key, alias);
}
const escape = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const pattern = new RegExp(`\\b(?:${[...byPhrase.keys()].sort((a, b) => b.length - a.length).map(escape).join("|")})\\b`, "gi");
export type AnatomyTermMatch = { term: string; canonicalNames: string[]; structureIds: HeartPartId[]; kind: Alias["kind"]; qualifier: string | null; usable: boolean };
/** Match longest phrases first, preserving segment specificity and conditional origins. */
export function resolveAnatomicalTerms(text: string, options: { separateConusOriginConfirmed?: boolean } = {}) {
  const matches: AnatomyTermMatch[] = [];
  // Resolve shared-vessel grammar without equating any of its segments.
  const expanded = text.replace(/\b(proximal|mid|middle|distal|apical)\s+(and|versus|vs)\s+(proximal|mid|middle|distal|apical)\s+(RCA|LAD)\b/gi,
    "$1 $4 $2 $3 $4");
  const normalized = normalize(expanded).replace(pattern, term => {
    const alias = byPhrase.get(term.toLowerCase())!;
    // Ordinary English "am" must not be interpreted as the AM abbreviation.
    if (term.toLowerCase() === "am" && term !== "AM") return term;
    const usable = alias.kind !== "unmapped-region" && (!alias.requiresConfirmation || options.separateConusOriginConfirmed === true);
    matches.push({ term, canonicalNames: alias.structureIds.map(id => HEART_PARTS.find(p => p.id === id)!.name), structureIds: alias.structureIds, kind: alias.kind, qualifier: alias.qualifier ?? null, usable });
    return usable || alias.kind === "unmapped-region" ? alias.replacement : term;
  }).toLowerCase();
  return { normalized, matches };
}
export function canonicalText(text: string) {
  return resolveAnatomicalTerms(text).normalized.replace(/\b(?:middle|mid)\b/g, "mid").replace(/\b(?:supplied|supplies|supplying|supply)\b/g, "supply").replace(/\b(?:drainage|drains|draining|drain)\b/g, "drain").replace(/\b(?:empties|emptying)\b/g, "empty")
    .replace(/\bcomputed tomography\b/g, "ct").replace(/\bpercutaneous coronary intervention\b/g, "pci")
    .replace(/\bcoronary artery bypass graft(?:ing)?\b/g, "cabg").replace(/\bstents\b/g, "stent");
}
const stop = new Set("a an am is are was were be to of in on at from as by into or which what does do the this that its it they them function role explain where how and for with only test synthetic fixture source material information please tell me about between difference determines provides describe versus vs has have gives branches branch artery vein vessel named name anatomy anatomical educational not no solely tagged study context contains knowledge can you your our my all any but these their than if then when moves through identify question compare general physiology clinical purpose why relevant normal fictional invented imaginary answer same also used show focus select highlight display zoom find reset view camera".split(" "));
export function lexicalTerms(value: string): Set<string> {
  return new Set(canonicalText(value).replace(/[^a-z0-9]+/g, " ").split(/\s+/).filter(word => word.length > 1 && !stop.has(word)));
}
