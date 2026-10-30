import { readFile, realpath, stat } from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import { selectApproved, validateRegistry, type Reference } from "./registry";
import { renderTeachingDocument } from "./teaching";

export const sha256 = (bytes: string | Uint8Array) => createHash("sha256").update(bytes).digest("hex");
export type PreparedDocument = { source: Reference; bytes: Buffer; hash: string; metadataHash: string; version: string };
export type IndexEntry = { sourceId: string; fileId: string; hash: string; documentVersion?: string; metadataHash?: string };
export type IndexManifest = { vectorStoreId: string | null; documents: IndexEntry[] };
export function metadataHash(source: Reference): string {
  // Stable key order: input JSON property order has no effect on identity.
  return sha256(JSON.stringify(Object.fromEntries(Object.entries(source).sort(([a], [b]) => a.localeCompare(b)))));
}
export async function loadRegistry(filename: string): Promise<Reference[]> {
  return validateRegistry(JSON.parse(await readFile(filename, "utf8")));
}
export function validateManifest(value: unknown): IndexManifest {
  if (!value || typeof value !== "object") throw new Error("Invalid index manifest");
  const v = value as IndexManifest;
  if (!(v.vectorStoreId === null || typeof v.vectorStoreId === "string") || !Array.isArray(v.documents)) throw new Error("Invalid index manifest");
  const ids = new Set<string>(), files = new Set<string>();
  for (const d of v.documents) {
    if (!d || typeof d.sourceId !== "string" || typeof d.fileId !== "string" || !d.fileId || !/^[a-f0-9]{64}$/.test(d.hash) || ids.has(d.sourceId) || files.has(d.fileId)) throw new Error("Invalid or duplicate indexed document");
    if (d.documentVersion !== undefined && (typeof d.documentVersion !== "string" || !d.documentVersion.trim())) throw new Error("Invalid indexed version");
    if (d.metadataHash !== undefined && !/^[a-f0-9]{64}$/.test(d.metadataHash)) throw new Error("Invalid indexed metadata hash");
    ids.add(d.sourceId); files.add(d.fileId);
  }
  if (v.documents.length && !v.vectorStoreId) throw new Error("Indexed documents require a vector store");
  return v;
}
export async function prepareDocuments(records: Reference[], root: string): Promise<PreparedDocument[]> {
  const approved = selectApproved(records).filter(source => !source.collection || source.collection.contentStatus === "searchable");
  if (!approved.length) return [];
  const base = await realpath(root);
  const directory = await realpath(path.resolve(base, "approved"));
  const directoryRelative = path.relative(base, directory);
  if (!directoryRelative || directoryRelative.startsWith("..") || path.isAbsolute(directoryRelative)) throw new Error("Approved directory escapes knowledge base");
  const prepared: PreparedDocument[] = [];
  for (const source of approved) {
    const filename = await realpath(path.resolve(root, source.documentPath!));
    const relative = path.relative(directory, filename);
    if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) throw new Error(`Approved file escapes directory: ${source.id}`);
    const info = await stat(filename);
    if (!info.isFile() || !info.size || info.size > 20 * 1024 * 1024) throw new Error(`Invalid/oversized document: ${source.id}`);
    const bytes = await readFile(filename), hash = sha256(bytes);
    if (hash !== source.approvedSha256) throw new Error(`Changed document requires renewed approval: ${source.id}`);
    if (source.teachingNote && !bytes.equals(Buffer.from(renderTeachingDocument(source)))) throw new Error(`Teaching metadata and file differ: ${source.id}`);
    if (/\.(txt|md)$/.test(filename)) {
      const content = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
      if (!content.trim() || content.includes("\0")) throw new Error(`Invalid UTF-8 text: ${source.id}`);
    } else if (!bytes.subarray(0, 5).equals(Buffer.from("%PDF-"))) throw new Error(`Invalid PDF: ${source.id}`);
    prepared.push({ source, bytes, hash, metadataHash: metadataHash(source), version: source.documentVersion });
  }
  return prepared;
}
/** Fail closed per source: a missing/changed document does not disable its peers. */
export async function prepareAvailableDocuments(records: Reference[], root: string) {
  const documents: PreparedDocument[] = [], excluded: { sourceId: string; reason: string }[] = [];
  for (const source of records) {
    if (source.status !== "approved") { excluded.push({ sourceId: source.id, reason: `Scientific status: ${source.status}` }); continue; }
    if (source.collection?.contentStatus === "metadata-only") { excluded.push({ sourceId: source.id, reason: source.collection.issues.join("; ") || "No permitted extracted content" }); continue; }
    try { documents.push(...await prepareDocuments([source], root)); }
    catch (error) { excluded.push({ sourceId: source.id, reason: error instanceof Error ? error.message : String(error) }); }
  }
  return { documents, excluded };
}
export function matchesIndex(document: PreparedDocument, entry: IndexEntry): boolean {
  return entry.sourceId === document.source.id && entry.hash === document.hash && entry.documentVersion === document.version && entry.metadataHash === document.metadataHash;
}
export function planIndex(documents: PreparedDocument[], manifest: IndexManifest) {
  validateManifest(manifest);
  return {
    changed: documents.filter(d => !manifest.documents.some(e => matchesIndex(d, e))),
    unchanged: documents.filter(d => manifest.documents.some(e => matchesIndex(d, e))),
    obsolete: manifest.documents.filter(e => !documents.some(d => d.source.id === e.sourceId)),
  };
}
