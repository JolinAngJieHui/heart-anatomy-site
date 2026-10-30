import { mkdir, readFile, writeFile, rename } from "node:fs/promises";
import path from "node:path";
import { type HeartPartId } from "../heart-parts";
import { sha256, prepareAvailableDocuments } from "./documents";
import { validateReference, validateRegistry, validDate, type Reference } from "./registry";

export type ImportEntry = {
  url: string; categories?: string[]; structureIds?: HeartPartId[]; topics?: Reference["topics"];
  documentPath?: string;
};
export type VerifiedMetadata = {
  url: string; title: string | null; authors: string[]; publicationYear: number | null;
  publicationDetails: string | null; doi: string | null; identityVerified: boolean; access: string;
  verificationUrl?: string; license: string | null; licenseUrl: string | null;
  articleType: string | null; text: string | null; sections: string[]; issues: string[];
};
export const normalizeUrl = (value: string) => {
  const url = new URL(value);
  if (url.protocol !== "https:" || url.username || url.password) throw new Error("References require public HTTPS citation URLs");
  url.hash = "";
  for (const key of [...url.searchParams.keys()]) if (key.startsWith("utm_")) url.searchParams.delete(key);
  return url.href.replace(/\/$/, "");
};
const unrestrictedLicense = (url: string | null) => !!url && /^https?:\/\/(www\.)?creativecommons\.org\/licenses\/(by|by-sa)\/(\d\.\d\/?)?$/.test(url);
const safeCollection = (id: string) => { if (!/^[a-z0-9][a-z0-9-]{0,79}$/.test(id)) throw new Error("Invalid collection ID"); return id; };
const unique = <T>(values: T[]) => [...new Set(values)];
const existingUrl = (value: string) => { try { return normalizeUrl(value); } catch { return null; } };

