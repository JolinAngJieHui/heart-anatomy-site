import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { load } from './helpers/load-module.mjs';
const { PerspectiveCamera, Quaternion, Vector3 } = createRequire(import.meta.url)('three');
const { rotateHeartCamera, applyHeartPan, zoomHeartCamera, wheelZoomFactor } = load('lib/free-heart-camera.ts');
function scene() {
  const target = new Vector3(0, .2, 0), camera = new PerspectiveCamera(40, 1.5, .1, 100);
  camera.position.set(3.8, 1.6, 6.2); camera.lookAt(target); camera.updateMatrixWorld();
  return { target, camera };
}
const close = (a, b, epsilon = 1e-9) => assert.ok(Math.abs(a - b) < epsilon, `${a} != ${b}`);
const sameRotation = (a, b) => close(Math.abs(a.dot(b)), 1);

for (const direction of ['horizontal', 'vertical']) test(`two continuous ${direction} turns return to the original pose with no pole snap`, () => {
  const { target, camera } = scene(), rotation = camera.quaternion.clone(), position = camera.position.clone();
  for (let i = 0; i < 48; i++) {
    const before = camera.quaternion.clone();
    rotateHeartCamera(camera, target, direction === 'horizontal' ? 25 : 0, direction === 'vertical' ? 25 : 0, 600);
    close(before.angleTo(camera.quaternion), Math.PI / 12);
    close(camera.position.distanceTo(target), position.distanceTo(target));
  }
  sameRotation(camera.quaternion, rotation); close(camera.position.distanceTo(position), 0);
});
test('upside-down orientation stays inverted and continues smoothly', () => {
  const { camera, target } = scene(), up = new Vector3(0, 1, 0).applyQuaternion(camera.quaternion);
  rotateHeartCamera(camera, target, 0, 300, 600); close(camera.up.dot(up), -1);
  const before = camera.quaternion.clone(); rotateHeartCamera(camera, target, 0, 10, 600);
  close(before.angleTo(camera.quaternion), Math.PI / 30); assert.ok(camera.up.dot(up) < -.99);
});
test('panning follows pixels without moving the anatomical pivot; rotation preserves its screen position', () => {
  const { camera, target } = scene(), shift = { x: 130, y: -80 }, position = camera.position.clone(), rotation = camera.quaternion.clone();
  applyHeartPan(camera, { x: 0, y: 0 }, 900, 600); const before = target.clone().project(camera);
  applyHeartPan(camera, shift, 900, 600); const panned = target.clone().project(camera);
  close((panned.x - before.x) * 450, 130); close((before.y - panned.y) * 300, -80);
  sameRotation(camera.quaternion, rotation); close(camera.position.distanceTo(position), 0);
  rotateHeartCamera(camera, target, 84, 170, 600);
  const after = target.clone().project(camera); close(after.x, panned.x); close(after.y, panned.y);
});
test('zoom retains old wheel ratio and limits without changing orientation or pivot', () => {
  const { camera, target } = scene(), rotation = camera.quaternion.clone(), distance = camera.position.distanceTo(target);
  zoomHeartCamera(camera, target, wheelZoomFactor(-20)); close(camera.position.distanceTo(target), distance * .95);
  zoomHeartCamera(camera, target, wheelZoomFactor(20)); close(camera.position.distanceTo(target), distance);
  zoomHeartCamera(camera, target, .00001); close(camera.position.distanceTo(target), 1.6);
  zoomHeartCamera(camera, target, 1e6); close(camera.position.distanceTo(target), 12);
  sameRotation(camera.quaternion, rotation);
});
test('input after a programmatic camera pose uses that live quaternion, not stale orientation', () => {
  const { camera, target } = scene();
  camera.quaternion.setFromAxisAngle(new Vector3(0, 0, 1), Math.PI * .85);
  camera.position.set(0, 0, 5).applyQuaternion(camera.quaternion).add(target);
  const expected = camera.quaternion.clone().multiply(new Quaternion().setFromAxisAngle(new Vector3(0, -1, 0), Math.PI / 30));
  rotateHeartCamera(camera, target, 10, 0, 600);
  sameRotation(camera.quaternion, expected); close(camera.position.distanceTo(target), 5);
});
