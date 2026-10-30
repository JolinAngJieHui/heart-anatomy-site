import assert from 'node:assert/strict';
import fs from 'node:fs';
import JSZip from 'jszip';
const { chromium } = await import(new URL('../.next/cache/browser-tools/node_modules/playwright/index.mjs', import.meta.url).href);
const base = process.env.EXPLORER_TEST_URL ?? 'http://localhost:3000';
const key = 'heart-anatomy:tab-session:v1';
const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const report = { checks: [], errors: [], externalApiCalls: 0 };
fs.mkdirSync('.next/cache/restart-session-tests', { recursive: true });
try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, acceptDownloads: true });
  let heldChat, heldReview, holdChat = false, holdReview = false, reviewCalls = 0;
  await context.route('**/api/chat', route => { if (holdChat) { heldChat = route; return; } const q = route.request().postDataJSON(); return route.fulfill({ json: { answer: 'MOCK SAVED ANSWER FOR RESTART TEST', sources: [], selectedStructureId: q.selectedStructureId, learningLevel: q.learningLevel, mode: 'mock', status: 'mock', evidenceStatus: 'synthetic', schemaVersion: 1 } }); });
  await context.route('**/api/learning/review', route => { reviewCalls++; if (holdReview) { heldReview = route; return; } return route.fulfill({ json: { mode: 'basic', reason: 'disabled' } }); });
  await context.route('**/api/learning/evidence', route => route.fulfill({ json: { mode: 'approved-local', generatedAt: 'fixture', sources: [], passages: [], gaps: [] } }));
  const page = await context.newPage(); page.on('pageerror', e => report.errors.push(e.message));
  await page.addInitScript(() => { window.observedCounts = []; window.lockCalls = 0; window.legacyReads = 0; window.workspaceAt = null; window.readyAt = null;
    Object.defineProperty(navigator, 'locks', { value: { request() { window.lockCalls++; return new Promise(() => {}); } } });
    const originalGet = Storage.prototype.getItem;
    localStorage.setItem('heart-anatomy:learning-sessions:v1', 'UNREAD LEGACY ARCHIVE ' + 'x'.repeat(2_000_000));
    Storage.prototype.getItem = function(k) { if (this === localStorage && k === 'heart-anatomy:learning-sessions:v1') { window.legacyReads++; throw Error('Legacy archive must not be read'); } return originalGet.call(this, k); };
 new MutationObserver(() => { if (document.querySelector('.viewer-panel') && window.workspaceAt === null) window.workspaceAt = performance.now();
      const n = document.querySelector('[aria-label="Anatomical exploration"]')?.getAttribute('aria-valuenow');
      if (n !== null && n !== undefined && window.readyAt === null) window.readyAt = performance.now(); if (n !== null && n !== undefined) window.observedCounts.push(n); }).observe(document, { childList: true, subtree: true, attributes: true }); });
  const load = async p => { await p.goto(base, { waitUntil: 'networkidle' }); await p.locator('canvas').waitFor(); };
  const count = (p, n) => p.waitForFunction(n => document.querySelector('[aria-label="Anatomical exploration"]')?.getAttribute('aria-valuenow') === String(n), n);
  const history = p => p.evaluate(k => JSON.parse(sessionStorage.getItem(k)), key);
  const select = async (p, id) => { if (await p.locator('.information-overlay').isVisible()) await p.getByRole('button', { name: 'Close anatomical information', exact: true }).click(); await p.locator(`[data-structure-id="${id}"]`).click(); };
  const restart = async p => { await p.locator('.workspace-learning-toolbar').getByRole('button', { name: 'Restart Session', exact: true }).click(); await p.getByRole('dialog').getByRole('button', { name: 'Restart Session', exact: true }).click(); await count(p, 0); };
  const colours = async (p, ids) => {
    await p.waitForFunction(ids => [...document.querySelectorAll('[data-marker-id]')].every(el => el.getAttribute('data-explored') === String(ids.includes(el.getAttribute('data-marker-id')))), ids);
    const markers = await p.locator('[data-marker-id]').evaluateAll(els => els.map(el => ({ id: el.dataset.markerId, fill: getComputedStyle(el).backgroundColor })));
    assert.equal(markers.length, 17); for (const marker of markers) assert.equal(marker.fill, ids.includes(marker.id) ? 'rgb(251, 113, 133)' : 'rgba(19, 35, 57, 0.96)');
  };
  await load(page); await count(page, 0);
  const timing = await page.evaluate(() => ({ workspaceAt: window.workspaceAt, readyAt: window.readyAt, lockCalls: window.lockCalls, legacyReads: window.legacyReads }));
  assert.equal(timing.lockCalls, 0); assert.equal(timing.legacyReads, 0); assert.ok(timing.workspaceAt <= timing.readyAt); report.startup = timing;
  assert.equal(await page.getByText('Restoring your learning session…', { exact: true }).count(), 0);
  const ids = await page.locator('[data-structure-id]').evaluateAll(els => els.map(e => e.dataset.structureId));
  for (const id of ids.slice(0, 5)) await select(page, id);
  await count(page, 5); await colours(page, ids.slice(0, 5)); await page.locator('.achievement-toast').waitFor();
  await page.getByRole('button', { name: 'Dismiss achievement' }).click();
  await select(page, ids[0]); await count(page, 5);
  await page.getByRole('button', { name: 'advanced', exact: true }).click();
  await page.getByRole('button', { name: 'Reset view', exact: true }).click(); await count(page, 5); assert.equal(await page.locator('.information-overlay').isVisible(), false);
  await page.getByRole('button', { name: 'Ask AI Tutor', exact: true }).click();
   await page.locator('#tutor-question').fill('ORIGINAL QUESTION FOR RESTART TEST'); await page.getByRole('button', { name: 'Send', exact: true }).click(); await page.locator('.tutor-answer').waitFor();
  await page.evaluate(() => { localStorage.setItem('other-application', 'KEEP'); sessionStorage.setItem('other-application', 'KEEP'); localStorage.setItem('heart-anatomy:exploration:v1', 'legacy-data'); });
  // The reply renders immediately; its refresh checkpoint is intentionally debounced.
  await page.waitForFunction(k => JSON.parse(sessionStorage.getItem(k))?.sessions[0].events.some(e => e.type === 'tutor-replied'), key);
  const saved = await history(page);
  await page.reload({ waitUntil: 'networkidle' }); await count(page, 5); await colours(page, ids.slice(0, 5));
  assert.equal(await page.locator('.achievement-toast').count(), 0); assert.ok((await page.evaluate(() => window.observedCounts)).every(n => n === '5'), 'no zero flash on restore');
  assert.deepEqual(await history(page), saved); assert.equal(await page.getByRole('button', { name: 'advanced', exact: true }).getAttribute('aria-pressed'), 'true');
  await page.getByRole('button', { name: 'Ask AI Tutor', exact: true }).click(); assert.equal(await page.locator('.tutor-question').innerText(), 'ORIGINAL QUESTION FOR RESTART TEST');
  report.checks.push('Immediate independent rose markers, unique progress, Reset View, refresh persistence, no zero flash or milestone replay, original conversation preserved');
  await page.locator('.restart-session-button').click(); const dialog = page.getByRole('dialog');
  assert.equal(await dialog.getByRole('button', { name: 'Cancel', exact: true }).evaluate(el => el === document.activeElement), true);
  await page.keyboard.press('Tab'); assert.equal(await dialog.getByRole('button', { name: 'Restart Session', exact: true }).evaluate(el => el === document.activeElement), true);
  await page.keyboard.press('Tab'); assert.equal(await dialog.getByRole('button', { name: 'Cancel', exact: true }).evaluate(el => el === document.activeElement), true);
  await page.keyboard.press('Escape'); assert.deepEqual(await history(page), saved); await count(page, 5);
  await page.locator('.restart-session-button').click(); await page.getByRole('dialog').getByRole('button', { name: 'Cancel', exact: true }).click(); assert.deepEqual(await history(page), saved);
  const other = await context.newPage(); other.on('pageerror', e => report.errors.push(e.message)); await load(other); await count(other, 0); await select(other, ids[6]); await count(other, 1); await other.waitForTimeout(200); const otherHistory = await history(other);
  holdChat = true;  await page.locator('#tutor-question').fill('LATE QUESTION MUST BE DELETED'); await page.getByRole('button', { name: 'Send', exact: true }).click();
  await new Promise(r => setTimeout(r, 200)); assert.ok(heldChat);
  holdReview = true; await page.getByRole('button', { name: 'Review Session', exact: true }).click();
  for (let i = 0; i < 50 && !heldReview; i++) await new Promise(r => setTimeout(r, 100)); assert.ok(heldReview);
  await restart(page); await count(other, 1); await colours(page, []); await colours(other, [ids[6]]);
  const fresh = await history(page); assert.notEqual(fresh.activeId, saved.activeId); assert.equal(fresh.sessions.length, 1); assert.deepEqual(fresh.sessions[0].events, []);
  await heldReview.fulfill({ json: { mode: 'basic', reason: 'disabled' } }).catch(() => {});
  const q = heldChat.request().postDataJSON(); await heldChat.fulfill({ json: { answer: 'LATE ANSWER MUST BE DELETED', sources: [], selectedStructureId: q.selectedStructureId, learningLevel: q.learningLevel, mode: 'mock', status: 'mock', evidenceStatus: 'synthetic', schemaVersion: 1 } }).catch(() => {});
  holdChat = false; holdReview = false; await page.waitForTimeout(300); assert.deepEqual(await history(page), fresh); assert.deepEqual(await history(other), otherHistory);
  assert.deepEqual(await page.evaluate(() => [localStorage.getItem('other-application'), sessionStorage.getItem('other-application'), localStorage.getItem('heart-anatomy:exploration:v1')]), ['KEEP', 'KEEP', null]);
  assert.equal(await page.getByRole('button', { name: 'basic', exact: true }).getAttribute('aria-pressed'), 'true');
  assert.equal(await page.locator('.information-overlay').isVisible(), false);
  await page.getByRole('button', { name: 'Ask AI Tutor', exact: true }).click(); assert.equal(await page.locator('.tutor-turn').count(), 0); assert.equal(await page.locator('.tutor-privacy input').count(), 0);
  await page.reload({ waitUntil: 'networkidle' }); await count(page, 0); assert.deepEqual(await history(page), fresh);
  await other.close();
  const beforeEmptyReview = reviewCalls; await page.getByRole('button', { name: 'Review Session', exact: true }).click(); await page.locator('.lesson-review-content').waitFor();
  assert.match(await page.locator('.lesson-review-content').innerText(), /No structures selected yet/);
  const downloadEvent = page.waitForEvent('download'); await page.getByRole('button', { name: 'Download Word', exact: true }).click(); const download = await downloadEvent; const file = '.next/cache/restart-session-tests/fresh-session.docx'; await download.saveAs(file);
  const xml = await (await JSZip.loadAsync(fs.readFileSync(file))).file('word/document.xml').async('string'); assert.doesNotMatch(xml, /ORIGINAL QUESTION|MOCK SAVED|LATE QUESTION|LATE ANSWER/); assert.equal(reviewCalls, beforeEmptyReview);
  assert.equal(await page.getByText('Continue your revision', { exact: true }).count(), 0); assert.equal(await page.getByRole('button', { name: 'Take Personalised Quiz', exact: true }).count(), 1);
  await page.getByRole('button', { name: 'Return to Model', exact: true }).click();
  report.checks.push('Keyboard confirmation/cancellation, independent tabs, late tutor/review invalidation, unrelated storage retained, defaults restored, fresh review/quiz/Word');
  for (const id of ids.slice(0, 5)) await select(page, id); await count(page, 5); await page.locator('.achievement-toast').waitFor();
  await page.reload({ waitUntil: 'networkidle' }); await count(page, 5); assert.equal(await page.locator('.achievement-toast').count(), 0);
  await page.getByRole('button', { name: 'Review Session', exact: true }).click(); await page.locator('.review-generation-status').waitFor(); await page.waitForFunction(() => !document.querySelector('.review-generation-status')?.textContent.includes('Preparing'));
  const cachedCalls = reviewCalls; await page.getByRole('button', { name: 'Return to Model', exact: true }).click(); await page.getByRole('button', { name: 'Review Session', exact: true }).click(); await page.waitForTimeout(150); assert.equal(reviewCalls, cachedCalls);
  await page.getByRole('button', { name: 'Return to Model', exact: true }).click();
  for (const [width, height] of [[1440,900],[1024,768],[768,1024],[390,844],[320,568],[844,390]]) {
    await page.setViewportSize({ width, height }); await page.locator('.restart-session-button').click();
    const bounds = await page.getByRole('dialog').boundingBox(); assert.ok(bounds.x >= 0 && bounds.y >= 0 && bounds.x + bounds.width <= width && bounds.y + bounds.height <= height);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth && document.documentElement.scrollHeight <= innerHeight), true);
    await page.screenshot({ path: `.next/cache/restart-session-tests/confirmation-${width}.png` }); await page.getByRole('dialog').getByRole('button', { name: 'Cancel', exact: true }).click();
    assert.ok(await page.locator('.scene-surface').evaluate(el => el.getBoundingClientRect().height >= 60));
  }
  await restart(page); await count(page, 0);
  await page.setViewportSize({ width: 1440, height: 900 }); await select(page, ids[0]); await count(page, 1);
  // A normal new visit must not inherit an opener's copied sessionStorage.
  const popupEvent = context.waitForEvent('page'); await page.evaluate(url => window.open(url, '_blank'), base);
  // Session readiness is independent of model downloads and development-server
  // traffic. Wait for the visible learning state, not global network silence.
  const popup = await popupEvent; await popup.waitForLoadState('domcontentloaded'); await count(popup, 0); await popup.close();
  await page.close(); const reopened = await context.newPage(); await load(reopened); await count(reopened, 0);
  assert.equal((await history(reopened)).sessions[0].events.length, 0);
  report.checks.push('Old archives and locks never read; viewer shell mounts before session readiness; fresh visits, new/opener tabs and reopening after close start empty');
  report.checks.push('Milestones re-earned after restart, cached unchanged review, six viewport sizes and mobile restart');
  assert.deepEqual(report.errors, []); report.passed = true; fs.writeFileSync('.next/cache/restart-session-tests/report.json', JSON.stringify(report, null, 2)); console.log(JSON.stringify(report, null, 2));
} finally { await browser.close(); }


