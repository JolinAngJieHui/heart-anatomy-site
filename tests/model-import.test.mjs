import assert from 'node:assert/strict';
import { test } from 'node:test';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { load } from './helpers/load-module.mjs';
import { inspectGlb } from '../lib/glb-file.mjs';
import { installModel } from '../scripts/heart-model.mjs';
import { glbFixture, arrayBuffer } from './helpers/glb-fixture.mjs';
// Match the CJS Three instance used by the in-memory TypeScript test loader.
const three = createRequire(import.meta.url)('three');
const { prepareImportedModel } = load('lib/imported-model.ts', { three });
const { modelConfigSchema } = load('lib/model-config.ts');
const { importedCameraDistance, IMPORTED_RESET_ROTATION, IMPORTED_RESET_TARGET } = load('lib/heart-model.ts');
const { VESSEL_HIGHLIGHT_OPACITY } = load('lib/vessel-highlight.ts');
const tintedRed = new three.Color('#aa2222').lerp(new three.Color('#ef4444'), VESSEL_HIGHLIGHT_OPACITY).getHexString();
const config = structures => ({ version: 1, url: '/models/test.glb', rotationDegrees: [0, 0, 0], structures });
function model() {
  const root = new three.Group(); root.position.set(1000, -70, 20);
  const shared = new three.MeshStandardMaterial({ color: '#aa2222' });
  const a = new three.Mesh(new three.BoxGeometry(2, 4, 2), shared); a.name = 'A';
  const b = new three.Mesh(new three.BoxGeometry(1, 2, 1), shared); b.name = 'B'; b.position.x = 3;
  const group = new three.Group(); group.name = 'Branches'; group.add(a, b); root.add(group);
  return { root, a, b, shared };
}

test('upright reset keeps the actual scan fully in frame at desktop and mobile aspect ratios', async () => {
  const THREE = await import('three');
  const { scanGeometry } = await import('./helpers/scan-geometry.mjs');
  const manifest = JSON.parse(fs.readFileSync('public/models/heart-model.json', 'utf8'));
  const { root } = await scanGeometry(path.join('public', manifest.url));
  const ready = load('lib/imported-model.ts', { three: THREE }).prepareImportedModel(root, manifest);
  const inverseRotation = new THREE.Quaternion(...IMPORTED_RESET_ROTATION).normalize().invert();
  const target = new THREE.Vector3(...IMPORTED_RESET_TARGET), points = [];
  ready.container.traverseVisible(object => {
    if (!object.isMesh) return;
    const positions = object.geometry.attributes.position;
    for (let i = 0; i < positions.count; i++) points.push(new THREE.Vector3().fromBufferAttribute(positions, i).applyMatrix4(object.matrixWorld).sub(target).applyQuaternion(inverseRotation));
  });
  for (const fov of [35, 40, 50]) for (const aspect of [.4, .75, 1, 1.8, 3]) {
    const distance = importedCameraDistance(fov, aspect), tangent = Math.tan(fov * Math.PI / 360);
    let maxX = 0, maxY = 0;
    for (const p of points) {
      const depth = distance - p.z;
      maxX = Math.max(maxX, Math.abs(p.x / (depth * tangent * aspect)));
      maxY = Math.max(maxY, Math.abs(p.y / (depth * tangent)));
    }
    assert.ok(maxX < .99 && maxY < .99, `Whole scan fits: fov=${fov}, aspect=${aspect}, x=${maxX}, y=${maxY}`);
  }
  ready.dispose();
});

