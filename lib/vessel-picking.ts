import { Mesh, type Intersection, type Raycaster } from "three";
import { acceleratedRaycast } from "three-mesh-bvh";
import { markerTree } from "./marker-geometry";
import { isIsolationContext } from "./heart-isolation";

/** Reuse the occlusion index. Context surfaces also stop picking through tissue. */
export function enableVesselPicking(mesh: Mesh) {
  mesh.geometry.boundsTree = markerTree(mesh.geometry);
  mesh.raycast = function (raycaster: Raycaster, hits: Intersection[]) {
    if (isIsolationContext(this)) return;
    for (let object = this as Mesh | null; object; object = object.parent as Mesh | null) if (!object.visible) return;
    const materials = Array.isArray(this.material) ? this.material : [this.material];
    if (!materials.some(material => material.visible && material.opacity > 0)) return;
    const previous = raycaster.firstHitOnly;
    raycaster.firstHitOnly = true;
    try { acceleratedRaycast.call(this, raycaster, hits); }
    finally { raycaster.firstHitOnly = previous; }
  };
}
