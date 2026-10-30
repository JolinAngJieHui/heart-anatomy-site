/** Shared preflight for the importer and browser. This is not anatomical validation. */
export const MAX_GLB_BYTES = 100 * 1024 * 1024;
const supported = new Set([
  'KHR_draco_mesh_compression', 'EXT_meshopt_compression', 'KHR_mesh_quantization',
  'KHR_materials_unlit', 'KHR_materials_clearcoat', 'KHR_materials_transmission',
  'KHR_materials_volume', 'KHR_materials_ior', 'KHR_materials_specular',
  'KHR_materials_sheen', 'KHR_materials_iridescence', 'KHR_materials_emissive_strength',
  'KHR_materials_anisotropy', 'KHR_materials_dispersion', 'KHR_texture_transform',
  'KHR_lights_punctual', 'EXT_mesh_gpu_instancing',
]);

/** @param {ArrayBuffer} buffer */
export function inspectGlb(buffer) {
  if (buffer.byteLength > MAX_GLB_BYTES) throw Error('Model exceeds 100 MB. Export a smaller web version.');
  if (buffer.byteLength < 20) throw Error('The file is not a complete GLB.');
  const view = new DataView(buffer);
  if (view.getUint32(0, true) !== 0x46546c67 || view.getUint32(4, true) !== 2 || view.getUint32(8, true) !== buffer.byteLength) throw Error('Expected a valid glTF 2.0 binary (.glb).');
  const length = view.getUint32(12, true);
  if (view.getUint32(16, true) !== 0x4e4f534a || length % 4 || length + 20 > buffer.byteLength) throw Error('The GLB JSON chunk is invalid.');
  const data = JSON.parse(new TextDecoder().decode(new Uint8Array(buffer, 20, length)));
  if (data.asset?.version !== '2.0' || !data.meshes?.length || !data.scenes?.length) throw Error('Export a glTF 2.0 scene containing mesh geometry.');
  for (const resource of [...(data.buffers ?? []), ...(data.images ?? [])]) {
    if (resource.uri && !/^data:(application\/octet-stream|image\/(png|jpeg));base64,/i.test(resource.uri)) throw Error('Embed all geometry and PNG/JPEG textures inside the GLB; external files are not supported.');
  }
  const extensions = [...new Set([...(data.extensionsUsed ?? []), ...(data.extensionsRequired ?? [])])];
  const unsupported = extensions.filter(name => !supported.has(name));
  if (unsupported.length) throw Error(`Unsupported GLB extensions: ${unsupported.join(', ')}. Export standard materials with PNG/JPEG textures.`);
  let offset = 20 + length;
  while (offset < buffer.byteLength) {
    if (offset + 8 > buffer.byteLength) throw Error('Truncated GLB chunk.');
    const size = view.getUint32(offset, true);
    if (size % 4 || offset + 8 + size > buffer.byteLength) throw Error('Invalid GLB chunk length.');
    offset += 8 + size;
  }
  const nodes = (data.nodes ?? []).map((node, index) => ({ index, name: node.name ?? '', mesh: node.mesh ?? null, children: node.children ?? [] }));
  const names = nodes.map(node => node.name).filter(Boolean);
  const duplicates = [...new Set(names.filter((name, index) => names.indexOf(name) !== index))];
  return { nodes, duplicates, meshes: data.meshes.length, animations: data.animations?.length ?? 0, bytes: buffer.byteLength, extensions };
}
