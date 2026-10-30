import fs from "node:fs";
import ts from "typescript";
function load(filename) {
  const loaded = { exports: {} };
  const code = ts.transpileModule(fs.readFileSync(filename, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  new Function("exports", "module", code)(loaded.exports, loaded);
  return loaded.exports;
}
const { HEART_PARTS } = load("lib/heart-parts.ts");
const { EDUCATION, REFERENCES } = load("lib/education.ts");
const entries = HEART_PARTS.map(p => ({ id: `website-${p.id}`, title: `${p.name}: existing website explanations`, institution: null, yearOrEdition: null, section: "Basic, Intermediate, Advanced and blood-flow route", structureIds: [p.id], location: `lib/education.ts#${p.id}`, status: "draft", approvalDate: null, approvedBy: null, licenseConfirmed: false, publicCitation: false, documentPath: null, referenceIds: EDUCATION[p.id].references }));
entries.push(...Object.entries(REFERENCES).map(([id, r]) => ({ id: `external-${id}`, title: r.title, institution: null, yearOrEdition: null, section: "Not yet verified", structureIds: HEART_PARTS.filter(p => EDUCATION[p.id].references.includes(id)).map(p => p.id), location: r.url, status: "unverified", approvalDate: null, approvedBy: null, licenseConfirmed: false, publicCitation: true, documentPath: null })));
const records = entries.map(entry => ({ ...entry, status: entry.status === "unverified" ? "pending_review" : entry.status, approvedSha256: null, publicationYear: null, edition: null, documentVersion: "1", approvedVersion: null, sourceType: entry.id.startsWith("website-") ? "educational-summary" : "website", materialKind: "reference", topics: ["cardiovascular-anatomy", "coronary-anatomy"] }));
const { loadTypeScript } = await import("./load-typescript.mjs");
loadTypeScript("lib/knowledge-base/registry.ts").validateRegistry(records);
fs.writeFileSync("knowledge-base/draft-registry.json", JSON.stringify(records, null, 2) + "\n");
console.log(`Recorded ${HEART_PARTS.length} draft structure entries and ${Object.keys(REFERENCES).length} pending-review reference links; no content copied or approved.`);
