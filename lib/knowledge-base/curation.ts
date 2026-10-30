import { z } from "zod";
import { HEART_PARTS } from "../heart-parts";

const ids = z.enum(HEART_PARTS.map(p => p.id) as [string, ...string[]]);
const nonempty = z.string().trim().min(1);
const https = z.url().refine(url => new URL(url).protocol === "https:");
const unique = <T>(items: T[]) => new Set(items).size === items.length;
/** Optional enrichment for reviewed web references. Legacy records remain valid. */
export const curationSchema = z.object({
  checkedOn: z.iso.date(),
  authors: z.array(nonempty).min(1),
  publicationDetails: nonempty,
  doi: nonempty.nullable(),
  updatedOn: z.iso.date().nullable(),
  scope: z.enum(["broad-anatomy", "structure-specific", "clinical-context", "variant-case", "imaging-methods"]),
  access: z.enum(["readable", "search-index-only", "abstract-only", "blocked"]),
  metadataEvidenceUrls: z.array(https).min(1),
  verificationNotes: nonempty,
  reuse: z.object({
    license: nonempty,
    evidenceUrl: https,
    disposition: z.enum(["attributed-summary-ready", "conditional-noncommercial", "permission-required", "unverified"]),
    fullTextCopied: z.literal(false),
    externalIndexingCleared: z.boolean(),
    notes: nonempty,
  }).strict(),
  sectionMappings: z.array(z.object({
    section: nonempty,
    structureIds: z.array(ids).min(1).refine(unique),
    relationship: z.enum(["direct", "parent-vessel", "context", "variant"]),
    anatomy: z.enum(["normal", "normal-variant", "rare-anomaly", "clinical", "methods"]),
    levels: z.array(z.enum(["basic", "intermediate", "advanced"])).min(1).refine(unique),
    verified: z.boolean(),
    notes: nonempty,
  }).strict()).min(1),
}).strict();
export type ReferenceCuration = z.infer<typeof curationSchema>;

export function validateCuration(value: unknown, structureIds: readonly string[]) {
  const parsed = curationSchema.parse(value);
  const mapped = new Set(parsed.sectionMappings.flatMap(s => s.structureIds));
  if (structureIds.some(id => !mapped.has(id)) || [...mapped].some(id => !structureIds.includes(id))) throw new Error("Curation structure mapping disagrees with reference");
  if (parsed.scope === "variant-case" && parsed.sectionMappings.some(s => s.anatomy !== "rare-anomaly" || s.relationship !== "variant")) throw new Error("Variant cases cannot count as normal anatomy");
  if (parsed.sectionMappings.some(s => s.anatomy === "rare-anomaly" && !s.notes.toLowerCase().includes("not normal"))) throw new Error("Rare anomalies require an explicit not normal warning");
  return parsed;
}
