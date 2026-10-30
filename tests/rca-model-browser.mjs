import assert from 'node:assert/strict';
import fs from 'node:fs';
import { Color } from 'three';
import { load } from './helpers/load-module.mjs';
const { VESSEL_HIGHLIGHT_OPACITY } = load('lib/vessel-highlight.ts');
const tintedRed = new Color('#ffffff').lerp(new Color('#ef4444'), VESSEL_HIGHLIGHT_OPACITY).getHexString();
import { exposeRcaMarker } from './helpers/viewer-orbit.mjs';
const { chromium } = await import(new URL('../.next/cache/browser-tools/node_modules/playwright/index.mjs', import.meta.url).href);
const base = process.env.EXPLORER_TEST_URL ?? 'http://localhost:3000';
const directory = 'artifacts/rca-test'; fs.mkdirSync(directory, { recursive: true });
const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const report = { checks: [], errors: [], warnings: [], externalRequests: [] };
try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 });
  // Never contact an AI backend, even if the user's running server is configured live.
  await context.route('**/api/**', route => route.fulfill({ json: { mode: 'basic', reason: 'disabled', sources: [], passages: [], gaps: [] } }));
  await context.route('**/*', route => {
    if (!['localhost', '127.0.0.1'].includes(new URL(route.request().url()).hostname)) {
      report.externalRequests.push(route.request().url()); return route.abort();
    }
    return route.fallback();
  });
  const page = await context.newPage(); page.on('pageerror', error => report.errors.push(error.message));
  page.on('console', message => { if (message.type() === 'warning' && message.text().includes('Model tagging')) report.warnings.push(message.text()); });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const settle = async () => {
    await page.waitForTimeout(250);
    await page.waitForFunction(() => { const value = document.querySelector('.scene-surface')?.dataset.framing; return value && !JSON.parse(value).moving; });
  };
  const progress = () => page.locator('[aria-label="Anatomical exploration"]').getAttribute('aria-valuenow');
  const applied = async expected => page.waitForFunction(value => {
    const current = JSON.parse(document.querySelector('.scene-surface')?.dataset.modelSelection ?? 'null');
    return current && Object.entries(value).every(([key, item]) => current[key] === item);
  }, expected);
  const reset = async () => { await page.getByRole('button', { name: 'Reset view', exact: true }).click(); await page.mouse.move(5, 5); await applied({ selected: null, hovered: null, isolated: null, selectedGroup: null, hoveredGroup: null }); await settle(); };
  const materials = async () => JSON.parse(await page.locator('.scene-surface').getAttribute('data-model-materials'));
  const assertHighlight = async (color, original) => {
    // Canvas has its own React root and demand-render schedule. Wait for the
    // rendered material change, not just the HTML marker's earlier update.
    await page.waitForFunction(expected => {
      const all = JSON.parse(document.querySelector('.scene-surface')?.dataset.modelMaterials ?? '[]');
      const vessel = all.filter(m => m.group === 'right-coronary-artery');
      return vessel.length === 2 && vessel.every(m => m.colors.every(c => c === expected));
    }, color, { timeout: 10000 }).catch(() => {});
    const current = await materials(), vessel = current.filter(m => m.group === 'right-coronary-artery');
    assert.equal(vessel.length, 2, 'Both textured RCA primitives are loaded');
    if (!vessel.every(m => m.colors.every(c => c === color))) {
      report.highlightFailure = { expected: color, current, selection: await page.locator('.scene-surface').getAttribute('data-model-selection'), hoveredMarkers: await page.locator('.anatomy-marker.hovered').evaluateAll(els => els.map(el => el.dataset.markerId)), hoveredVessel: await page.locator('.scene-surface').getAttribute('data-hovered-vessel') };
      await page.screenshot({ path: `${directory}/highlight-failure.png` });
    }
    assert.ok(vessel.every(m => m.colors.every(c => c === color)), `Entire RCA changes color: ${JSON.stringify(report.highlightFailure ?? {})}`);
    assert.deepEqual(current.filter(m => !m.group).map(m => m.colors), original.filter(m => !m.group).map(m => m.colors), 'Heart context retains its original colors');
  };
  await page.goto(base, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.scene-surface[data-model-kind="imported"]', { timeout: 90000 }); await settle();
  await page.waitForFunction(() => JSON.parse(document.querySelector('.scene-surface').dataset.markerVisibility ?? 'null')?.anchors.filter(a => a.id.startsWith('right-coronary-')).length === 3);
  assert.equal(await progress(), '0');
  await page.screenshot({ path: `${directory}/initial.png` });
  const ids = ['right-coronary-proximal', 'right-coronary-middle', 'right-coronary-distal'];
  const probes = [];
  for (let index = 0; index < ids.length; index++) {
    const marker = page.locator(`[data-marker-id="${ids[index]}"]`);
    await reset();
    await exposeRcaMarker(page, ids[index]); await settle();
    const before = await materials();
    probes.push(await marker.evaluate(el => { const r = el.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; }));
    await marker.hover(); await settle();
    await assertHighlight(tintedRed, before);
    assert.equal(await progress(), String(index));
    if (index === 1) await page.screenshot({ path: `${directory}/marker-hover.png` });
    await page.mouse.move(5, 5); await settle();
    await assertHighlight('ffffff', before);
    assert.deepEqual(await materials(), before, 'Leaving restores the original textured material');
    await marker.focus(); await page.keyboard.press('Enter'); await settle();
    assert.match(await page.locator('#detail-title').innerText(), new RegExp(['Proximal', 'Middle', 'Distal'][index]));
    assert.equal(await progress(), String(index + 1));
    assert.equal(await marker.getAttribute('data-explored'), 'true');
    await assertHighlight(tintedRed, before);
    await page.screenshot({ path: `${directory}/selected-${index + 1}.png` });
    await page.getByRole('switch', { name: 'Isolate Structure' }).click(); await applied({ isolated: ids[index] }); await settle();
    assert.equal(await page.getByRole('switch', { name: 'Isolate Structure' }).getAttribute('aria-checked'), 'true');
    await assertHighlight('ffffff', before);
    assert.ok((await materials()).filter(m => m.group !== 'right-coronary-artery').every(m => m.visible && m.materials.every(material => material.opacity === .2)));
    if (index === 1) await page.screenshot({ path: `${directory}/rca-isolated.png` });
  }
  report.checks.push('All three authored marker positions render. Normal hover/selection updates both RCA materials; isolation restores original vessel appearance with translucent context. Keyboard selection opens the correct segment. Only selected markers count as explored.');
  await reset();
  // Context now correctly blocks picking through the heart. Test the surface
  // from an exposed RCA view instead of searching its hidden side after reset.
  await exposeRcaMarker(page, ids[0]); await settle();
  await page.getByRole('button', { name: 'Hide Markers', exact: true }).click(); await settle();
  const baseline = await materials();
  let hit;
  // Try the actual projected anchors and nearby surface, then a bounded canvas scan.
  const offsets = [0, -8, 8, -18, 18, -32, 32, -50, 50];
  const candidates = probes.flatMap(p => offsets.flatMap(dx => offsets.map(dy => ({ x: p.x + dx, y: p.y + dy }))));
  const bounds = await page.locator('canvas').boundingBox();
  for (let y = bounds.y + 20; y < bounds.y + bounds.height - 20; y += 24) for (let x = bounds.x + 20; x < bounds.x + bounds.width - 20; x += 24) candidates.push({ x, y });
  for (const p of candidates) {
    if (p.x < bounds.x || p.x > bounds.x + bounds.width || p.y < bounds.y || p.y > bounds.y + bounds.height) continue;
    await page.mouse.move(p.x, p.y);
    if (await page.locator('.scene-surface').getAttribute('data-hovered-vessel') === 'right-coronary-artery') { hit = p; break; }
  }
  assert.ok(hit, 'The real RCA surface is hoverable'); await settle();
  assert.match(await page.locator('.vessel-highlight-label').innerText(), /Right Coronary Artery/);
  await assertHighlight(tintedRed, baseline);
  await page.screenshot({ path: `${directory}/surface-hover.png` });
  await page.mouse.click(hit.x, hit.y); await settle();
  assert.equal(await page.locator('.scene-surface').getAttribute('data-selected-vessel'), 'right-coronary-artery');
  assert.equal(await page.locator('.information-overlay').isVisible(), false);
  assert.equal(await progress(), '3');
  await page.mouse.move(5, 5); await settle();
  await assertHighlight(tintedRed, baseline);
  // Inspect the selected vessel from different viewing directions; no pose is
  // written back into the authored GLB or production manifest.
  for (let view = 1; view <= 3; view++) {
    const box = await page.locator('canvas').boundingBox();
    await page.mouse.move(box.x + box.width * .55, box.y + box.height * .45); await page.mouse.down();
    await page.mouse.move(box.x + box.width * .55 - 160, box.y + box.height * .45 + 20, { steps: 10 }); await page.mouse.up();
    await page.mouse.move(5, 5); await settle(); await assertHighlight(tintedRed, baseline);
    await page.screenshot({ path: `${directory}/whole-rca-view-${view}.png` });
  }
  await reset(); assert.deepEqual(await materials(), baseline);
  assert.equal(await progress(), '3');
  report.checks.push('Direct surface hover/click highlights the RCA and names the whole artery; it does not invent a segment selection. Reset restores the original appearance without clearing progress.');
  report.surfaceHit = hit;
  report.renderStats = JSON.parse(await page.locator('.scene-surface').getAttribute('data-render-stats') ?? 'null');
  await page.getByRole('button', { name: 'Show Markers', exact: true }).click();
  for (const [width, height] of [[390, 844], [768, 1024]]) {
    await page.setViewportSize({ width, height }); await reset();
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false);
    await exposeRcaMarker(page, 'right-coronary-middle'); await settle();
    await page.locator('[data-marker-id="right-coronary-middle"]').click(); await settle();
    assert.match(await page.locator('#detail-title').innerText(), /Middle/);
    await page.screenshot({ path: `${directory}/mobile-${width}.png` });
  }
  report.checks.push('Phone and tablet: all three markers, touch-sized clicks, correct information, and no page overflow.');
  assert.deepEqual(report.errors, []); assert.deepEqual(report.warnings, []); assert.deepEqual(report.externalRequests, []);
  report.passed = true;
} finally { fs.writeFileSync(`${directory}/browser-report.json`, JSON.stringify(report, null, 2)); await browser.close(); }
console.log(JSON.stringify(report, null, 2));
