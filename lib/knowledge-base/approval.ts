import { metadataHash, sha256 } from "./documents";
import { validateReference, validDate, type Reference } from "./registry";
import { renderTeachingDocument } from "./teaching";
export function approveTeachingDocument(source: Reference, bytes: Uint8Array, review: { reviewer: string; date: string; expectedSha256: string; expectedMetadataHash: string; scientificReviewed: boolean; localReuseConfirmed: boolean }): Reference {
  validateReference(source);
  if (!source.teachingNote || source.status !== "pending_review" || !source.documentPath?.startsWith("pending_review/")) throw new Error("Only pending teaching documents may be approved");
  if (!review.reviewer?.trim() || !validDate(review.date) || !review.scientificReviewed || !review.localReuseConfirmed) throw new Error("Explicit scientific review, reviewer/date and local reuse confirmation required");
  if (review.expectedSha256 !== sha256(bytes) || review.expectedMetadataHash !== metadataHash(source) || !Buffer.from(bytes).equals(Buffer.from(renderTeachingDocument(source)))) throw new Error("Review snapshot is stale or content/metadata differ");
  return validateReference({ ...source, status: "approved", documentPath: `approved/${source.id}.md`, approvedBy: review.reviewer, approvalDate: review.date, approvedVersion: source.documentVersion, approvedSha256: sha256(bytes), licenseConfirmed: true, externalIndexingPermission: { cleared: false, reviewedBy: null, reviewedOn: null, evidence: null } });
}
