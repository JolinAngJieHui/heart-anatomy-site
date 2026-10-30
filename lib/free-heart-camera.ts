import { PerspectiveCamera, Quaternion, Vector3 } from "three";
import type { ScreenPoint } from "./panel-framing";

export const DRAG_THRESHOLD = 6;
export const MIN_HEART_DISTANCE = 1.6;
export const MAX_HEART_DISTANCE = 12;
const axis = new Vector3(), delta = new Quaternion();

/** Incremental camera-local rotations have no poles or preferred world-up.
 * Screen-space panning is deliberately independent of the anatomical pivot. */
export function rotateHeartCamera(camera: PerspectiveCamera, target: Vector3, dx: number, dy: number, height: number) {
  const pixels = Math.hypot(dx, dy);
  if (!pixels || height <= 0) return;
  const distance = camera.position.distanceTo(target);
  axis.set(-dy / pixels, -dx / pixels, 0);
  delta.setFromAxisAngle(axis, pixels * Math.PI * 2 / height);
  camera.quaternion.multiply(delta).normalize();
  camera.position.set(0, 0, distance).applyQuaternion(camera.quaternion).add(target);
  camera.up.set(0, 1, 0).applyQuaternion(camera.quaternion);
  camera.updateMatrixWorld();
}

export function zoomHeartCamera(camera: PerspectiveCamera, target: Vector3, factor: number) {
  if (!Number.isFinite(factor) || factor <= 0) return;
  const distance = Math.min(MAX_HEART_DISTANCE, Math.max(MIN_HEART_DISTANCE, camera.position.distanceTo(target) * factor));
  camera.position.set(0, 0, distance).applyQuaternion(camera.quaternion).add(target);
  camera.updateMatrixWorld();
}

/** Same 0.95 wheel step as the previous installed OrbitControls. */
export const wheelZoomFactor = (deltaY: number) => deltaY < 0 ? .95 : deltaY > 0 ? 1 / .95 : 1;

export function applyHeartPan(camera: PerspectiveCamera, shift: ScreenPoint, width: number, height: number) {
  if (width <= 0 || height <= 0) return;
  camera.setViewOffset(width, height, -shift.x, -shift.y, width, height);
  camera.up.set(0, 1, 0).applyQuaternion(camera.quaternion);
  camera.updateMatrixWorld();
}
