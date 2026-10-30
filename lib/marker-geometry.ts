import { BufferGeometry } from "three";
import { CENTER, MeshBVH } from "three-mesh-bvh";

// Separate from mesh.raycast: visual-only context meshes deliberately disable
// pointer picking. Indirect construction leaves every authored triangle intact.
const trees = new WeakMap<BufferGeometry, MeshBVH>();
export const MARKER_BVH_OPTIONS = { strategy: CENTER, indirect: true, maxLeafTris: 10 };

export function rememberMarkerTree(geometry: BufferGeometry, tree: MeshBVH) {
  if (!trees.has(geometry)) geometry.addEventListener("dispose", function release() {
    trees.delete(geometry);
    geometry.removeEventListener("dispose", release);
  });
  trees.set(geometry, tree);
  return tree;
}

export function markerTree(geometry: BufferGeometry) {
  return trees.get(geometry) ?? rememberMarkerTree(geometry, new MeshBVH(geometry, MARKER_BVH_OPTIONS));
}

export type MarkerGeometryInput = {
  position: Float32Array;
  index: Uint32Array | null;
  groups: BufferGeometry["groups"];
  drawRange: BufferGeometry["drawRange"];
};
