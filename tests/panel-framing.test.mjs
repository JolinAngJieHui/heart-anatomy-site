import assert from "node:assert/strict";
import { test } from "node:test";
import fs from "node:fs";
import ts from "typescript";
import { createRequire } from "node:module";
import path from "node:path";
const require = createRequire(import.meta.url);
function load(name) {
  const code = ts.transpileModule(fs.readFileSync(path.resolve("lib", name + ".ts"), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true, target: ts.ScriptTarget.ES2020 } }).outputText;
  const loaded = { exports: {} };
  new Function("exports", "module", "require", code)(loaded.exports, loaded, specifier => specifier.startsWith(".") ? load(specifier.slice(2)) : require(specifier));
  return loaded.exports;
}
const { planFraming, visibleFraction, freeRegions, area } = load("panel-framing");
const { dockInformationCard } = load("stable-card-layout");
const viewport = { x: 0, y: 0, width: 1000, height: 650 };
const model = { x: 300, y: 120, width: 370, height: 440 };
const marker = { x: 480, y: 330 };
test("left obstruction shifts right and right obstruction shifts left", () => {
  for (const [x, direction] of [[0, 1], [600, -1]]) {
    const p = planFraming({ model, viewport, marker, obstacles: [{ x, y: 0, width: 400, height: 650 }] });
    assert.ok(p.x * direction > 0); assert.ok(p.visibility >= .85); assert.ok(p.markerVisible);
  }
});
test("unselected framing centres the entire model", () => {
  assert.deepEqual([planFraming({ model, viewport, obstacles: [] }).x, planFraming({ model, viewport, obstacles: [] }).y], [15, -15]);
  const p = planFraming({ model, viewport, obstacles: [{ x: 0, y: 0, width: 315, height: 650 }] });
  assert.equal(model.x + model.width / 2 + p.x, p.region.x + p.region.width / 2);
  assert.equal(model.y + model.height / 2 + p.y, p.region.y + p.region.height / 2);
});
test("overlapping panels are counted once and free regions are disjoint", () => {
  const obstacles = [{ x: 0, y: 0, width: 600, height: 650 }, { x: 400, y: 0, width: 300, height: 650 }];
  assert.equal(visibleFraction(viewport, viewport, obstacles), .3);
  assert.equal(freeRegions(viewport, obstacles).reduce((n, r) => n + area(r), 0), 300 * 650);
});
test("two side panels use central space without scaling", () => {
  const p = planFraming({ model: { x: 170, y: 140, width: 350, height: 390 }, viewport, marker: { x: 400, y: 330 }, obstacles: [{ x: 0, y: 0, width: 280, height: 650 }, { x: 740, y: 0, width: 260, height: 650 }] });
  assert.ok(p.x > 0); assert.ok(p.visibility >= .85); assert.ok(p.markerVisible); assert.ok(!("scale" in p));
});
test("inset panels leave a full-height corridor between information and chat", () => {
  const obstacles = [{ x: 8, y: 90, width: 280, height: 400 }, { x: 740, y: 0, width: 260, height: 650 }];
  const p = planFraming({ model, viewport, obstacles });
  assert.deepEqual(p.region, { x: 298, y: 0, width: 432, height: 650 });
  assert.equal(model.x + model.width / 2 + p.x, 514);
  assert.equal(model.y + model.height / 2 + p.y, 325);
  assert.deepEqual(planFraming({ model, viewport, obstacles: [...obstacles].reverse() }).region, p.region);
});
test("a single inset information panel does not pull the heart vertically", () => {
  const p = planFraming({ model, viewport, obstacles: [{ x: 8, y: 160, width: 356, height: 400 }] });
  assert.deepEqual(p.region, { x: 374, y: 0, width: 626, height: 650 });
  assert.equal(model.y + model.height / 2 + p.y, viewport.height / 2);
});
test("narrow space centres the available region without changing scale", () => {
  const p = planFraming({ model: { x: 50, y: 30, width: 230, height: 230 }, viewport: { x: 0, y: 0, width: 340, height: 260 }, marker: { x: 170, y: 120 }, obstacles: [{ x: 0, y: 95, width: 340, height: 165 }] });
  assert.ok(p.limited); assert.ok(p.visibility < .65); assert.ok(!("scale" in p));
  assert.equal(170 + p.x, p.region.x + p.region.width / 2);
});
test("planner converges and does not chase its previous adjustment", () => {
  const obstacles = [{ x: 0, y: 0, width: 370, height: 650 }];
  const p = planFraming({ model, viewport, marker, obstacles });
  const next = planFraming({ model: { ...model, x: model.x + p.x, y: model.y + p.y }, viewport, marker: { x: marker.x + p.x, y: marker.y + p.y }, obstacles });
  assert.ok(Math.hypot(next.x, next.y) < 4);
});
test("closing a panel centres the whole viewport", () => {
  const p = planFraming({ model: { ...model, x: model.x + 160 }, viewport, obstacles: [] });
  assert.equal(model.x + 160 + model.width / 2 + p.x, viewport.width / 2); assert.ok(p.visibility >= .85);
});
test("each selected marker reaches the same unobstructed centre without scaling", () => {
  const options = { model, viewport, obstacles: [{ x: 600, y: 0, width: 400, height: 650 }] };
  const a = planFraming({ ...options, marker: { x: 400, y: 100 } });
  const b = planFraming({ ...options, marker: { x: 990, y: 600 } });
  assert.deepEqual(a.region, b.region);
  assert.deepEqual([400 + a.x, 100 + a.y], [990 + b.x, 600 + b.y]);
  assert.equal(400 + a.x, a.region.x + a.region.width / 2);
  assert.equal(100 + a.y, a.region.y + a.region.height / 2);
  assert.ok(a.markerVisible && b.markerVisible);
});
test("stable card reserves the left corridor and compact sheets fit their bounds", () => {
  const first = dockInformationCard(viewport, 356, 560, false);
  assert.equal(first.side, "right"); assert.equal(first.x + first.width, viewport.width - 8);
  const sheet = dockInformationCard({ x: 0, y: 0, width: 340, height: 260 }, 356, 120, true);
  assert.equal(sheet.side, "below"); assert.ok(sheet.x >= 0 && sheet.y + sheet.height <= 260);
});
test("projection offsets preserve world geometry, orbit direction and apparent size", () => {
  const { PerspectiveCamera, Group, Mesh, BoxGeometry, Vector3 } = require("three");
  const { modelScreenBounds } = load("model-screen-bounds");
  const root = new Group(); root.add(new Mesh(new BoxGeometry(2, 3, 1)));
  const camera = new PerspectiveCamera(40, 1000 / 650, .1, 100); camera.position.set(3, 2, 7); camera.lookAt(new Vector3());
  const before = modelScreenBounds(root, camera, 1000, 650), orientation = camera.quaternion.toArray();
  camera.setViewOffset(1000, 650, -140, 25, 1000, 650);
  const after = modelScreenBounds(root, camera, 1000, 650);
  assert.ok(Math.abs(after.x - before.x - 140) < .001); assert.ok(Math.abs(after.y - before.y + 25) < .001);
  assert.ok(Math.abs(after.width - before.width) < .001); assert.ok(Math.abs(after.height - before.height) < .001);
  assert.deepEqual(camera.quaternion.toArray(), orientation); assert.deepEqual(root.position.toArray(), [0, 0, 0]);
  root.children[0].visible = false; assert.equal(modelScreenBounds(root, camera, 1000, 650), null);
});