test('GLB config rejects external URLs, traversal, unknown IDs and invalid coordinates', () => {
  assert.ok(modelConfigSchema.safeParse(config({})).success);
  for (const url of ['https://example.com/a.glb', '/models/../a.glb', '/models/a.gltf', '/models/a.glb?x=1']) assert.equal(modelConfigSchema.safeParse({ ...config({}), url }).success, false);
  assert.equal(modelConfigSchema.safeParse(config({ invented: {} })).success, false);
  assert.equal(modelConfigSchema.safeParse(config({ 'ascending-aorta': { anchor: { position: [NaN, 1, 2] } } })).success, false);
});
test('untagged import normalizes any author scale/offset without invented anchors or owners', () => {
  const { root } = model(); root.scale.setScalar(100);
  const ready = prepareImportedModel(root, { ...config({}), rotationDegrees: [90, 0, 0] });
  const bounds = new three.Box3().setFromObject(ready.container);
  assert.ok(bounds.getCenter(new three.Vector3()).distanceTo(new three.Vector3(0, .2, 0)) < 1e-9);
  assert.ok(Math.abs(bounds.getSize(new three.Vector3()).length() - 3.4) < 1e-9);
  assert.equal(ready.registry.size, 0); assert.equal(ready.owners.size, 0);
  ready.dispose();
});
test('explicit anchors stay node-local and group mappings cover multiple meshes', () => {
  const { root, a, b } = model();
  const ready = prepareImportedModel(root, config({ 'ascending-aorta': { meshes: ['Branches'], anchor: { node: 'A', position: [0, 2, 0] } } }));
  const entry = ready.registry.get('ascending-aorta');
  assert.equal(entry.anchorObject, a); assert.deepEqual(entry.objects, [a, b]);
  assert.ok(entry.modelCenter.getWorldPosition(new three.Vector3()).distanceTo(new three.Vector3(0, .2, 0)) < 1e-9);
  assert.deepEqual(ready.meshIds, ['ascending-aorta']); ready.dispose();
});
test('picking uses indexed geometry and retains opaque context as a blocker without a vessel identity', () => {
  const { root, a, b } = model();
  const ready = prepareImportedModel(root, config({ 'ascending-aorta': { meshes: ['A'] } }));
  assert.notEqual(a.raycast, three.Mesh.prototype.raycast);
  assert.notEqual(b.raycast, three.Mesh.prototype.raycast);
  assert.ok(a.geometry.boundsTree); assert.ok(b.geometry.boundsTree);
  const center = a.getWorldPosition(new three.Vector3());
  const ray = new three.Raycaster(center.clone().add(new three.Vector3(0, 0, 10)), new three.Vector3(0, 0, -1));
  assert.ok(ray.intersectObjects([a, b], true).length > 0);
  assert.ok(ray.intersectObjects([a, b], true).every(hit => hit.object === a));
  const contextCenter = b.getWorldPosition(new three.Vector3());
  ray.set(contextCenter.clone().add(new three.Vector3(0, 0, 10)), new three.Vector3(0, 0, -1));
  assert.equal(ray.intersectObjects([a, b], true)[0].object, b);
  assert.equal(ready.owners.has(b), false);
  b.visible = false; assert.equal(ray.intersectObject(b).length, 0);
  ready.dispose();
});

