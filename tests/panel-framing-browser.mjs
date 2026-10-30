import assert from "node:assert/strict";
import fs from "node:fs";
const { chromium } = await import(new URL("../.next/cache/browser-tools/node_modules/playwright/index.mjs", import.meta.url).href);
const browser = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true, args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
try {
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
  // This suite verifies the established 17 schematic anchors independently of
  // whichever scan is installed. Imported-model coverage has its own fixtures.
  await page.route('**/models/heart-model.json', route => route.fulfill({ json: { version: 1, url: null, rotationDegrees: [0,0,0], structures: {} } }));
  const errors = []; page.on("pageerror", error => errors.push(error.message));
  await page.goto(process.env.EXPLORER_TEST_URL ?? "http://127.0.0.1:3100", { waitUntil: "networkidle" });
  await page.locator("canvas").waitFor();
  const read = () => page.locator(".scene-surface").evaluate(el => JSON.parse(el.dataset.framing));
  const settle = async (selectedId) => {
    await page.waitForFunction(id => {
      const view = document.querySelector(".scene-surface");
      if (!view?.dataset.framing) return false;
      const d = JSON.parse(view.dataset.framing), r = view.getBoundingClientRect();
      return d.measured && !d.moving && d.cardOpen === !document.querySelector(".information-overlay").hidden
        && d.tutorOpen === !document.querySelector("#anatomy-tutor").hidden
        && Math.abs(d.viewport.width - r.width) < 3 && Math.abs(d.viewport.height - r.height) < 3
        && (id === undefined || d.selectedId === id);
    }, selectedId);
    await page.waitForTimeout(140);
    const result = await read();
    // Reselecting the same ID can initially expose the preceding diagnostic
    // sample. Observe the next sample before declaring the new pan complete.
    return result.moving ? settle(selectedId) : result;
  };
  const orientation = (a, b) => {
    for (const key of ["quaternion", "position", "target"]) a[key].forEach((v, i) => assert.ok(Math.abs(v - b[key][i]) < .00001, `${key} preserved`));
    assert.ok(Math.abs(a.distance - b.distance) < .00001); assert.equal(a.zoom, b.zoom); assert.equal(a.fov, b.fov);
  };
  const targeted = async d => {
    const point = await page.locator(".anatomy-marker.selected").evaluate(el => ({ x: parseFloat(el.style.left), y: parseFloat(el.style.top), hidden: el.hidden }));
    assert.equal(point.hidden, false);
    assert.ok(Math.abs(point.x - d.region.x - d.region.width / 2) < 2, JSON.stringify({ point, d }));
    assert.ok(Math.abs(point.y - d.region.y - d.region.height / 2) < 2, JSON.stringify({ point, d }));
    for (const obstacle of d.obstacles) assert.ok(point.x < obstacle.x || point.x > obstacle.x + obstacle.width || point.y < obstacle.y || point.y > obstacle.y + obstacle.height, "selected marker outside overlays");
    await page.waitForFunction(() => {
      const marker = document.querySelector(".anatomy-marker.selected"), line = document.querySelector(".information-leader"), root = document.querySelector(".information-overlay");
      if (!marker || marker.hidden || line.style.display === "none") return false;
      const m = marker.getBoundingClientRect(), r = root.getBoundingClientRect();
      return Math.abs(Number(line.getAttribute("x1")) - m.x - m.width / 2 + r.x) < 2 && Math.abs(Number(line.getAttribute("y1")) - m.y - m.height / 2 + r.y) < 2;
    });
  };
  const snapshots = [];
  const initial = await settle(null);
  let current = initial;
  assert.equal(await page.getByRole("button", { name: /selected label/i }).count(), 0);
  if (process.env.CAMERA_TEST_PHASE !== "responsive") {
  await page.evaluate(() => {
    window.panTrace = [];
    const capture = () => {
      const raw = document.querySelector(".scene-surface")?.dataset.framing;
      if (raw) window.panTrace.push({ at: performance.now(), ...JSON.parse(raw) });
      window.panFrame = requestAnimationFrame(capture);
    }; capture();
  });
  await page.locator('[data-marker-id="right-coronary-middle"]').click();
  current = await settle("right-coronary-middle");
  await targeted(current); orientation(initial, current);
  assert.equal(current.transactions - initial.transactions, 1, "selection and card opening share one animation");
  const trace = await page.evaluate(() => { cancelAnimationFrame(window.panFrame); return window.panTrace; });
  const offsets = [...new Map(trace.map(d => [JSON.stringify(d.offset), d.offset])).values()];
  assert.ok(offsets.length >= 3, `intermediate animation positions between the endpoints: ${offsets.length}`);
  for (let i = 1; i < offsets.length; i++) {
    const delta = current.offset.x - initial.offset.x;
    assert.ok((offsets[i].x - offsets[i - 1].x) * Math.sign(delta) >= -.1, "no overshoot or shaking");
    assert.ok(Math.abs(offsets[i].x - offsets[i - 1].x) < Math.abs(delta) * .85, "no one-frame jump to destination");
  }
  snapshots.push({ name: "marker centred beside card", ...current });
  console.log("Smooth marker selection and connected leader passed");
  const inventory = await page.locator("[data-structure-id]").evaluateAll(els => els.map(el => ({ id: el.dataset.structureId, name: el.querySelector(".structure-name").childNodes[0].textContent })));
  for (const entry of inventory) {
    await page.locator(`[data-structure-id="${entry.id}"]`).click();
    current = await settle(entry.id); await targeted(current); orientation(initial, current);
    assert.equal(await page.locator("#detail-title").innerText(), entry.name);
    if (await page.locator(".achievement-toast").count()) { await page.getByRole("button", { name: "Dismiss achievement", exact: true }).click(); await page.locator(".achievement-toast").waitFor({ state: "hidden" }); current = await settle(entry.id); }
  }
  // Real marker clicks use the same target as list clicks for all 17 IDs.
  for (const entry of inventory) {
    await page.getByRole("button", { name: "Reset view", exact: true }).click(); await settle(null);
    const marker = page.locator(`[data-marker-id="${entry.id}"]`);
    await marker.hover(); assert.ok(await marker.locator("[role=tooltip]").isVisible());
    await marker.click(); current = await settle(entry.id); await targeted(current);
    assert.equal(await page.locator("#detail-title").innerText(), entry.name);
  }
  console.log("All 17 list and marker selections passed");
  await page.evaluate(ids => {
    ids.forEach((id, i) => setTimeout(() => document.querySelector(`[data-structure-id="${id}"]`).click(), i * 65));
  }, inventory.slice(0, 8).map(e => e.id));
  await page.waitForTimeout(550); current = await settle(inventory[7].id); await targeted(current); orientation(initial, current);
  await page.waitForTimeout(1100);
  const stationary = await read(); assert.deepEqual(stationary.offset, current.offset); assert.equal(stationary.transactions, current.transactions);
  await page.getByRole("button", { name: "advanced", exact: true }).click();
  assert.equal((await settle()).transactions, current.transactions);
  await page.getByRole("button", { name: "Ask AI Tutor", exact: true }).click();
  current = await settle(inventory[7].id); await targeted(current); orientation(initial, current);
  snapshots.push({ name: "card and tutor", ...current });
  await page.screenshot({ path: ".next/cache/selection-tutor-desktop.png" });
  await page.getByLabel("Your anatomy question", { exact: true }).fill("What does this structure connect to?");
  await page.waitForTimeout(600); assert.deepEqual((await read()).offset, current.offset);
  console.log("Rapid interruption, rest, learning levels and tutor passed");
  const canvas = await page.locator("canvas").boundingBox();
  await page.mouse.move(canvas.x + 24, canvas.y + 24); await page.mouse.wheel(0, -120);
  await page.waitForTimeout(900); const zoomed = await read(); assert.ok(zoomed.distance < current.distance);
  await page.locator('[data-structure-id="left-diagonal-d1"]').click(); current = await settle("left-diagonal-d1"); await targeted(current); orientation(zoomed, current);
  await page.mouse.move(canvas.x + 24, canvas.y + 24); await page.mouse.down();
  await page.mouse.move(canvas.x + 110, canvas.y + 44, { steps: 10 }); await page.mouse.up();
  let rotated = await read(), steady = 0;
  for (let i = 0; i < 120 && steady < 3; i++) {
    await page.waitForTimeout(120); const next = await read();
    steady = next.quaternion.every((v, j) => Math.abs(v - rotated.quaternion[j]) < .00000001) ? steady + 1 : 0;
    rotated = next;
  }
  assert.equal(steady, 3, "manual damping settles");
  assert.ok(rotated.quaternion.some((v, i) => Math.abs(v - current.quaternion[i]) > .02));
  await page.locator('[data-structure-id="left-diagonal-d1"]').click(); current = await settle("left-diagonal-d1"); await targeted(current); orientation(rotated, current);
  const progress = await page.getByRole("progressbar").getAttribute("aria-valuenow");
  const history = await page.evaluate(() => localStorage.getItem("heart-anatomy:learning-sessions:v1"));
  await page.getByRole("switch", { name: "Isolate Structure", exact: true }).click();
  await page.getByRole("button", { name: "Reset view", exact: true }).click(); current = await settle(null);
  assert.ok(await page.locator(".information-overlay").isHidden()); assert.ok(await page.locator("#anatomy-tutor").isVisible());
  assert.equal(await page.locator(".anatomy-marker.selected").count(), 0);
  assert.equal(await page.getByRole("switch", { name: "Isolate Structure", exact: true }).getAttribute("aria-checked"), "false");
  assert.equal(await page.getByRole("progressbar").getAttribute("aria-valuenow"), progress);
  assert.equal(await page.evaluate(() => localStorage.getItem("heart-anatomy:learning-sessions:v1")), history);
  orientation(initial, current);
  console.log("Manual rotation/zoom and reset semantics passed");
  // Manual input during a pan cancels it; ending the gesture must not snap back.
  await page.locator('[data-structure-id="right-coronary-middle"]').evaluate(el => el.click());
  await page.waitForFunction(() => JSON.parse(document.querySelector('.scene-surface').dataset.framing).moving);
  const manualCanvas = await page.locator('canvas').boundingBox();
  await page.mouse.move(manualCanvas.x + 22, manualCanvas.y + 22); await page.mouse.down();
  await page.mouse.move(manualCanvas.x + 50, manualCanvas.y + 35, { steps: 4 }); await page.mouse.up();
  await page.waitForTimeout(200); const interrupted = await read();
  await page.waitForTimeout(600); const afterInterrupt = await read();
  assert.equal(afterInterrupt.moving, false); assert.deepEqual(afterInterrupt.offset, interrupted.offset);
  assert.equal(afterInterrupt.transactions, interrupted.transactions);
  await page.getByRole('button', { name: 'Reset view', exact: true }).click(); await settle(null);
  } else {
    await page.getByRole('button', { name: 'Ask AI Tutor', exact: true }).click(); await settle(null);
  }
  for (const viewport of [{ width: 1440, height: 900 }, { width: 1024, height: 768 }, { width: 768, height: 1024 }, { width: 390, height: 844 }, { width: 320, height: 568 }, { width: 844, height: 390 }]) {
    await page.getByRole("button", { name: "Close AI Anatomy Tutor" }).click();
    if (await page.locator('.information-overlay').isVisible()) await page.getByRole('button', { name: 'Close anatomical information', exact: true }).click();
    await page.setViewportSize(viewport);
    await page.locator('[data-structure-id="right-coronary-middle"]').click();
    current = await settle("right-coronary-middle"); await targeted(current);
    snapshots.push({ name: `${viewport.width}x${viewport.height} card`, ...current });
    await page.getByRole("button", { name: "Ask AI Tutor", exact: true }).click();
    current = await settle("right-coronary-middle"); await targeted(current);
    snapshots.push({ name: `${viewport.width}x${viewport.height} tutor`, ...current });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth && document.documentElement.scrollHeight <= innerHeight), true);
    await page.waitForTimeout(500); assert.deepEqual((await read()).offset, current.offset);
    await page.screenshot({ path: `.next/cache/selection-${viewport.width}.png` });
  }
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.getByRole('button', { name: 'Close AI Anatomy Tutor' }).click();
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.locator('[data-structure-id="coronary-sinus"]').focus(); await page.keyboard.press('Enter');
  current = await settle('coronary-sinus'); await targeted(current);
  await page.getByRole('button', { name: 'Reset view', exact: true }).click(); await settle(null);
  assert.ok(await page.locator('.information-overlay').isHidden());
  assert.deepEqual(errors, []);
  fs.writeFileSync("docs/stable-camera-framing-browser-report.json", JSON.stringify({ passed: true, phase: process.env.CAMERA_TEST_PHASE ?? "all", snapshots }, null, 2));
  console.log("Responsive camera targeting passed at six sizes, with and without tutor");
} finally { await browser.close(); }
