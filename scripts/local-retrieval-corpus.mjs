import fs from "node:fs/promises";
import path from "node:path";
import { loadTypeScript } from "./load-typescript.mjs";
export async function loadLocalCorpus(mode, evaluation = false, collectionId = "replacement-2026-10-11") {
  if (!["--synthetic", "--approved", "--candidate"].includes(mode)) throw new Error("Select --synthetic, --approved or --candidate explicitly; no network requests are made");
  const retrieval = loadTypeScript("lib/tutor/retrieval.ts");
  if (mode === "--synthetic") return retrieval.syntheticToLocal(JSON.parse(await fs.readFile(evaluation ? "tests/fixtures/knowledge-base/retrieval-evaluation.json" : "tests/fixtures/knowledge-base/synthetic.json", "utf8")));
  const { loadRegistry, prepareAvailableDocuments } = loadTypeScript("lib/knowledge-base/documents.ts");
  const root = path.resolve("knowledge-base");
  if (!/^[a-z0-9][a-z0-9-]{0,79}$/.test(collectionId)) throw new Error("Invalid candidate collection ID");
  const filename = mode === "--candidate" ? path.join(root, "collections", collectionId, "registry.json") : path.join(root, "registry.json");
  const prepared = await prepareAvailableDocuments(await loadRegistry(filename), root);
  return retrieval.preparedToLocal(prepared.documents);
}
