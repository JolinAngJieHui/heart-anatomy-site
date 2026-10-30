import { z } from "zod";
import { HEART_PARTS, type HeartPartId } from "../heart-parts";
import type { Reference } from "./registry";
const ids = z.enum(HEART_PARTS.map(p => p.id) as [HeartPartId, ...HeartPartId[]]);
const citation = z.object({ sourceId: z.string().min(1), title: z.string().min(1), url: z.url().refine(u => u.startsWith("https://")), section: z.string().min(1), page: z.string().nullable(), publicationDetails: z.string().min(1), sourceVersion: z.string().min(1), evidenceAccess: z.enum(["readable-page", "primary-search-excerpt"]) }).strict();
export const teachingSchema = z.object({
  structureId: ids, synonyms: z.array(z.string().min(1)).min(1), preparedOn: z.iso.date(),
  preparation: z.literal("independently-written-attributed-notes"),
  passages: z.array(z.object({ id: z.string().regex(/^[a-z0-9-]+$/), domain: z.enum(["anatomy", "physiology", "clinical"]), pattern: z.enum(["normal", "normal-variant", "rare-anomaly", "clinical-context"]), relationship: z.enum(["direct", "parent-vessel", "general-coronary-context"]), structureIds: z.array(ids).min(1), levels: z.array(z.enum(["basic", "intermediate", "advanced"])).min(1), text: z.string().min(20).max(1500), evidence: z.array(citation).min(1) }).strict()).min(1),
  gaps: z.array(z.string().min(1)).min(1), uncertainties: z.array(z.string().min(1)),
}).strict();
export type TeachingNote = z.infer<typeof teachingSchema>;
export function validateTeachingNote(value: unknown, structureIds: string[]) {
  const note = teachingSchema.parse(value);
  const seen = new Set<string>();
  if (!structureIds.includes(note.structureId)) throw new Error("Teaching structure mismatch");
  for (const p of note.passages) {
    if (seen.has(p.id) || p.structureIds.some(id => !structureIds.includes(id)) || new Set(p.structureIds).size !== p.structureIds.length) throw new Error("Invalid teaching passage mapping");
    seen.add(p.id);
    if (p.pattern === "rare-anomaly" && (!p.text.includes("not typical anatomy") || p.levels.some(l => l !== "advanced"))) throw new Error("Rare anomalies must be qualified and Advanced only");
  }
  return note;
}
export function validateTeachingEvidence(records: Reference[]) {
  for (const r of records) if (r.teachingNote) for (const p of r.teachingNote.passages) for (const e of p.evidence) {
    const original = records.find(s => s.id === e.sourceId && !s.teachingNote);
    if (!original || e.url !== original.location || e.title !== original.title || e.sourceVersion !== original.documentVersion || e.publicationDetails !== original.curation?.publicationDetails || p.structureIds.some(id => !original.structureIds.includes(id))) throw new Error(`Unknown, stale or mismapped teaching citation: ${r.id}/${p.id}`);
  }
}
/** Reproducible review document. Approval binds these exact bytes and metadata. */
export function renderTeachingDocument(source: Reference): string {
  const n = validateTeachingNote(source.teachingNote, source.structureIds);
  return `# ${source.title}\n\nDocument: ${source.id}; version: ${source.documentVersion}; prepared: ${n.preparedOn}.\nScientific approval and reuse permissions are recorded separately in registry.json.\nPreparation: ${n.preparation}. No copied full text or figures.\n\nStructure: ${n.structureId}. Synonyms: ${n.synonyms.join(", ")}.\n\n` + n.passages.map(p => `## ${p.id}: ${p.domain}\n\nPattern: ${p.pattern}; relationship: ${p.relationship}; structures: ${p.structureIds.join(", ")}; levels: ${p.levels.join(", ")}.\n\n${p.text}\n\n` + p.evidence.map(e => `Evidence: [${e.sourceId}: ${e.title}](${e.url}) — ${e.section}${e.page ? `; page ${e.page}` : ""}. ${e.publicationDetails} Registry source version: ${e.sourceVersion}. Access: ${e.evidenceAccess}.\n`).join("\n")).join("\n") + `\n## Outstanding questions (not retrievable factual evidence)\n\n${n.gaps.map(g => `- ${g}`).join("\n")}\n\n## Scientific uncertainties\n\n${n.uncertainties.map(g => `- ${g}`).join("\n") || "None additionally recorded; supervisor review still required."}\n`;
}
