// CLI adapter for trusted repository modules; shares the TypeScript implementation
// with Next.js without installing a second runtime or duplicating validation rules.
import fs from "node:fs";
import path from "node:path";
import ts from "typescript";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url), cache = new Map();
export function loadTypeScript(filename) {
  filename = path.resolve(filename);
  if (cache.has(filename)) return cache.get(filename);
  const loaded = { exports: {} };
  const code = ts.transpileModule(fs.readFileSync(filename, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
  new Function("exports", "module", "require", code)(loaded.exports, loaded, name => name.startsWith(".")
    ? name.endsWith(".json") ? JSON.parse(fs.readFileSync(path.resolve(path.dirname(filename), name), "utf8")) : loadTypeScript(path.resolve(path.dirname(filename), name + ".ts"))
    : require(name));
  cache.set(filename, loaded.exports);
  return loaded.exports;
}