/** Original sources only. Categories are filing associations, never claim verification. */
export function buildCollection(entries: ImportEntry[], metadata: VerifiedMetadata[], previous: Reference[], options: { id: string; reviewer: string; date: string }) {
  safeCollection(options.id);
  if (!options.reviewer.trim() || !validDate(options.date)) throw new Error("Explicit bulk scientific confirmation requires reviewer and date");
  const byUrl = new Map<string, VerifiedMetadata>(), metadataErrors = new Map<string, string>();
  for (const m of metadata) {
    let url: string | undefined;
    try {
      url = normalizeUrl(m.url);
      if (typeof m.identityVerified !== "boolean" || typeof m.access !== "string" || !Array.isArray(m.authors) || !Array.isArray(m.sections) || !Array.isArray(m.issues)) throw new Error("Malformed verified source metadata");
      for (const field of ["title", "publicationDetails", "doi", "license", "licenseUrl", "articleType", "text"] as const) if (m[field] !== null && typeof m[field] !== "string") throw new Error(`Malformed metadata field: ${field}`);
      byUrl.set(url, m);
    } catch (error) { if (url) metadataErrors.set(url, String(error)); }
  }
  const originals = previous.filter(r => !r.teachingNote && r.sourceType !== "educational-summary");
  const groups = new Map<string, ImportEntry[]>(), invalid: { entry: ImportEntry; reason: string }[] = [];
  for (const entry of entries) {
    try {
      const url = normalizeUrl(entry.url), m = byUrl.get(url);
      const key = m?.identityVerified && m.doi ? `doi:${m.doi.toLowerCase().replace(/^https?:\/\/doi.org\//, "")}` : url;
      groups.set(key, [...groups.get(key) ?? [], entry]);
    } catch (error) { invalid.push({ entry, reason: String(error) }); }
  }
  const files: { filename: string; text: string }[] = [], records: Reference[] = [], retained: string[] = [], added: string[] = [];
  for (const group of groups.values()) {
    const url = normalizeUrl(group[0].url);
    const candidates = group.map(e => byUrl.get(normalizeUrl(e.url))).filter((m): m is VerifiedMetadata => !!m);
    const m = candidates.find(m => m.identityVerified && unrestrictedLicense(m.licenseUrl) && !!m.text?.trim()) ?? candidates.find(m => m.identityVerified) ?? candidates[0];
    const old = originals.find(r => existingUrl(r.location) === url || (!!m?.doi && (r.collection?.doi ?? r.curation?.doi)?.toLowerCase() === m.doi.toLowerCase()));
    const pmcid = /\/(PMC\d+)\/?$/i.exec(url)?.[1].toLowerCase();
    const id = old?.id ?? pmcid ?? `web-${sha256(url).slice(0, 16)}`;
    (old ? retained : added).push(id);
    const usable = !!m?.identityVerified && unrestrictedLicense(m.licenseUrl) && !!m.text?.trim();
    const content = usable ? `# ${m!.title}\n\nSource: ${group[0].url}\nAuthors: ${m!.authors.join("; ")}\nLicense: ${m!.licenseUrl}\nExtracted article body; headings retained. No generated summaries.\n\n${m!.text!.trim()}\n` : null;
    const hash = content ? sha256(content) : null;
    const version = hash ? `content-${hash.slice(0, 20)}` : "metadata-1";
    const filename = hash ? `approved/${id}-${hash.slice(0, 20)}.md` : null;
    if (filename && content) files.push({ filename, text: content });
    const issues = [...m?.issues ?? ["Source identity has not been verified"]];
    if (metadataErrors.has(url)) issues.push(metadataErrors.get(url)!);
    if (!m?.authors.length) issues.push("Author metadata not available; no author invented");
    if (!m?.publicationYear) issues.push("Publication year not available; no year invented");
    if (m?.articleType === "case-report" || /\bcase (?:report|of)\b/i.test(m?.title ?? "")) issues.push("Case report: individual findings must not be presented as universal normal anatomy");
    const record: Reference = {
      id, title: m?.title ?? old?.title ?? `Unverified reference: ${pmcid?.toUpperCase() ?? group[0].url}`,
      institution: m?.publicationDetails ?? old?.institution ?? null, publicationYear: m?.publicationYear ?? null,
      edition: null, yearOrEdition: m?.publicationDetails ?? null,
      section: usable ? "Article body; section headings retained in extracted text" : "Not extracted",
      structureIds: unique(group.flatMap(e => e.structureIds ?? [])),
      topics: unique(group.flatMap(e => e.topics?.length ? e.topics : ["cardiovascular-anatomy" as const])),
      location: group[0].url, documentPath: filename, sourceType: pmcid ? "journal" : "website", materialKind: "reference",
      status: "approved", approvedBy: options.reviewer, approvalDate: options.date,
      documentVersion: version, approvedVersion: hash ? version : null, approvedSha256: hash,
      licenseConfirmed: usable, publicCitation: true,
      externalIndexingPermission: { cleared: false, reviewedBy: null, reviewedOn: null, evidence: null },
      collection: {
        id: options.id, scientificApprovalEvidence: "Project owner's explicit bulk scientific approval of the supplied original-reference list; no independent review of derivatives implied.",
        identityVerified: m?.identityVerified ?? false, categories: unique(group.flatMap(e => e.categories ?? ["Uncategorised"])), originalUrls: unique(group.map(e => e.url)),
        authors: m?.authors ?? [], doi: m?.doi ?? null, publicationDetails: m?.publicationDetails ?? null,
        access: m?.access ?? "unverified", verificationUrl: m?.verificationUrl ?? null,
        license: m?.license ?? null, licenseUrl: m?.licenseUrl ?? null, articleType: m?.articleType ?? null,
        contentStatus: usable ? "searchable" : "metadata-only", sections: usable ? m!.sections : [], issues,
      },
    };
    try { records.push(validateReference(record)); }
    catch (error) {
      invalid.push({ entry: group[0], reason: String(error) });
      // Technical rejection excludes just this source, never its valid peers.
      if (old) retained.splice(retained.indexOf(id), 1); else added.splice(added.indexOf(id), 1);
    }
  }
  validateRegistry(records);
  return { records, files, summary: { occurrences: entries.length, imported: records.length, duplicatesRemoved: entries.length - invalid.length - records.length, added, retained,
    archived: previous.filter(r => !retained.includes(r.id)).map(r => r.id), invalid,
    searchable: records.filter(r => r.collection!.contentStatus === "searchable").map(r => r.id),
    metadataOnly: records.filter(r => r.collection!.contentStatus === "metadata-only").map(r => r.id) } };
}

