import assert from 'node:assert/strict';
import fs from 'node:fs';
import { load } from './helpers/load-module.mjs';
import { glbFixture } from './helpers/glb-fixture.mjs';
import { orientHeart } from './helpers/viewer-orbit.mjs';
const { HEART_PARTS } = load('lib/heart-parts.ts');
const { chromium } = await import(new URL('../.next/cache/browser-tools/node_modules/playwright/index.mjs', import.meta.url).href);
const base = process.env.EXPLORER_TEST_URL ?? 'http://localhost:3000';
const real = process.argv.includes('--real');
const noWorker = process.argv.includes('--no-worker');
const directory = 'artifacts/marker-occlusion'; fs.mkdirSync(directory, { recursive: true });
const report = { model: real ? 'supplied RCA scan' : '17-anchor synthetic geometry', checks: [], views: [], errors: [], externalRequests: [], workerRequests: [] };
const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
try {
  const context = await browser.newContext({ viewport: { width: real ? 1100 : 1440, height: 850 }, deviceScaleFactor: 1 });
  if (noWorker) await context.addInitScript(() => { window.Worker = class Worker { constructor() { throw Error('Synthetic worker restriction'); } }; });
  await context.route('**/*', route => {
    const url = new URL(route.request().url());
    if (!['localhost', '127.0.0.1'].includes(url.hostname)) { report.externalRequests.push(url.href); return route.abort(); }
    if (url.pathname === '/api/chat') {
      const input = route.request().postDataJSON();
      return route.fulfill({ json: { schemaVersion: 1, answer: 'Waiting for viewer navigation.', sources: [], mode: 'review', status: 'navigation', selectedStructureId: input.selectedStructureId, learningLevel: input.learningLevel,
        navigation: { id: 'occlusion-test-navigation', command: { type: 'focus_structure', structureId: real ? 'right-coronary-middle' : HEART_PARTS[10].id } } } });
    }
    if (url.pathname.startsWith('/api/')) return route.fulfill({ json: { mode: 'basic', reason: 'disabled', sources: [], passages: [], gaps: [] } });
    return route.continue();
  });
  if (!real) {
    const structures = Object.fromEntries(HEART_PARTS.map((part, i) => [part.id, { meshes: [], anchor: { node: 'Test_Vessel', position: [(i % 3 - 1) * .6, (Math.floor(i / 3) % 3 - 1) * .8, i < 9 ? .5 : -.5] } }]));
    await context.route('**/models/heart-model.json', route => route.fulfill({ json: { version: 1, url: '/models/occlusion-fixture.glb', rotationDegrees: [0, 0, 0], structures } }));
    await context.route('**/models/occlusion-fixture.glb', route => route.fulfill({ contentType: 'model/gltf-binary', body: glbFixture(data => { data.nodes[0].children = [1]; }) }));
  }
  const page = await context.newPage(); page.setDefaultTimeout(60000);
  page.on('pageerror', error => report.errors.push(error.message));
  page.on('worker', worker => report.workerRequests.push(worker.url()));
  await page.goto(base, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.scene-surface[data-model-kind="imported"]', { timeout: 90000 });
  const frame = () => page.locator('.scene-surface').evaluate(el => JSON.parse(el.dataset.framing));
  const check = async label => {
    const data = await page.locator('.scene-surface').evaluate(el => JSON.parse(el.dataset.markerVisibility));
    const visible = await page.locator('.anatomy-marker:not([hidden])').evaluateAll(els => els.map(el => el.dataset.markerId));
    assert.deepEqual(visible.sort(), data.anchors.filter(a => a.visible).map(a => a.id).sort(), `${label}: DOM follows anatomical visibility`);
    const hidden = await page.locator('.anatomy-marker[hidden]').evaluateAll(els => els.map(el => ({ id: el.dataset.markerId, boxes: el.getClientRects().length, display: getComputedStyle(el).display })));
    assert.ok(hidden.every(h => h.boxes === 0 && h.display === 'none'));
    const lines = await page.locator('.annotation-layer line').evaluateAll(els => els.filter(el => getComputedStyle(el).display !== 'none').length);
    assert.equal(lines, visible.length, 'Connector lines hide with their markers');
    report.views.push({ label, visible, framing: await frame(), visibility: data });
    await page.screenshot({ path: `${directory}/${real ? 'scan' : 'fixture'}-${label}.png` });
    return visible;
  };
  const settle = async () => {
    await page.waitForFunction(() => {
      const text = document.querySelector('.scene-surface')?.dataset.framing;
      return text && !JSON.parse(text).moving;
    });
    await page.waitForTimeout(real ? 700 : 300);
  };
  const orient = async (azimuth, elevation) => {
    await settle();
    await orientHeart(page, azimuth, elevation);
    await settle();
  };
  await settle();
  await check('initial');
  if (!real) {
    await orient(0, 0); assert.equal((await check('front')).length, 9);
    const first = page.locator(`[data-marker-id="${HEART_PARTS[0].id}"]`);
    await first.focus(); await page.keyboard.press('Enter'); await settle();
    assert.equal(await first.getAttribute('data-explored'), 'true');
    await orient(180, 0); assert.equal((await check('back-selected')).length, 8);
    assert.equal(await first.isVisible(), false);
    assert.equal(await page.locator('.information-overlay').isVisible(), true);
    assert.equal(await page.locator('.information-card-position').getAttribute('data-anchor-visible'), 'false');
    await first.evaluate(el => el.focus()); assert.equal(await first.evaluate(el => el === document.activeElement), false);
    const pose = await frame(); await page.waitForTimeout(1000); const later = await frame();
    assert.equal(later.transactions, pose.transactions, 'Hiding selected marker must not request camera return');
    await orient(0, 0); await check('front-restored'); assert.equal(await first.getAttribute('data-explored'), 'true');
    assert.equal(await page.locator('.information-card-position').getAttribute('data-anchor-visible'), 'true');
    assert.equal(await page.locator('[aria-label="Anatomical exploration"]').getAttribute('aria-valuenow'), '1');
    report.checks.push('17 stable IDs: nine front and eight rear anchors swap correctly; selection/card/progress persist; hidden buttons cannot focus and connectors disappear; no camera return.');
    await page.getByRole('button', { name: 'Close anatomical information', exact: true }).click();
  }
  for (const [label, a, e] of [['front', 0, 0], ['back', 180, 0], ['right-side', 90, 0], ['left-side', -90, 0], ['top', 0, 87], ['underside', 0, -87], ['tilted', 180, -35]]) {
    await orient(a, e); await check(label);
  }
  report.checks.push('Front, back, both sides, top, underside and tilted views update markers while rotating.');
  if (real) {
    const audit = JSON.parse(fs.readFileSync(`${directory}/anchor-audit.json`, 'utf8'));
    for (const anchor of audit.anchors) {
      // Choose the centre of an exposed patch, not its silhouette boundary.
      // The browser's fitted camera distance differs slightly from the audit.
      const neighbours = view => anchor.visibleViews.filter(v => Math.abs(v.elevation - view.elevation) <= 15 && Math.abs(Math.atan2(Math.sin((v.azimuth - view.azimuth) * Math.PI / 180), Math.cos((v.azimuth - view.azimuth) * Math.PI / 180))) <= .263).length;
      const view = [...anchor.visibleViews].sort((a, b) => neighbours(b) - neighbours(a))[0];
      await orient(view.azimuth, view.elevation);
      const marker = page.locator(`[data-marker-id="${anchor.id}"]`);
      await marker.waitFor({ state: 'visible' }); await marker.click(); await settle();
      assert.equal(await marker.getAttribute('data-explored'), 'true');
      assert.equal(await page.locator('#detail-title').isVisible(), true);
      await check(`authored-${anchor.id}`);
      await page.getByRole('button', { name: 'Close anatomical information', exact: true }).click();
    }
    report.checks.push('All three supplied RCA anchors become visible and clickable from exposed views; original IDs and explored states survive.');
  }
  await page.getByRole('button', { name: 'Reset view', exact: true }).click(); await settle();
  await page.getByRole('button', { name: 'Ask AI Tutor', exact: true }).click();
  
  await page.locator('#tutor-question').fill('Show the middle right coronary artery'); await page.locator('#tutor-question').press('Enter');
  await page.waitForFunction(() => document.querySelector('.tutor-answer')?.textContent.includes('Opened'));
  await settle(); await check('tutor-navigation');
  assert.equal(await page.locator('.information-overlay').isVisible(), true);
  report.checks.push('Mocked AI Tutor navigation still opens anatomy and visibility follows its automatic camera/panel transition. No live API call.');
  await page.getByRole('button', { name: 'Close AI Anatomy Tutor', exact: true }).click();
  await page.getByRole('button', { name: 'Reset view', exact: true }).click(); await settle();
  await page.setViewportSize({ width: 390, height: 844 }); await settle(); await check('mobile');
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false);
  await page.mouse.move(170, 400); await page.mouse.wheel(0, -500); await settle(); await check('mobile-zoom');
  report.checks.push('Mobile resizing and zoom preserve visibility and page width.');
  if (noWorker) assert.equal(report.workerRequests.length, 0, 'Worker restrictions use the exact-geometry loading fallback');
  else assert.ok(report.workerRequests.length, 'Model indexing uses a background worker');
  assert.deepEqual(report.errors, []); assert.deepEqual(report.externalRequests, []); report.passed = true;
} finally { fs.writeFileSync(`${directory}/browser-${real ? 'scan' : noWorker ? 'worker-fallback' : 'fixture'}.json`, JSON.stringify(report, null, 2)); await browser.close(); }
console.log(JSON.stringify({ ...report, views: report.views.map(v => ({ label: v.label, visible: v.visible })) }, null, 2));
