import assert from 'node:assert/strict';
import fs from 'node:fs';
const { chromium } = await import(new URL('../.next/cache/browser-tools/node_modules/playwright/index.mjs', import.meta.url).href);
const directory = 'artifacts/heart-navigation'; fs.mkdirSync(directory, { recursive: true });
const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const report = { checks: [], errors: [], externalRequests: [], poses: {} };
let page;
try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1, hasTouch: true });
  await context.route('**/*', route => {
    const url = new URL(route.request().url());
    if (!['localhost', '127.0.0.1'].includes(url.hostname)) { report.externalRequests.push(url.href); return route.abort(); }
    if (url.pathname === '/api/chat') {
      const input = route.request().postDataJSON();
      return route.fulfill({ json: { schemaVersion: 1, answer: 'Waiting for viewer navigation.', sources: [], mode: 'review', status: 'navigation', selectedStructureId: input.selectedStructureId, learningLevel: input.learningLevel,
        navigation: { id: 'free-camera-test', command: { type: 'focus_structure', structureId: 'right-coronary-proximal' } } } });
    }
    if (url.pathname.startsWith('/api/')) return route.fulfill({ json: { mode: 'basic', reason: 'disabled', sources: [], passages: [], gaps: [] } });
    return route.continue();
  });
  page = await context.newPage(); page.setDefaultTimeout(45000);
  page.on('pageerror', error => report.errors.push(error.message));
  await page.goto(process.env.EXPLORER_TEST_URL ?? 'http://localhost:3000', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.scene-surface[data-model-kind="imported"]', { timeout: 90000 });
  const read = () => page.locator('.scene-surface').evaluate(el => JSON.parse(el.dataset.framing));
  const settle = async () => { await page.waitForTimeout(650); await page.waitForFunction(() => { const f = document.querySelector('.scene-surface')?.dataset.framing; return f && !JSON.parse(f).moving; }); };
  const close = (a, b, label, epsilon = .001) => assert.ok(Math.abs(a - b) < epsilon, `${label}: ${a} != ${b}`);
  const vector = (a, b, label) => a.forEach((v, i) => close(v, b[i], label));
  const sameRotation = (a, b) => close(Math.abs(a.reduce((s, v, i) => s + v * b[i], 0)), 1, 'rotation');
  const angle = (a, b) => 2 * Math.acos(Math.min(1, Math.abs(a.reduce((s, v, i) => s + v * b[i], 0))));
  const progress = () => page.locator('[aria-label="Anatomical exploration"]').getAttribute('aria-valuenow');
  const drag = async (dx, dy, button = 'left', start) => {
    const box = await page.locator('canvas').boundingBox();
    const p = start ?? { x: box.x + box.width * .35, y: box.y + box.height - 75 };
    await page.mouse.move(p.x, p.y); await page.mouse.down({ button });
    await page.mouse.move(p.x + dx, p.y + dy, { steps: 20 }); await page.mouse.up({ button });
    await page.mouse.move(4, 4); await page.waitForTimeout(100);
    assert.equal((await read()).manual, false, 'Release finishes gesture');
  };
  const visibleAgreement = async () => {
    const expected = await page.locator('.scene-surface').evaluate(el => JSON.parse(el.dataset.markerVisibility).anchors.filter(a => a.visible).map(a => a.id).sort());
    const actual = await page.locator('.anatomy-marker:not([hidden])').evaluateAll(els => els.map(e => e.dataset.markerId).sort());
    assert.deepEqual(actual, expected, 'Markers follow current geometry during free rotation/pan');
  };
  const reset = async () => { await page.getByRole('button', { name: 'Reset view', exact: true }).click(); await settle(); };
  await settle(); const initial = await read(); report.poses.initial = initial;
  assert.equal(await page.locator('.learning-save-status').count(), 0, 'No routine session notice or empty notice space');
  await page.screenshot({ path: `${directory}/upright-reset-desktop.png` });
  const box = await page.locator('canvas').boundingBox();
  for (const direction of ['horizontal', 'vertical']) {
    await reset();
    for (let turn = 0; turn < 4; turn++) {
      const previous = await read();
      await drag(direction === 'horizontal' ? box.height / 4 : 0, direction === 'vertical' ? box.height / 4 : 0);
      const current = await read(); close(angle(current.quaternion, previous.quaternion), Math.PI / 2, `${direction} quarter-turn`, .015);
      await visibleAgreement();
      if (direction === 'vertical' && turn === 1) {
        report.poses.upsideDown = current;
        await page.screenshot({ path: `${directory}/upside-down.png` });
      }
    }
    const end = await read(); sameRotation(end.quaternion, initial.quaternion); vector(end.position, initial.position, `${direction} full turn`);
    report.checks.push(`Full ${direction} turn: four uninterrupted quarter-turns, including pole crossings; returns to the original pose.`);
  }
  await reset();
  for (const [dx, dy] of [[100, 0], [0, -85], [-100, 0], [0, 85]]) {
    const before = await read(); await drag(dx, dy, 'right'); const after = await read();
    close(after.offset.x - before.offset.x, dx, 'pan x'); close(after.offset.y - before.offset.y, dy, 'pan y');
    sameRotation(before.quaternion, after.quaternion); vector(before.position, after.position, 'pan position'); vector(before.target, after.target, 'pan pivot');
  }
  await drag(110, -65, 'right'); const panned = await read(); await drag(100, 60); const rotated = await read();
  assert.deepEqual(rotated.offset, panned.offset); vector(rotated.target, panned.target, 'fixed heart pivot'); close(rotated.distance, panned.distance, 'orbit radius');
  await visibleAgreement(); report.poses.panThenRotate = rotated;
  await page.screenshot({ path: `${directory}/pan-then-rotate.png` });
  const outside = await page.locator('canvas').boundingBox(); await drag(outside.width, -80);
  const released = await read(); await page.mouse.move(400, 150); await page.waitForTimeout(300); sameRotation((await read()).quaternion, released.quaternion);
  await reset();
  const focusCanvas = await page.locator('canvas').boundingBox(), focusX = focusCanvas.x + 100, focusY = focusCanvas.y + focusCanvas.height - 90;
  await page.mouse.move(focusX, focusY); await page.mouse.down(); await page.mouse.move(focusX + 40, focusY, { steps: 8 });
  await page.evaluate(() => window.dispatchEvent(new Event('blur'))); await page.waitForTimeout(100);
  const blurred = await read(); assert.equal(blurred.manual, false);
  await page.mouse.move(focusX + 80, focusY); await page.mouse.up(); await page.waitForTimeout(100); sameRotation((await read()).quaternion, blurred.quaternion);
  report.checks.push('Right-drag pans naturally in four directions without orientation changes; rotating after pan retains screen offset and heart pivot. Release outside viewer stops movement.');
  report.checks.push('Losing window focus cancels a drag; subsequent pointer movement cannot leave navigation stuck.');
  await reset();
  let marker = page.locator('.anatomy-marker:not([hidden])').first();
  const centre = async el => el.evaluate(node => { const r = node.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; });
  assert.equal(await progress(), '0');
  const beforeMarkerDrag = await read(); await drag(60, 20, 'left', await centre(marker));
  assert.equal(await progress(), '0'); assert.equal(await page.locator('.information-overlay').isVisible(), false);
  assert.ok(angle((await read()).quaternion, beforeMarkerDrag.quaternion) > .1);
  await reset(); marker = page.locator('.anatomy-marker:not([hidden])').first();
  await drag(55, -25, 'right', await centre(marker)); assert.equal(await progress(), '0'); assert.equal(await page.locator('.information-overlay').isVisible(), false);
  await reset(); marker = page.locator('.anatomy-marker:not([hidden])').first();
  const at = await centre(marker); await page.mouse.move(at.x, at.y); await page.mouse.down(); await page.mouse.move(at.x + 2, at.y + 2); await page.mouse.up(); await settle();
  assert.equal(await progress(), '1'); assert.equal(await page.locator('.information-overlay').isVisible(), true);
  const selectionPose = await read(), selectionCanvas = await page.locator('canvas').boundingBox(); await drag(10, 0); const afterSelection = await read();
  close(angle(selectionPose.quaternion, afterSelection.quaternion), 10 * Math.PI * 2 / selectionCanvas.height, 'no jump after selection');
  assert.equal(await progress(), '1'); assert.equal(await page.locator('.information-overlay').isVisible(), true);
  const contextMenu = async locator => locator.evaluate(el => { const e = new MouseEvent('contextmenu', { bubbles: true, cancelable: true, button: 2 }); el.dispatchEvent(e); return e.defaultPrevented; });
  assert.equal(await contextMenu(page.locator('canvas')), true);
  assert.equal(await contextMenu(page.locator('.scene-toolbar')), false);
  assert.equal(await contextMenu(page.locator('.information-overlay')), false);
  report.checks.push('Left/right drags starting on markers never select or add progress; a 2-pixel click selects normally. Context menu is suppressed only in the navigation surface.');
  await reset();
  const beforeWheel = await read(); const canvas = await page.locator('canvas').boundingBox();
  await page.mouse.move(canvas.x + canvas.width / 2, canvas.y + canvas.height / 2); await page.mouse.wheel(0, -100); await page.waitForTimeout(150);
  close((await read()).distance, beforeWheel.distance * .95, 'existing wheel step');
  const cdp = await context.newCDPSession(page), cx = canvas.x + canvas.width / 2, cy = canvas.y + canvas.height / 2;
  const touch = (id, x, y) => ({ id, x, y, radiusX: 4, radiusY: 4, force: 1 });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [touch(0, cx - 35, cy), touch(1, cx + 35, cy)] });
  const pinchStart = (await read()).distance;
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [touch(0, cx - 55, cy), touch(1, cx + 55, cy)] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await page.waitForTimeout(200);
  assert.ok((await read()).distance < pinchStart); assert.equal((await read()).manual, false); assert.equal(await progress(), '1');
  report.checks.push('Wheel zoom keeps its previous step; two-finger pinch zoom works without recording a selection.');
  await drag(0, box.height / 2); await drag(80, 30, 'right'); const inverted = await read();
  await page.getByRole('button', { name: 'Ask AI Tutor', exact: true }).click(); await settle(); sameRotation((await read()).quaternion, inverted.quaternion);
   await page.locator('#tutor-question').fill('Show the proximal right coronary artery'); await page.locator('#tutor-question').press('Enter');
  await page.waitForFunction(() => document.querySelector('.tutor-answer')?.textContent.includes('Opened')); await settle();
  assert.equal(await page.locator('[data-marker-id="right-coronary-proximal"]').isVisible(), true); await visibleAgreement();
  assert.match(await page.locator('#detail-title').innerText(), /Proximal/);
  const beforeTutorDrag = await read(), resized = await page.locator('canvas').boundingBox(); await drag(10, 0);
  close(angle((await read()).quaternion, beforeTutorDrag.quaternion), 10 * Math.PI * 2 / resized.height, 'no jump after Tutor transition');
  await page.getByRole('button', { name: 'Close AI Anatomy Tutor', exact: true }).click(); await settle(); await reset(); const restored = await read();
  sameRotation(restored.quaternion, initial.quaternion); vector(restored.position, initial.position, 'reset position'); vector(restored.target, initial.target, 'reset target');
  close(restored.zoom, initial.zoom, 'reset zoom'); close(restored.offset.x, initial.offset.x, 'reset x'); close(restored.offset.y, initial.offset.y, 'reset y');
  assert.equal(await page.locator('.information-overlay').isVisible(), false, 'Reset closes the selected information panel');
  assert.equal(restored.selectedId, null);
  assert.equal(await progress(), '2', 'Reset preserves both marker and Tutor exploration');
  report.checks.push('Explicit Tutor navigation reveals the vessel while ordinary panel framing preserves the viewing angle; next drag has no jump. Reset View restores original orientation, position, zoom and pan.');
  await page.setViewportSize({ width: 390, height: 844 }); await settle(); await reset();
  sameRotation((await read()).quaternion, initial.quaternion);
  await page.screenshot({ path: `${directory}/upright-reset-mobile.png` });
  await drag(35, 30, 'right'); await drag(20, 40); await visibleAgreement();
  const mobile = await page.locator('canvas').boundingBox(), mx = mobile.x + mobile.width / 4, my = mobile.y + mobile.height / 2;
  const beforeTouch = await read();
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [touch(0, mx, my)] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [touch(0, mx + 30, my + 35)] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await page.waitForTimeout(200);
  assert.ok(angle(beforeTouch.quaternion, (await read()).quaternion) > .1); assert.equal((await read()).manual, false); await visibleAgreement();
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false);
  await page.screenshot({ path: `${directory}/mobile-navigation.png` });
  report.checks.push('Mobile layout, single-finger rotation and pointer navigation remain usable without overflow.');
  assert.deepEqual(report.errors, []); assert.deepEqual(report.externalRequests, []); report.passed = true;
} catch (error) {
  if (page) { await page.screenshot({ path: `${directory}/failure.png` }).catch(() => {}); report.failurePose = await page.locator('.scene-surface').getAttribute('data-framing').catch(() => null); }
  throw error;
} finally { fs.writeFileSync(`${directory}/browser-report.json`, JSON.stringify(report, null, 2)); await browser.close(); }
console.log(JSON.stringify({ checks: report.checks, errors: report.errors, passed: report.passed }, null, 2));
