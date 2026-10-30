// Test-only fictional corpus. Never writes into knowledge-base/approved.
import fs from "node:fs/promises";
import { loadTypeScript } from "./load-typescript.mjs";
const { HEART_PARTS } = loadTypeScript("lib/heart-parts.ts");
const filename = "tests/fixtures/knowledge-base/synthetic.json";
const existing = JSON.parse(await fs.readFile(filename, "utf8"));
const base = existing.documents.filter(d => !d.id.startsWith("synthetic-context-"));
const mapped = new Set(base.flatMap(d => d.structureIds));
const documents = [...base, ...HEART_PARTS.filter(p => !mapped.has(p.id)).map(p => ({ id: `synthetic-context-${p.id}`, materialKind: "synthetic", version: "1", structureIds: [p.id], text: `SYNTHETIC TEST ONLY. An invented amber pump moves fictional amber fluid through an imaginary conduit. This fixture is tagged with ${p.id} solely to test study context. It contains no anatomical knowledge or clinical advice.` }))];
await fs.writeFile(filename, JSON.stringify({ kind: "synthetic-test-only", documents }, null, 2) + "\n");
console.log(`Prepared ${documents.length} fictional test fixtures covering ${HEART_PARTS.length} context IDs. No production references changed.`);
