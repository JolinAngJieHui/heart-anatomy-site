import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";
import { inspectGlb, MAX_GLB_BYTES } from "./glb-file.mjs";
import { prepareImportedModel, disposeModel } from "./imported-model";
import type { HeartModelConfig } from "./model-config";
import { prepareMarkerGeometry } from "./prepare-marker-geometry";

let cachedBytes: { url: string; bytes: ArrayBuffer } | null = null;
async function downloadModel(config: HeartModelConfig, signal: AbortSignal, progress: (bytes: number, total: number) => void) {
  if (cachedBytes?.url === config.url) { progress(cachedBytes.bytes.byteLength, cachedBytes.bytes.byteLength); return cachedBytes.bytes; }
  if (!config.url) throw Error("No model selected.");
  const response = await fetch(config.url, { signal, credentials: "same-origin" });
  if (!response.ok) throw Error("The model file could not be downloaded.");
  const total = Number(response.headers.get("content-length")) || 0;
  if (total > MAX_GLB_BYTES) { await response.body?.cancel(); throw Error("Model exceeds 100 MB."); }
  const reader = response.body?.getReader();
  if (!reader) throw Error("Model download is unavailable.");
  const chunks: Uint8Array[] = [];
  let bytes = 0;
  let lastProgress = 0;
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    bytes += value.byteLength;
    if (bytes > MAX_GLB_BYTES) { await reader.cancel(); throw Error("Model exceeds 100 MB."); }
    chunks.push(value);
    const now = performance.now();
    if (now - lastProgress >= 100) { progress(bytes, total); lastProgress = now; }
  }
  progress(bytes, total);
  const buffer = new Uint8Array(bytes);
  let offset = 0;
  for (const chunk of chunks) { buffer.set(chunk, offset); offset += chunk.byteLength; }
  inspectGlb(buffer.buffer);
  signal.throwIfAborted();
  cachedBytes = { url: config.url, bytes: buffer.buffer };
  return buffer.buffer;
}
export async function loadHeartAsset(config: HeartModelConfig, signal: AbortSignal, progress: (bytes: number, total: number) => void) {
  const buffer = await downloadModel(config, signal, progress);
  signal.throwIfAborted();
  const draco = new DRACOLoader().setDecoderPath("/models/draco/");
  const loader = new GLTFLoader().setDRACOLoader(draco).setMeshoptDecoder(MeshoptDecoder);
  try {
    const gltf = await loader.parseAsync(buffer, "/models/");
    try {
      await prepareMarkerGeometry(gltf.scene, signal);
      signal.throwIfAborted();
      return prepareImportedModel(gltf.scene, config);
    }
    catch (error) { disposeModel(gltf.scene); throw error; }
  } finally { draco.dispose(); }
}
