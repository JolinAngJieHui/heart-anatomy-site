"use client";
import { useFrame } from "@react-three/fiber";
import { useRef, type RefObject } from "react";
import { Mesh, type Color } from "three";
import type { PreparedHeartModel } from "@/lib/imported-model";
import { isIsolationContext } from "@/lib/heart-isolation";

/** Local development measurements only; no telemetry, requests or React updates. */
export default function ViewerDiagnostics({ surface, importedModel }: { surface: RefObject<HTMLDivElement | null>; importedModel?: PreparedHeartModel }) {
  const sample = useRef({ last: 0, frames: 0, intervals: [] as number[] });
  useFrame(({ gl }) => {
    const now = performance.now(), current = sample.current;
    current.frames++;
    surface.current?.setAttribute("data-render-frame", String(current.frames));
    if (current.last && now - current.last < 250) current.intervals.push(now - current.last);
    else current.intervals = []; // Exclude time intentionally idle between gestures.
    if (current.intervals.length > 120) current.intervals.shift();
    current.last = now;
    if (!surface.current) return;
    // Measure the actual loaded materials, including every GLB primitive, for
    // browser regression checks. This component is absent in production.
    const modelMaterials: { name: string; group: string | null; structures: string[]; visible: boolean; colors: (string | null)[]; isolationContext: boolean; renderOrder: number; materials: object[] }[] = [];
    importedModel?.root.traverse(object => {
      if (!(object instanceof Mesh)) return;
      modelMaterials.push({ name: object.name, group: importedModel.owners.get(object)?.groupId ?? null, visible: object.visible,
        structures: importedModel.owners.get(object)?.structureIds ?? [],
        colors: (Array.isArray(object.material) ? object.material : [object.material]).map(material => (material as { color?: Color }).color?.getHexString() ?? null),
        isolationContext: isIsolationContext(object), renderOrder: object.renderOrder,
        materials: (Array.isArray(object.material) ? object.material : [object.material]).map(material => {
          const appearance = material as typeof material & { emissive?: Color; emissiveIntensity?: number; roughness?: number; metalness?: number; map?: { uuid: string }; normalMap?: { uuid: string } };
          return { uuid: material.uuid, opacity: material.opacity, transparent: material.transparent, depthWrite: material.depthWrite, depthTest: material.depthTest,
            forceSinglePass: material.forceSinglePass, emissive: appearance.emissive?.getHexString(), emissiveIntensity: appearance.emissiveIntensity,
            roughness: appearance.roughness, metalness: appearance.metalness, map: appearance.map?.uuid, normalMap: appearance.normalMap?.uuid };
        }) });
    });
    surface.current.setAttribute("data-model-materials", JSON.stringify(modelMaterials));
    surface.current.setAttribute("data-model-selection", JSON.stringify(importedModel?.container.userData.selection ?? null));
    const sorted = [...current.intervals].sort((a, b) => a - b);
    surface.current.setAttribute("data-render-stats", JSON.stringify({ frames: current.frames,
      medianFrameMs: sorted[Math.floor(sorted.length * .5)] ?? null,
      p95FrameMs: sorted[Math.floor(sorted.length * .95)] ?? null,
      samples: sorted.length, drawCalls: gl.info.render.calls, triangles: gl.info.render.triangles,
      geometries: gl.info.memory.geometries, textures: gl.info.memory.textures,
      dpr: gl.getPixelRatio(), drawingBuffer: [gl.domElement.width, gl.domElement.height],
      exposure: gl.toneMappingExposure, toneMapping: gl.toneMapping, outputColorSpace: gl.outputColorSpace,
      shadows: gl.shadowMap.enabled }));
  });
  return null;
}