test('names accept harmless separators/case and original Blender names without merging numbered objects', () => {
  const { root, a, b } = model(); a.name = 'LEFT__DIAGONAL_D1'; b.name = 'Right_Conus_Artery001'; b.userData.name = 'Right Conus Artery.001';
  const ready = prepareImportedModel(root, config({ 'left-diagonal-d1': { meshes: ['left diagonal d1'] }, 'right-conus-artery': { meshes: ['Right Conus Artery.001'] } }));
  assert.equal(ready.owners.get(a).structureIds[0], 'left-diagonal-d1'); assert.equal(ready.owners.get(b).structureIds[0], 'right-conus-artery');
  assert.deepEqual(ready.warnings, []); ready.dispose();
  const duplicate = model(); duplicate.a.name = 'LEFT_D1'; duplicate.b.name = 'Left-D1';
  const ambiguous = prepareImportedModel(duplicate.root, config({ 'left-diagonal-d1': { meshes: ['left d1'] } }));
  assert.equal(ambiguous.owners.size, 0); assert.equal(ambiguous.warnings.length, 1); ambiguous.dispose();
});
test('shared materials stay untouched and isolation uses original vessel appearance with translucent context', () => {
  const { root, a, b, shared } = model();
  const ready = prepareImportedModel(root, config({ 'ascending-aorta': { meshes: ['A'] } }));
  assert.equal(ready.registry.size, 0); // A mesh mapping does not invent a marker.
  ready.applySelection('ascending-aorta', null, 'ascending-aorta');
  assert.equal(a.material.color.getHexString(), 'aa2222'); assert.equal(b.material.color.getHexString(), 'aa2222'); assert.equal(b.visible, true);
  assert.equal(a.material.opacity, 1); assert.equal(b.material.opacity, .2);
  assert.equal(a.material.emissive.getHexString(), '000000');
  assert.equal(shared.color.getHexString(), 'aa2222');
  ready.applySelection(null, null, null); assert.equal(b.visible, true); assert.equal(a.material.color.getHexString(), 'aa2222'); ready.dispose();
});

test('selected vessel keeps its highlight while a different vessel is hovered', () => {
  const { root, a, b } = model();
  const ready = prepareImportedModel(root, config({ 'ascending-aorta': { meshes: ['A'] }, 'left-diagonal-d1': { meshes: ['B'] } }));
  ready.applySelection('ascending-aorta', 'left-diagonal-d1', null);
  assert.equal(a.material.color.getHexString(), tintedRed); assert.equal(b.material.color.getHexString(), tintedRed);
  ready.applySelection('ascending-aorta', null, null);
  assert.equal(a.material.color.getHexString(), tintedRed); assert.equal(b.material.color.getHexString(), 'aa2222');
  ready.dispose();
});

test('isolation preserves every original material property and reuses clones across repeated switches', () => {
  const { root, a, b, shared } = model();
  shared.map = new three.Texture(); shared.normalMap = new three.Texture();
  shared.emissive.set('#18232a'); shared.emissiveIntensity = .17;
  shared.roughness = .73; shared.metalness = .09; shared.side = three.DoubleSide;
  a.material = [shared, shared.clone()];
  a.material[1].opacity = .85; a.material[1].transparent = true; a.material[1].depthWrite = false;
  a.renderOrder = 7; b.renderOrder = -2;
  const originals = [...a.material, b.material];
  const appearance = m => ({ color: m.color.getHexString(), emissive: m.emissive.getHexString(), intensity: m.emissiveIntensity,
    roughness: m.roughness, metalness: m.metalness, side: m.side, map: m.map, normalMap: m.normalMap });
  const pipeline = m => ({ opacity: m.opacity, transparent: m.transparent, depthWrite: m.depthWrite, depthTest: m.depthTest, forceSinglePass: m.forceSinglePass });
  const originalAppearance = originals.map(appearance), originalPipeline = originals.map(pipeline);
  const ready = prepareImportedModel(root, config({ 'ascending-aorta': { meshes: ['A'] }, 'left-diagonal-d1': { meshes: ['B'] } }));
  const clones = [...a.material, b.material], uuids = clones.map(m => m.uuid);
  for (let i = 0; i < 30; i++) {
    ready.applySelection('ascending-aorta', 'ascending-aorta', 'ascending-aorta');
    assert.deepEqual(clones.map(appearance), originalAppearance, 'Hover and selection cannot alter isolated textures/shading');
    assert.deepEqual(clones.map(m => m.opacity), [1, 1, .2]);
    assert.ok(a.renderOrder > b.renderOrder);
    assert.ok(a.material.every(m => m.transparent && m.depthTest && m.depthWrite && m.forceSinglePass));
    assert.equal(b.material.depthWrite, false);
    ready.applySelection('left-diagonal-d1', 'ascending-aorta', 'left-diagonal-d1');
    assert.deepEqual(clones.map(m => m.opacity), [.2, .2, 1]);
    assert.deepEqual(clones.map(appearance), originalAppearance, 'Changing selection/hover retains original appearance');
    assert.ok(b.renderOrder > a.renderOrder);
    ready.applySelection(null, null, null);
    assert.deepEqual(clones.map(pipeline), originalPipeline);
    assert.deepEqual(clones.map(appearance), originalAppearance);
    assert.equal(a.renderOrder, 7); assert.equal(b.renderOrder, -2);
  }
  assert.deepEqual(clones.map(m => m.uuid), uuids, 'Toggling does not create new materials');
  assert.deepEqual(originals.map(appearance), originalAppearance);
  assert.deepEqual(originals.map(pipeline), originalPipeline, 'Original GLB materials remain untouched');
  ready.applySelection('ascending-aorta', 'left-diagonal-d1', null);
  assert.ok(a.material.every(m => m.color.getHexString() === tintedRed));
  assert.equal(b.material.color.getHexString(), tintedRed, 'Normal highlighting resumes outside isolation');
  ready.dispose();
});

