import fs from 'node:fs';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

/** Node geometry audit only. The served GLB and its textures are never edited. */
export async function scanGeometry(filename) {
  globalThis.ProgressEvent ??= class ProgressEvent extends Event { constructor(type, init) { super(type); Object.assign(this, init); } };
  const bytes = fs.readFileSync(filename), jsonLength = bytes.readUInt32LE(12);
  const data = JSON.parse(bytes.subarray(20, 20 + jsonLength).toString());
  const metadata = structuredClone(data);
  data.buffers[0].uri = `data:application/octet-stream;base64,${bytes.subarray(28 + jsonLength).toString('base64')}`;
  data.materials = data.materials.map(() => ({ doubleSided: true, pbrMetallicRoughness: { metallicFactor: 0, roughnessFactor: .75 } }));
  delete data.textures; delete data.images; delete data.samplers;
  const gltf = await new GLTFLoader().parseAsync(JSON.stringify(data), '');
  return { root: gltf.scene, metadata, bytes };
}
