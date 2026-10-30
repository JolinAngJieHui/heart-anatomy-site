import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as three from 'three';
import { scanGeometry } from './helpers/scan-geometry.mjs';
import { load } from './helpers/load-module.mjs';
const { VESSEL_HIGHLIGHT_OPACITY } = load('lib/vessel-highlight.ts');
const tintedRed = new three.Color('#ffffff').lerp(new three.Color('#ef4444'), VESSEL_HIGHLIGHT_OPACITY).getHexString();
const config = JSON.parse(fs.readFileSync('public/models/heart-model.json'));
const { root } = await scanGeometry(`public${config.url}`);
const cpu = load('lib/imported-model.ts', { three }).prepareImportedModel(root, config);
const meshes = []; root.traverse(o => { if (o.isMesh) meshes.push(o); });
function probe(id, f, isolated) {
  cpu.applySelection(null, null, isolated ? id : null);
  const camera = new three.PerspectiveCamera(f.fov, f.viewport.width / f.viewport.height, .1, 1000);
  camera.position.fromArray(f.position); camera.quaternion.fromArray(f.quaternion); camera.zoom = f.zoom;
  camera.setViewOffset(f.viewport.width, f.viewport.height, -f.offset.x, -f.offset.y, f.viewport.width, f.viewport.height); camera.updateMatrixWorld();
  const ray = new three.Raycaster();
  for (const [mesh, target] of cpu.owners) {
    if (!target.structureIds.includes(id)) continue;
    const position = mesh.geometry.attributes.position, index = mesh.geometry.index;
    for (let face = 0; face < index.count / 3; face += Math.max(1, Math.floor(index.count / 3 / 1200))) {
      const point = new three.Vector3();
      for (let j = 0; j < 3; j++) point.add(new three.Vector3().fromBufferAttribute(position, index.getX(face * 3 + j)));
      const p = mesh.localToWorld(point.multiplyScalar(1 / 3)).project(camera);
      if (Math.abs(p.x) > .9 || Math.abs(p.y) > .85) continue;
      const x = Math.round((p.x + 1) * f.viewport.width / 2), y = Math.round((1 - p.y) * f.viewport.height / 2);
      if (f.obstacles.some(r => x >= r.x - 15 && x <= r.x + r.width + 15 && y >= r.y - 15 && y <= r.y + r.height + 15)) continue;
      if ([[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]].every(([dx, dy]) => {
        ray.setFromCamera(new three.Vector2((x + dx) / f.viewport.width * 2 - 1, 1 - (y + dy) / f.viewport.height * 2), camera);
        const hit = ray.intersectObjects(meshes, false)[0];
        return hit && cpu.owners.get(hit.object)?.structureIds.includes(id);
      })) return { x, y };
    }
  }
  throw Error(`No stable surface probe for ${id}`);
}
const { chromium } = await import(new URL('../.next/cache/browser-tools/node_modules/playwright/index.mjs', import.meta.url).href);
const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const directory = 'artifacts/isolation'; fs.mkdirSync(directory, { recursive: true });
const report = { checks: [], errors: [], externalRequests: [] }; let page;
try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 });
  await context.route('**/*', route => {
    const url = new URL(route.request().url());
    if (!['localhost', '127.0.0.1'].includes(url.hostname)) { report.externalRequests.push(url.href); return route.abort(); }
    if (url.pathname === '/api/chat') {
      const input = route.request().postDataJSON();
      return route.fulfill({ json: { schemaVersion: 1, answer: 'Waiting for viewer navigation.', sources: [], mode: 'review', status: 'navigation', selectedStructureId: input.selectedStructureId, learningLevel: input.learningLevel,
        navigation: { id: 'isolation-navigation-test', command: { type: 'focus_structure', structureId: 'left-marginal-artery' } } } });
    }
    if (url.pathname.startsWith('/api/')) return route.fulfill({ json: { mode: 'basic', reason: 'disabled', sources: [], passages: [], gaps: [] } });
    return route.continue();
  });
  page = await context.newPage(); page.setDefaultTimeout(20000); await page.emulateMedia({ reducedMotion: 'reduce' });
  page.on('pageerror', error => report.errors.push(error.message));
  await page.goto(process.env.EXPLORER_TEST_URL ?? 'http://localhost:3000', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.scene-surface[data-model-kind="imported"]', { timeout: 90000 });
  const frame = () => page.locator('.scene-surface').evaluate(el => JSON.parse(el.dataset.framing));
  const materials = () => page.locator('.scene-surface').evaluate(el => JSON.parse(el.dataset.modelMaterials));
  const settle = async () => { await page.waitForTimeout(250); await page.waitForFunction(() => !JSON.parse(document.querySelector('.scene-surface').dataset.framing).moving); };
  const switchControl = page.getByRole('switch', { name: 'Isolate Structure', exact: true });
  const progress = () => page.locator('[aria-label="Anatomical exploration"]').getAttribute('aria-valuenow');
  await settle(); const original = await materials();
  const assertIsolated = async id => {
    await page.waitForFunction(id => JSON.parse(document.querySelector('.scene-surface').dataset.modelSelection).isolated === id, id);
    const current = await materials(); assert.equal(current.length, original.length);
    for (const mesh of current) {
      const base = original.find(m => m.name === mesh.name), own = mesh.structures.includes(id);
      assert.equal(mesh.visible, base.visible); assert.deepEqual(mesh.colors, base.colors, 'No turquoise/colour tint on any isolated-view mesh');
      assert.equal(mesh.isolationContext, !own); assert.equal(mesh.renderOrder, own ? 1 : 0);
      mesh.materials.forEach((m, i) => {
        for (const key of ['uuid', 'emissive', 'emissiveIntensity', 'roughness', 'metalness', 'map', 'normalMap']) assert.deepEqual(m[key], base.materials[i][key], `${mesh.name} preserves ${key}`);
        assert.equal(m.opacity, own ? 1 : .2); assert.equal(m.transparent, true); assert.equal(m.depthWrite, own); assert.equal(m.depthTest, true); assert.equal(m.forceSinglePass, true);
      });
    }
    assert.equal(await switchControl.getAttribute('aria-checked'), 'true');
  };
  const select = async id => { await page.locator(`[data-structure-id="${id}"]`).click(); await page.mouse.move(4, 4); await settle(); };
  const surfacePoint = async id => { const p = probe(id, await frame(), true), box = await page.locator('canvas').boundingBox(); return { x: p.x + box.x, y: p.y + box.y }; };
  await select('left-coronary-artery'); await switchControl.click(); await settle(); await assertIsolated('left-coronary-artery');
  await page.screenshot({ path: `${directory}/original-textured-vessel.png` });
  await page.getByRole('button', { name: 'Hide Markers', exact: true }).click(); await settle();
  for (const id of ['left-coronary-artery', 'left-anterior-descending-mid', 'right-coronary-middle', 'right-marginal-artery', 'left-marginal-artery']) {
    await select(id); await assertIsolated(id); const before = await progress();
    let point = await surfacePoint(id); await page.mouse.move(point.x, point.y); await settle(); await assertIsolated(id);
    point = await surfacePoint(id); await page.mouse.click(point.x, point.y); await settle(); await assertIsolated(id);
    assert.equal(await progress(), before, 'Clicking the isolated vessel does not invent or duplicate a segment visit');
    assert.equal(await page.locator('.vessel-segment-choices').count(), 0, 'Grouped vessel click does not leave isolation');
    await page.mouse.move(4, 4);
    await page.screenshot({ path: `${directory}/${id}.png` });
  }
  report.checks.push('Original colour, emissive, textures, normal maps and shading preserved on every component; isolated opacity 1, context opacity .2. Actual surface hover/click retains isolation for both combined arteries and marginal vessels.');
  const finalId = 'left-marginal-artery';
  for (let i = 0; i < 8; i++) {
    await switchControl.click(); await settle();
    const normal = await materials();
    for (const mesh of normal) {
      const base = original.find(m => m.name === mesh.name); assert.equal(mesh.isolationContext, false); assert.equal(mesh.renderOrder, base.renderOrder);
      mesh.materials.forEach((m, index) => { for (const key of ['uuid', 'opacity', 'transparent', 'depthWrite', 'depthTest', 'forceSinglePass', 'map', 'normalMap']) assert.deepEqual(m[key], base.materials[index][key]); });
      assert.ok(mesh.colors.every(c => c === (mesh.structures.includes(finalId) ? tintedRed : 'ffffff')));
    }
    await switchControl.click(); await settle(); await assertIsolated(finalId);
  }
  const frozen = await page.locator('.scene-surface').getAttribute('data-render-frame'); await page.waitForTimeout(450);
  assert.equal(await page.locator('.scene-surface').getAttribute('data-render-frame'), frozen, 'No continuous rendering while idle');
  report.checks.push('Repeated toggles restore normal rendering and highlighting, reuse the same material/texture IDs, and do not introduce an animation loop.');
  const box = await page.locator('canvas').boundingBox();
  const beforeRotation = await frame(); await page.mouse.move(box.x + 70, box.y + 80); await page.mouse.down(); await page.mouse.move(box.x + 125, box.y + 115, { steps: 15 }); await page.mouse.up(); await settle();
  assert.notDeepEqual((await frame()).quaternion, beforeRotation.quaternion); await assertIsolated(finalId);
  await page.getByRole('button', { name: 'Ask AI Tutor', exact: true }).click(); await settle();
  await select('right-marginal-artery'); await assertIsolated('right-marginal-artery');
   await page.locator('#tutor-question').fill('Show the left marginal artery'); await page.locator('#tutor-question').press('Enter');
  await page.waitForFunction(() => document.querySelector('.tutor-answer')?.textContent.includes('Opened')); await settle(); await assertIsolated(finalId);
  await page.getByRole('button', { name: 'Close AI Anatomy Tutor', exact: true }).click(); await settle();
  await page.getByRole('button', { name: 'Show Markers', exact: true }).click(); await settle();
  assert.ok(await page.locator(`[data-marker-id="${finalId}"]`).isVisible(), 'The selected marker is visible through translucent context');
  report.checks.push('Rotation and mocked Tutor navigation retain isolation; the newly selected vessel becomes opaque and its marker remains usable through context.');
  await page.getByRole('button', { name: 'Reset view', exact: true }).click(); await settle();
  assert.deepEqual(await materials(), original, 'Reset restores the complete original material state');
  const p = probe('left-coronary-artery', await frame(), false), canvas = await page.locator('canvas').boundingBox();
  await page.getByRole('button', { name: 'Hide Markers', exact: true }).click();
  await page.mouse.move(canvas.x + p.x, canvas.y + p.y); await settle();
  assert.ok((await materials()).filter(m => m.group === 'left-main-and-lad').every(m => m.colors.every(c => c === tintedRed)), 'Normal hover still works');
  await page.mouse.move(4, 4); await settle();
  await page.setViewportSize({ width: 390, height: 844 }); await settle(); await page.getByRole('button', { name: 'Reset view', exact: true }).click(); await settle();
  await select('left-coronary-artery'); await switchControl.focus(); await page.keyboard.press('Space'); await settle(); await assertIsolated('left-coronary-artery');
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false);
  await page.screenshot({ path: `${directory}/mobile.png` });
  report.checks.push('Reset, normal hover outside isolation, keyboard isolation toggle and mobile layout remain functional.');
  assert.deepEqual(report.errors, []); assert.deepEqual(report.externalRequests, []); report.passed = true;
} catch (error) {
  report.error = error.message; if (page) await page.screenshot({ path: `${directory}/failure.png` }).catch(() => {}); throw error;
} finally { fs.writeFileSync(`${directory}/browser-report.json`, JSON.stringify(report, null, 2)); await browser.close(); cpu.dispose(); }
console.log(JSON.stringify(report, null, 2));
