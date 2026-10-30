import { Box3, Mesh, Vector3, type PerspectiveCamera, type Object3D } from "three";
import type { ScreenRect } from "./panel-framing";

/** Real visible geometry only, including future GLB transforms and isolation.
 * Bounding boxes are conservative proxies, not a silhouette-area measurement. */
export function modelScreenBounds(root: Object3D, camera: PerspectiveCamera, width: number, height: number): ScreenRect | null {
  root.updateWorldMatrix(true, true);
  camera.updateMatrixWorld();
  const box = new Box3();
  root.traverseVisible(object => {
    if (!(object instanceof Mesh)) return;
    if (!object.geometry.boundingBox) object.geometry.computeBoundingBox();
    if (object.geometry.boundingBox) box.union(object.geometry.boundingBox.clone().applyMatrix4(object.matrixWorld));
  });
  if (box.isEmpty()) return null;
  const corners: Vector3[] = [];
  for (const x of [box.min.x, box.max.x]) for (const y of [box.min.y, box.max.y]) for (const z of [box.min.z, box.max.z]) {
    corners.push(new Vector3(x, y, z).applyMatrix4(camera.matrixWorldInverse));
  }
  // At close zoom an empty corner of the conservative box can cross the near
  // plane while the selected anatomy remains visible. Clip box edges instead
  // of cancelling navigation (or moving the camera away to obtain a box).
  const near = -camera.near;
  const points = corners.filter(p => p.z <= near).map(p => p.clone());
  corners.forEach((a, i) => {
    for (const bit of [1, 2, 4]) {
      const j = i ^ bit, b = corners[j];
      if (j > i && (a.z < near && b.z > near || b.z < near && a.z > near)) {
        points.push(a.clone().lerp(b, (near - a.z) / (b.z - a.z)));
      }
    }
  });
  if (!points.length) return null;
  points.forEach(p => p.applyMatrix4(camera.projectionMatrix));
  const xs = points.map(p => (p.x + 1) * width / 2), ys = points.map(p => (1 - p.y) * height / 2);
  return { x: Math.min(...xs), y: Math.min(...ys), width: Math.max(...xs) - Math.min(...xs), height: Math.max(...ys) - Math.min(...ys) };
}
