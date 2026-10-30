/** Offline concept-space semantic features. No model, downloads or generated facts.
 * These features connect query wording to passage wording; they never supply answers.
 * This deliberately bounded semantic matcher is not a neural embedding model.
 */
const concepts: Record<string, RegExp> = {
  perfusion: /\b(perfusion|supply|supplies|supplied|blood flow|oxygenated|oxygen rich|oxygen delivery|vascular territory|irrigation)\b/i,
  ischemia: /\b(ischemi\w*|ischaemi\w*|oxygen deprivation|reduced blood flow|hypoperfusion|infarct\w*)\b/i,
  atherosclerosis: /\b(atherosclero\w*|plaque|coronary artery disease|cad|coronary heart disease)\b/i,
  drainage: /\b(drain\w*|venous return|deoxygenated|empties|empty into|returns blood)\b/i,
  dominance: /\b(dominan\w*|dominant|codominan\w*|co dominan\w*)\b/i,
  branching: /\b(branch\w*|bifurcat\w*|trifurcat\w*|origin|originate\w*|arises|arise|takeoff)\b/i,
  variants: /\b(variation\w*|variant\w*|anomal\w*|aberrant|ectopic|congenital|unusual|rare)\b/i,
  imaging: /\b(angiogra\w*|catheteri\w*|computed tomography|cta|ct|imaging|visualization|visualisation)\b/i,
  rhythm: /\b(rhythm|conduction|sinoatrial|atrioventricular|pacemaker|sa node|av node)\b/i,
};
export function semanticConcepts(text: string): Set<string> {
  return new Set(Object.entries(concepts).filter(([, expression]) => expression.test(text.replace(/[-–—]/g, " "))).map(([concept]) => concept));
}
export function conceptSimilarity(query: Set<string>, passage: Set<string>) {
  const matches = [...query].filter(concept => passage.has(concept));
  return { matches, score: query.size && passage.size ? matches.length / Math.sqrt(query.size * passage.size) : 0 };
}
