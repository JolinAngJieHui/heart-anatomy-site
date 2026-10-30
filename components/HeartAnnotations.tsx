"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { useLayoutEffect, useRef, type CSSProperties, type Dispatch, type RefObject } from "react";
import { vesselHighlightColor, vesselKind } from "@/lib/vessel-highlight";
import type { Group } from "three";
import { HEART_PARTS, type HeartPartId } from "@/lib/heart-parts";
import { placeMarkers, type ProjectedMarker } from "@/lib/marker-layout";
import type { SceneAction, SceneState } from "@/lib/scene-state";
import type { ModelRegistry } from "@/lib/model-registry";
import { MarkerVisibility } from "@/lib/marker-visibility";

export type SelectedMarkerProjection = { id: HeartPartId; x: number; y: number; behind: boolean };

export type AnnotationNodes = Map<HeartPartId, { button?: HTMLButtonElement; line?: SVGLineElement }>;

export function AnnotationProjector({ state, dispatch, model, surface, registry, nodes, projectionRef }: {
  state: SceneState; dispatch: Dispatch<SceneAction>; model: RefObject<Group | null>; surface: RefObject<HTMLDivElement | null>;
  registry: RefObject<ModelRegistry>; nodes: RefObject<AnnotationNodes>; projectionRef: RefObject<SelectedMarkerProjection | null>;
}) {
  const invalidate = useThree(value => value.invalidate);
  const visibility = useRef<MarkerVisibility | null>(null);
  const lastPlacement = useRef("");
  useLayoutEffect(() => { invalidate(); }, [invalidate, state]);
  useFrame(({ camera, size }) => {
    if (!model.current) return;
    const checker = visibility.current ??= new MarkerVisibility();
    const results = checker.update(camera, model.current, registry.current);
    // Hover/level changes and demand-render tails often leave the view unchanged.
    // Do not rerun decluttering or touch the DOM unless visibility/layout changed.
    const placement = `${checker.stats.revision}:${size.width}:${size.height}:${state.selectedId}:${state.isolatedId}:${state.markersVisible}`;
    if (placement === lastPlacement.current) return;
    lastPlacement.current = placement;
    const anchors: ProjectedMarker[] = [];
    const ordered = [...HEART_PARTS].sort((a, b) => Number(b.id === state.selectedId) - Number(a.id === state.selectedId));
    for (const part of ordered) {
      const result = results.get(part.id);
      if (!state.markersVisible || !result?.visible || (state.isolatedId && state.isolatedId !== part.id)) continue;
      // Visibility uses the anatomical point, before any screen-space displacement.
      anchors.push({ id: part.id, x: (result.projected.x + 1) * size.width / 2, y: (1 - result.projected.y) * size.height / 2, behind: false });
    }
    projectionRef.current = null;
    const placed = placeMarkers(anchors, size.width, size.height);
    const visible = new Set(placed.map(({ id }) => id));
    nodes.current.forEach((node, id) => {
      const hiding = !visible.has(id);
      if (node.button && node.button.hidden !== hiding) {
        const active = node.button.dataset.markerActive === "true";
        node.button.hidden = hiding;
        if (hiding) {
          // Blurring removes keyboard focus; the hidden subtree also removes its
          // tooltip and pointer target. Do not clear sidebar or mesh hover state.
          if (node.button === document.activeElement) node.button.blur();
          else if (active && state.hoveredId === id) dispatch({ type: "hover", id: null });
          delete node.button.dataset.markerActive;
        }
      }
      if (node.line) node.line.style.display = visible.has(id) ? "" : "none";
    });
    if (process.env.NODE_ENV === "development") surface.current?.setAttribute("data-marker-visibility", JSON.stringify({
      ...checker.stats, anchors: [...results].map(([id, result]) => ({ id, visible: result.visible, reason: result.reason, obstruction: result.obstruction, world: result.world.toArray(), projected: result.projected.toArray() })),
    }));
    placed.forEach(({ id, x, y, markerX, markerY, behind }) => {
      if (id === state.selectedId) projectionRef.current = { id, x: markerX, y: markerY, behind: !!behind };
      const node = nodes.current.get(id);
      if (node?.button) {
        node.button.style.left = `${markerX}px`;
        node.button.style.top = `${markerY}px`;
        node.button.dataset.behind = String(behind);
        node.button.style.setProperty("--tooltip-shift", `${Math.max(0, 110 - markerX) - Math.max(0, markerX + 110 - size.width)}px`);
        node.button.dataset.tooltipBelow = String(markerY < 70);
      }
      if (node?.line) {
        node.line.setAttribute("x1", String(x)); node.line.setAttribute("y1", String(y));
        node.line.setAttribute("x2", String(markerX)); node.line.setAttribute("y2", String(markerY));
        node.line.dataset.behind = String(behind);
      }
    });
  });
  return null;
}

export default function HeartAnnotations({ state, dispatch, nodes, assessment = false }: {
  state: SceneState; dispatch: Dispatch<SceneAction>; nodes: RefObject<AnnotationNodes>; assessment?: boolean;
}) {
  function register(id: HeartPartId, element: { button?: HTMLButtonElement; line?: SVGLineElement }) {
    nodes.current.set(id, { ...nodes.current.get(id), ...element });
  }
  return <div className="annotation-layer" aria-label="Numbered anatomical markers">
    <svg aria-hidden="true">{HEART_PARTS.map(({ id }) => <line key={id} ref={(node) => register(id, { line: node ?? undefined })}
      className={state.selectedId === id ? "leader selected" : "leader"} style={{ display: "none", "--vessel-highlight": assessment ? undefined : vesselHighlightColor([id]) } as CSSProperties} />)}</svg>
    {HEART_PARTS.map((part) => <button key={part.id} ref={(node) => register(part.id, { button: node ?? undefined })}
      hidden type="button" className={`anatomy-marker ${state.selectedId === part.id ? "selected" : ""} ${state.hoveredId === part.id ? "hovered" : ""}`}
      data-marker-id={part.id} data-explored={assessment ? undefined : state.visitedIds.includes(part.id)}
      data-vessel-kind={assessment ? undefined : vesselKind(part.id)} style={{ "--vessel-highlight": assessment ? undefined : vesselHighlightColor([part.id]) } as CSSProperties}
      aria-pressed={state.selectedId === part.id} aria-label={assessment ? `Marker ${part.number}` : `Marker ${part.number}: ${part.name}`}
      aria-describedby={assessment ? undefined : `marker-tooltip-${part.id}`} aria-controls={assessment ? undefined : "structure-details"}
      onClick={() => dispatch({ type: "select", id: part.id })}
      onPointerEnter={event => { event.currentTarget.dataset.markerActive = "true"; dispatch({ type: "hover", id: part.id }); }}
      onPointerLeave={event => { delete event.currentTarget.dataset.markerActive; dispatch({ type: "hover", id: null }); }}
      onFocus={event => { event.currentTarget.dataset.markerActive = "true"; dispatch({ type: "hover", id: part.id }); }}
      onBlur={event => { delete event.currentTarget.dataset.markerActive; dispatch({ type: "hover", id: null }); }}>
      <span aria-hidden="true">{part.number}</span>
      {!assessment && <span className="marker-tooltip" id={`marker-tooltip-${part.id}`} role="tooltip">{part.name}</span>}
    </button>)}
  </div>;
}
