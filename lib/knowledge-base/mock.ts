import { HEART_PARTS, type HeartPartId } from "../heart-parts";
type Fixture = { id: string; structureIds: HeartPartId[]; text: string; version: string; materialKind: "synthetic" };
export type SyntheticDataset = { kind: "synthetic-test-only"; documents: Fixture[] };
export function validateSyntheticDataset(value: unknown): SyntheticDataset {
  if (!value || typeof value !== "object") throw new Error("Invalid synthetic dataset");
  const data = value as SyntheticDataset;
  if (data.kind !== "synthetic-test-only" || !Array.isArray(data.documents)) throw new Error("Synthetic namespace required");
  const ids = new Set<string>();
  for (const doc of data.documents) {
    if (!doc || typeof doc.id !== "string" || !doc.id.startsWith("synthetic-") || ids.has(doc.id) || doc.materialKind !== "synthetic" || typeof doc.text !== "string" || !doc.text.startsWith("SYNTHETIC TEST ONLY") || typeof doc.version !== "string" || !doc.version || !Array.isArray(doc.structureIds) || !doc.structureIds.length || doc.structureIds.some(id => !HEART_PARTS.some(p => p.id === id))) throw new Error("Invalid synthetic fixture");
    ids.add(doc.id);
  }
  return data;
}
const tokens = (value: string) => new Set(value.toLowerCase().match(/[a-z0-9]+/g) ?? []);
/** Local lexical ranking, not embeddings or anatomical evidence. Structure
 * context adds a tie-breaker without excluding related structures. */
export function mockRetrieve(value: unknown, query: string, selected: HeartPartId | null = null, limit = 4) {
  const dataset = validateSyntheticDataset(value);
  if (typeof query !== "string" || !query.trim() || query.length > 1200 || !Number.isInteger(limit) || limit < 1 || limit > 10 || (selected !== null && !HEART_PARTS.some(p => p.id === selected))) throw new Error("Invalid mock query");
  const words = tokens(query);
  const matches = dataset.documents.map(doc => {
    const terms = tokens(doc.text), overlap = [...words].filter(word => terms.has(word)).length;
    return { ...doc, score: overlap ? overlap / words.size + (selected && doc.structureIds.includes(selected) ? .01 : 0) : 0 };
  }).filter(doc => doc.score > 0).sort((a, b) => b.score - a.score || a.id.localeCompare(b.id)).slice(0, limit);
  return { mode: "synthetic-test-only" as const, warning: "SYNTHETIC TEST ONLY — fictional material, never production anatomical evidence", query, selectedStructureId: selected, passages: matches };
}
