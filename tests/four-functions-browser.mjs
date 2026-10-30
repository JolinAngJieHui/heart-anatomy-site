import assert from "node:assert/strict";
import fs from "node:fs";
import JSZip from "jszip";
import { load } from "./helpers/load-module.mjs";
const { chromium } = await import(new URL("../.next/cache/browser-tools/node_modules/playwright/index.mjs", import.meta.url).href);
const live = process.argv.includes("--authorised-live");
const base = process.env.EXPLORER_TEST_URL ?? "http://localhost:3000";
const R = load("lib/learning/lesson-review.ts"), Q = load("lib/learning/quiz-personalisation.ts");
const { loadLearningEvidence } = load("lib/learning/evidence-server.ts");
const catalogue = await loadLearningEvidence();
const directory = "artifacts/four-functions"; fs.mkdirSync(directory, { recursive: true });
const report = { live, counts: { chat: 0, review: 0, quiz: 0 }, requests: [], checks: [], errors: [] };
const logPath = ".next/dev/logs/next-development.log";
const logOffset = fs.existsSync(logPath) ? fs.statSync(logPath).size : 0;
const browser = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true });
let page, failure = false, held, hold = false, id = 0;
try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, acceptDownloads: true });
  await context.route("**/*", async route => {
    const req = route.request(), url = new URL(req.url());
    if (!["localhost", "127.0.0.1"].includes(url.hostname)) return route.abort();
    if (!live && url.pathname === "/models/heart-model.json") return route.fulfill({ json: { version: 1, url: null, rotationDegrees: [0, 0, 0], structures: {} } });
    if (url.pathname === "/api/learning/evidence" && !live) return route.fulfill({ json: catalogue });
    if (url.pathname === "/api/chat/action-result" && !live) return route.fulfill({ status: 204 });
    const kind = { "/api/chat": "chat", "/api/learning/review": "review", "/api/learning/quiz": "quiz" }[url.pathname];
    if (!kind) return route.continue();
    report.counts[kind]++;
    const input = req.postDataJSON();
    if (live) {
      // Three chat requests: 2 x generation+verification, 1 x Luna.
      // One Sol review and one Sol quiz. At most seven billable responses.
      if (report.counts[kind] > ({ chat: 3, review: 1, quiz: 1 })[kind]) {
        report.errors.push(`Live request budget blocked an unexpected ${kind} request`);
        return route.fulfill({ status: 429, json: { mode: "basic", reason: "acceptance_budget" } });
      }
      return route.continue();
    }
    if (hold && kind === "chat") { held = route; return; }
    if (failure) return route.fulfill({ status: 503, json: { mode: "basic", reason: "unavailable" } });
    if (kind === "review") {
      const options = R.reviewChoices(input, catalogue);
      return route.fulfill({ json: { mode: "ai", selection: { introduction: options.introductions[0], closing: options.closings[0], structures: input.structures, questions: input.questions.map(q => ({ id: q.id, paragraphIndexes: [] })), takeawayIds: options.candidates.slice(0, 4).map(c => c.id) } } });
    }
    if (kind === "quiz") {
      assert.ok(input.review?.version);
      const pool = Q.quizCandidates(input, catalogue);
      return route.fulfill({ json: { mode: "ai", selection: { questionIds: pool.slice(0, input.count).map(q => q.id) } } });
    }
    const common = { schemaVersion: 1, sources: [], selectedStructureId: input.selectedStructureId, learningLevel: input.learningLevel, mode: "live" };
    if (/focus|show/i.test(input.question)) return route.fulfill({ json: { ...common, status: "navigation", answer: "Waiting for viewer confirmation.", navigation: { id: `fixture-${id++}`, command: { type: "focus_structure", structureId: "left-circumflex-artery" } } } });
    return route.fulfill({ json: { ...common, status: "insufficient_evidence", evidenceStatus: "insufficient", answer: "No supported answer in this mocked browser test. This qualification must remain in the review." } });
  });
  page = await context.newPage(); page.setDefaultTimeout(30000);
  page.on("pageerror", e => report.errors.push(e.message));
  page.on("response", async response => {
    if (/\/api\/(chat$|learning\/(review|quiz)$)/.test(new URL(response.url()).pathname)) {
      await response.finished().catch(() => {});
      const data = await response.json().catch(() => ({}));
      report.requests.push({ path: new URL(response.url()).pathname, status: response.status(), requestId: response.headers()["x-request-id"], outcome: data.status ?? data.mode, evidenceStatus: data.evidenceStatus, sourceIds: data.sources?.map(s => s.sourceId), action: data.navigation?.command });
    }
  });
  await page.goto(base, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => !!document.querySelector(".scene-surface")?.dataset.framing, { timeout: 90000 });
  if (live) await page.locator('.scene-surface[data-model-kind="imported"]').waitFor({ timeout: 90000 });
  const select = async id => {
    if (await page.locator(".information-overlay").isVisible()) await page.getByRole("button", { name: "Close anatomical information", exact: true }).click();
    await page.locator(`[data-structure-id="${id}"]`).click();
  };
  for (const id of ["left-circumflex-artery", "left-diagonal-d1", "coronary-sinus"]) await select(id);
  assert.equal(await page.locator('[aria-label="Anatomical exploration"]').getAttribute("aria-valuenow"), "3");
  const openTutor = async () => {
    if (!await page.locator("#anatomy-tutor").isVisible()) await page.getByRole("button", { name: "Ask AI Tutor", exact: true }).click();
    
  };
  const send = async text => {
    await page.locator("#tutor-question").fill(text); await page.locator("#tutor-question").press("Enter");
    await page.waitForFunction(() => document.querySelector(".tutor-send")?.textContent === "Send", { timeout: 90000 });
  };
  await openTutor();
  await send("Where does the coronary sinus drain?");
  await send("Can you explain that more simply?");
  await send("Focus on the LCx");
  await page.waitForFunction(() => [...document.querySelectorAll(".tutor-answer")].at(-1)?.textContent === "Opened Left Circumflex Artery.");
  assert.equal(await page.locator('[data-structure-id="left-circumflex-artery"]').getAttribute("aria-pressed"), "true");
  report.checks.push("Three deliberate selections, two recorded anatomy questions, selected context and bounded follow-up, confirmed LCx navigation");
  await send("Summarise my session");
  await page.locator(".lesson-review-content").waitFor();
  await page.waitForFunction(() => !document.querySelector(".review-generation-status")?.textContent.includes("Preparing"));
  const body = await page.locator(".lesson-review-content").innerText();
  assert.match(body, /Where does the coronary sinus drain/);
  assert.match(body, /Can you explain that more simply/);
  assert.doesNotMatch(body, /Summarise my session/);
  if (!live) assert.match(body, /did not provide a supported answer/);
  const reviews = report.counts.review;
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download Word", exact: true }).click();
  const file = await download, zip = await JSZip.loadAsync(fs.readFileSync(await file.path()));
  assert.match(await zip.file("word/document.xml").async("string"), /Where does the coronary sinus drain/);
  await file.saveAs(`${directory}/${live ? "live" : "mock"}-review.docx`);
  await page.getByRole("button", { name: "Return to Model", exact: true }).click();
  await openTutor(); await send("Summarise my session");
  await page.locator(".lesson-review-content").waitFor();
  assert.equal(report.counts.review, reviews);
  await page.getByRole("button", { name: "Return to Model", exact: true }).click();
  await openTutor(); await send("Quiz me on my review");
  await page.getByRole("heading", { name: "Personalised Quiz", exact: true }).waitFor();
  await page.getByRole("button", { name: "Submit Answer", exact: true }).waitFor({ timeout: 90000 });
  assert.equal(report.counts.review, reviews, "Quiz reuses the same current review");
  let answered = 0;
  while (await page.getByRole("button", { name: "Submit Answer", exact: true }).count()) {
    assert.ok(answered < 15);
    if (await page.getByRole("radio").count()) await page.getByRole("radio").first().check();
    else await page.locator(".quiz-model .anatomy-marker:not([hidden])").first().click();
    await page.getByRole("button", { name: "Submit Answer", exact: true }).click(); answered++;
    assert.ok(await page.locator('.learning-entry[role="status"] a').count());
    if (await page.getByRole("button", { name: "Show Results", exact: true }).count()) { await page.getByRole("button", { name: "Show Results", exact: true }).click(); break; }
    await page.getByRole("button", { name: "Next Question", exact: true }).click();
  }
  await page.getByRole("heading", { name: "Quiz Results", exact: true }).waitFor();
  report.quizPersonalisationVisible = (await page.locator(".quiz-workspace").innerText()).includes("AI-personalised selection");
  assert.ok(answered > 0 && answered <= 5);
  assert.equal(report.counts.quiz, 1);
  await page.waitForTimeout(500);
  const stored = await page.evaluate(() => JSON.parse(sessionStorage.getItem("heart-anatomy:tab-session:v1")));
  const events = stored.sessions[0].events;
  assert.equal(events.filter(e => e.type === "navigation-completed").length, 1);
  assert.ok(events.find(e => e.type === "quiz-started").reviewVersion);
  assert.equal(events.find(e => e.type === "quiz-completed").results.length, answered);
  report.session = { explored: [...new Set(events.filter(e => e.type === "card-opened").map(e => e.structureId))], questions: events.filter(e => e.type === "question-asked").map(e => e.question), replies: events.filter(e => e.type === "tutor-replied").map(e => ({ status: e.reply.status, answer: e.reply.answer, sources: e.reply.sources })), quizQuestions: answered, quizResults: events.find(e => e.type === "quiz-completed").results };
  report.checks.push("Chat review and quiz reuse existing screens, unchanged review cached, original answers/qualifications and Word retained; snapshot-linked quiz scored locally with cited feedback");
  await page.screenshot({ path: `${directory}/${live ? "live" : "mock"}-quiz.png` });
  await page.setViewportSize({ width: 390, height: 844 });
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  await page.getByRole("button", { name: "Exit Quiz", exact: true }).click();
  await page.getByRole("button", { name: "Reset view", exact: true }).click();
  assert.equal(await page.locator(".information-overlay").isVisible(), false);
  if (!live) {
    // Changing the session invalidates the review, then an API failure uses real local activity.
    await page.getByRole("button", { name: "Close AI Anatomy Tutor", exact: true }).click();
    await select("left-coronary-artery"); failure = true;
    await page.getByRole("button", { name: "Review Session", exact: true }).click();
    await page.waitForFunction(() => document.querySelector(".lesson-review-content")?.textContent.includes("AI personalisation is unavailable"));
    assert.match(await page.locator(".lesson-review-content").innerText(), /Basic session review/i);
    await page.getByRole("button", { name: "Return to Model", exact: true }).click(); failure = false;
    await openTutor(); hold = true;
    await page.locator("#tutor-question").fill("Show the LCx"); await page.locator("#tutor-question").press("Enter");
    await page.waitForTimeout(200);
    await page.locator(".restart-session-button").click();
    await page.getByRole("dialog").getByRole("button", { name: "Restart Session", exact: true }).click();
    if (held) await held.fulfill({ status: 503, json: { error: "cancelled test" } }).catch(() => {});
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => document.querySelector('[aria-label="Anatomical exploration"]')?.getAttribute("aria-valuenow") === "0");
    await openTutor(); assert.equal(await page.locator(".tutor-turn").count(), 0);
    report.checks.push("Changed activity refreshes review, failure uses basic recap, mobile fits, Reset View works, restart prevents late reply restoration");
  } else {
    assert.ok(report.requests.filter(r => r.path === "/api/chat" && r.outcome === "supported" && r.evidenceStatus === "verified").length === 2, "Both real anatomy answers must be verified");
    assert.equal(report.requests.find(r => r.path === "/api/learning/review").outcome, "ai");
    // The API's returned model is checked in server diagnostics. A browser
    // observer may lose a consumed response body when its frame is disposed.
    assert.equal(report.quizPersonalisationVisible, true);
    report.checks.push("Live OpenAI session on supplied GLB; both grounded answers, navigation, review and quiz completed; mobile fits and Reset View closes information");
  }
  assert.deepEqual(report.errors, []);
} catch (error) {
  report.failure = error.message;
  if (page) await page.screenshot({ path: `${directory}/${live ? "live" : "mock"}-failure.png` }).catch(() => {});
  process.exitCode = 1;
} finally {
  await browser.close();
  if (live && fs.existsSync(logPath)) {
    const lines = fs.readFileSync(logPath).subarray(logOffset).toString().split("\n");
    report.serverDiagnostics = lines.flatMap(line => {
      try { const outer = JSON.parse(line), message = typeof outer.message === "string" ? outer.message : "";
        const start = message.indexOf('{"event":');
        if (start < 0) return [];
        const value = JSON.parse(message.slice(start));
        return ["anatomy_request", "anatomy_http", "viewer_action_proposed", "viewer_action_result"].includes(value.event) ? [value] : [];
      } catch { return []; }
    });
  }
  fs.writeFileSync(`${directory}/${live ? "live" : "mock"}-browser.json`, JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ live, counts: report.counts, checks: report.checks, errors: report.errors, failure: report.failure }, null, 2));
}
