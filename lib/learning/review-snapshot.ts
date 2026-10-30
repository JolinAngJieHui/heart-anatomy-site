import { z } from "zod";
import { applyReviewSelection, basicReview, reviewRequestSchema, reviewSelectionSchema, type ReviewInput, type ReviewSelection } from "./lesson-review";
import { permittedEvidence, type EvidenceCatalogue } from "./evidence";

export const reviewSnapshotSchema = z.object({
  version: z.string().min(1).max(64), input: reviewRequestSchema, selection: reviewSelectionSchema.nullable(),
}).strict();
export type ReviewSnapshot = z.infer<typeof reviewSnapshotSchema>;
function versionOf(input: ReviewInput, selection: ReviewSelection | null, catalogue: EvidenceCatalogue | null) {
  // A content label, not an authentication token. Cache keys retain the full input.
  // Canonical schema order is essential: JSON property insertion order can
  // change between SDK output, browser storage and server request parsing.
  const text = JSON.stringify({ input: reviewRequestSchema.parse(input), selection: selection ? reviewSelectionSchema.parse(selection) : null, evidence: catalogue?.sources });
  let hash = 2166136261;
  for (let i = 0; i < text.length; i++) hash = Math.imul(hash ^ text.charCodeAt(i), 16777619);
  return `review-v1-${(hash >>> 0).toString(16)}`;
}
export function createReviewSnapshot(input: ReviewInput, selection: ReviewSelection | null, catalogue: EvidenceCatalogue | null): ReviewSnapshot {
  return { version: versionOf(input, selection, permittedEvidence(catalogue)), input, selection };
}
export function restoreReviewSnapshot(raw: ReviewSnapshot, catalogue: EvidenceCatalogue | null) {
  const snapshot = reviewSnapshotSchema.parse(raw), evidence = permittedEvidence(catalogue);
  if (snapshot.version !== versionOf(snapshot.input, snapshot.selection, evidence)) throw new Error("The review or reference collection has changed");
  return snapshot.selection ? applyReviewSelection(snapshot.input, evidence, snapshot.selection) : basicReview(snapshot.input, evidence);
}