test('translucent context cannot intercept isolated vessel picking or hide its marker', () => {
  const { root, a, b } = model(); b.position.set(0, 0, 3);
  const ready = prepareImportedModel(root, config({ 'ascending-aorta': { meshes: ['A'], anchor: { node: 'A', position: [0, 0, 1] } } }));
  const center = a.getWorldPosition(new three.Vector3());
  const camera = new three.PerspectiveCamera(40, 1, .1, 100); camera.position.copy(center).add(new three.Vector3(0, 0, 10)); camera.lookAt(center); camera.updateMatrixWorld();
  const ray = new three.Raycaster(camera.position.clone(), new three.Vector3(0, 0, -1));
  const checker = new (load('lib/marker-visibility.ts', { three }).MarkerVisibility)();
  const visible = () => checker.update(camera, ready.container, ready.registry).get('ascending-aorta').visible;
  assert.equal(visible(), false); assert.equal(ray.intersectObjects([a, b])[0].object, b);
  ready.applySelection('ascending-aorta', null, 'ascending-aorta');
  assert.equal(b.visible, true); assert.equal(b.material.opacity, .2);
  assert.equal(visible(), true, 'Stationary camera invalidates occlusion when context becomes translucent');
  assert.equal(ray.intersectObjects([a, b])[0].object, a);
  ready.applySelection('ascending-aorta', null, null);
  assert.equal(visible(), false); assert.equal(ray.intersectObjects([a, b])[0].object, b);
  ready.dispose();
});

test('opaque context is the first pick in front of a vessel and hidden ancestors stop blocking', () => {
  const { root, a, b } = model(); b.position.set(0, 0, 3);
  const ready = prepareImportedModel(root, config({ 'ascending-aorta': { meshes: ['A'] } }));
  const center = a.getWorldPosition(new three.Vector3());
  const ray = new three.Raycaster(center.clone().add(new three.Vector3(0, 0, 10)), new three.Vector3(0, 0, -1));
  assert.equal(ray.intersectObjects([a, b])[0].object, b); assert.equal(ready.owners.has(b), false);
  assert.equal(ray.firstHitOnly, undefined, 'The raycaster flag is restored after accelerated picking');
  b.visible = false; assert.equal(ray.intersectObjects([a, b])[0].object, a);
  a.parent.visible = false; assert.equal(ray.intersectObjects([a, b]).length, 0);
  ready.dispose();
});
test('bad/ambiguous tags cannot silently select or isolate the wrong vessel', () => {
  const { root, a } = model();
  const ready = prepareImportedModel(root, config({ 'ascending-aorta': { meshes: ['Branches'], anchor: { node: 'missing', position: [0, 0, 0] } }, 'right-coronary-middle': { meshes: ['A'] } }));
  assert.equal(ready.owners.has(a), false); assert.equal(ready.registry.size, 0); assert.equal(ready.warnings.length, 2); ready.dispose();
  const duplicate = model(); duplicate.b.name = 'A';
  const skipped = prepareImportedModel(duplicate.root, config({ 'ascending-aorta': { meshes: ['A'], anchor: { node: 'A', position: [0, 0, 0] } } }));
  assert.equal(skipped.owners.size, 0); assert.equal(skipped.registry.size, 0); skipped.dispose();
});

