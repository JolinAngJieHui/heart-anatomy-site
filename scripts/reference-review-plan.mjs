import path from "node:path";
import { loadTypeScript } from "./load-typescript.mjs";
const { loadRegistry } = loadTypeScript("lib/knowledge-base/documents.ts");
const { prepareReviewInventory } = loadTypeScript("lib/knowledge-base/review.ts");
console.log(JSON.stringify(await prepareReviewInventory(await loadRegistry("knowledge-base/registry.json"), path.resolve("knowledge-base")), null, 2));
