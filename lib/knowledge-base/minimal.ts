import { readFile, realpath } from "node:fs/promises";
import { readFileSync } from "node:fs";
import path from "node:path";
import { HEART_PARTS } from "../heart-parts";
import { loadRegistry, metadataHash, sha256, type PreparedDocument } from "./documents";
import { preparedToLocal, LocalRetrievalProvider, type LocalDocument } from "../tutor/retrieval";
import type { Reference } from "./registry";

export type MinimalSelection = { id: string; mode: "review"; registryPath: string; registrySha256: string; collectionVersion: string; rollback: string };
export function readMinimalSelection(root = path.resolve(process.cwd(), "knowledge-base")): MinimalSelection | null {
  try {
    const value = JSON.parse(readFileSync(path.join(root, "active-collection.json"), "utf8"));
    if (!/^minimal-\d{4}-\d{2}-\d{2}$/.test(value.id) || value.mode !== "review" || value.registryPath !== `collections/${value.id}/registry.json` || !/^[a-f0-9]{64}$/.test(value.registrySha256) || !/^[a-f0-9]{64}$/.test(value.collectionVersion)) throw new Error("Invalid active minimal collection");
    return value;
  } catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") return null; throw error; }
}

export async function loadMinimalCorpus(root = path.resolve(process.cwd(), "knowledge-base"), candidateId?: string, production = false) {
  const active = candidateId ? null : readMinimalSelection(root);
  const id = candidateId ?? active?.id;
  if (!id || !/^minimal-\d{4}-\d{2}-\d{2}$/.test(id)) throw new Error("No minimal collection selected");
  const registryPath = path.join(root, "collections", id, "registry.json");
  const bytes = await readFile(registryPath);
  if (active && sha256(bytes) !== active.registrySha256) throw new Error("Active registry changed; validate and reactivate the collection");
  const records = await loadRegistry(registryPath);
  const register = JSON.parse(await readFile(path.join(root, "collections", id, "register.json"), "utf8"));
  if (records.length !== 11 || register.sources.length !== 11 || register.vessels.length !== 17 || new Set(register.sources.map((s: { doi: string }) => s.doi.toLowerCase())).size !== 11) throw new Error("Invalid minimal collection counts or duplicate identity");
  let assignments = 0;
  for (const vessel of register.vessels) {
    const inventory = HEART_PARTS.find(p => p.id === vessel.structure_id);
    if (!inventory || inventory.number !== vessel.number || inventory.name !== vessel.label || vessel.source_ids.length < 1 || vessel.source_ids.length > 2 || new Set(vessel.source_ids).size !== vessel.source_ids.length) throw new Error("Invalid canonical vessel mapping");
    assignments += vessel.source_ids.length;
  }
  if (assignments !== 29 || new Set(register.vessels.map((v: { structure_id: string }) => v.structure_id)).size !== 17) throw new Error("Invalid assignment count");
  const base = await realpath(root);
  const documents: PreparedDocument[] = [], excluded: { sourceId: string; reason: string }[] = [];
  for (const source of records) {
    const supplied = register.sources.find((s: { id: string }) => s.id === source.id);
    const e = source.extraction;
    const mapped = register.vessels.filter((v: { source_ids: string[] }) => v.source_ids.includes(source.id)).map((v: { structure_id: string }) => v.structure_id);
    if (!supplied || !e || e.collectionId !== id || e.doi !== supplied.doi || source.title !== supplied.title || JSON.stringify(e.cautions) !== JSON.stringify(supplied.cautions) || JSON.stringify(e.starterSections) !== JSON.stringify(supplied.starter_sections) || JSON.stringify(mapped) !== JSON.stringify(source.structureIds)) throw new Error(`Scope or identity changed: ${source.id}`);
    if (production && source.status !== "approved") { excluded.push({ sourceId: source.id, reason: "Scientific review pending" }); continue; }
    if (!["pending_review", "approved"].includes(source.status) || !source.documentPath || !e.sha256 || !e.locators.length || !source.licenseConfirmed) { excluded.push({ sourceId: source.id, reason: "No eligible extracted article text" }); continue; }
    const permitted = source.status === "approved" ? `approved/${id}/` : `pending_review/${id}/`;
    if (!source.documentPath.startsWith(permitted)) throw new Error("Extraction path outside selected collection");
    const filename = await realpath(path.join(base, source.documentPath));
    if (path.relative(base, filename).startsWith("..") || path.isAbsolute(path.relative(base, filename))) throw new Error("Extraction path escaped knowledge base");
    const content = await readFile(filename);
    if (content.length > 20 * 1024 * 1024 || sha256(content) !== e.sha256 || (production && (source.approvedSha256 !== e.sha256 || source.approvedVersion !== source.documentVersion))) throw new Error(`Stale extraction: ${source.id}`);
    documents.push({ source, bytes: content, hash: e.sha256, metadataHash: metadataHash(source), version: source.documentVersion });
  }
  const corpus = preparedToLocal(documents);
  const version = sha256(JSON.stringify(records.map(s => [s.id, metadataHash(s), s.extraction?.sha256])));
  if (active && version !== active.collectionVersion) throw new Error("Collection content version differs from active snapshot");
  return { id, records, documents, corpus, excluded, register, collectionVersion: version, registrySha256: sha256(bytes), provider: new LocalRetrievalProvider(corpus) };
}

export function minimalCitation(source: LocalDocument["source"], id: string, passageId: string) {
  return { id, sourceId: source.id, title: source.title, url: source.url, section: source.section, passageId, documentVersion: source.documentVersion, materialKind: "reference" as const, authors: source.authors, year: source.year, doi: source.doi, licenceUrl: source.licenceUrl, copyrightNotice: source.copyrightNotice, changesNotice: source.changesNotice, reviewStatus: source.reviewStatus, collectionId: source.collectionId };
}
export function approvedMinimal(source: Reference) { return source.status === "approved" && source.approvedSha256 === source.extraction?.sha256 && source.approvedVersion === source.documentVersion; }
