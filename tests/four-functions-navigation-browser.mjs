import assert from "node:assert/strict";
import fs from "node:fs";
const { chromium } = await import(new URL("../.next/cache/browser-tools/node_modules/playwright/index.mjs", import.meta.url).href);
const browser = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true });
const report = { mockedAPI: true, realGLB: true, checks: [], errors: [] };
let page, sequence = 0, fixedId = null;
try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  await context.route("**/*", route => {
    const url = new URL(route.request().url());
    if (!["localhost", "127.0.0.1"].includes(url.hostname)) return route.abort();
    if (url.pathname === "/api/chat") {
      const input = route.request().postDataJSON(), q = input.question;
      const command = /RCA/.test(q) ? { type: "select_vessel_group", groupId: "right-coronary-artery" }
        : /LAD/.test(q) ? { type: "select_vessel_group", groupId: "left-main-and-lad" }
        : /reset/i.test(q) ? { type: "reset_view" }
        : input.selectedStructureId ? { type: "focus_structure", structureId: input.selectedStructureId } : null;
      return route.fulfill({ json: { schemaVersion: 1, mode: "live", status: "navigation", answer: command ? "Waiting for viewer confirmation." : "Which structure would you like to view?", sources: [], selectedStructureId: input.selectedStructureId, learningLevel: input.learningLevel,
        ...(command ? { navigation: { id: fixedId ?? `group-${sequence++}`, command } } : {}) } });
    }
    if (url.pathname.startsWith("/api/")) return route.fulfill({ status: 204 });
    return route.continue();
  });
  page = await context.newPage(); page.setDefaultTimeout(25000);
  page.on("pageerror", e => report.errors.push(e.message));
  await page.goto(process.env.EXPLORER_TEST_URL ?? "http://localhost:3000", { waitUntil: "domcontentloaded" });
  await page.locator('.scene-surface[data-model-kind="imported"]').waitFor({ timeout: 90000 });
  await page.getByRole("button", { name: "Ask AI Tutor", exact: true }).click();
  
  const send = async q => {
    await page.locator("#tutor-question").fill(q); await page.locator("#tutor-question").press("Enter");
    await page.waitForFunction(() => document.querySelector(".tutor-send")?.textContent === "Send");
  };
  const progress = () => page.locator('[aria-label="Anatomical exploration"]').getAttribute("aria-valuenow");
  await send("Find this vessel");
  assert.match(await page.locator(".tutor-answer").last().innerText(), /Which structure/); assert.equal(await progress(), "0");
  await send("Show me the RCA");
  await page.getByRole("dialog", { name: "Right Coronary Artery segments", exact: true }).waitFor();
  assert.equal(await page.locator("[data-vessel-segment]").count(), 3);
  assert.equal(await progress(), "0");
  assert.equal(await page.locator(".scene-surface").getAttribute("data-selected-vessel"), "right-coronary-artery");
  await page.locator('[data-vessel-segment="right-coronary-middle"]').click();
  assert.equal(await progress(), "1");
  await send("Find this vessel");
  assert.match(await page.locator(".tutor-answer").last().innerText(), /Opened Right Coronary Artery \(Middle\)/);
  assert.equal(await progress(), "1");
  await send("Show the LAD");
  await page.locator(".vessel-segment-choices").waitFor();
  assert.equal(await page.locator("[data-vessel-segment]").count(), 4); assert.equal(await progress(), "1");
  await page.getByRole("button", { name: "Close vessel choices", exact: true }).click();
  fixedId = "duplicate-group"; await send("Show RCA");
  await page.getByRole("button", { name: "Reset view", exact: true }).click();
  await send("Show RCA");
  assert.match(await page.locator(".tutor-answer").last().innerText(), /already applied/);
  assert.equal(await page.locator(".vessel-segment-choices").count(), 0);
  fixedId = null; await send("Reset the view");
  assert.equal(await page.locator(".tutor-answer").last().innerText(), "The view has been reset.");
  assert.equal(await progress(), "1");
  report.checks.push("Actual GLB RCA and LM/LAD groups highlight and offer 3/4 segment choices; group actions never mark segments explored",
    "Selected-vessel pronoun, no-selection clarification, duplicate rejection, server-proposed Reset View, unique progress and markers preserved");
  await page.screenshot({ path: "artifacts/four-functions/group-navigation.png" });
  assert.deepEqual(report.errors, []);
} catch (e) { report.failure = e.message; process.exitCode = 1; }
finally { await browser.close(); fs.writeFileSync("artifacts/four-functions/navigation-browser.json", JSON.stringify(report, null, 2)); console.log(JSON.stringify(report)); }
