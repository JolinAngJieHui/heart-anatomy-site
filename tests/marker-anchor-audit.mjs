// Read-only audit: parse the supplied geometry without loading photographic
// textures in Node, and measure anchors without changing the GLB or manifest.
import fs from 'node:fs';
import * as three from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { load } from './helpers/load-module.mjs';
globalThis.ProgressEvent ??= class ProgressEvent extends Event { constructor(type, init) { super(type); Object.assign(this, init); } };
const { prepareImportedModel } = load('lib/imported-model.ts', { three });
const { markerTree } = load('lib/marker-geometry.ts', { three });
const { MarkerVisibility } = load('lib/marker-visibility.ts', { three });
const config = JSON.parse(fs.readFileSync('public/models/heart-model.json', 'utf8'));
const bytes = fs.readFileSync(`public${config.url}`), jsonLength = bytes.readUInt32LE(12);
const data = JSON.parse(bytes.subarray(20, 20 + jsonLength).toString());
data.buffers[0].uri = `data:application/octet-stream;base64,${bytes.subarray(28 + jsonLength).toString('base64')}`;
data.materials = data.materials.map(() => ({ pbrMetallicRoughness: { metallicFactor: 0, roughnessFactor: 1 } }));
delete data.textures; delete data.images; delete data.samplers;
const gltf = await new GLTFLoader().parseAsync(JSON.stringify(data), '');
const model = prepareImportedModel(gltf.scene, config), camera = new three.PerspectiveCamera(40, 1, .1, 100);
model.container.updateWorldMatrix(true, true);
const meshes = []; model.root.traverse(o => { if (o.isMesh) meshes.push(o); });
const started = performance.now(); meshes.forEach(m => markerTree(m.geometry));
const buildMs = performance.now() - started;
const anchors = [...model.registry].map(([id, entry]) => {
  const world = entry.anchorObject.localToWorld(new three.Vector3(...entry.anchor));
  let closest = Infinity, meshName = '';
  for (const mesh of meshes) {
    const hit = markerTree(mesh.geometry).closestPointToPoint(mesh.worldToLocal(world.clone()));
    if (hit) { const distance = mesh.localToWorld(hit.point).distanceTo(world); if (distance < closest) { closest = distance; meshName = mesh.name; } }
  }
  return { id, world: world.toArray(), nearestSurfaceDistance: closest, nearestMesh: meshName, visibleViews: [] };
});
const checker = new MarkerVisibility(), times = [];
for (let elevation = -75; elevation <= 75; elevation += 15) for (let azimuth = 0; azimuth < 360; azimuth += 15) {
  const a = azimuth * Math.PI / 180, e = elevation * Math.PI / 180;
  camera.position.set(6 * Math.cos(e) * Math.sin(a), .2 + 6 * Math.sin(e), 6 * Math.cos(e) * Math.cos(a)); camera.lookAt(0, .2, 0);
  const results = checker.update(camera, model.container, model.registry); times.push(checker.stats.milliseconds);
  for (const anchor of anchors) if (results.get(anchor.id).visible) anchor.visibleViews.push({ azimuth, elevation });
}
times.sort((a, b) => a - b);
const report = { buildMs, diameterTolerance: checker.stats.tolerance, medianQueryMs: times[Math.floor(times.length / 2)], p95QueryMs: times[Math.floor(times.length * .95)], sampledViews: times.length, anchors };
fs.mkdirSync('artifacts/marker-occlusion', { recursive: true }); fs.writeFileSync('artifacts/marker-occlusion/anchor-audit.json', JSON.stringify(report, null, 2));
console.log(JSON.stringify({ ...report, anchors: anchors.map(a => ({ ...a, visibleViews: a.visibleViews.length, exampleViews: a.visibleViews.slice(0, 3) })) }, null, 2));
model.dispose();
