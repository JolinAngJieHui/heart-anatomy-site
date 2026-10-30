// Original synthetic test geometry, deliberately not an anatomical asset.
import { BoxGeometry } from 'three';
export function glbFixture(edit = () => {}) {
  const geometry = new BoxGeometry(2, 3, 1).toNonIndexed();
  const position = Buffer.from(geometry.attributes.position.array.buffer);
  const normal = Buffer.from(geometry.attributes.normal.array.buffer);
  const binary = Buffer.concat([position, normal]);
  const data = { asset: { version: '2.0', generator: 'heart-site synthetic test fixture' }, scene: 0,
    scenes: [{ nodes: [0] }], nodes: [{ name: 'Test_Heart', children: [1, 2], translation: [100, -60, 20] }, { name: 'Test_Vessel', mesh: 0 }, { name: 'Test_Context', mesh: 0, translation: [2, 0, 0] }],
    meshes: [{ primitives: [{ attributes: { POSITION: 0, NORMAL: 1 }, material: 0 }] }],
    materials: [{ pbrMetallicRoughness: { baseColorFactor: [0.7, 0.15, 0.1, 1], metallicFactor: 0, roughnessFactor: 0.5 } }],
    buffers: [{ byteLength: binary.length }], bufferViews: [{ buffer: 0, byteOffset: 0, byteLength: position.length }, { buffer: 0, byteOffset: position.length, byteLength: normal.length }],
    accessors: [{ bufferView: 0, componentType: 5126, count: geometry.attributes.position.count, type: 'VEC3', min: [-1, -1.5, -.5], max: [1, 1.5, .5] }, { bufferView: 1, componentType: 5126, count: geometry.attributes.normal.count, type: 'VEC3' }] };
  edit(data);
  const text = JSON.stringify(data), json = Buffer.from(text.padEnd(Math.ceil(Buffer.byteLength(text) / 4) * 4, ' '));
  const output = Buffer.alloc(12 + 8 + json.length + 8 + binary.length);
  output.writeUInt32LE(0x46546c67, 0); output.writeUInt32LE(2, 4); output.writeUInt32LE(output.length, 8);
  output.writeUInt32LE(json.length, 12); output.writeUInt32LE(0x4e4f534a, 16); json.copy(output, 20);
  output.writeUInt32LE(binary.length, 20 + json.length); output.writeUInt32LE(0x004e4942, 24 + json.length); binary.copy(output, 28 + json.length);
  geometry.dispose();
  return output;
}
export const arrayBuffer = bytes => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
