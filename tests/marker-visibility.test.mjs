import assert from 'node:assert/strict';
import test from 'node:test';
import { createRequire } from 'node:module';
import { load } from './helpers/load-module.mjs';
const require = createRequire(import.meta.url);
const { Group, Mesh, BoxGeometry, SphereGeometry, MeshBasicMaterial, PerspectiveCamera, OrthographicCamera, Vector3 } = require('three');
const { MarkerVisibility, MARKER_SURFACE_TOLERANCE } = load('lib/marker-visibility.ts');
const { markerTree } = load('lib/marker-geometry.ts');
const { HEART_PARTS } = load('lib/heart-parts.ts');

function scene() {
  const root = new Group(), parent = new Group(), mesh = new Mesh(new BoxGeometry(2, 2, 2), new MeshBasicMaterial());
  root.add(parent); parent.add(mesh);
  // Context mesh pointer picking stays disabled, as it does on the real scan.
  mesh.raycast = () => {};
  const camera = new PerspectiveCamera(50, 1, .1, 100);
  camera.position.set(0, 0, 6); camera.lookAt(0, 0, 0); camera.updateMatrixWorld();
  const registry = new Map();
  const anchor = (id, point) => registry.set(id, { objects: [], anchorObject: parent, anchor: point });
  const checker = new MarkerVisibility();
  const update = () => checker.update(camera, root, registry);
  return { root, parent, mesh, camera, registry, anchor, checker, update };
}

test('all 17 stable marker IDs use actual child geometry, and reappear from the opposite view', () => {
  const s = scene();
  HEART_PARTS.forEach((part, i) => s.anchor(part.id, [(i % 3 - 1) * .3, (i % 5 - 2) * .2, i % 2 ? -1 : 1]));
  let results = s.update();
  HEART_PARTS.forEach((part, i) => assert.equal(results.get(part.id).visible, i % 2 === 0));
  s.camera.position.z = -6; s.camera.lookAt(0, 0, 0);
  results = s.update();
  HEART_PARTS.forEach((part, i) => assert.equal(results.get(part.id).visible, i % 2 === 1));
  assert.equal(s.registry.size, 17, 'Hiding never deletes anatomical data');
});

test('surface tolerance handles a slightly inset anchor without revealing the opposite wall', () => {
  const s = scene();
  s.anchor('surface', [0, 0, 1]); s.anchor('inset', [.1, 0, .997]); s.anchor('buried', [0, 0, .9]); s.anchor('back', [0, 0, -1]);
  const results = s.update();
  assert.equal(results.get('surface').visible, true); assert.equal(results.get('inset').visible, true);
  assert.equal(results.get('buried').visible, false); assert.equal(results.get('back').visible, false);
  assert.ok(s.checker.stats.tolerance < .02);
});

test('narrow hysteresis is stable under small silhouette/depth perturbations', () => {
  const s = scene(), tolerance = Math.sqrt(12) * MARKER_SURFACE_TOLERANCE;
  s.anchor('edge', [0, 0, 1]); assert.equal(s.update().get('edge').visible, true);
  for (const ratio of [1, 1.02, .98, 1.05, .95]) {
    s.anchor('edge', [0, 0, 1 - tolerance * ratio]); assert.equal(s.update().get('edge').visible, true);
  }
  s.anchor('edge', [0, 0, 1 - tolerance * 1.2]); assert.equal(s.update().get('edge').visible, false);
  for (const ratio of [1, .98, 1.02, .95]) {
    s.anchor('edge', [0, 0, 1 - tolerance * ratio]); assert.equal(s.update().get('edge').visible, false);
  }
  s.anchor('edge', [0, 0, 1 - tolerance * .8]); assert.equal(s.update().get('edge').visible, true);
});

