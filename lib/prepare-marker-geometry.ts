import { Mesh, type BufferGeometry, type Object3D } from "three";
import { MeshBVH } from "three-mesh-bvh";
import { markerTree, rememberMarkerTree, type MarkerGeometryInput } from "./marker-geometry";

/** Prepare detailed scans off the UI thread, once per distinct geometry. */
export async function prepareMarkerGeometry(root: Object3D, signal: AbortSignal) {
  const geometries = new Set<BufferGeometry>();
  root.traverse(object => { if (object instanceof Mesh) geometries.add(object.geometry); });
  let worker: Worker | undefined;
  try {
    try { worker = new Worker(new URL("./marker-geometry.worker.ts", import.meta.url), { type: "module" }); }
    catch { /* Restrictive hosting can still use the same exact geometry locally. */ }
    for (const geometry of geometries) {
      signal.throwIfAborted();
      if (worker) {
        try {
          const position = geometry.getAttribute("position"), index = geometry.getIndex();
          // Clone only the position/index data; GLB primitives can share backing
          // buffers, so transferring their original arrays would detach the scan.
          const positions = new Float32Array(position.count * 3);
          for (let i = 0; i < position.count; i++) {
            positions[i * 3] = position.getX(i); positions[i * 3 + 1] = position.getY(i); positions[i * 3 + 2] = position.getZ(i);
          }
          const indices = index ? Uint32Array.from(index.array) : null;
          const input: MarkerGeometryInput = { position: positions, index: indices, groups: geometry.groups, drawRange: geometry.drawRange };
          const current = worker;
          const serialized = await new Promise<ReturnType<typeof MeshBVH.serialize>>((resolve, reject) => {
            const abort = () => finish(() => reject(signal.reason));
            const timer = setTimeout(() => finish(() => reject(Error("Geometry worker timed out."))), 20000);
            function finish(done: () => void) { clearTimeout(timer); signal.removeEventListener("abort", abort); current.onmessage = null; current.onerror = null; done(); }
            signal.addEventListener("abort", abort, { once: true });
            current.onerror = event => { event.preventDefault(); finish(() => reject(Error("Geometry worker unavailable."))); };
            current.onmessage = event => finish(() => event.data.serialized ? resolve(event.data.serialized) : reject(Error("Geometry worker failed.")));
            try { current.postMessage(input, [positions.buffer, ...(indices ? [indices.buffer] : [])]); }
            catch (error) { finish(() => reject(error)); }
          });
          signal.throwIfAborted();
          rememberMarkerTree(geometry, MeshBVH.deserialize(serialized, geometry, { setIndex: false }));
          continue;
        } catch {
          signal.throwIfAborted();
          worker.terminate(); worker = undefined;
        }
      }
      // Fallback also runs only during loading, never repeatedly during rotation.
      await new Promise(resolve => setTimeout(resolve, 0));
      signal.throwIfAborted();
      markerTree(geometry);
    }
  } finally { worker?.terminate(); }
}
