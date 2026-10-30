import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as three from 'three';
import { scanGeometry } from './helpers/scan-geometry.mjs';
import { load } from './helpers/load-module.mjs';
import { orientHeart } from './helpers/viewer-orbit.mjs';
const { prepareImportedModel } = load('lib/imported-model.ts', { three });
const { HEART_PARTS } = load('lib/heart-parts.ts');
const { vesselHighlightColor, VESSEL_HIGHLIGHT_OPACITY } = load('lib/vessel-highlight.ts');
const highlightColor = target => new three.Color('#ffffff').lerp(new three.Color(vesselHighlightColor(target.structureIds)), VESSEL_HIGHLIGHT_OPACITY).getHexString();
const config = JSON.parse(fs.readFileSync('public/models/heart-model.json'));
const audit = JSON.parse(fs.readFileSync('artifacts/final-model/anchor-audit.json'));
const { root } = await scanGeometry(`public${config.url}`), model = prepareImportedModel(root, config);
const targets = [...new Set(model.owners.values())];
const targetKey = target => target.groupId ?? target.structureIds[0];
const meshes = []; root.traverse(o => { if (o.isMesh) meshes.push(o); });
const samples = new Map();
for (const [mesh, target] of model.owners) {
  const position = mesh.geometry.getAttribute('position'), index = mesh.geometry.index;
  const points = samples.get(target) ?? [], count = index ? index.count : position.count;
  const stride = Math.max(1, Math.floor(count / 3 / 300));
  for (let face = 0; face < count / 3; face += stride) {
    const point = new three.Vector3();
    for (let j = 0; j < 3; j++) point.add(new three.Vector3().fromBufferAttribute(position, index ? index.getX(face * 3 + j) : face * 3 + j));
    points.push({ point: mesh.localToWorld(point.multiplyScalar(1 / 3)), mesh: mesh.name });
  }
  samples.set(target, points);
}
function findProbes(f, target) {
  const camera = new three.PerspectiveCamera(f.fov, f.viewport.width / f.viewport.height, .1, 1000);
  camera.position.fromArray(f.position); camera.quaternion.fromArray(f.quaternion); camera.zoom = f.zoom;
  camera.setViewOffset(f.viewport.width, f.viewport.height, -f.offset.x, -f.offset.y, f.viewport.width, f.viewport.height); camera.updateMatrixWorld();
  const ray = new three.Raycaster(), probes = new Map();
  for (const { point, mesh } of samples.get(target)) {
    if (probes.has(mesh)) continue;
    const projected = point.clone().project(camera);
    if (Math.abs(projected.x) > .85 || Math.abs(projected.y) > .8) continue;
    const x = Math.round((projected.x + 1) * f.viewport.width / 2), y = Math.round((1 - projected.y) * f.viewport.height / 2);
    // Browser pointer coordinates can round to a pixel. Require a small visible
    // interior, not a triangle centroid on a sub-pixel occlusion boundary.
    const interior = [[0, 0], [-1, 0], [1, 0], [0, -1], [0, 1]].every(([dx, dy]) => {
      ray.setFromCamera(new three.Vector2((x + dx) / f.viewport.width * 2 - 1, 1 - (y + dy) / f.viewport.height * 2), camera);
      const hit = ray.intersectObjects(meshes, false)[0];
      return hit && model.owners.get(hit.object) === target;
    });
    if (interior) probes.set(mesh, { x, y, mesh });
  }
  return [...probes.values()];
}
const { chromium } = await import(new URL('../.next/cache/browser-tools/node_modules/playwright/index.mjs', import.meta.url).href);
const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const directory = 'artifacts/final-model', report = { checks: [], vessels: [], markers: [], errors: [], externalRequests: [], modelRequests: [] };
let page;
try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 });
  await context.route('**/*', route => {
    const url = new URL(route.request().url());
    if (!['localhost', '127.0.0.1'].includes(url.hostname)) { report.externalRequests.push(url.href); return route.abort(); }
    if (url.pathname.startsWith('/api/')) return route.fulfill({ json: { mode: 'basic', reason: 'disabled', sources: [], passages: [], gaps: [] } });
    if (url.pathname.endsWith('.glb')) report.modelRequests.push(url.pathname);
    return route.continue();
  });
  page = await context.newPage(); page.setDefaultTimeout(15000);
  page.on('pageerror', error => report.errors.push(error.message));
  await page.goto('http://localhost:3000', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.scene-surface[data-model-kind="imported"]', { timeout: 90000 });
  const frame = () => page.locator('.scene-surface').evaluate(el => JSON.parse(el.dataset.framing));
  const settle = async () => { await page.waitForTimeout(650); await page.waitForFunction(() => !JSON.parse(document.querySelector('.scene-surface').dataset.framing).moving); };
  const reset = async () => { await page.getByRole('button', { name: 'Reset view', exact: true }).click(); await page.mouse.move(4, 4); await settle(); };
  const progress = async () => Number(await page.locator('[aria-label="Anatomical exploration"]').getAttribute('aria-valuenow'));
  const materials = () => page.locator('.scene-surface').evaluate(el => JSON.parse(el.dataset.modelMaterials));
  const highlighted = async (target, color) => {
    const ids = target.structureIds;
    await page.waitForFunction(({ ids, color }) => {
      const materials = JSON.parse(document.querySelector('.scene-surface').dataset.modelMaterials);
      return materials.filter(m => m.structures.some(id => ids.includes(id))).every(m => m.colors.every(c => c === color));
    }, { ids, color });
    const all = await materials(), own = all.filter(m => m.structures.some(id => ids.includes(id)));
    assert.equal(own.length, [...model.owners].filter(([, t]) => t === target).length);
    assert.ok(all.filter(m => !m.structures.some(id => ids.includes(id))).every(m => m.colors.every(c => c === 'ffffff')), 'Other vessels/context retain original materials');
  };
  await settle();
  report.initial = { frame: await frame(), render: JSON.parse(await page.locator('.scene-surface').getAttribute('data-render-stats')) };
  assert.equal(report.initial.render.triangles, audit.triangles); assert.equal(report.initial.render.drawCalls, audit.drawCalls);
  assert.equal(await page.locator('.anatomy-marker').count(), HEART_PARTS.length);
  assert.deepEqual(model.warnings, [], 'Every configured mesh and anchor resolves unambiguously');
  const missingAnchors = HEART_PARTS.filter(part => !model.registry.has(part.id));
  assert.equal(missingAnchors.length, 0, 'Revised export supplies all 17 marker anchors');
  assert.equal(await page.locator('.model-status').count(), 0, 'No outdated missing-marker notice');
  for (const part of missingAnchors) assert.equal(await page.locator(`[data-marker-id="${part.id}"]`).isVisible(), false, 'Missing anchors are never placed on unrelated tissue');
  await page.screenshot({ path: `${directory}/installed.png` });
  await page.getByRole('button', { name: 'Hide Markers', exact: true }).click();
  for (const target of targets) {
    await reset(); let found;
    const preferred = audit.anchors.find(a => a.id === target.structureIds[0]).visibleViews;
    const views = [...preferred.filter((_, i) => i % 4 === 0), ...preferred];
    for (const view of views) {
      await orientHeart(page, view.azimuth, view.elevation);
      const probes = findProbes(await frame(), target);
      if (probes.length) { found = { view, probes }; break; }
    }
    assert.ok(found, `A visible surface was found for ${target.label}`);
    const box = await page.locator('canvas').boundingBox(), before = await progress();
    for (const probe of found.probes) {
      await page.mouse.move(box.x + probe.x, box.y + probe.y); await highlighted(target, highlightColor(target));
      assert.equal(await page.locator('.vessel-highlight-label strong').innerText(), target.label);
      assert.equal(await progress(), before, 'Hover never records exploration');
    }
    await page.screenshot({ path: `${directory}/hover-${targetKey(target)}.png` });
    await page.mouse.move(4, 4); await highlighted(target, 'ffffff');
    const probe = found.probes[0], x = box.x + probe.x, y = box.y + probe.y;
    // A drag starting on the actual labelled mesh must not select it.
    await page.mouse.move(x, y); await page.mouse.down(); await page.mouse.move(x + 35, y + 20, { steps: 10 }); await page.mouse.up(); await page.mouse.move(4, 4);
    assert.equal(await progress(), before); assert.equal(await page.locator('.information-overlay').isVisible(), false);
    await orientHeart(page, found.view.azimuth, found.view.elevation);
    const clickProbe = findProbes(await frame(), target)[0]; assert.ok(clickProbe);
    await page.mouse.click(box.x + clickProbe.x, box.y + clickProbe.y); await settle();
    if (target.groupId) {
      await page.locator('.vessel-segment-choices').waitFor();
      assert.equal(await progress(), before, 'Opening segment choices is not a segment visit');
      const choices = await page.locator('[data-vessel-segment]').evaluateAll(els => els.map(el => el.dataset.vesselSegment));
      assert.deepEqual(choices, target.structureIds);
      await page.locator(`[data-vessel-segment="${target.structureIds[1]}"]`).click(); await settle();
      assert.equal(await page.locator('#detail-title').innerText(), HEART_PARTS.find(p => p.id === target.structureIds[1]).name);
    } else assert.equal(await page.locator('#detail-title').innerText(), target.label);
    assert.equal(await progress(), before + 1); await page.mouse.move(4, 4); await highlighted(target, highlightColor(target));
    await page.getByRole('button', { name: 'advanced', exact: true }).click();
    assert.match(await page.locator('.information-overlay').innerText(), /Advanced Explanation/);
    await page.getByRole('button', { name: 'basic', exact: true }).click();
    if (target.groupId === 'left-main-and-lad') {
      assert.deepEqual(target.structureIds.map(id => HEART_PARTS.find(p => p.id === id).number), [5, 6, 7, 8]);
      // Exercise each choice on the real combined mesh, not just the first LAD
      // segment. Every choice highlights both primitives but records one ID.
      for (const id of target.structureIds.filter(id => id !== target.structureIds[1])) {
        await reset(); await orientHeart(page, found.view.azimuth, found.view.elevation);
        const current = await progress(), probe = findProbes(await frame(), target)[0]; assert.ok(probe);
        await page.mouse.click(box.x + probe.x, box.y + probe.y); await settle();
        assert.equal(await progress(), current);
        if (id === target.structureIds[0]) {
          assert.equal(await page.locator('[data-vessel-segment]:focus').getAttribute('data-vessel-segment'), id);
          await page.screenshot({ path: `${directory}/left-main-lad-choices.png` });
          await page.keyboard.press('Escape'); await settle();
          assert.equal(await page.locator('.vessel-segment-choices').count(), 0); assert.equal(await progress(), current);
          // Deselecting can reframe the camera; pick from its current pose.
          const reopened = findProbes(await frame(), target)[0]; assert.ok(reopened);
          await page.mouse.click(box.x + reopened.x, box.y + reopened.y); await settle();
          await page.locator('.vessel-segment-choices').waitFor();
          assert.equal(await page.locator('[data-vessel-segment]:focus').getAttribute('data-vessel-segment'), id);
          await page.keyboard.press('Enter');
        } else await page.locator(`[data-vessel-segment="${id}"]`).click();
        await settle(); await page.mouse.move(4, 4);
        assert.equal(await page.locator('#detail-title').innerText(), HEART_PARTS.find(p => p.id === id).name);
        assert.equal(await progress(), current + 1); await highlighted(target, highlightColor(target));
      }
      report.checks.push('Combined left main/LAD: all choices 5–8 open their own information and record only that structure; each highlights the same complete mesh. Keyboard Enter and Escape work.');
    }
    report.vessels.push({ id: targetKey(target), label: target.label, primitives: found.probes.map(p => p.mesh), view: found.view });
  }
  report.checks.push('Every enabled vessel: real surface hover, correct tooltip, all associated materials, restored textures, drag protection, direct click or approved segment choices, learning level and unique progress.');
  await reset(); await page.getByRole('button', { name: 'Show Markers', exact: true }).click();
  for (const anchor of audit.anchors) {
    await reset();
    const visible = page.locator(`[data-marker-id="${anchor.id}"]`);
    const neighbours = v => anchor.visibleViews.filter(p => Math.abs(p.elevation - v.elevation) <= 15 && Math.abs(Math.atan2(Math.sin((p.azimuth - v.azimuth) * Math.PI / 180), Math.cos((p.azimuth - v.azimuth) * Math.PI / 180))) < .27).length;
    let shown = false;
    for (const view of [...anchor.visibleViews].sort((a, b) => neighbours(b) - neighbours(a)).slice(0, 15)) {
      await orientHeart(page, view.azimuth, view.elevation);
      if (await visible.isVisible()) { shown = true; break; }
    }
    assert.ok(shown, `Marker ${anchor.number} can be exposed`);
    await visible.click(); await settle();
    assert.equal(await page.locator('#detail-title').innerText(), HEART_PARTS.find(p => p.id === anchor.id).name);
    assert.equal(await visible.getAttribute('data-explored'), 'true');
    const combined = model.groups.get('left-main-and-lad');
    if (combined?.structureIds.includes(anchor.id)) {
      await page.mouse.move(4, 4); await highlighted(combined, highlightColor(combined));
    }
    const before = await progress();
    await page.locator(`[data-structure-id="${anchor.id}"]`).click({ force: true }); await settle(); assert.equal(await progress(), before);
    report.markers.push({ id: anchor.id, number: anchor.number, verified: true });
  }
  for (const part of missingAnchors) {
    await reset();
    await page.locator(`[data-structure-id="${part.id}"]`).click(); await settle();
    assert.equal(await page.locator('#detail-title').innerText(), part.name);
    assert.equal(await page.locator(`[data-marker-id="${part.id}"]`).isVisible(), false);
    assert.equal(await page.getByRole('switch', { name: 'Isolate Structure' }).isDisabled(), true);
    report.markers.push({ id: part.id, number: part.number, verified: 'Catalogue information available; no invented 3D marker' });
  }
  assert.equal(await progress(), HEART_PARTS.length);
  report.checks.push(`${audit.anchors.length} anchored markers become visible from exposed views and open their original information. All ${HEART_PARTS.length} catalogue entries remain accessible; repeat selections do not increase progress.`);
  await reset();
  for (const [name, azimuth, elevation] of [['front', 0, 0], ['back', 180, 0], ['side', 90, 0], ['top', 0, 87], ['under', 0, -87]]) {
    await orientHeart(page, azimuth, elevation);
    const visibility = await page.locator('.scene-surface').evaluate(el => JSON.parse(el.dataset.markerVisibility));
    const hidden = new Set(visibility.anchors.filter(a => !a.visible).map(a => a.id));
    for (const id of hidden) assert.equal(await page.locator(`[data-marker-id="${id}"]`).isVisible(), false);
    await page.screenshot({ path: `${directory}/view-${name}.png` });
  }
  report.checks.push('Front/back/side/top/underside: occluded marker buttons disappear while textures and lighting remain present.');
  await reset(); await page.setViewportSize({ width: 390, height: 844 }); await settle(); await reset();
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false);
  await page.screenshot({ path: `${directory}/mobile.png` });
  const leftGroup = targets.find(target => target.groupId === 'left-main-and-lad');
  if (leftGroup) {
    await page.getByRole('button', { name: 'Hide Markers', exact: true }).click();
    const view = report.vessels.find(v => v.id === leftGroup.groupId).view;
    await orientHeart(page, view.azimuth, view.elevation);
    const probe = findProbes(await frame(), leftGroup)[0], box = await page.locator('canvas').boundingBox(); assert.ok(probe);
    await page.mouse.click(box.x + probe.x, box.y + probe.y); await settle();
    assert.equal(await page.locator('[data-vessel-segment]').count(), 4);
    const panel = await page.locator('.vessel-segment-choices').boundingBox();
    assert.ok(panel.x >= box.x && panel.x + panel.width <= box.x + box.width + 1);
    assert.ok(panel.y >= box.y && panel.y + panel.height <= box.y + box.height + 1);
    await page.screenshot({ path: `${directory}/left-main-lad-mobile-choices.png` });
    await page.locator('[data-vessel-segment="left-anterior-descending-apical"]').click(); await settle();
    assert.equal(await page.locator('#detail-title').innerText(), HEART_PARTS.find(p => p.id === 'left-anterior-descending-apical').name);
    assert.equal(await progress(), HEART_PARTS.length, 'Mobile revisits do not add duplicate progress');
    report.checks.push('On mobile, all four left main/LAD choices remain within the viewer and the final choice can be reached by scrolling.');
  }
  assert.ok(report.modelRequests.every(url => url === config.url), 'Only the new GLB was requested');
  assert.deepEqual(report.errors, []); assert.deepEqual(report.externalRequests, []); report.passed = true;
} catch (error) {
  report.error = error.message;
  if (page) report.failureState = await page.locator('.scene-surface').evaluate(el => ({ selection: el.dataset.modelSelection, framing: el.dataset.framing })).catch(() => null);
  if (page) await page.screenshot({ path: `${directory}/browser-failure.png` }).catch(() => {});
  throw error;
} finally { fs.writeFileSync(`${directory}/browser-report.json`, JSON.stringify(report, null, 2)); await browser.close(); model.dispose(); }
console.log(JSON.stringify(report, null, 2));