const rcaIds = ['right-coronary-proximal', 'right-coronary-middle', 'right-coronary-distal'];
function groupedConfig() {
  return { ...config(Object.fromEntries(rcaIds.map((id, i) => [id, { meshes: [], anchor: { node: 'A', position: [0, i, 0] } }]))),
    highlightGroups: { rca: { label: 'Right Coronary Artery', meshes: ['A'], structures: rcaIds } } };
}

test('explicit whole-vessel group shares highlighting and isolation while anchors remain independent', () => {
  const { root, a, b } = model();
  const ready = prepareImportedModel(root, modelConfigSchema.parse(groupedConfig()));
  assert.deepEqual(ready.warnings, []);
  assert.deepEqual(ready.meshIds, rcaIds);
  assert.deepEqual(ready.owners.get(a).structureIds, rcaIds);
  rcaIds.forEach((id, i) => {
    assert.deepEqual(ready.registry.get(id).anchor, [0, i, 0]);
    assert.deepEqual(ready.registry.get(id).objects, [a]);
    ready.applySelection(null, id, null);
    assert.equal(a.material.color.getHexString(), tintedRed);
    assert.equal(a.material.emissive.getHexString(), 'ef4444'); assert.equal(a.material.emissiveIntensity, .12 * VESSEL_HIGHLIGHT_OPACITY);
    ready.applySelection(id, null, id);
    assert.equal(a.material.color.getHexString(), 'aa2222');
    assert.equal(a.material.opacity, 1); assert.equal(b.material.opacity, .2);
    assert.equal(a.material.emissive.getHexString(), '000000'); assert.equal(b.visible, true);
  });
  ready.applySelection(null, null, null, null, 'rca');
  assert.equal(a.material.color.getHexString(), tintedRed); assert.equal(b.visible, true);
  ready.applySelection(null, null, null, 'rca', null);
  assert.equal(a.material.color.getHexString(), tintedRed);
  ready.applySelection(null, null, null);
  assert.equal(a.material.color.getHexString(), 'aa2222'); assert.equal(b.material.color.getHexString(), 'aa2222');
  assert.equal(a.material.emissive.getHexString(), '000000'); assert.equal(a.material.emissiveIntensity, 1);
  ready.dispose();
});

test('a vessel group highlights every primitive and never takes ownership of context geometry', () => {
  const { root, a, b } = model();
  const vessel = new three.Group(); vessel.name = 'Vessel';
  const second = a.clone(); second.material = a.material;
  a.parent.remove(a); vessel.add(a, second); root.add(vessel);
  const value = groupedConfig(); value.highlightGroups.rca.meshes = ['Vessel'];
  const ready = prepareImportedModel(root, modelConfigSchema.parse(value));
  ready.applySelection('right-coronary-middle', null, null);
  assert.equal(a.material.color.getHexString(), tintedRed); assert.equal(second.material.color.getHexString(), tintedRed);
  assert.equal(b.material.color.getHexString(), 'aa2222'); assert.equal(ready.owners.has(b), false);
  assert.notEqual(b.raycast, three.Mesh.prototype.raycast);
  ready.applySelection('right-coronary-middle', 'right-coronary-proximal', 'right-coronary-middle', null, 'rca');
  for (const mesh of [a, second]) {
    assert.equal(mesh.material.color.getHexString(), 'aa2222'); assert.equal(mesh.material.emissive.getHexString(), '000000');
    assert.equal(mesh.material.opacity, 1); assert.ok(mesh.renderOrder > b.renderOrder);
  }
  assert.equal(b.material.opacity, .2);
  ready.dispose();
});

