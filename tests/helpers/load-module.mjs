import fs from "node:fs";
import path from "node:path";
import ts from "typescript";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url), cache = new Map();
export function load(filename, overrides = {}) {
  filename = path.resolve(filename);
  if (cache.has(filename) && !Object.keys(overrides).length) return cache.get(filename);
  const loaded = { exports: {} };
  const code = ts.transpileModule(fs.readFileSync(filename, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
  const resolve = name => {
    if (name in overrides) return overrides[name];
    if (name === "server-only") return {};
    if (name.startsWith("@/")) return load(name.slice(2) + ".ts", overrides);
    if (name.startsWith(".")) { const target = path.resolve(path.dirname(filename), name); return target.endsWith(".json") ? JSON.parse(fs.readFileSync(target, "utf8")) : load(target + ".ts", overrides); }
    return require(name);
  };
  new Function("exports", "module", "require", code)(loaded.exports, loaded, resolve);
  if (!Object.keys(overrides).length) cache.set(filename, loaded.exports);
  return loaded.exports;
}
