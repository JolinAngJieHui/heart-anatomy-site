import { getHeartPart, type HeartPart, type HeartPartId } from "./heart-parts";

export type VesselKind = "artery" | "vein";
// Shared by the GLB materials, active markers and vessel labels. Explored-only
// markers retain the rose learning-progress colour rather than these accents.
export const VESSEL_HIGHLIGHT_COLORS = { artery: "#ef4444", vein: "#3b82f6" } as const;
// Blend the model tint over its original material; never make the vessel itself transparent.
export const VESSEL_HIGHLIGHT_OPACITY = 0.7;
const CATEGORY_KIND: Record<HeartPart["category"], VesselKind> = {
  "coronary-artery": "artery", "great-artery": "artery",
  "systemic-vein": "vein", "coronary-vein": "vein",
};
export function vesselKind(id: HeartPartId): VesselKind {
  return CATEGORY_KIND[getHeartPart(id)!.category];
}
/** Whole-vessel groups use the same classification as their numbered segments.
 * A mixed/empty group has no single vessel colour; never guess its identity. */
export function vesselHighlightColor(ids: readonly HeartPartId[]) {
  if (!ids.length) return undefined;
  const kind = vesselKind(ids[0]);
  return ids.every(id => vesselKind(id) === kind) ? VESSEL_HIGHLIGHT_COLORS[kind] : undefined;
}
