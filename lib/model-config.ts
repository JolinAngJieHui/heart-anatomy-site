import { z } from "zod";
import { HEART_PARTS, type HeartPartId } from "./heart-parts";

const coordinates = z.tuple([z.number().finite(), z.number().finite(), z.number().finite()]);
const structure = z.object({
  /** Unique exported node names; safe separator/case fallback, never fuzzy anatomy. */
  meshes: z.array(z.string().min(1).max(200)).max(100).default([]),
  /** No inferred marker positions: an author must supply each attachment. */
  anchor: z.object({ node: z.string().min(1).max(200).optional(), position: coordinates }).strict().optional(),
}).strict();
const highlightGroup = z.object({
  label: z.string().trim().min(1).max(120),
  meshes: z.array(z.string().min(1).max(200)).min(1).max(100),
  structures: z.array(z.string().refine(id => HEART_PARTS.some(part => part.id === id), "Unknown structure ID"))
    .min(1).max(HEART_PARTS.length).refine(ids => new Set(ids).size === ids.length, "Duplicate group member"),
}).strict();

export const modelConfigSchema = z.object({
  version: z.literal(1),
  url: z.string().regex(/^\/models\/[a-zA-Z0-9_-]+\.glb$/).nullable(),
  rotationDegrees: coordinates,
  structures: z.record(z.string(), structure).refine(value => Object.keys(value).every(id => HEART_PARTS.some(part => part.id === id)), "Unknown structure ID"),
  /** Explicit shared geometry, independent of each segment's marker and history. */
  highlightGroups: z.record(z.string().regex(/^[a-z0-9-]+$/), highlightGroup).optional(),
}).strict().superRefine((config, context) => {
  const members = new Set<string>();
  for (const [groupId, group] of Object.entries(config.highlightGroups ?? {})) {
    for (const id of group.structures) {
      if (!config.structures[id] || members.has(id)) context.addIssue({ code: "custom", path: ["highlightGroups", groupId, "structures"], message: "Each group member must have a structure entry and belong to only one highlight group." });
      members.add(id);
    }
  }
});
export type HeartModelConfig = z.infer<typeof modelConfigSchema>;
export type ModelCapabilities = { kind: "loading" | "imported" | "error"; markerIds: HeartPartId[]; meshIds: HeartPartId[]; groupIds?: string[] };
export const UNLOADED_MODEL: ModelCapabilities = { kind: "loading", markerIds: [], meshIds: [] };
