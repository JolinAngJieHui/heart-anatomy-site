import fs from 'node:fs';
import assert from 'node:assert/strict';
import * as three from 'three';
import { createHash } from 'node:crypto';
import { scanGeometry } from './helpers/scan-geometry.mjs';
import { load } from './helpers/load-module.mjs';
const { HEART_PARTS } = load('lib/heart-parts.ts');
const { prepareImportedModel } = load('lib/imported-model.ts', { three });
const { markerTree } = load('lib/marker-geometry.ts', { three });
const { MarkerVisibility } = load('lib/marker-visibility.ts', { three });
const source = 'artifacts/heart-scan-web/heart final labelled.glb';
const { root, metadata, bytes } = await scanGeometry(source);
const hash = createHash('sha256').update(bytes).digest('hex');
const nodes = new Map(); root.traverse(o => { if (o.userData.name) nodes.set(o.userData.name.trim(), o); });
// The unsuffixed PDA object is the context heart, with the newly separated
// right marginal removed. The .001 object is the same previously verified PDA.
// Numeric suffixes are never removed by the runtime name resolver.
const aliases = { 'posterior-descending-artery': 'posterior-descending-artery.001' };
const structures = {};
for (const part of HEART_PARTS) {
  const node = nodes.get(aliases[part.id] ?? part.id), marker = nodes.get(`marker-${part.id}`);
  structures[part.id] = { meshes: node ? [node.name] : [],
    ...(marker ? { anchor: { node: marker.name, position: [0, 0, 0] } } : {}) };
}
const rawBounds = new three.Box3().setFromObject(root, true);
// Both marginal vessels now have their own named meshes and authored anchors.
const adjustedAnchors = [];
// D1's authored empty is just inside the scan. Project it only onto its named
// D1 mesh, retaining the exported anatomical assignment rather than searching
// unrelated tissue or increasing the global occlusion tolerance.
for (const id of ['left-diagonal-d1']) {
  const marker = nodes.get(`marker-${id}`), vessel = nodes.get(id);
  const original = marker.getWorldPosition(new three.Vector3());
  let closest;
  vessel.traverse(mesh => {
    if (!mesh.isMesh) return;
    const hit = markerTree(mesh.geometry).closestPointToPoint(mesh.worldToLocal(original.clone()));
    if (!hit) return;
    const distance = mesh.localToWorld(hit.point.clone()).distanceTo(original);
    if (!closest || distance < closest.distance) closest = { mesh: mesh.name, point: hit.point.toArray(), distance };
  });
  structures[id].anchor = { node: closest.mesh, position: closest.point };
  adjustedAnchors.push({ id, ...closest, original: original.toArray() });
}
// The author confirmed this mesh contains left main plus the whole LAD. The
// revised export renames it without changing its geometry or authored anchors.
// Claim it once through the shared group; retain four independent anchors/IDs.
structures['left-coronary-artery'].meshes = [];
const config = { version: 1, url: `/models/heart-${hash.slice(0, 16)}.glb`, rotationDegrees: [0, 0, 0], structures,
  highlightGroups: {
    'right-coronary-artery': { label: 'Right Coronary Artery', meshes: ['right-coronary-artery'], structures: ['right-coronary-proximal', 'right-coronary-middle', 'right-coronary-distal'] },
    'left-main-and-lad': { label: 'Left Main and Left Anterior Descending Artery', meshes: ['left-anterior-descending'], structures: ['left-coronary-artery', 'left-anterior-descending-proximal', 'left-anterior-descending-mid', 'left-anterior-descending-apical'] },
  } };
const model = prepareImportedModel(root, config), camera = new three.PerspectiveCamera(40, 1, .1, 100);
assert.deepEqual(model.warnings, []);
assert.equal(model.registry.size, HEART_PARTS.length, 'All 17 authored marker assignments resolve');
const context = nodes.get('posterior-descending-artery');
context.traverse(mesh => { if (mesh.isMesh) assert.equal(model.owners.has(mesh), false, 'Context must never highlight as PDA'); });
for (const id of ['left-marginal-artery', 'right-marginal-artery']) {
  assert.equal(model.registry.get(id).anchorObject, nodes.get(`marker-${id}`));
  nodes.get(id).traverse(mesh => { if (mesh.isMesh) assert.deepEqual(model.owners.get(mesh).structureIds, [id]); });
}
model.container.updateWorldMatrix(true, true);
const meshes = []; model.root.traverse(o => { if (o.isMesh) { meshes.push(o); markerTree(o.geometry); } });
const anchors = [...model.registry].map(([id, entry]) => {
  const world = entry.anchorObject.localToWorld(new three.Vector3(...entry.anchor));
  let nearestSurfaceDistance = Infinity, ownSurfaceDistance = Infinity, nearestMesh = '';
  for (const mesh of meshes) {
    const hit = markerTree(mesh.geometry).closestPointToPoint(mesh.worldToLocal(world.clone()));
    if (!hit) continue;
    const distance = mesh.localToWorld(hit.point.clone()).distanceTo(world);
    if (distance < nearestSurfaceDistance) { nearestSurfaceDistance = distance; nearestMesh = mesh.name; }
    if (entry.objects.includes(mesh)) ownSurfaceDistance = Math.min(ownSurfaceDistance, distance);
  }
  return { id, number: HEART_PARTS.find(p => p.id === id).number, world: world.toArray(), nearestSurfaceDistance, ownSurfaceDistance: Number.isFinite(ownSurfaceDistance) ? ownSurfaceDistance : null, nearestMesh, visibleViews: [] };
});
const checker = new MarkerVisibility();
for (let elevation = -75; elevation <= 75; elevation += 15) for (let azimuth = 0; azimuth < 360; azimuth += 15) {
  const a = azimuth * Math.PI / 180, e = elevation * Math.PI / 180;
  camera.position.set(6 * Math.cos(e) * Math.sin(a), .2 + 6 * Math.sin(e), 6 * Math.cos(e) * Math.cos(a)); camera.up.set(0, 1, 0); camera.lookAt(0, .2, 0);
  const results = checker.update(camera, model.container, model.registry);
  for (const anchor of anchors) if (results.get(anchor.id).visible) anchor.visibleViews.push({ azimuth, elevation });
}
const report = { source, hash, bytes: bytes.length, rawBounds: { min: rawBounds.min.toArray(), max: rawBounds.max.toArray() }, warnings: model.warnings, tolerance: checker.stats.tolerance,
  triangles: metadata.meshes.flatMap(m => m.primitives).reduce((sum, p) => sum + metadata.accessors[p.indices].count / 3, 0),
  drawCalls: meshes.length,
  objects: metadata.nodes.filter(n => n.mesh !== undefined).map(n => ({ name: n.name, triangles: metadata.meshes[n.mesh].primitives.reduce((sum, p) => sum + metadata.accessors[p.indices].count / 3, 0) })),
  missingAnchors: HEART_PARTS.filter(part => !model.registry.has(part.id)).map(({ id, number, name }) => ({ id, number, name })),
  adjustedAnchors, anchors };
fs.mkdirSync('artifacts/final-model', { recursive: true });
fs.writeFileSync('artifacts/final-model/proposed-config.json', JSON.stringify(config, null, 2));
fs.writeFileSync('artifacts/final-model/anchor-audit.json', JSON.stringify(report, null, 2));
console.log(JSON.stringify({ ...report, anchors: anchors.map(a => ({ ...a, visibleViews: a.visibleViews.length })) }, null, 2));
model.dispose();