test('nested translation, rotation and nonuniform scaling preserve occlusion', () => {
  const s = scene(); s.root.position.set(7, 2, -8); s.root.rotation.set(.3, .8, .1); s.parent.scale.set(2, .8, 1.5);
  s.anchor('front', [0, 0, 1]); s.anchor('back', [0, 0, -1]); s.root.updateWorldMatrix(true, true);
  s.camera.position.copy(s.parent.localToWorld(new Vector3(0, 0, 6)));
  s.camera.lookAt(s.parent.localToWorld(new Vector3()));
  assert.equal(s.update().get('front').visible, true); assert.equal(s.update().get('back').visible, false);
});

test('occlusion includes another child and ignores hidden ancestors during isolation', () => {
  const s = scene(); s.anchor('front', [0, 0, 1]);
  const cover = new Group(), mesh = new Mesh(new BoxGeometry(.5, .5, .1), new MeshBasicMaterial());
  mesh.position.z = 1.5; cover.add(mesh); s.root.add(cover);
  assert.equal(s.update().get('front').visible, false);
  cover.visible = false; assert.equal(s.update().get('front').visible, true);
  cover.visible = true; assert.equal(s.update().get('front').visible, false);
  mesh.position.x = 2; assert.equal(s.update().get('front').visible, true);
});

test('outside screen, behind camera, and clipped depth anchors are hidden; projection offsets invalidate cache', () => {
  const s = scene(); s.anchor('front', [0, 0, 1]); s.anchor('offscreen', [30, 0, 1]); s.anchor('behind', [0, 0, 7]); s.anchor('far', [0, 0, -150]); s.anchor('near', [0, 0, 5.95]);
  let results = s.update();
  for (const id of ['offscreen', 'behind', 'far', 'near']) assert.equal(results.get(id).reason, 'outside');
  const revision = s.checker.stats.revision; s.update(); assert.equal(s.checker.stats.revision, revision);
  s.camera.setViewOffset(800, 600, 2000, 0, 800, 600);
  results = s.update(); assert.equal(results.get('front').reason, 'outside');
  assert.equal(s.checker.stats.revision, revision + 1);
});

test('orthographic zoom/pan uses parallel camera rays and current frustum', () => {
  const s = scene(); const camera = new OrthographicCamera(-2, 2, 2, -2, .1, 30);
  camera.position.set(0, 0, 6); camera.lookAt(0, 0, 0);
  s.anchor('front', [.7, 0, 1]); s.anchor('back', [.7, 0, -1]);
  let result = s.checker.update(camera, s.root, s.registry);
  assert.equal(result.get('front').visible, true); assert.equal(result.get('back').visible, false);
  camera.zoom = 4; camera.updateProjectionMatrix();
  result = s.checker.update(camera, s.root, s.registry); assert.equal(result.get('front').reason, 'outside');
});

test('curved silhouette is determined by the surface anchor, not an offset label', () => {
  const s = scene(); s.parent.remove(s.mesh); s.parent.add(new Mesh(new SphereGeometry(1, 64, 48), new MeshBasicMaterial()));
  s.anchor('front', [.6, 0, .8]); s.anchor('behind', [.6, 0, -.8]);
  assert.equal(s.update().get('front').visible, true); assert.equal(s.update().get('behind').visible, false);
  s.camera.position.set(6, 0, 0); s.camera.lookAt(0, 0, 0);
  assert.equal(s.update().get('behind').visible, true);
});

test('BVH preserves original index, material groups, and pointer raycast; cache disposes with geometry', () => {
  const s = scene(), before = s.mesh.geometry.index.array.slice(), raycast = s.mesh.raycast;
  const groups = structuredClone(s.mesh.geometry.groups), first = markerTree(s.mesh.geometry);
  assert.equal(markerTree(s.mesh.geometry), first);
  assert.deepEqual(s.mesh.geometry.index.array, before); assert.deepEqual(s.mesh.geometry.groups, groups); assert.equal(s.mesh.raycast, raycast);
  s.mesh.geometry.dispose(); assert.notEqual(markerTree(s.mesh.geometry), first);
});
