import { HEART_PARTS, type HeartPartId } from "../heart-parts";
import { validateCuration, type ReferenceCuration } from "./curation";
import { validateTeachingNote, validateTeachingEvidence, type TeachingNote } from "./teaching";

export const APPROVAL_STATES = ["draft", "pending_review", "approved", "rejected"] as const;
export const TOPICS = ["cardiovascular-anatomy", "coronary-anatomy", "cardiovascular-physiology", "clinical-correlations", "anatomical-variants", "diagnostics", "procedures"] as const;
export const SOURCE_TYPES = ["textbook", "journal", "guideline", "website", "educational-summary"] as const;
export type Reference = {
  id: string; title: string; institution: string | null; publicationYear: number | null; edition: string | null;
  yearOrEdition: string | null; section: string; structureIds: HeartPartId[]; topics: (typeof TOPICS)[number][];
  location: string; documentPath: string | null; sourceType: (typeof SOURCE_TYPES)[number]; materialKind: "reference";
  status: (typeof APPROVAL_STATES)[number]; approvedBy: string | null; approvalDate: string | null;
  documentVersion: string; approvedVersion: string | null; approvedSha256: string | null;
  licenseConfirmed: boolean; publicCitation: boolean;
  curation?: ReferenceCuration;
  extraction?: {
    collectionId: string; sourceLabel: string; doi: string; authors: string[];
    licenceUrl: string | null; licenceText: string | null; licenceCheckedOn: string;
    acquisitionUrl: string | null; copyrightNotice: string | null; changesNotice: string;
    rawSha256: string | null; sha256: string | null; articleType: string | null;
    starterSections: string[]; cautions: string[];
    locators: { section: string; locator: string; sha256: string }[];
  };
  teachingNote?: TeachingNote;
  externalIndexingPermission?: { cleared: boolean; reviewedBy: string | null; reviewedOn: string | null; evidence: string | null };
  collection?: {
    id: string; scientificApprovalEvidence: string; identityVerified: boolean;
    categories: string[]; originalUrls: string[]; authors: string[]; doi: string | null; publicationDetails: string | null;
    access: string; verificationUrl: string | null; license: string | null; licenseUrl: string | null;
    articleType: string | null; contentStatus: "searchable" | "metadata-only";
    sections: string[]; issues: string[];
  };
};
const text = (v: unknown): v is string => typeof v === "string" && !!v.trim();
const nullableText = (v: unknown) => v === null || text(v);
export function validDate(v: unknown): v is string {
  if (typeof v !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  const date = new Date(`${v}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === v;
}
export function safeDocumentPath(v: unknown): v is string {
  return typeof v === "string" && /^(draft|pending_review|approved|rejected)\/[a-zA-Z0-9_./-]+\.(txt|md|pdf)$/.test(v)
    && !v.split("/").some(segment => !segment || segment === "." || segment === "..");
}
export function validateReference(value: unknown): Reference {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Reference must be an object");
  const v = value as Record<string, unknown>;
  const fail = (field: string): never => { throw new Error(`Invalid reference ${String(v.id ?? "unknown")}: ${field}`); };
  for (const field of ["id", "title", "section", "location", "documentVersion"]) if (!text(v[field])) fail(field);
  if (String(v.documentVersion).length > 64) fail("documentVersion length");
  if ((!/^[a-z0-9][a-z0-9-]{0,99}$/.test(String(v.id)) && !(/^R(?:[1-9]|10|11)$/.test(String(v.id)) && v.extraction)) || String(v.id).startsWith("synthetic-")) fail("id");
  if (v.materialKind !== "reference") fail("materialKind: production accepts reference material only");
  for (const field of ["institution", "edition", "yearOrEdition", "approvedBy", "approvedVersion"]) if (!nullableText(v[field])) fail(field);
  if (v.publicationYear !== null && (typeof v.publicationYear !== "number" || !Number.isInteger(v.publicationYear) || v.publicationYear < 1 || v.publicationYear > 9999)) fail("publicationYear");
  if (!APPROVAL_STATES.includes(v.status as Reference["status"])) fail("status");
  if (!SOURCE_TYPES.includes(v.sourceType as Reference["sourceType"])) fail("sourceType");
  if (!Array.isArray(v.topics) || !v.topics.length || v.topics.some(t => !TOPICS.includes(t)) || new Set(v.topics).size !== v.topics.length) fail("topics");
  const ids = new Set<string>(HEART_PARTS.map(p => p.id));
  if (!Array.isArray(v.structureIds) || (!v.structureIds.length && v.collection === undefined) || v.structureIds.some(id => !ids.has(id)) || new Set(v.structureIds).size !== v.structureIds.length) fail("structureIds");
  if (v.documentPath !== null && !safeDocumentPath(v.documentPath)) fail("documentPath");
  if (v.approvalDate !== null && !validDate(v.approvalDate)) fail("approvalDate");
  if (v.approvedSha256 !== null && (typeof v.approvedSha256 !== "string" || !/^[a-f0-9]{64}$/.test(v.approvedSha256))) fail("approvedSha256");
  if (typeof v.licenseConfirmed !== "boolean" || typeof v.publicCitation !== "boolean") fail("permissions");
  if (v.curation !== undefined) validateCuration(v.curation, v.structureIds as string[]);
  if (v.extraction !== undefined) {
    const e = v.extraction as NonNullable<Reference["extraction"]>;
    if (!e || !/^minimal-\d{4}-\d{2}-\d{2}$/.test(e.collectionId) || e.sourceLabel !== v.id || !/^R(?:[1-9]|10|11)$/.test(e.sourceLabel) || !text(e.doi) || !validDate(e.licenceCheckedOn) || !text(e.changesNotice)) fail("extraction identity");
    for (const field of ["authors", "starterSections", "cautions"] as const) if (!Array.isArray(e[field]) || e[field].some(t => !text(t))) fail(`extraction ${field}`);
    if (!Array.isArray(e.locators) || e.locators.some(p => !text(p.section) || !text(p.locator) || !/^[a-f0-9]{64}$/.test(p.sha256))) fail("extraction locators");
    for (const hash of [e.sha256, e.rawSha256]) if (hash !== null && !/^[a-f0-9]{64}$/.test(hash)) fail("extraction hash");
    if (e.locators.length && (!e.sha256 || !e.rawSha256 || !e.authors.length || e.licenceUrl !== "https://creativecommons.org/licenses/by/4.0/" || !text(e.licenceText) || !text(e.acquisitionUrl) || !v.licenseConfirmed || !safeDocumentPath(v.documentPath))) fail("extraction readiness");
    if (v.status === "pending_review" && (v.approvedBy !== null || v.approvalDate !== null || v.approvedVersion !== null || v.approvedSha256 !== null)) fail("pending extraction cannot claim scientific approval");
  }
  if (v.teachingNote !== undefined) validateTeachingNote(v.teachingNote, v.structureIds as string[]);
  if (v.collection !== undefined) {
    const c = v.collection as NonNullable<Reference["collection"]>;
    if (!c || !text(c.id) || !text(c.scientificApprovalEvidence) || typeof c.identityVerified !== "boolean" || !text(c.access) || !["searchable", "metadata-only"].includes(c.contentStatus)) fail("collection");
    for (const field of ["categories", "originalUrls", "authors", "sections", "issues"] as const) if (!Array.isArray(c[field]) || c[field].some(item => !text(item))) fail(`collection ${field}`);
    for (const field of ["doi", "publicationDetails", "verificationUrl", "license", "licenseUrl", "articleType"] as const) if (!nullableText(c[field])) fail(`collection ${field}`);
    if (v.teachingNote || v.sourceType === "educational-summary") fail("bulk approval applies to original sources only");
    if (c.contentStatus === "searchable" && (!c.identityVerified || !v.licenseConfirmed || !v.approvedSha256 || v.approvedVersion !== v.documentVersion || !safeDocumentPath(v.documentPath) || !v.documentPath.startsWith("approved/"))) fail("collection content readiness");
    if (c.contentStatus === "metadata-only" && (v.documentPath !== null || v.approvedSha256 !== null || v.approvedVersion !== null)) fail("metadata-only content must not enter retrieval");
  }
  if (v.externalIndexingPermission !== undefined) {
    const permission = v.externalIndexingPermission as NonNullable<Reference["externalIndexingPermission"]>;
    if (!permission || typeof permission.cleared !== "boolean" || !nullableText(permission.reviewedBy) || !nullableText(permission.evidence) || !(permission.reviewedOn === null || validDate(permission.reviewedOn))) fail("external indexing permission");
    if (permission.cleared && (!text(permission.reviewedBy) || !validDate(permission.reviewedOn) || !text(permission.evidence))) fail("incomplete external indexing clearance");
  }
  if (v.status === "approved") {
    if (v.collection !== undefined) {
      // Scientific approval of a bibliography is separate from extraction and rights.
      if (!text(v.approvedBy) || !validDate(v.approvalDate) || !v.publicCitation) fail("bulk scientific approval evidence");
      try { if (new URL(String(v.location)).protocol !== "https:") fail("public citation URL"); } catch { fail("public citation URL"); }
      return v as Reference;
    }
    if (!text(v.institution) || typeof v.publicationYear !== "number" || !text(v.approvedBy) || !validDate(v.approvalDate) || !v.approvedSha256 || v.approvedVersion !== v.documentVersion) fail("incomplete or stale approval");
    if (!v.licenseConfirmed || !v.publicCitation || !safeDocumentPath(v.documentPath) || !v.documentPath.startsWith("approved/")) fail("approval permissions/path");
    try { if (new URL(String(v.location)).protocol !== "https:") fail("public citation URL"); } catch { fail("public citation URL"); }
    if (v.sourceType === "textbook" && !text(v.edition)) fail("textbook edition");
  }
  return v as Reference;
}
export function validateRegistry(value: unknown): Reference[] {
  if (!Array.isArray(value)) throw new Error("Registry must be an array");
  const records = value.map(validateReference), ids = new Set<string>();
  for (const record of records) { if (ids.has(record.id)) throw new Error(`Duplicate source ID: ${record.id}`); ids.add(record.id); }
  validateTeachingEvidence(records);
  return records;
}
export function externalIndexingAllowed(source: Reference): boolean {
  return source.status === "approved" && (!source.collection || source.collection.contentStatus === "searchable") && (source.externalIndexingPermission?.cleared ?? source.curation?.reuse.externalIndexingCleared ?? false);
}
export function selectApproved(records: Reference[]): Reference[] {
  const validated = records.map(validateReference);
  if (new Set(validated.map(r => r.id)).size !== validated.length) throw new Error("Duplicate source ID");
  return validated.filter(record => record.status === "approved");
}
