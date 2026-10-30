import fs from "node:fs/promises";
import path from "node:path";
import { loadTypeScript } from "./load-typescript.mjs";
const { stageCollection, activateCollection } = loadTypeScript("lib/knowledge-base/collections.ts");
const root = path.resolve("knowledge-base");
const [command, ...args] = process.argv.slice(2);
const option = (name, fallback) => { const index = args.indexOf(name); return index < 0 ? fallback : args[index + 1]; };
if (command === "stage") {
  if (!args.includes("--scientifically-approved")) throw new Error("Provide --scientifically-approved only after the project owner approves the original reference list");
  const inputFile = option("--input", "knowledge-base/imports/approved-reference-list.json");
  const value = JSON.parse(await fs.readFile(inputFile, "utf8"));
  const entries = (Array.isArray(value) ? value : value.references).map(entry => typeof entry === "string" ? { url: entry } : entry);
  const metadataFile = option("--metadata", "knowledge-base/imports/verified-reference-metadata.json");
  const metadata = JSON.parse(await fs.readFile(metadataFile, "utf8"));
  for (const entry of entries) {
    if (!entry.documentPath) continue;
    const m = metadata.find(m => m.url === entry.url);
    if (!m) continue;
    try {
      if (!/\.(md|txt)$/i.test(entry.documentPath)) throw new Error("Local documents require TXT/Markdown extraction; PDF/DOCX needs a separate faithful conversion");
      const bytes = await fs.readFile(entry.documentPath);
      if (!bytes.length || bytes.length > 20 * 1024 * 1024) throw new Error("Empty/oversized document");
      const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
      if (text.includes("\0")) throw new Error("Invalid text");
      // Original source identity and licence still have to be recorded; a file alone is no permission.
      m.text = /^## /m.test(text) ? text : `## Original document text\n\n${text}`;
      m.sections = [...m.text.matchAll(/^## (.+)$/gm)].map(match => match[1]);
    } catch (error) { m.text = null; m.issues.push(`Local import excluded: ${error.message}`); }
  }
  console.log(JSON.stringify(await stageCollection(root, entries, metadata, {
    id: option("--id", "replacement-2026-10-11"), reviewer: option("--reviewer", "Project owner (explicit user confirmation)"), date: option("--date", new Date().toISOString().slice(0, 10)),
  }), null, 2));
} else if (command === "activate") {
  console.log(JSON.stringify(await activateCollection(root, args[0], args.includes("--confirm")), null, 2));
} else {
  throw new Error("Use stage --scientifically-approved [--input list.json --metadata verified.json --id collection-id --reviewer name --date YYYY-MM-DD] or activate collection-id --confirm");
}
