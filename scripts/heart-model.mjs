import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { PropertyBinding } from 'three';
import { inspectGlb, MAX_GLB_BYTES } from '../lib/glb-file.mjs';

const project = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export function inspectFile(filename) {
  if (!filename || path.extname(filename).toLowerCase() !== '.glb') throw Error('Supply a .glb file, with textures embedded.');
  if (fs.statSync(filename).size > MAX_GLB_BYTES) throw Error('Model exceeds 100 MB. Export a smaller web version.');
  const bytes = fs.readFileSync(filename);
  const report = inspectGlb(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
  return { bytes, report: { ...report, nodes: report.nodes.map(node => ({ ...node, lookupName: PropertyBinding.sanitizeNodeName(node.name) })) } };
}

export function installModel(filename, destination = project) {
  const { bytes, report } = inspectFile(filename);
  const hash = createHash('sha256').update(bytes).digest('hex').slice(0, 16);
  const directory = path.join(destination, 'public', 'models');
  fs.mkdirSync(directory, { recursive: true });
  const configPath = path.join(directory, 'heart-model.json');
  let previous = null;
  if (fs.existsSync(configPath)) {
    const original = fs.readFileSync(configPath, 'utf8');
    const backupDirectory = path.join(destination, '.next', 'cache', 'model-import');
    fs.mkdirSync(backupDirectory, { recursive: true });
    fs.writeFileSync(path.join(backupDirectory, `heart-model-${Date.now()}.json`), original);
    try { previous = JSON.parse(original); } catch { /* The backup retains malformed configuration for repair. */ }
  }
  const url = `/models/heart-${hash}.glb`;
  const config = previous?.url === url ? previous : { version: 1, url, rotationDegrees: [0, 0, 0], structures: {} };
  fs.writeFileSync(path.join(directory, path.basename(url)), bytes);
  if (report.extensions.includes('KHR_draco_mesh_compression')) {
    const decoders = path.join(directory, 'draco');
    fs.mkdirSync(decoders, { recursive: true });
    for (const name of ['draco_decoder.js', 'draco_decoder.wasm', 'draco_wasm_wrapper.js']) fs.copyFileSync(path.join(project, 'node_modules', 'three', 'examples', 'jsm', 'libs', 'draco', 'gltf', name), path.join(decoders, name));
    fs.copyFileSync(path.join(project, 'node_modules', 'three', 'examples', 'jsm', 'libs', 'draco', 'README.md'), path.join(decoders, 'README.md'));
    fs.copyFileSync(path.join(project, 'scripts', 'licenses', 'Apache-2.0.txt'), path.join(decoders, 'LICENSE.txt'));
    fs.writeFileSync(path.join(decoders, 'NOTICE.txt'), 'Draco decoder, Google Draco Authors. Apache License 2.0.\nUnmodified glTF decoder files from the installed three.js package.\nhttps://github.com/google/draco\n');
  }
  fs.writeFileSync(path.join(directory, `heart-${hash}.inventory.json`), JSON.stringify(report, null, 2) + '\n');
  // Activate last: a failed preflight/copy can never replace the working manifest.
  const staging = configPath + '.tmp';
  fs.writeFileSync(staging, JSON.stringify(config, null, 2) + '\n');
  fs.renameSync(staging, configPath);
  return { url, report, preservedTags: previous?.url === url };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const [command, filename] = process.argv.slice(2);
    if (command === 'inspect') console.log(JSON.stringify(inspectFile(filename).report, null, 2));
    else if (command === 'install') {
      const result = installModel(filename);
      console.log(`Model ready: ${result.url}\nRefresh the website. Deployment must include public/models.\n${result.report.meshes} mesh definitions; ${(result.report.bytes / 1048576).toFixed(1)} MB.\n${result.preservedTags ? 'Existing tags retained for the same asset.' : 'New asset starts without tags; previous configuration was backed up under .next/cache/model-import.'}\nNode inventory saved beside the model. See docs/model-handoff.md for tagging and orientation.`);
      if (result.report.duplicates.length) console.warn('Duplicate node names: rename before tagging:', result.report.duplicates.join(', '));
      if (result.report.animations) console.warn('Animations are present; the viewer displays the static exported pose.');
      if (result.report.bytes > 20 * 1048576) console.warn('For faster mobile loading, aim for a web export below 20 MB.');
    } else throw Error('Use npm run model:inspect -- "path/to/heart.glb" or npm run model:install -- "path/to/heart.glb".');
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
