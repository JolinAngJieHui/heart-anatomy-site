import fs from "node:fs/promises";
import path from "node:path";
import { loadTypeScript } from "./load-typescript.mjs";
const { loadRegistry, metadataHash, sha256 } = loadTypeScript("lib/knowledge-base/documents.ts");
const { renderTeachingDocument } = loadTypeScript("lib/knowledge-base/teaching.ts");
const { approveTeachingDocument } = loadTypeScript("lib/knowledge-base/approval.ts");
const { validateRegistry } = loadTypeScript("lib/knowledge-base/registry.ts");
const args = process.argv.slice(2), command = args[0] ?? "list", value = flag => args[args.indexOf(flag) + 1];
const filename = "knowledge-base/registry.json", records = await loadRegistry(filename), root = await fs.realpath("knowledge-base");
if (!["list", "approve"].includes(command)) throw new Error("Use list or approve; no external indexing clearance is granted");
async function readNote(record) {
  const resolved = await fs.realpath(path.resolve(root, record.documentPath)), relative = path.relative(root, resolved);
  if (relative.startsWith("..") || path.isAbsolute(relative)) throw new Error("Teaching file escapes knowledge base");
  const bytes = await fs.readFile(resolved);
  if (bytes.length > 1024 * 1024 || bytes.toString("utf8") !== renderTeachingDocument(record)) throw new Error("Teaching document and registry metadata differ; renew the review snapshot");
  return bytes;
}
if (command === "list") {
  const notes = [];
  for (const record of records.filter(r => r.teachingNote)) notes.push({ id: record.id, status: record.status, path: record.documentPath, sha256: sha256(await readNote(record)), metadataHash: metadataHash(record), externalIndexingCleared: record.externalIndexingPermission.cleared });
  console.log(JSON.stringify({ notes, network: false }, null, 2));
} else {
  const source = records.find(r => r.id === args[1]);
  if (!source) throw new Error("Unknown teaching document ID");
  const bytes = await readNote(source);
  const approved = approveTeachingDocument(source, bytes, { reviewer: value("--reviewer"), date: value("--date"), expectedSha256: value("--sha256"), expectedMetadataHash: value("--metadata-hash"), scientificReviewed: args.includes("--scientific-reviewed"), localReuseConfirmed: args.includes("--local-reuse-confirmed") });
  const next = records.map(r => r.id === source.id ? approved : r);
  validateRegistry(next);
  if (args.includes("--apply")) {
    const directory = await fs.realpath(path.join(root, "approved"));
    const relative = path.relative(root, directory);
    if (relative.startsWith("..") || path.isAbsolute(relative)) throw new Error("Approved directory escapes knowledge base");
    // Keep the pending file for review history; never overwrite an existing approved document.
    await fs.writeFile(path.join(directory, `${source.id}.md`), bytes, { flag: "wx" });
    const temporary = `${filename}.tmp`;
    await fs.writeFile(temporary, JSON.stringify(next, null, 2) + "\n", { flag: "wx" });
    await fs.rename(temporary, filename);
  }
  console.log(JSON.stringify({ id: approved.id, mode: args.includes("--apply") ? "LOCAL APPROVAL APPLIED" : "PREVIEW ONLY", externalIndexingCleared: false, network: false }, null, 2));
}
