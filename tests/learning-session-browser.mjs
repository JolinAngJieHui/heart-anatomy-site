import assert from "node:assert/strict";
import fs from "node:fs";
const { chromium } = await import(new URL("../.next/cache/browser-tools/node_modules/playwright/index.mjs", import.meta.url).href);
const browser = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true, args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
const base = process.env.EXPLORER_TEST_URL ?? "http://localhost:3000";
const key = "heart-anatomy:tab-session:v1";
const collectionVersion = JSON.parse(fs.readFileSync("knowledge-base/active-collection.json", "utf8")).collectionVersion;
const report = { mockTutorOnly: true, isolatedEvidenceFixtures: true, externalApiCalls: 0, checks: [], errors: [] };
// Keep workflow tests independent of changes in actual reference coverage.
const passages = [["coronary-sinus", "Coronary Sinus"], ["left-diagonal-d1", "Left Diagonal D1"], ["left-circumflex-artery", "Left Circumflex Artery"]].map(([structureId, name], i) => ({ id: `fixture-${i}`, structureId, text: `SYNTHETIC WORKFLOW TEST ONLY: ${name} is a fictional practice label in this fixture.`, sourceId: `fixture-source-${i}`, title: "Synthetic test fixture, not medical evidence", url: "https://example.org/fixture", section: "Fixture", documentVersion: "fixture-v1", pattern: "Not medical evidence", domain: "anatomy", levels: ["basic"], matchedTerm: name, reviewStatus: "approved" }));
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, acceptDownloads: true, timezoneId: "Asia/Singapore" });
  await page.route("**/api/learning/review", route => route.fulfill({ json: { mode: "basic", reason: "disabled" } }));
  await page.route("**/api/learning/evidence", route => route.fulfill({ json: { mode: "approved-local", generatedAt: "fixture", passages, gaps: [], sources: passages.map(p => ({ id: p.sourceId, title: p.title, url: p.url, documentVersion: p.documentVersion, available: true, reviewStatus: "approved" })) } }));
  page.on("pageerror", e => { report.errors.push(e.message); console.log("Browser error:", e.message); });
  await page.route("**/api/chat", route => {
    const q = route.request().postDataJSON();
    return route.fulfill({ json: { answer: "MOCK TEST ONLY: no medical answer.", sources: [], selectedStructureId: q.selectedStructureId, learningLevel: q.learningLevel, mode: "mock", status: "mock", evidenceStatus: "synthetic", schemaVersion: 1, collectionVersion } });
  });
  await page.goto(base, { waitUntil: "networkidle" }); await page.locator("canvas").waitFor();
  console.log("Loaded explorer");
  await page.getByRole("button", { name: "Review Session", exact: true }).waitFor();
  console.log("Toolbar ready");
  const history = () => page.evaluate(k => JSON.parse(sessionStorage.getItem(k)), key);
  await page.locator('[data-structure-id="coronary-sinus"]').click();
  await page.locator('[data-structure-id="coronary-sinus"]').click();
  await page.getByRole("button", { name: "Review Session", exact: true }).click();
  console.log("Opened review");
  await page.getByRole("heading", { name: "Review Session", exact: true }).waitFor();
  assert.equal((await history()).sessions[0].events.filter(e => e.type === "card-opened").length, 1);
  await page.getByRole("button", { name: "Return to Model", exact: true }).click();
  console.log("Returned to model");
  await page.getByRole("button", { name: "Ask AI Tutor", exact: true }).click();
  
  await page.getByLabel("Your anatomy question", { exact: true }).fill("Where does the coronary sinus drain?");
  await page.getByRole("button", { name: "Send", exact: true }).click();
  await page.locator(".tutor-answer").filter({ hasText: "MOCK TEST ONLY" }).waitFor();
  console.log("Mock reply received");
  await page.getByRole("button", { name: "Mark this topic for revision", exact: true }).click();
  await page.getByRole("button", { name: "Review Session", exact: true }).click();
  await page.locator(".learning-review-scroll").waitFor();
  await page.getByText("Checking approved local references…", { exact: true }).waitFor({ state: "hidden" });
  assert.match(await page.locator(".review-question").innerText(), /Mock preview/);
  for (const id of ["coronary-sinus", "left-diagonal-d1", "left-circumflex-artery"]) {
    if (id !== "coronary-sinus") {
      await page.getByRole("button", { name: "Return to Model", exact: true }).click();
      await page.locator(`[data-structure-id="${id}"]`).click();
      await page.getByRole("button", { name: "Review Session", exact: true }).click();
      await page.getByText("Checking approved local references…", { exact: true }).waitFor({ state: "hidden" });
    }
    assert.equal(await page.getByText("Continue your revision", { exact: true }).count(), 0);
    await page.getByRole("button", { name: "Take Personalised Quiz", exact: true }).waitFor();
  }
  report.checks.push("Unique selections; stored mock question/reply; explicit confusion; removed revision section and retained quiz access");
  console.log("Reviewed source passages");
  await page.getByRole("button", { name: "Download Word", exact: true }).scrollIntoViewIfNeeded();
  const downloadPromise = page.waitForEvent("download"); await page.getByRole("button", { name: "Download Word", exact: true }).click();
  const download = await downloadPromise;
  fs.mkdirSync(".next/cache/learning-test-output", { recursive: true }); await download.saveAs(".next/cache/learning-test-output/browser-summary.docx");
  assert.match(download.suggestedFilename(), /^Heart_Anatomy_Session_Summary_\d{4}-\d{2}-\d{2}\.docx$/);
  report.checks.push("Actual browser Word download");
  console.log("Downloaded Word");
  await page.reload({ waitUntil: "networkidle" }); await page.locator("canvas").waitFor();
  assert.equal(await page.getByRole("progressbar", { name: "Anatomical exploration" }).getAttribute("aria-valuenow"), "3");
  assert.equal(await page.locator(".information-overlay").isVisible(), false);
  await page.getByRole("button", { name: "Ask AI Tutor", exact: true }).click(); assert.equal(await page.locator(".tutor-answer").count(), 1);
  await page.getByRole("button", { name: "Review Session", exact: true }).click(); await page.getByText("Checking approved local references…", { exact: true }).waitFor({ state: "hidden" });
  await page.getByRole("button", { name: "Take Personalised Quiz", exact: true }).click();
  await page.getByRole("button", { name: "Start Personalised Quiz", exact: true }).click();
  console.log("Started quiz");
  const answerIds = ["left-diagonal-d1", "coronary-sinus", "left-circumflex-artery"];
  let answerNumber = 0, identificationQuestions = 0;
  while (await page.getByRole("button", { name: "Submit Answer", exact: true }).count()) {
    assert.ok(answerNumber < 15, "Quiz must advance after an answer");
    if (await page.locator(".quiz-options").count()) {
      const options = page.getByRole("radio"); const optionValues = await options.evaluateAll(els => els.map(e => e.value));
      const expected = answerIds.find(id => optionValues.includes(id));
      await page.getByRole("radio").filter({}).nth(answerNumber === 0 ? optionValues.findIndex(id => id !== expected) : optionValues.indexOf(expected)).check();
    } else {
      identificationQuestions++;
      await page.locator(".quiz-model canvas").waitFor();
      assert.equal(await page.locator(".quiz-model .marker-tooltip").count(), 0);
      assert.ok((await page.locator(".quiz-model .anatomy-marker").first().getAttribute("aria-label")).match(/^Marker \d+$/));
      const visibleMarker = page.locator(".quiz-model .anatomy-marker:not([hidden])").first(); await visibleMarker.click();
    }
    await page.getByRole("button", { name: "Submit Answer", exact: true }).click(); answerNumber++;
    console.log(`Answered question ${answerNumber}`);
    if (await page.getByRole("button", { name: "Show Results", exact: true }).count()) { await page.getByRole("button", { name: "Show Results", exact: true }).click(); break; }
    await page.getByRole("button", { name: "Next Question", exact: true }).click();
  }
  await page.getByRole("heading", { name: "Quiz Results", exact: true }).waitFor();
  assert.equal(answerNumber, 5);
  assert.ok(identificationQuestions > 0, "Default practice includes a tested identification question");
  let h = await history(); const quiz = h.sessions[0].events.find(e => e.type === "quiz-completed"); assert.equal(quiz.results.length, 5); assert.ok(quiz.results.some(r => !r.correct));
  const updatedPromise = page.waitForEvent("download"); await page.getByRole("button", { name: "Download Updated Summary", exact: true }).click(); await (await updatedPromise).saveAs(".next/cache/learning-test-output/browser-updated-summary.docx");
  await page.getByRole("button", { name: "Review Incorrect Answers", exact: true }).click();
  await page.getByRole("button", { name: "Retry Missed Questions", exact: true }).click();
  assert.ok(await page.getByRole("button", { name: "Submit Answer", exact: true }).count());
  await page.getByRole("button", { name: "Exit Quiz", exact: true }).click();
  assert.equal(await page.locator(".learning-review").count(), 0);
  report.checks.push("Quiz, feedback, scoring, missed retry, updated Word, hidden identification labels, exit to model");
  await page.getByRole("button", { name: "Review Session", exact: true }).click();
  for (const viewport of [{ width: 1440, height: 900 }, { width: 768, height: 1024 }, { width: 390, height: 844 }, { width: 320, height: 568 }]) {
    await page.setViewportSize(viewport);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth && document.documentElement.scrollHeight <= innerHeight), true);
    await page.getByRole("button", { name: "Download Word", exact: true }).scrollIntoViewIfNeeded();
    await page.screenshot({ path: `.next/cache/learning-test-output/review-${viewport.width}.png` });
  }
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.getByText("This session", { exact: true }).click();
  await page.locator('.restart-session-button').click();
  await page.getByRole('dialog').getByRole('button', { name: 'Cancel', exact: true }).click(); assert.equal((await history()).sessions.length, 1);
  await page.locator('.restart-session-button').click(); await page.getByRole('dialog').getByRole('button', { name: 'Restart Session', exact: true }).click();
  await page.waitForFunction(k => JSON.parse(sessionStorage.getItem(k)).sessions.length === 1, key);
  assert.equal((await history()).sessions[0].events.length, 0);
  report.checks.push("Refresh and transcript restoration; tab session preserved; responsive fixed viewport; confirmed restart");
  assert.deepEqual(report.errors, []);
  report.passed = true; fs.writeFileSync("docs/learning-session-browser-report.json", JSON.stringify(report, null, 2));
  console.log("Learning session browser workflow passed; mocked tutor and isolated evidence fixtures, no external AI calls.");
} finally { await browser.close(); }