/** Writes immutable content and a candidate registry. The active registry is untouched. */
export async function stageCollection(root: string, entries: ImportEntry[], metadata: VerifiedMetadata[], options: { id: string; reviewer: string; date: string }) {
  const directory = path.join(root, "collections", safeCollection(options.id));
  let alreadyActivated = false;
  try { await readFile(path.join(directory, "activation.json")); alreadyActivated = true; }
  catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; }
  if (alreadyActivated) throw new Error("Collection already activated; use a fresh collection ID to preserve its historical snapshot");
  const activeBytes = await readFile(path.join(root, "registry.json"), "utf8");
  const previous = validateRegistry(JSON.parse(activeBytes));
  const built = buildCollection(entries, metadata, previous, options);
  await mkdir(directory, { recursive: true }); await mkdir(path.join(root, "approved"), { recursive: true });
  for (const file of built.files) await writeFile(path.join(root, file.filename), file.text, "utf8");
  const registryBytes = JSON.stringify(built.records, null, 2) + "\n";
  const report = { collectionId: options.id, activation: "awaiting-confirmation", activeRegistrySha256: sha256(activeBytes), registrySha256: sha256(registryBytes), ...built.summary };
  await writeFile(path.join(directory, "registry.json"), registryBytes);
  await writeFile(path.join(directory, "previous-registry.json"), activeBytes);
  await writeFile(path.join(directory, "report.json"), JSON.stringify(report, null, 2) + "\n");
  return report;
}

/** One explicit activation, with automatic integrity checks and a complete backup. */
export async function activateCollection(root: string, id: string, confirmed: boolean) {
  if (!confirmed) throw new Error("Activation requires explicit confirmation; staging is the default");
  const directory = path.join(root, "collections", safeCollection(id));
  const report = JSON.parse(await readFile(path.join(directory, "report.json"), "utf8"));
  const candidate = await readFile(path.join(directory, "registry.json"), "utf8");
  const active = await readFile(path.join(root, "registry.json"), "utf8");
  if (sha256(candidate) !== report.registrySha256 || sha256(active) !== report.activeRegistrySha256) throw new Error("Collection changed since staging; restage before activation");
  const records = validateRegistry(JSON.parse(candidate));
  if (records.some(r => r.collection?.id !== id)) throw new Error("Mixed collection registry");
  const readiness = await prepareAvailableDocuments(records, root);
  if (readiness.documents.length !== report.searchable.length) throw new Error("Searchable content changed or unavailable; restage before activation");
  const archive = path.join(root, "archive", `${id}-${sha256(active).slice(0, 12)}`);
  await mkdir(archive, { recursive: true });
  await writeFile(path.join(archive, "registry.json"), active);
  // Manifest is backed up and reset: stale remote evidence cannot survive replacement.
  const manifest = await readFile(path.join(root, "index-manifest.json"), "utf8");
  await writeFile(path.join(archive, "index-manifest.json"), manifest);
  await writeFile(path.join(root, "index-manifest.json"), JSON.stringify({ vectorStoreId: null, documents: [] }, null, 2) + "\n");
  const temporary = path.join(root, "registry.activating.json");
  await writeFile(temporary, candidate); await rename(temporary, path.join(root, "registry.json"));
  const activatedAt = new Date().toISOString();
  await writeFile(path.join(directory, "activation.json"), JSON.stringify({ activatedAt, archive, searchable: readiness.documents.length }, null, 2) + "\n");
  await writeFile(path.join(directory, "report.json"), JSON.stringify({ ...report, activation: "active", activatedAt, archive }, null, 2) + "\n");
  return { activated: id, archive, searchable: readiness.documents.length, metadataOnly: readiness.excluded.length };
}
