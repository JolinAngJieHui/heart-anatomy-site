import assert from "node:assert/strict";
import fs from "node:fs";
import JSZip from "jszip";
import { load } from "./helpers/load-module.mjs";
const R = load("lib/learning/lesson-review.ts"), { HEART_PARTS } = load("lib/heart-parts.ts");
const catalogue = await load("lib/learning/evidence-server.ts").loadLearningEvidence();
const { chromium } = await import(new URL("../.next/cache/browser-tools/node_modules/playwright/index.mjs", import.meta.url).href);
const browser = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true });
const dir = "artifacts/lesson-layout"; fs.mkdirSync(dir, { recursive: true });
const report = { mockedAPI: true, paidCalls: 0, checks: [], levels: [], requests: 0, errors: [] };
let page, variant = "short", latest;
const longText = "Long layout fixture: this complete explanation is retained so that wrapping, scrolling and Word export can be checked. ".repeat(5);
try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, acceptDownloads: true });
  await context.route("**/*", async route => {
    const u = new URL(route.request().url());
    if (!["localhost", "127.0.0.1"].includes(u.hostname)) return route.abort();
    if (u.pathname === "/api/learning/evidence") return route.fulfill({ json: catalogue });
    if (u.pathname === "/api/learning/review") {
      const b = route.request().postDataJSON(); report.requests++; report.levels.push(b.level);
      const c = R.reviewChoices(b, catalogue), e = R.lessonEvidence(b, catalogue);
      const point = { text: "A short synthetic layout fixture, not an anatomical explanation.", heading: "A point from this test lesson", kind: "reference", evidenceIds: [e[0].key], questionIds: [] };
      const prose = { title: "Your explored anatomy: a test summary", introduction: "You explored a structure in this browser test. Here are the recorded review points.", overview: null, closing: "", questions: [], takeaways: [point] };
      if (variant === "long") {
        prose.title = "Your lesson on the structures you explored and the questions you brought to this session — a longer generated title that wraps naturally";
        prose.overview = { ...point, text: "An optional overview supplied by the mocked API. ".repeat(12) }; delete prose.overview.heading;
        prose.takeaways = Array.from({ length: 5 }, (_, i) => ({ ...point, heading: `Generated heading ${i + 1}: a longer explanation from the session`, text: longText }));
      }
      if (variant === "legacy") { delete prose.title; delete prose.overview; delete prose.takeaways[0].heading; }
      if (variant === "literal") { prose.title = '<img src=x onerror="window.injected=true">'; prose.takeaways = [{ ...point, heading: "<script>window.injected=true</script>" }, { ...point, heading: "A second generated point" }]; }
      if (variant === "malformed") prose.overview = { text: "An invalid overview" };
      latest = prose;
      return route.fulfill({ json: { mode: "ai", selection: { introduction: c.introductions[0], closing: c.closings[0], structures: b.structures, questions: b.questions.map(q => ({ id: q.id, paragraphIndexes: [] })), takeawayIds: c.candidates.slice(0, 4).map(t => t.id), personalisation: prose } } });
    }
    // Never let these UI tests reach a paid endpoint.
    if (u.pathname.startsWith("/api/")) return route.fulfill({ status: 503, json: { mode: "basic", reason: "mocked-test" } });
    return route.continue();
  });
  page = await context.newPage(); page.setDefaultTimeout(45000); page.on("pageerror", e => report.errors.push(e.message));
  await page.goto(process.env.EXPLORER_TEST_URL ?? "http://localhost:3000", { waitUntil: "domcontentloaded" });
  await page.locator('.scene-surface[data-model-kind="imported"]').waitFor({ timeout: 90000 });
  const settle = () => page.waitForFunction(() => { const s = document.querySelector('.review-generation-status'); return s && s.getAttribute('data-state') !== 'loading'; });
  const open = async () => { await page.getByRole("button", { name: "Review Session", exact: true }).click(); await settle(); };
  const back = () => page.getByRole("button", { name: "Return to Model", exact: true }).click();
  const update = async () => { await page.getByRole("button", { name: /^(Update|Retry) review$/ }).click(); await settle(); };
  await open(); assert.equal(report.requests, 0); assert.equal(await page.locator('#review-title').innerText(), "Your lesson review"); assert.equal(await page.locator('.lesson-overview').count(), 0); await back();
  await page.locator('[data-structure-id="coronary-sinus"]').click(); await open();
  assert.equal(report.requests, 1); assert.equal(await page.locator('.lesson-takeaway-card').count(), 1); assert.equal(await page.locator('.lesson-overview').count(), 0);
  assert.equal(await page.locator('[data-review-vessel]').count(), 1); assert.equal(await page.locator('#review-title').innerText(), latest.title);
  await page.locator('.review-sources > summary').click(); const link = page.locator('.review-sources a').first(); assert.match(await link.getAttribute('href'), /^https?:/); assert.ok(await link.isVisible());
  await page.screenshot({ path: `${dir}/short-desktop.png` });
  const chip = page.getByRole('button', { name: 'Show Coronary Sinus in the model', exact: true }); await chip.focus(); await page.keyboard.press('Shift+Tab'); await page.keyboard.press('Tab'); assert.equal(await chip.evaluate(el => el.matches(':focus-visible')), true); await chip.press('Enter');
  await page.getByRole('button', { name: 'Close anatomical information' }).waitFor();
  assert.match(await page.locator('.information-overlay').innerText(), /Coronary Sinus/); assert.equal(report.requests, 1); await open(); assert.equal(report.requests, 1); await back();
  report.checks.push('Empty fallback; one takeaway and vessel; absent overview; citations; keyboard chip navigation and unchanged cache');
  await page.getByRole('button', { name: 'Close anatomical information' }).click();
  // Dispatch actual catalogue buttons so every entry goes through the existing navigation/session action.
  for (const part of HEART_PARTS) { await page.locator(`[data-structure-id="${part.id}"]`).evaluate(el => el.click()); }
  await open(); assert.equal(report.requests, 1); assert.equal(await page.locator('[data-review-vessel]').count(), 17);
  const ids = await page.locator('[data-review-vessel]').evaluateAll(es => es.map(e => e.dataset.reviewVessel)); assert.equal(new Set(ids).size, 17); assert.deepEqual(ids, HEART_PARTS.map(p => p.id));
  assert.equal(await page.locator('.review-generation-status').getAttribute('data-state'), 'stale');
  for (const level of ['intermediate', 'advanced']) {
    const calls = report.requests; await page.getByRole('group', { name: 'Learning level', exact: true }).getByRole('button', { name: level, exact: true }).click(); await settle(); assert.equal(report.requests, calls);
    variant = "long"; await update(); assert.equal(report.requests, calls + 1); assert.equal(report.levels.at(-1), level); assert.equal(await page.locator('.lesson-takeaway-card').count(), 5); assert.equal(await page.locator('.lesson-overview').count(), 1);
  }
  report.checks.push('All 17 canonical chips from current activity even while summary is stale; three levels; one and five cards; explicit updates only');
  const calls = report.requests;
  for (const [width, height] of [[1440, 1000], [1024, 768], [390, 844], [320, 568], [844, 390]]) {
    await page.setViewportSize({ width, height }); await page.locator('.learning-review-scroll').evaluate(el => el.scrollTop = 0);
    const layout = await page.evaluate(() => { const scroll = document.querySelector('.learning-review-scroll'), header = document.querySelector('.learning-review-heading'); return { pageOverflow: document.documentElement.scrollWidth > innerWidth + 1 || document.documentElement.scrollHeight > innerHeight + 1, contentOverflow: scroll.scrollWidth > scroll.clientWidth + 1, scrollable: scroll.scrollHeight > scroll.clientHeight, headerTop: header.getBoundingClientRect().top, headerBottom: header.getBoundingClientRect().bottom, height: innerHeight }; });
    assert.equal(layout.pageOverflow, false, `${width} page overflow`); assert.equal(layout.contentOverflow, false, `${width} content overflow`); assert.equal(layout.scrollable, true); assert.ok(layout.headerTop >= 0 && layout.headerBottom < layout.height);
    for (const name of ['Take Personalised Quiz', 'Return to Model', 'Update review', 'Download Word']) assert.equal(await page.getByRole('button', { name, exact: true }).isVisible(), true);
    assert.equal((await page.locator('.lesson-takeaway-card .lesson-card-body > p').first().innerText()).trim(), longText.trim());
    assert.equal(await page.locator('.lesson-takeaway-card .lesson-card-body > p').first().evaluate(el => getComputedStyle(el).webkitLineClamp), 'none');
    await page.screenshot({ path: `${dir}/long-${width}x${height}.png` });
  }
  assert.equal(report.requests, calls); report.checks.push('Long titles/overview/five full explanations: internal scroll, fixed actions, no horizontal overflow at five desktop/mobile/landscape sizes; resizing makes no generation requests');
  await page.setViewportSize({ width: 1440, height: 1000 });
  const pendingDownload = page.waitForEvent('download'); await page.getByRole('button', { name: 'Download Word', exact: true }).click(); const downloaded = await pendingDownload; await downloaded.saveAs(`${dir}/review.docx`);
  const xml = await (await JSZip.loadAsync(fs.readFileSync(`${dir}/review.docx`))).file('word/document.xml').async('string');
  for (const text of [latest.title, latest.introduction, latest.overview.text, latest.takeaways[0].heading, longText, 'Vessels explored', 'Coronary Sinus']) assert.ok(xml.includes(text.trim()), `Word missing ${text.slice(0, 35)}`);
  assert.doesNotMatch(xml, /Continue your revision/); assert.equal(report.requests, calls);
  variant = 'legacy'; await update(); assert.equal(await page.locator('#review-title').innerText(), 'Your lesson review'); assert.equal(await page.locator('.lesson-overview').count(), 0); assert.equal(await page.locator('.lesson-takeaway-card h4').count(), 0); assert.equal(await page.locator('.lesson-takeaway-card').count(), 1);
  const legacyCalls = report.requests; await back(); await open(); assert.equal(report.requests, legacyCalls);
  variant = 'literal'; await update(); assert.equal(await page.locator('#review-title').innerText(), latest.title); assert.equal(await page.locator('.lesson-takeaway-card').count(), 2); assert.equal(await page.locator('.lesson-summary-hero img,.lesson-takeaway-card script').count(), 0); assert.equal(await page.evaluate(() => window.injected), undefined);
  variant = 'malformed'; await update(); assert.equal(await page.getByRole('button', { name: 'Retry review', exact: true }).count(), 1); assert.equal(await page.locator('.lesson-overview,.lesson-takeaway-card').count(), 0); assert.equal(await page.getByText('AI-personalised review', { exact: true }).count(), 0);
  variant = 'short'; await update(); assert.equal(await page.locator('.lesson-takeaway-card').count(), 1);
  report.checks.push('Word retains displayed title/intro/overview/headings/full explanations; legacy fields remain readable without regeneration; safe literal text; malformed fields offer retry without invented cards');
  assert.deepEqual(report.errors, []); report.passed = true;
} catch (error) { report.failure = error.stack; process.exitCode = 1; if (page) await page.screenshot({ path: `${dir}/failure.png` }).catch(() => {}); }
finally { fs.writeFileSync(`${dir}/browser-report.json`, JSON.stringify(report, null, 2)); console.log(JSON.stringify(report)); await browser.close(); }
