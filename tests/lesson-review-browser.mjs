import assert from "node:assert/strict";
import fs from "node:fs";
import JSZip from "jszip";
import { loadTypeScript } from "../scripts/load-typescript.mjs";
const R = loadTypeScript("lib/learning/lesson-review.ts");
const { chromium } = await import(new URL("../.next/cache/browser-tools/node_modules/playwright/index.mjs", import.meta.url).href);
const browser = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true, args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
const base = process.env.EXPLORER_TEST_URL ?? "http://localhost:3104";
const key = "heart-anatomy:tab-session:v1";
const report = { externalApiCalls: 0, mockedResponsesOnly: true, checks: [], errors: [] };
const catalogue = { mode: "approved-local", generatedAt: "fixture", sources: [], passages: [], gaps: [] };
fs.mkdirSync(".next/cache/lesson-review-tests", { recursive: true });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, acceptDownloads: true });
  // This suite tests timed toasts and review UI. Keep its GPU workload stable;
  // the separate model/navigation suite exercises the supplied detailed GLB.
  await page.route("**/models/heart-model.json", r => r.fulfill({ json: { version: 1, url: null, rotationDegrees: [0, 0, 0], structures: {} } }));
  page.on("pageerror", e => report.errors.push(e.message));
  let calls = 0, mode = "disabled";
  await page.route("**/api/learning/evidence", r => r.fulfill({ json: catalogue }));
  await page.route("**/api/learning/review", r => {
    calls++; const input = r.request().postDataJSON();
    assert.doesNotMatch(JSON.stringify(input), /startedAt|updatedAt|timeZone|conversation-reset/);
    if (mode === "failure") return r.fulfill({ status: 503, json: { mode: "basic", reason: "unavailable" } });
    if (mode === "malformed") return r.fulfill({ json: { mode: "ai", selection: { invented: "achievement" } } });
    if (mode === "ai") { const choices = R.reviewChoices(input, catalogue); return r.fulfill({ json: { mode: "ai", selection: { introduction: choices.introductions[1], closing: choices.closings[0], structures: input.structures, questions: input.questions.map(q => ({ id: q.id, paragraphIndexes: [] })), takeawayIds: choices.candidates.slice(0, 4).map(c => c.id) } } }); }
    return r.fulfill({ json: { mode: "basic", reason: "disabled" } });
  });
  await page.route("**/api/chat", r => { const q = r.request().postDataJSON(); return r.fulfill({ json: { answer: "MOCK TEST ONLY: no medical answer.\n\nEvidence is unavailable in this test.", sources: [], selectedStructureId: q.selectedStructureId, learningLevel: q.learningLevel, mode: "mock", status: "mock", evidenceStatus: "synthetic", schemaVersion: 1 } }); });
  await page.goto(base, { waitUntil: "networkidle" }); await page.locator("canvas").waitFor();
  await page.evaluate(() => {
    window.toastDurations = [];
    let current = null, title = "", began = 0;
    new MutationObserver(() => {
      const next = document.querySelector(".achievement-toast");
      if (next === current) return;
      if (current) window.toastDurations.push({ title, duration: performance.now() - began });
      current = next; began = performance.now(); title = next?.querySelector("strong")?.textContent ?? "";
    }).observe(document.body, { childList: true, subtree: true });
  });
  const review = async () => { await page.getByRole("button", { name: "Review Session", exact: true }).click(); await page.waitForFunction(() => !document.querySelector('.review-generation-status [role="status"]')?.textContent.includes("Preparing")); };
  const back = () => page.getByRole("button", { name: "Return to Model", exact: true }).click();
  const select = async id => { if (await page.locator('.information-overlay').isVisible()) await page.getByRole("button", { name: "Close anatomical information", exact: true }).click(); await page.locator(`[data-structure-id="${id}"]`).click(); };
  await review(); assert.equal(calls, 0); assert.match(await page.locator(".learning-review").innerText(), /No structures selected yet/); await back();
  const ids = await page.locator("[data-structure-id]").evaluateAll(els => els.map(e => e.dataset.structureId));
  for (const id of ids.slice(0, 4)) await select(id);
  const rects = () => page.evaluate(() => [".workspace-heading", ".viewer-panel", ".learning-panel"].map(s => { const r = document.querySelector(s).getBoundingClientRect(); return [r.x, r.y, r.width, r.height]; }));
  const before = await rects(); await select(ids[4]); await page.locator(".achievement-toast").waitFor();
  assert.deepEqual(await rects(), before, "toast arrival must not move or resize panels");
  const bounds = await page.evaluate(() => { const a = document.querySelector(".exploration-progress").getBoundingClientRect(), t = document.querySelector(".achievement-region").getBoundingClientRect(); return { bottom: a.bottom, top: t.top, left: t.left, anchorLeft: a.left, position: getComputedStyle(document.querySelector(".achievement-region")).position, parent: document.querySelector(".achievement-region").parentElement.tagName }; });
  assert.equal(bounds.top, bounds.bottom + 8); assert.equal(bounds.left, bounds.anchorLeft); assert.equal(bounds.position, "fixed"); assert.equal(bounds.parent, "BODY");
  await page.screenshot({ path: ".next/cache/lesson-review-tests/toast-desktop.png" });
  await page.getByRole("button", { name: "Dismiss achievement" }).click(); await page.locator(".achievement-toast").waitFor({ state: "hidden" }); assert.deepEqual(await rects(), before);
  // Queue two milestones quickly. There must be exactly one visible at a time.
  // Dispatch the catalogue selections together so slow software-rendered 3D
  // frames cannot consume the first toast's four seconds during the test setup.
  await page.evaluate(selected => { for (const id of selected) document.querySelector(`[data-structure-id="${id}"]`).click(); }, ids.slice(5, 15));
  await page.waitForFunction(() => document.querySelector('[aria-label="Anatomical exploration"]')?.getAttribute('aria-valuenow') === '15');
  await page.locator('.achievement-toast strong').filter({ hasText: 'Heart Explorer' }).waitFor();
  assert.equal(await page.locator(".achievement-toast").count(), 1);
  await page.getByRole("button", { name: "Dismiss achievement" }).click(); await page.locator(".achievement-toast strong").filter({ hasText: "Almost There" }).waitFor();
  await page.locator(".achievement-toast").waitFor({ state: "hidden", timeout: 6500 });
  const duration = await page.evaluate(() => window.toastDurations.find(t => t.title === "Almost There")?.duration);
  assert.ok(duration >= 3900 && duration < 6500, `Auto-dismiss duration was ${duration}ms`);
  await page.emulateMedia({ reducedMotion: "reduce" });
  for (const id of ids.slice(15)) await select(id);
  await page.locator(".achievement-toast").waitFor();
  await page.setViewportSize({ width: 320, height: 568 });
  await page.waitForTimeout(100);
  const small = await page.evaluate(() => { const a = document.querySelector(".exploration-progress").getBoundingClientRect(), t = document.querySelector(".achievement-region").getBoundingClientRect(); return { top: t.top, bottom: a.bottom, left: t.left, right: t.right, animation: getComputedStyle(document.querySelector(".achievement-toast")).animationName }; });
  assert.equal(small.top, small.bottom + 8); assert.ok(small.left >= 0 && small.right <= 320); assert.equal(small.animation, "none");
  await page.screenshot({ path: ".next/cache/lesson-review-tests/toast-mobile.png" });
  await page.getByRole("button", { name: "Dismiss achievement" }).click();
  report.checks.push("Toast is portalled below progress, no panel shifts, one-at-a-time queue, manual and four-second dismissal, resize alignment and reduced motion");
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.getByRole("button", { name: "advanced", exact: true }).click();
  await page.getByRole("button", { name: "Ask AI Tutor", exact: true }).click();
  
  await page.getByLabel("Your anatomy question", { exact: true }).fill("What did I ask in this test?");
  await page.getByRole("button", { name: "Send", exact: true }).click();
  await page.locator(".tutor-answer").filter({ hasText: "MOCK TEST ONLY" }).waitFor();
  await review(); assert.equal(calls, 1);
  assert.equal(await page.locator("[data-review-vessel]").count(), 17);
  assert.match(await page.locator(".lesson-summary-meta").innerText(), /advanced/i);
  assert.match(await page.locator(".review-question h4").innerText(), /What did I ask in this test\?/);
  await page.locator(".lesson-questions > summary").click(); await page.locator(".review-full-answer summary").click(); assert.equal(await page.locator(".review-full-answer p").innerText(), "MOCK TEST ONLY: no medical answer.\n\nEvidence is unavailable in this test.");
  await back(); await review(); assert.equal(calls, 1, "unchanged reopen must use cache");
  await page.getByRole("button", { name: "intermediate", exact: true }).click();
  await page.getByText("Your session has changed. Update the review when you’re ready.", { exact: true }).waitFor();
  assert.equal(calls, 1, "level changes alone must not trigger paid generation");
  mode = "ai"; await page.getByRole("button", { name: /^(Update|Retry) review$/ }).click(); await page.getByText("AI-personalised review", { exact: true }).waitFor(); assert.equal(calls, 2);
  await back(); await review(); assert.equal(calls, 2);
  const downloadPromise = page.waitForEvent("download"); await page.getByRole("button", { name: "Download Word", exact: true }).click();
  const download = await downloadPromise; const file = ".next/cache/lesson-review-tests/lesson-review.docx"; await download.saveAs(file);
  const zip = await JSZip.loadAsync(fs.readFileSync(file)); const xml = await zip.file("word/document.xml").async("string");
  for (const text of ["Vessels explored", "Questions you asked", "Key takeaways", "Original tutor answers", "MOCK TEST ONLY", "What did I ask in this test?"]) assert.ok(xml.includes(text));
  assert.doesNotMatch(xml, /information-card openings|Session Overview/);
  await page.screenshot({ path: ".next/cache/lesson-review-tests/review-desktop.png" });
  for (const [width, height] of [[1024, 768], [768, 1024], [390, 844], [320, 568], [844, 390]]) {
    await page.setViewportSize({ width, height });
    const layout = await page.evaluate(() => { const scroll = document.querySelector(".learning-review-scroll"); return { width: document.documentElement.scrollWidth, height: document.documentElement.scrollHeight, scrollable: scroll.scrollHeight > scroll.clientHeight, overflow: getComputedStyle(scroll).overflowY }; });
    assert.equal(layout.width, width); assert.equal(layout.height, height); assert.equal(layout.overflow, "auto"); assert.equal(layout.scrollable, true);
  }
  await page.setViewportSize({ width: 390, height: 844 }); await page.screenshot({ path: ".next/cache/lesson-review-tests/review-mobile.png" });
  for (const failure of ["failure", "malformed"]) { mode = failure; await page.getByRole("button", { name: /^(Update|Retry) review$/ }).click(); await page.getByText("Basic session review", { exact: true }).waitFor(); await page.getByRole("button", { name: /^(Update|Retry) review$/ }).waitFor({ state: "visible" }); await page.waitForFunction(() => document.querySelector(".review-generation-status")?.dataset.state !== "loading"); }
  const saved = await page.evaluate(k => JSON.parse(sessionStorage.getItem(k)), key);
  assert.equal(saved.sessions[0].events.filter(e => e.type === "question-asked").length, 1);
  assert.equal(saved.sessions[0].events.find(e => e.type === "tutor-replied").reply.answer, "MOCK TEST ONLY: no medical answer.\n\nEvidence is unavailable in this test.");
  await back(); await page.setViewportSize({ width: 1440, height: 900 });
  await page.getByRole("button", { name: "Reset view", exact: true }).click(); assert.equal(await page.getByRole("progressbar").getAttribute("aria-valuenow"), "17");
  await page.locator(".anatomy-marker:not([hidden])").first().click(); await page.locator(".information-overlay").waitFor();
  await page.getByRole("button", { name: "Hide Markers", exact: true }).click(); await page.getByRole("button", { name: "Show Markers", exact: true }).click();
  report.checks.push("Empty session, exact structures/questions/original answers, learning level, mocked AI rendering, unchanged reopen cache, explicit update, errors/malformed fallback, six responsive layouts, Word download, reset/markers/tutor regressions");
  assert.deepEqual(report.errors, []); fs.writeFileSync(".next/cache/lesson-review-tests/report.json", JSON.stringify(report, null, 2)); console.log(JSON.stringify(report, null, 2));
} finally { await browser.close(); }
