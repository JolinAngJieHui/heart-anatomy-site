import assert from "node:assert/strict";
import { test } from "node:test";
import { checkDeployment } from "../scripts/vercel-preflight.mjs";

test("Vercel upload preserves the active heart and reference corpus without secrets or old assets", () => {
  const result = checkDeployment();
  assert.equal(result.referenceSources, 11);
  assert.equal(result.referencePassages, 137);
  assert(result.megabytes < 100);
});
