import assert from "node:assert/strict";
import { test } from "node:test";
import fs from "node:fs";
import path from "node:path";
import ts from "typescript";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const requireModule = createRequire(import.meta.url);
const testDirectory = path.dirname(fileURLToPath(import.meta.url));

// Compile pure TypeScript modules in memory; no runner dependency or output files.
function loadModule(name) {
  const filename = path.join(testDirectory, "..", "lib", name + ".ts");
  const compiled = ts.transpileModule(fs.readFileSync(filename, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  const loadedModule = { exports: {} };
  new Function("exports", "module", "require", compiled)(loadedModule.exports, loadedModule, requireModule);
  return loadedModule.exports;
}
const { sceneReducer, INITIAL_SCENE } = loadModule("scene-state");
const { placeAnnotations } = loadModule("annotation-layout");
const { HEART_PARTS } = loadModule("heart-parts");
const { EDUCATION, LEARNING_LEVELS, REFERENCES } = loadModule("education");
const { placeMarkers } = loadModule("marker-layout");

test("document inventory has exactly 17 unique IDs, ordered names and numbers", () => {
  const expected = ["Right Coronary Artery (Proximal)", "Right Coronary Artery (Middle)", "Right Coronary Artery (Distal)", "Posterior Descending Artery", "Left Coronary Artery", "Left Anterior Descending (Proximal)", "Left Anterior Descending (Mid)", "Left Anterior Descending (Apical)", "Left Diagonal D1", "Left Diagonal D2", "Left Circumflex Artery", "Right Marginal Artery", "Right Conus Artery", "Left Marginal Artery", "Ascending Aorta", "Superior Vena Cava", "Coronary Sinus"];
  assert.deepEqual(HEART_PARTS.map((p) => p.name), expected);
  assert.deepEqual(HEART_PARTS.map((p) => p.number), Array.from({ length: 17 }, (_, i) => i + 1));
  assert.equal(new Set(HEART_PARTS.map((p) => p.id)).size, 17);
  assert.deepEqual(HEART_PARTS.slice(-3).map((p) => p.category), ["great-artery", "systemic-vein", "coronary-vein"]);
});
test("all 51 distinct explanations have blood-flow routes and valid reference keys", () => {
  assert.deepEqual(Object.keys(EDUCATION).sort(), HEART_PARTS.map((p) => p.id).sort());
  const explanations = [];
  for (const part of HEART_PARTS) {
    const entry = EDUCATION[part.id];
    for (const level of LEARNING_LEVELS) {
      assert.ok(entry[level].length > 80, `${part.id}: ${level}`);
      explanations.push(entry[level]);
    }
    assert.ok(entry.bloodFlow.length >= 3);
    assert.ok(entry.references.length >= 2);
    entry.references.forEach((id) => assert.equal(new URL(REFERENCES[id].url).protocol, "https:"));
    assert.equal(part.position, undefined);
  }
  assert.equal(explanations.length, 51);
  assert.equal(new Set(explanations).size, 51);
});
test("production anchors and mesh groups cover all 17 canonical IDs", () => {
  const config = JSON.parse(fs.readFileSync("public/models/heart-model.json", "utf8"));
  assert.deepEqual(Object.keys(config.structures).sort(), HEART_PARTS.map(p => p.id).sort());
  for (const value of Object.values(config.structures)) { assert.ok(value.anchor.node); assert.equal(value.anchor.position.length, 3); }
  const covered = new Set([...Object.entries(config.structures).filter(([,v]) => v.meshes.length).map(([id]) => id), ...Object.values(config.highlightGroups).flatMap(g => g.structures)]);
  assert.equal(covered.size, 17);
});
test("level switching preserves selection, isolation, camera and explored progress", () => {
  let state = sceneReducer(INITIAL_SCENE, { type: "select", id: "coronary-sinus" });
  state = sceneReducer(state, { type: "isolate" });
  state = sceneReducer(state, { type: "camera", kind: "zoom-in" });
  for (const level of LEARNING_LEVELS) {
    const next = sceneReducer(state, { type: "level", level });
    assert.equal(next.selectedId, state.selectedId);
    assert.equal(next.isolatedId, state.isolatedId);
    assert.equal(next.cameraRequest, state.cameraRequest);
    assert.equal(next.visitedIds, state.visitedIds);
    assert.equal(next.learningLevel, level);
  }
});
test("marker toggle preserves selection and camera; revisits do not increase progress", () => {
  let state = sceneReducer(INITIAL_SCENE, { type: "select", id: "coronary-sinus" });
  state = sceneReducer(state, { type: "select", id: "coronary-sinus" });
  assert.equal(state.visitedIds.length, 1);
  const next = sceneReducer(state, { type: "markers" });
  assert.equal(next.markersVisible, false);
  assert.equal(next.selectedId, state.selectedId);
  assert.equal(next.cameraRequest, state.cameraRequest);
});
test("clearing selection also exits isolation", () => {
  const selected = sceneReducer(INITIAL_SCENE, { type: "select", id: "right-coronary-proximal" });
  const isolated = sceneReducer(selected, { type: "isolate" });
  const cleared = sceneReducer(isolated, { type: "select", id: null });
  assert.equal(cleared.selectedId, null);
  assert.equal(cleared.isolatedId, null);
});
test("17 coincident markers declutter on desktop and small screens without overlapping targets", () => {
  for (const [width, height] of [[1000, 520], [768, 300], [292, 200], [362, 180]]) {
    const anchors = HEART_PARTS.map(({ id }) => ({ id, x: width / 2, y: height / 2 }));
    const placed = placeMarkers(anchors, width, height);
    assert.equal(placed.length, 17, `${width} x ${height}`);
    placed.forEach((marker, index) => {
      assert.ok(marker.markerX >= 20 && marker.markerX <= width - 20);
      assert.ok(marker.markerY >= 20 && marker.markerY <= height - 20);
      placed.slice(0, index).forEach((other) => assert.ok(Math.hypot(marker.markerX - other.markerX, marker.markerY - other.markerY) >= 36));
    });
  }
});
test("very small view prioritizes the selected input anchor without overlapping targets", () => {
  const anchors = HEART_PARTS.map(({ id }) => ({ id, x: 60, y: 30 }));
  const placed = placeMarkers(anchors, 120, 60);
  assert.equal(placed[0].id, anchors[0].id);
  assert.ok(placed.length < 17);
});

test("hover does not replace selection", () => {
  const selected = sceneReducer(INITIAL_SCENE, { type: "select", id: "right-coronary-proximal" });
  const state = sceneReducer(selected, { type: "hover", id: "ascending-aorta" });
  assert.equal(state.selectedId, "right-coronary-proximal");
  assert.equal(state.hoveredId, "ascending-aorta");
});
test("selection changes the isolated subject so sidebar navigation cannot select an invisible mesh", () => {
  const selected = sceneReducer(INITIAL_SCENE, { type: "select", id: "right-coronary-proximal" });
  let state = sceneReducer(selected, { type: "isolate" });
  state = sceneReducer(state, { type: "select", id: "left-coronary-artery" });
  assert.equal(state.selectedId, "left-coronary-artery");
  assert.equal(state.isolatedId, "left-coronary-artery");
  assert.equal(sceneReducer(state, { type: "show-all" }).isolatedId, null);
});
test("empty selection cancels panning and disables isolation", () => {
  const state = sceneReducer(INITIAL_SCENE, { type: "select", id: null });
  assert.equal(state.cameraRequest, null);
  assert.equal(sceneReducer(state, { type: "isolate" }), state);
});
test("selection, reselection and hover preserve the camera request", () => {
  let state = sceneReducer(INITIAL_SCENE, { type: "camera", kind: "zoom-in" });
  const request = state.cameraRequest;
  for (const id of ["coronary-sinus", "coronary-sinus", "ascending-aorta", null]) {
    state = sceneReducer(state, { type: "select", id });
    assert.equal(state.cameraRequest, request);
  }
  assert.equal(sceneReducer(state, { type: "hover", id: "ascending-aorta" }).cameraRequest, request);
  state = sceneReducer(state, { type: "camera", kind: "reset" });
  assert.equal(state.cameraRequest.sequence, request.sequence + 1);
});

test("reset clears selection, hover and isolation without erasing exploration or level", () => {
  let state = sceneReducer(INITIAL_SCENE, { type: "select", id: "ascending-aorta" });
  state = sceneReducer(state, { type: "isolate" });
  state = sceneReducer(state, { type: "hover", id: "ascending-aorta" });
  state = sceneReducer(state, { type: "level", level: "advanced" });
  const reset = sceneReducer(state, { type: "camera", kind: "reset" });
  assert.equal(reset.selectedId, null); assert.equal(reset.hoveredId, null); assert.equal(reset.isolatedId, null);
  assert.deepEqual(reset.visitedIds, ["ascending-aorta"]); assert.equal(reset.learningLevel, "advanced");
  assert.equal(reset.cameraRequest.kind, "reset");
});

test("whole-vessel hover and selection never record an arbitrary segment or explore every member", () => {
  let state = sceneReducer(INITIAL_SCENE, { type: "hover-group", id: "right-coronary-artery" });
  assert.equal(state.hoveredId, null); assert.deepEqual(state.visitedIds, []);
  state = sceneReducer(state, { type: "select-group", id: "right-coronary-artery" });
  assert.equal(state.selectedId, null); assert.deepEqual(state.visitedIds, []);
  state = sceneReducer(state, { type: "select", id: "right-coronary-middle" });
  assert.equal(state.selectedGroupId, null); assert.equal(state.hoveredGroupId, null);
  assert.deepEqual(state.visitedIds, ["right-coronary-middle"]);
  state = sceneReducer(state, { type: "select-group", id: "right-coronary-artery" });
  const reset = sceneReducer(state, { type: "camera", kind: "reset" });
  assert.equal(reset.selectedGroupId, null); assert.equal(reset.hoveredGroupId, null);
  assert.deepEqual(reset.visitedIds, ["right-coronary-middle"]);
});
test("crowded labels fit within desktop, tablet and mobile columns without vertical overlap", () => {
  for (const width of [292, 362, 768, 1080]) {
    const anchors = HEART_PARTS.map(({ id }, index) => ({ id, x: width * (index < 3 ? .35 : .65), y: 215 + index }));
    const placed = placeAnnotations(anchors, width, 440);
    assert.ok(placed.length >= 6);
    for (const side of ["left", "right"]) {
      const column = placed.filter((label) => label.side === side).sort((a, b) => a.labelY - b.labelY);
      column.forEach((label, index) => {
        assert.ok(label.labelY >= 28 && label.labelY <= 412);
        assert.ok(label.labelX >= 12 && label.labelX <= width - 12);
        if (index) assert.ok(label.labelY - column[index - 1].labelY >= 44);
      });
    }
  }
});

const { placeInformationCard } = loadModule("information-card-layout");
test("information card fits workspace edges and keeps its side during small camera movements", () => {
  const bounds = { x: 0, y: 0, width: 1000, height: 600 };
  const first = placeInformationCard(bounds, { x: 400, y: 300 }, 356, 560, null, false);
  assert.equal(first.side, "right");
  const next = placeInformationCard(bounds, { x: 410, y: 305 }, 356, 560, first.side, false);
  assert.equal(next.side, first.side);
  assert.equal(next.x, first.x);
  for (const [width, height] of [[320, 568], [768, 800], [900, 250]]) {
    const placed = placeInformationCard({ x: 0, y: 0, width, height }, { x: width - 5, y: 5 }, 356, 400, null, width < 700);
    assert.ok(placed.x >= 0 && placed.y >= 0);
    assert.ok(placed.x + placed.width <= width && placed.y + placed.height <= height);
  }
  assert.equal(placeInformationCard(bounds, null, 356, 560, null, false).lineVisible, false);
});

const { explorationMilestones } = loadModule("exploration-progress");
test("fresh exploration starts empty, counts each structure once, and can restart", () => {
  const ids = HEART_PARTS.map(p => p.id);
  let state = INITIAL_SCENE;
  assert.equal(state.visitedIds.length, 0);
  for (const id of ids.slice(0, 10)) state = sceneReducer(state, { type: "select", id });
  assert.equal(state.visitedIds.length, 10);
  assert.equal(sceneReducer(state, { type: "select", id: ids[0] }).visitedIds.length, 10);
  assert.equal(sceneReducer(state, { type: "clear-progress" }).visitedIds.length, 0);
  assert.deepEqual(explorationMilestones(17).map(m => m.count), [5, 10, 15, 17]);
  assert.equal(explorationMilestones(20).at(-1).count, 20);
});
