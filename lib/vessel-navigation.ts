import { Box3, PerspectiveCamera, Vector3, type Object3D } from "three";
import type { HeartPartId } from "./heart-parts";
import type { ModelRegistry } from "./model-registry";
import { MarkerVisibility } from "./marker-visibility";
import { clearFramingRegions, area, type PanelLayout } from "./panel-framing";
import { applyHeartPan } from "./free-heart-camera";

type PreservedView = { target: Vector3; distance: number; zoom: number };

/** Search actual occlusion-tested viewpoints once per explicit navigation, never
 * during manual rotation. No anatomical directions are inferred from names. */
export function vesselView(camera: PerspectiveCamera, root: Object3D, registry: ModelRegistry, id: HeartPartId, layout: PanelLayout, preserveView?: PreservedView) {
  const structure = registry.get(id);
  if (!structure) return null;
  root.updateWorldMatrix(true, true);
  const anchor = structure.anchorObject.localToWorld(new Vector3(...structure.anchor));
  const box = new Box3().setFromObject(root), center = box.getCenter(new Vector3());
  const radius = box.getSize(new Vector3()).length() / 2;
  const region = clearFramingRegions(layout.viewport, layout.obstacles).sort((a, b) => area(b) - area(a))[0] ?? layout.viewport;
  const vertical = Math.tan(camera.fov * Math.PI / 360);
  const fraction = Math.max(.15, Math.min(region.width / layout.viewport.width * camera.aspect, region.height / layout.viewport.height));
  // Explorer navigation keeps the student's viewing scale and orbit pivot.
  // The independent quiz camera can still fit the complete scan when required.
  const target = preserveView?.target.clone() ?? center;
  const distance = preserveView?.distance ?? Math.max(2.8, radius / (vertical * fraction) * 1.12);
  const zoom = preserveView?.zoom ?? 1;
  const probe = camera.clone(); probe.zoom = zoom;
  const up = new Vector3(0, 1, 0).applyQuaternion(camera.quaternion);
  const current = camera.position.clone().sub(target).normalize();
  const outward = anchor.clone().sub(center).normalize();
  const directions = [current, outward];
  for (let n = 0; n < 96; n++) {
    const y = 1 - 2 * (n + .5) / 96, r = Math.sqrt(1 - y * y), angle = n * Math.PI * (3 - Math.sqrt(5));
    directions.push(new Vector3(Math.cos(angle) * r, y, Math.sin(angle) * r));
  }
  const checker = new MarkerVisibility(), one = new Map([[id, structure]]);
  let best: { camera: PerspectiveCamera; score: number } | null = null;
  for (const direction of directions) {
    probe.clearViewOffset();
    probe.position.copy(target).addScaledVector(direction, distance);
    probe.up.copy(up); if (Math.abs(up.dot(direction)) > .98) probe.up.set(1, 0, 0);
    probe.lookAt(target); probe.updateProjectionMatrix(); probe.updateMatrixWorld(true);
    // A close-up anchor may be outside the initial frustum but reachable by pan.
    // Test its actual sightline after an optical pan, without moving the camera
    // farther away or accepting an anchor behind the eye / near plane.
    const projected = anchor.clone().project(probe);
    if (![projected.x, projected.y, projected.z].every(Number.isFinite) || projected.z < -1 || projected.z > 1) continue;
    applyHeartPan(probe, { x: -projected.x * layout.viewport.width / 2, y: projected.y * layout.viewport.height / 2 }, layout.viewport.width, layout.viewport.height);
    // Candidate views are independent. Do not inherit the previous candidate's
    // visibility hysteresis; leave a little margin for the animated final pose.
    checker.results.clear();
    const visibility = checker.update(probe, root, one).get(id);
    if (!visibility?.visible || visibility.obstruction > checker.stats.tolerance * .82) continue;
    // In the explorer prefer looking toward the selected surface, rather than
    // stopping as soon as its marker peeks around the silhouette. This keeps
    // more of the artery in view while the marker is centred beside the card.
    const score = preserveView ? outward.dot(direction) * 2 + current.dot(direction) * .35 : current.dot(direction) * 2 + outward.dot(direction) * .35;
    if (!best || score > best.score) best = { camera: probe.clone(), score };
    if (!preserveView && direction === current) break;
  }
  return best ? { target, rotation: best.camera.quaternion.clone(), distance, zoom } : null;
}
