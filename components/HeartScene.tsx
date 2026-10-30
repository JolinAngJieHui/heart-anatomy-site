"use client";
import { Canvas } from "@react-three/fiber";
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type Dispatch, type RefObject } from "react";
import { vesselHighlightColor } from "@/lib/vessel-highlight";
import { DEFAULT_CAMERA } from "@/lib/heart-model";
import type { SceneAction, SceneState } from "@/lib/scene-state";
import HeartCamera from "./HeartCamera";
import HeartAnnotations, { AnnotationProjector, type AnnotationNodes, type SelectedMarkerProjection } from "./HeartAnnotations";
import ImportedHeart from "./ImportedHeart";
import type { ModelRegistry, PointerGesture } from "@/lib/model-registry";
import { ACESFilmicToneMapping, SRGBColorSpace, type Group } from "three";
import type { FramingBridge } from "@/lib/panel-framing";
import useHeartAsset from "./useHeartAsset";
import { UNLOADED_MODEL, type ModelCapabilities } from "@/lib/model-config";
import ViewerDiagnostics from "./ViewerDiagnostics";
import HeartLighting from "./HeartLighting";
import VesselSegmentChoices from "./VesselSegmentChoices";
import { getHeartPart, HEART_PARTS, type HeartPartId } from "@/lib/heart-parts";

