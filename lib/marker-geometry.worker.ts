import { BufferAttribute, BufferGeometry } from "three";
import { MeshBVH } from "three-mesh-bvh";
import { MARKER_BVH_OPTIONS, type MarkerGeometryInput } from "./marker-geometry";

self.onmessage = ({ data }: MessageEvent<MarkerGeometryInput>) => {
  try {
    const geometry = new BufferGeometry();
    geometry.setAttribute("position", new BufferAttribute(data.position, 3));
    if (data.index) geometry.setIndex(new BufferAttribute(data.index, 1));
    geometry.groups = data.groups;
    geometry.setDrawRange(data.drawRange.start, data.drawRange.count);
    const tree = new MeshBVH(geometry, MARKER_BVH_OPTIONS);
    // The library's 0.8 typings omit indirectBuffer, although the serializer
    // includes it. Transfer only worker-owned buffers; never the rendered model.
    const serialized = MeshBVH.serialize(tree, { cloneBuffers: false }) as ReturnType<typeof MeshBVH.serialize> & { indirectBuffer?: Uint32Array };
    const transfer = [...serialized.roots];
    if (serialized.indirectBuffer) transfer.push(serialized.indirectBuffer.buffer as ArrayBuffer);
    self.postMessage({ serialized }, { transfer });
  } catch {
    self.postMessage({ error: "Geometry acceleration could not be prepared." });
  }
};