test('group schema rejects fabricated or ambiguously grouped structure IDs', () => {
  assert.ok(modelConfigSchema.safeParse(groupedConfig()).success);
  for (const members of [['invented'], ['ascending-aorta'], [rcaIds[0], rcaIds[0]]]) {
    const value = groupedConfig(); value.highlightGroups.rca.structures = members;
    assert.equal(modelConfigSchema.safeParse(value).success, false);
  }
  const value = groupedConfig(); value.highlightGroups.other = value.highlightGroups.rca;
  assert.equal(modelConfigSchema.safeParse(value).success, false);
});

test('accidental mesh overlap between a group and a standalone structure is still rejected', () => {
  const { root, a } = model(), value = groupedConfig();
  value.structures['ascending-aorta'] = { meshes: ['A'] };
  const ready = prepareImportedModel(root, modelConfigSchema.parse(value));
  assert.equal(ready.owners.has(a), false); assert.equal(ready.meshIds.length, 0);
  assert.ok(ready.warnings.some(message => message.includes('multiple structures')));
  ready.dispose();
});
test('empty models are rejected and model-owned textures/materials are released', () => {
  assert.throws(() => prepareImportedModel(new three.Group(), config({})), /no usable geometry/);
  const { root, shared } = model(); const texture = new three.Texture(); shared.map = texture;
  let releases = 0; texture.addEventListener('dispose', () => releases++);
  const ready = prepareImportedModel(root, config({})); ready.dispose(); assert.equal(releases, 1);
});
test('GLB preflight accepts embedded geometry and refuses incomplete files, dependencies and unsupported extensions', () => {
  assert.equal(inspectGlb(arrayBuffer(glbFixture())).meshes, 1);
  assert.throws(() => inspectGlb(new ArrayBuffer(2)), /complete GLB/);
  const truncated = glbFixture().subarray(0, 100); assert.throws(() => inspectGlb(arrayBuffer(truncated)), /valid glTF/);
  assert.throws(() => inspectGlb(arrayBuffer(glbFixture(d => d.images = [{ uri: 'https://unrelated.example/image.png' }]))), /Embed all/);
  assert.throws(() => inspectGlb(arrayBuffer(glbFixture(d => d.extensionsUsed = ['KHR_texture_basisu']))), /Unsupported/);
});
test('installer activates a versioned GLB, preserves same-asset tags and backs up replacement tags', () => {
  const directory = fs.mkdtempSync(path.resolve('.next/cache/model-import-test-'));
  const file = path.join(directory, 'test.glb'); fs.writeFileSync(file, glbFixture());
  const first = installModel(file, directory);
  const manifest = path.join(directory, 'public/models/heart-model.json');
  const saved = JSON.parse(fs.readFileSync(manifest)); saved.structures = { 'ascending-aorta': { meshes: ['Test_Vessel'] } }; fs.writeFileSync(manifest, JSON.stringify(saved));
  assert.equal(installModel(file, directory).preservedTags, true); assert.deepEqual(JSON.parse(fs.readFileSync(manifest)).structures, saved.structures);
  fs.writeFileSync(file, glbFixture(d => d.asset.generator = 'replacement fixture'));
  const second = installModel(file, directory); assert.notEqual(second.url, first.url); assert.deepEqual(JSON.parse(fs.readFileSync(manifest)).structures, {});
  assert.ok(fs.existsSync(path.join(directory, 'public', first.url))); assert.ok(fs.readdirSync(path.join(directory, '.next/cache/model-import')).length);
  const before = fs.readFileSync(manifest, 'utf8'); fs.writeFileSync(file, 'bad'); assert.throws(() => installModel(file, directory)); assert.equal(fs.readFileSync(manifest, 'utf8'), before);
});
