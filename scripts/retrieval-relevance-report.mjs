import fs from "node:fs/promises";
import assert from "node:assert/strict";
import { loadTypeScript } from "./load-typescript.mjs";
const before = JSON.parse(await fs.readFile("docs/retrieval-relevance-before.json", "utf8"));
const after = JSON.parse(await fs.readFile("docs/retrieval-relevance-after.json", "utf8"));
const registry = JSON.parse(await fs.readFile("knowledge-base/registry.json", "utf8"));
assert.equal(before.registryHash, after.registryHash);
assert.deepEqual(before.results.map(r => r.question), after.results.map(r => r.question));
const { questionProfile, passageFit } = loadTypeScript("lib/tutor/question-relevance.ts");
const fit = (question, passage) => passageFit(questionProfile(question), passage.text,
  { ...passage.source, articleType: registry.find(r => r.id === passage.source.id)?.collection?.articleType });
const rows = after.results.map((r, i) => {
  const old = before.results[i];
  return { question: r.question, level: r.level, negative: r.negative ?? false, structureIds: r.structureIds,
    before: { ...old, fits: old.passages.map(p => fit(r.question, p)) },
    after: { ...r, fits: r.passages.map(p => fit(r.question, p)) } };
});
const metrics = side => ({
  questions: rows.length,
  positiveQuestionsWithResults: rows.filter(r => !r.negative && r[side].passages.length).length,
  unsupportedQuestionsWithResults: rows.filter(r => r.negative && r[side].passages.length).length,
  topPassagesMeetingDirectTextHeuristic: rows.filter(r => !r.negative && r[side].fits[0]?.evidenceStrength === "direct-text-candidate").length,
  ordinaryQuestionTopCaseReports: rows.filter(r => !r.negative && ["normal-anatomy", "physiology"].includes(questionProfile(r.question).domain) && r[side].fits[0]?.individualCase).length,
  comparisonsWithAllTargetsInPassageBodies: rows.filter(r => {
    const profile = questionProfile(r.question);
    return !r.negative && profile.targets.length > 1 && profile.targets.every((_, i) => r[side].fits.some(f => f.matchedTargets[i]));
  }).length,
});
const report = { collectionId: "replacement-2026-10-11", registryHash: after.registryHash,
  network: false, scientificAccuracyCertified: false,
  metricMeaning: "Both sets graded with the same deterministic text-feature rules. These are diagnostic proxies, not human relevance labels, scientific confidence, recall or accuracy measurements.",
  before: metrics("before"), after: metrics("after"), rows };
await fs.writeFile("docs/retrieval-relevance-comparison.json", JSON.stringify(report, null, 2) + "\n");
const escape = value => String(value ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const passages = side => side.passages.length ? side.passages.map((p, i) => `<article><h4>${i + 1}. ${escape(p.source.id)} — ${escape(p.source.title)}</h4><p><a href="${escape(p.source.url)}" target="_blank" rel="noopener noreferrer">Original source</a> · ${escape(p.source.section)} · version ${escape(p.source.documentVersion)}</p><p>Ranking score: ${p.score.toFixed(3)} (not confidence). Text diagnostic: ${escape(side.fits[i].evidenceStrength)}. ${escape(side.fits[i].warnings.join(" "))}</p><blockquote>${escape(p.text)}</blockquote></article>`).join("") : "<p>No eligible passages. Additional source content or vocabulary review may be needed.</p>";
const html = `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Local retrieval relevance — before and after</title><style>body{font:16px/1.5 system-ui;max-width:1250px;margin:auto;padding:24px;color:#182534;background:#f8fafc}h1{font-size:26px}h2{font-size:20px}details,article{background:white;border:1px solid #cbd5e1;padding:12px;margin:12px 0}summary{cursor:pointer;font-weight:600}table{border-collapse:collapse;width:100%}td,th{padding:10px;text-align:left;border-bottom:1px solid #cbd5e1}blockquote{white-space:pre-wrap;border-left:3px solid #cbd5e1;padding-left:12px}.sides{display:grid;grid-template-columns:1fr 1fr;gap:16px}input,select{font:inherit;padding:8px}a{color:#155e75}@media(max-width:800px){.sides{grid-template-columns:1fr}}</style><h1>Local retrieval relevance: before and after</h1><p>Active collection ${escape(report.collectionId)}. Same 27 local documents and registry fingerprint in both runs. 72 questions: 51 across all 17 structures and three teaching levels, 15 additional anatomy/physiology/pathology/procedure/comparison questions, and six unsupported questions. No network, LLM, paid calls or uploads.</p><p><strong>These metrics do not certify scientific accuracy.</strong> ${escape(report.metricMeaning)} Teaching levels label the evaluation questions; the ranker does not infer an article's approved teaching level or generate answers.</p><table><thead><tr><th>Diagnostic count</th><th>Before</th><th>After</th></tr></thead><tbody>${Object.keys(report.before).map(key => `<tr><td>${escape(key)}</td><td>${report.before[key]}</td><td>${report.after[key]}</td></tr>`).join("")}</tbody></table><p>Reduced question coverage is a deliberate tradeoff: mismatched segments, absent requested modalities and unsupported question terms are now rejected. Empty results can also reflect strict vocabulary rules; review passages and gaps rather than assuming an article has no relevant information. Original source qualifications remain essential. Case reports may still appear for clinical requests or direct case evidence, with warnings.</p><label>Find a question <input id="search" placeholder="RCA, dominance, CT…"></label> <label>Level <select id="level"><option>All</option><option>Basic</option><option>Intermediate</option><option>Advanced</option><option>Mixed</option><option>Unsupported</option></select></label>${rows.map(r => `<details class="question" data-level="${escape(r.level)}" data-question="${escape(r.question.toLowerCase())}"><summary>${escape(r.level)} · ${escape(r.question)} — before ${r.before.passages.length}, after ${r.after.passages.length} passages</summary><p>Requested domain: ${escape(questionProfile(r.question).domain)}. After diagnostic: ${escape(r.after.support.status)}. ${escape(r.after.support.explanation)}</p><p>Uncovered comparison targets: ${escape(r.after.support.missingComparisonTargets?.join(", ") || "none detected")}. No-answer results do not establish corpus completeness.</p><div class="sides"><section><h2>Before</h2>${passages(r.before)}</section><section><h2>After</h2>${passages(r.after)}</section></div></details>`).join("")}<script>const search=document.getElementById('search'),level=document.getElementById('level');function filter(){document.querySelectorAll('.question').forEach(row=>{row.hidden=!row.dataset.question.includes(search.value.toLowerCase())||(level.value!=='All'&&row.dataset.level!==level.value)})}search.addEventListener('input',filter);level.addEventListener('change',filter);</script></html>`;
await fs.writeFile("docs/retrieval-relevance-comparison.html", html);
console.log(JSON.stringify({ before: report.before, after: report.after }, null, 2));