export default function HeartScene({ state, dispatch, projectionRef, surfaceRef, framing, assessment = false, assessmentTarget = null, assessmentKey = "", onCapabilities, suspended = false }: { state: SceneState; dispatch: Dispatch<SceneAction>; projectionRef: RefObject<SelectedMarkerProjection | null>; surfaceRef: RefObject<HTMLDivElement | null>; framing: RefObject<FramingBridge>; assessment?: boolean; assessmentTarget?: HeartPartId | null; assessmentKey?: string; onCapabilities?: (value: ModelCapabilities) => void; suspended?: boolean }) {
  const { asset, download, retry } = useHeartAsset();
  const renderState = assessment ? { ...state, selectedId: assessmentTarget, selectedGroupId: null, hoveredId: null, hoveredGroupId: null, isolatedId: null } : state;
  const capabilities = useMemo<ModelCapabilities>(() => asset.kind === "imported"
    ? { kind: "imported", markerIds: [...asset.model.registry.keys()], meshIds: asset.model.meshIds, groupIds: [...asset.model.groups.keys()] }
    : { ...UNLOADED_MODEL, kind: asset.kind }, [asset]);
  useEffect(() => { onCapabilities?.(capabilities); }, [capabilities, onCapabilities]);
  const model = useRef<Group>(null);
  const registry = useRef<ModelRegistry>(new Map());
  const nodes = useRef<AnnotationNodes>(new Map());
  const gesture = useRef<PointerGesture>({ x: 0, y: 0, dragged: false, pointers: new Set() });
  const [contextLost, setContextLost] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const activeGroup = asset.kind === "imported" && !state.hoveredId ? asset.model.groups.get(state.hoveredGroupId ?? state.selectedGroupId ?? "") : undefined;
  const activePart = asset.kind === "imported" && state.hoveredId && asset.model.meshIds.includes(state.hoveredId) ? getHeartPart(state.hoveredId) : undefined;
  const chosenGroup = asset.kind === "imported" ? asset.model.groups.get(state.selectedGroupId ?? "") : undefined;
  const unplacedMarkers = asset.kind === "imported" ? HEART_PARTS.filter(part => !capabilities.markerIds.includes(part.id)) : [];
  const handleContextLost = useCallback((event: Event) => {
    event.preventDefault();
    setContextLost(true);
  }, []);
  useEffect(() => () => {
    canvasRef.current?.removeEventListener("webglcontextlost", handleContextLost);
  }, [handleContextLost]);
  if (contextLost) return <div className="scene-message" role="alert"><h3>3D view interrupted</h3><p>Your browser lost its graphics connection. The structure list is still available.</p><button type="button" className="control" onClick={() => window.location.reload()}>Reload viewer</button></div>;
  return <div ref={surfaceRef} data-model-kind={asset.kind} data-hovered-vessel={state.hoveredGroupId ?? undefined} data-selected-vessel={state.selectedGroupId ?? undefined} className={`scene-surface ${state.hoveredId || state.hoveredGroupId ? "is-hovering" : ""}`}>
    <Canvas camera={{ position: DEFAULT_CAMERA, fov: 40 }} dpr={[1, 1.5]} frameloop={suspended ? "never" : "demand"}
      gl={{ outputColorSpace: SRGBColorSpace, toneMapping: ACESFilmicToneMapping, toneMappingExposure: 1 }}
      fallback={<div className="scene-message">3D graphics are unavailable. Explore the structures using the list.</div>}
      onCreated={({ gl }) => {
        canvasRef.current = gl.domElement;
        gl.domElement.setAttribute("aria-label", "Interactive heart model. Use the structure list and view controls for keyboard navigation.");
        gl.domElement.addEventListener("webglcontextlost", handleContextLost);
      }}
      onPointerMissed={(event) => { if (event.type === "click" && event.button === 0 && !gesture.current.dragged) dispatch({ type: "select", id: null }); }}>
      <color attach="background" args={["#0f1724"]} />
      <HeartLighting />
      <group ref={model}>
        {asset.kind === "imported" ?
          <ImportedHeart model={asset.model} state={renderState} dispatch={dispatch} registry={registry} gesture={gesture} />
        : null}
      </group>
      <HeartCamera request={state.cameraRequest} model={model} registry={registry} surface={surfaceRef} framing={framing} gesture={gesture} selectedId={state.selectedId} selectedGroupId={state.selectedGroupId} selectionRevision={state.selectionRevision} assessment={assessment} assessmentTarget={assessmentTarget} assessmentKey={assessmentKey} modelRevision={asset.kind} />
      <AnnotationProjector state={state} dispatch={dispatch} model={model} surface={surfaceRef} registry={registry} nodes={nodes} projectionRef={projectionRef} />
      {process.env.NODE_ENV === "development" && <ViewerDiagnostics surface={surfaceRef} importedModel={asset.kind === "imported" ? asset.model : undefined} />}
    </Canvas>
    <HeartAnnotations state={state} dispatch={dispatch} nodes={nodes} assessment={assessment} />
    {!assessment && (activeGroup || activePart) && <div className="vessel-highlight-label" role="status" style={{ "--vessel-highlight": vesselHighlightColor(activeGroup?.structureIds ?? (activePart ? [activePart.id] : [])) } as CSSProperties}><strong>{activeGroup?.label ?? activePart?.name}</strong>{activeGroup && !state.isolatedId && <span>Click to choose a numbered segment.</span>}</div>}
    {chosenGroup && <VesselSegmentChoices target={chosenGroup} dispatch={dispatch} assessment={assessment} />}
    {asset.kind === "loading" && <div className="model-status" role="status">Loading your heart model{download.total ? ` · ${Math.min(100, Math.round(download.bytes / download.total * 100))}%` : "…"}.</div>}
    {asset.kind === "error" && <div className="model-status" role="status">The heart model could not load. Please retry to continue.<button type="button" className="control" onClick={retry}>Retry model</button></div>}
    {!assessment && unplacedMarkers.length > 0 && <div className="model-status" role="status">{unplacedMarkers.length === 1
      ? `${unplacedMarkers[0].name} is available in the structure list; its 3D marker has not been placed.`
      : capabilities.markerIds.length ? "Vessel tagging is in progress. All structures remain available in the list." : "Vessel markers have not been added yet."}</div>}
    {!assessment && asset.kind === "imported" && capabilities.markerIds.length === HEART_PARTS.length && capabilities.meshIds.length < HEART_PARTS.length && <div className="model-status" role="status">Some vessel highlights are awaiting model review. All numbered structures remain available.</div>}
  </div>;
}
