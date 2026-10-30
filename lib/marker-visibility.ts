import { Box3, DoubleSide, Matrix4, Mesh, Ray, Raycaster, Vector2, Vector3, type Camera, type Object3D } from "three";
import { markerTree } from "./marker-geometry";
import type { ModelRegistry } from "./model-registry";
import type { HeartPartId } from "./heart-parts";
import { isIsolationContext } from "./heart-isolation";

export type MarkerVisibilityResult = {
  world: Vector3;
  projected: Vector3;
  visible: boolean;
  reason: "visible" | "outside" | "occluded";
  obstruction: number;
};

/** Scale-relative allowance for surface roundoff / slightly inset author anchors.
 * Hysteresis is geometric, so a stationary camera needs no timers or extra frames.
 * At the normalized scan's 3.4-unit diameter the allowance is 0.0136 units.
 * The authored proximal RCA point is inset by about 0.010 units (0.3%). */
export const MARKER_SURFACE_TOLERANCE = .004;
export class MarkerVisibility {
  readonly results = new Map<HeartPartId, MarkerVisibilityResult>();
  readonly stats = { revision: 0, queries: 0, milliseconds: 0, tolerance: 0, meshes: 0 };
  private signature = "";
  private raycaster = new Raycaster();
  private localRay = new Ray();
  private inverse = new Matrix4();
  private point = new Vector3();
  private bounds = new Box3();
  private meshBounds = new Box3();
  private ndc = new Vector2();

  update(camera: Camera, root: Object3D, registry: ModelRegistry) {
    camera.updateWorldMatrix(true, false);
    root.updateWorldMatrix(true, true);
    const meshes: { mesh: Mesh; visible: boolean }[] = [];
    const parts: (string | number | boolean)[] = [...camera.matrixWorld.elements, ...camera.projectionMatrix.elements, camera.layers.mask];
    // Child transforms and ancestor visibility matter, even when pointer raycasts
    // are disabled on the large context mesh. Translucent isolation context cannot occlude.
    function collect(object: Object3D, parentVisible: boolean) {
      const visible = parentVisible && object.visible;
      if (object instanceof Mesh) {
        const materials = Array.isArray(object.material) ? object.material : [object.material];
        const drawn = visible && !isIsolationContext(object) && camera.layers.test(object.layers) && materials.some(m => m.visible && m.opacity > 0);
        meshes.push({ mesh: object, visible: drawn });
        parts.push(object.id, object.geometry.id, drawn, ...object.matrixWorld.elements);
      }
      object.children.forEach(child => collect(child, visible));
    }
    collect(root, true);
    for (const [id, structure] of registry) {
      const world = this.point.fromArray(structure.anchor).applyMatrix4(structure.anchorObject.matrixWorld);
      parts.push(id, world.x, world.y, world.z);
    }
    const signature = parts.join(",");
    if (signature === this.signature) return this.results;
    this.signature = signature;
    const started = performance.now();
    this.bounds.makeEmpty();
    for (const { mesh } of meshes) {
      if (!mesh.geometry.boundingBox) mesh.geometry.computeBoundingBox();
      if (mesh.geometry.boundingBox) this.bounds.union(this.meshBounds.copy(mesh.geometry.boundingBox).applyMatrix4(mesh.matrixWorld));
    }
    const tolerance = Math.max(1e-7, this.bounds.getSize(this.point).length() * MARKER_SURFACE_TOLERANCE);
    let queries = 0;
    for (const id of this.results.keys()) if (!registry.has(id)) this.results.delete(id);
    for (const [id, structure] of registry) {
      const previous = this.results.get(id);
      const result: MarkerVisibilityResult = previous ?? { world: new Vector3(), projected: new Vector3(), visible: false, reason: "outside", obstruction: 0 };
      result.world.fromArray(structure.anchor).applyMatrix4(structure.anchorObject.matrixWorld);
      result.projected.copy(result.world).project(camera);
      const { x, y, z } = result.projected;
      const wasVisible = result.visible;
      result.visible = false; result.reason = "outside"; result.obstruction = 0;
      if ([x, y, z].every(Number.isFinite) && Math.abs(x) <= 1 && Math.abs(y) <= 1 && z >= -1 && z <= 1) {
        this.raycaster.setFromCamera(this.ndc.set(x, y), camera);
        const ray = this.raycaster.ray;
        const depth = this.point.copy(result.world).sub(ray.origin).dot(ray.direction);
        if (depth > 0) {
          // Only 0.3 * tolerance separates hide/show thresholds. It cannot expose
          // the far wall, and immediate large obstructions always hide the marker.
          const allowance = tolerance * (wasVisible ? 1.15 : .85);
          let obstruction = 0;
          for (const { mesh, visible } of meshes) {
            if (!visible) continue;
            this.inverse.copy(mesh.matrixWorld).invert();
            this.localRay.copy(ray).applyMatrix4(this.inverse);
            // Compare world distances, not local hit distances (nonuniform scales).
            const localDepth = this.point.copy(result.world).applyMatrix4(this.inverse).sub(this.localRay.origin).dot(this.localRay.direction);
            queries++;
            const hit = markerTree(mesh.geometry).raycastFirst(this.localRay, DoubleSide, 0, localDepth);
            if (!hit) continue;
            const distance = this.point.copy(hit.point).applyMatrix4(mesh.matrixWorld).sub(ray.origin).dot(ray.direction);
            obstruction = Math.max(obstruction, depth - distance);
            if (obstruction > allowance) break;
          }
          result.obstruction = obstruction;
          result.visible = obstruction <= allowance;
          result.reason = result.visible ? "visible" : "occluded";
        }
      }
      this.results.set(id, result);
    }
    Object.assign(this.stats, { revision: this.stats.revision + 1, queries, milliseconds: performance.now() - started, tolerance, meshes: meshes.length });
    return this.results;
  }
}
