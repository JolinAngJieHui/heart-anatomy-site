import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
const require = createRequire(import.meta.url);
const ignore = require("ignore");
const ts = require("typescript");

export function checkDeployment(root = process.cwd(), checkTraces = false) {
  const read = file => JSON.parse(fs.readFileSync(path.join(root, file), "utf8"));
  const rules = ignore().add(fs.readFileSync(path.join(root, ".vercelignore"), "utf8"));
  const files = [];
  function walk(dir = "") {
    for (const item of fs.readdirSync(path.join(root, dir), { withFileTypes: true })) {
      const relative = `${dir}${item.name}`;
      // Vercel's walker checks directory names without a trailing slash.
      // A directory-only negation can pass an idealised check but omit the
      // entire application when the CLI actually walks the upload.
      if (rules.ignores(relative)) continue;
      assert(!item.isSymbolicLink(), `Review linked upload file: ${relative}`);
      if (item.isDirectory()) walk(`${relative}/`);
      else files.push({ path: relative, bytes: fs.statSync(path.join(root, relative)).size });
    }
  }
  walk();
  const selected = read("knowledge-base/active-collection.json");
  const registry = read(`knowledge-base/${selected.registryPath}`);
  const references = ["knowledge-base/active-collection.json", "knowledge-base/registry.json",
    `knowledge-base/${selected.registryPath}`,
    `knowledge-base/collections/${selected.id}/register.json`,
    ...registry.map(source => `knowledge-base/${source.documentPath}`)];
  const model = read("public/models/heart-model.json");
  assert(model.url?.startsWith("/models/") && !model.url.includes(".."));
  const required = [...references, `public${model.url}`, "public/models/heart-model.json",
    "knowledge-base/quiz-bank.json", "docs/rag/anatomy_RAG_minimal_reference_register.json",
    "tests/fixtures/knowledge-base/synthetic.json", "package.json", "package-lock.json",
    "next.config.ts", "tsconfig.json", "vercel.json"];
  for (const file of required) assert(files.some(f => f.path === file), `Required upload file missing: ${file}`);
  // Windows resolves case-insensitive paths that will fail on Vercel's Linux host.
  const uploaded = new Set(files.map(file => file.path));
  // next-env.d.ts references types generated afresh by the production build.
  for (const file of files.filter(file => /\.tsx?$/.test(file.path) && file.path !== "next-env.d.ts")) {
    const imports = ts.preProcessFile(fs.readFileSync(path.join(root, file.path), "utf8"), true).importedFiles;
    for (const imported of imports) {
      const name = imported.fileName;
      if (!name.startsWith(".") && !name.startsWith("@/")) continue;
      const base = name.startsWith("@/") ? name.slice(2) : path.posix.normalize(path.posix.join(path.posix.dirname(file.path), name));
      const candidates = [base, ...[".ts", ".tsx", ".js", ".mjs", ".json", "/index.ts", "/index.tsx"].map(suffix => base + suffix)];
      assert(candidates.some(candidate => uploaded.has(candidate)), `Missing or wrong-case import ${name} in ${file.path}`);
    }
  }
  assert.equal(files.filter(f => f.path.endsWith(".glb")).length, 1, "Only the active model should upload");
  assert(!files.some(f => /(^|\/)(\.env[^/]*|artifacts|node_modules|\.git|\.next)(\/|$)|\.(docx|pdf|pem|key)$/i.test(f.path)), "Private or unnecessary files in upload");
  const bytes = files.reduce((total, file) => total + file.bytes, 0);
  assert(bytes < 100_000_000, "CLI upload exceeds conservative Hobby source limit");
  const traceRoutes = ["page", "api/chat/route", "api/tutor/route", "api/learning/review/route", "api/learning/quiz/route", "api/learning/evidence/route"];
  if (checkTraces) for (const route of traceRoutes) {
    const tracePath = path.join(root, ".next/server/app", `${route}.js.nft.json`);
    const traced = new Set(JSON.parse(fs.readFileSync(tracePath, "utf8")).files.map(file => path.resolve(path.dirname(tracePath), file)));
    for (const file of references) assert(traced.has(path.resolve(root, file)), `Missing runtime reference in ${route}: ${file}`);
  }
  return { files: files.length, bytes, megabytes: +(bytes / 1_000_000).toFixed(2), model: model.url,
    referenceSources: registry.length, referencePassages: registry.reduce((n, s) => n + s.extraction.locators.length, 0),
    tracedRoutes: checkTraces ? traceRoutes.length : 0 };
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  console.log(JSON.stringify(checkDeployment(process.cwd(), process.argv.includes("--traces")), null, 2));
}
