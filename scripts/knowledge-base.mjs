import fs from "node:fs/promises";
import path from "node:path";
import { loadTypeScript } from "./load-typescript.mjs";
const { loadRegistry, prepareAvailableDocuments, validateManifest, planIndex } = loadTypeScript("lib/knowledge-base/documents.ts");
const { externalIndexingAllowed } = loadTypeScript("lib/knowledge-base/registry.ts");
const command = process.argv[2] ?? "validate";
if (!["validate", "plan", "mock"].includes(command)) throw new Error("Use validate, plan or mock; this CLI never uploads");
if (command === "mock") {
  const { mockRetrieve } = loadTypeScript("lib/knowledge-base/mock.ts");
  const fixture = JSON.parse(await fs.readFile("tests/fixtures/knowledge-base/synthetic.json", "utf8"));
  console.log(JSON.stringify(mockRetrieve(fixture, process.argv[3] ?? "fictional blue conduit", process.argv[4] ?? null), null, 2));
} else {
  const root = path.resolve("knowledge-base");
  const records = await loadRegistry(path.join(root, "registry.json"));
  const drafts = await loadRegistry(path.join(root, "draft-registry.json"));
  if (command === "validate") console.log(JSON.stringify({ valid: true, productionRecords: records.length, candidateRecords: drafts.length, approved: records.filter(r => r.status === "approved").length, network: false }, null, 2));
  else {
    const readiness = await prepareAvailableDocuments(records, root);
    const documents = readiness.documents.filter(d => externalIndexingAllowed(d.source));
    const manifest = validateManifest(JSON.parse(await fs.readFile(path.join(root, "index-manifest.json"), "utf8")));
    const plan = planIndex(documents, manifest);
    console.log(JSON.stringify({ mode: "DRY RUN / NO NETWORK", excluded: [...readiness.excluded, ...readiness.documents.filter(d => !externalIndexingAllowed(d.source)).map(d => ({ sourceId: d.source.id, reason: "External indexing permission not granted" }))], changed: plan.changed.map(d => ({ id: d.source.id, version: d.version, hash: d.hash, metadataHash: d.metadataHash })), unchanged: plan.unchanged.map(d => d.source.id), obsolete: plan.obsolete.map(d => d.sourceId) }, null, 2));
  }
}
