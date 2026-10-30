import { readFile, realpath, stat } from "node:fs/promises";
import path from "node:path";
import { validateRegistry, type Reference } from "./registry";
import { sha256, metadataHash } from "./documents";

/** Review-only file inventory. Deliberately not a PreparedDocument or index plan. */
export async function prepareReviewInventory(records: Reference[], root: string) {
  validateRegistry(records);
  const ready = records.filter(r => r.status === "pending_review" && r.documentPath && (r.teachingNote || r.curation?.reuse.disposition === "attributed-summary-ready"));
  const staged = [];
  for (const source of ready) {
    if (!source.documentPath!.startsWith("pending_review/")) throw new Error("Review file must be under pending_review");
    const base = await realpath(root), pending = await realpath(path.resolve(base, "pending_review"));
    const relativeDirectory = path.relative(base, pending);
    if (!relativeDirectory || relativeDirectory.startsWith("..") || path.isAbsolute(relativeDirectory)) throw new Error("Review directory escapes knowledge base");
    const filename = await realpath(path.resolve(base, source.documentPath!));
    const relative = path.relative(pending, filename);
    if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) throw new Error("Review file escapes pending directory");
    const info = await stat(filename);
    if (!info.isFile() || !info.size || info.size > 1024 * 1024 || !/\.(md|txt)$/.test(filename)) throw new Error("Invalid review text file");
    const bytes = await readFile(filename), text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    if (!text.trim() || text.includes("\0") || !text.includes(source.location)) throw new Error("Review text must preserve original source URL");
    staged.push({ sourceId: source.id, path: source.documentPath, documentVersion: source.documentVersion, sha256: sha256(bytes), metadataHash: metadataHash(source), bytes: bytes.length, reviewOnly: true as const, productionEligible: false as const });
  }
  return { staged, excluded: records.filter(r => !ready.includes(r)).map(r => ({ sourceId: r.id, reason: r.curation?.reuse.disposition ?? "no curation metadata" })), network: false as const };
}
