"use client";
import { useLayoutEffect, useRef, type Dispatch, type RefObject } from "react";
import type { SceneAction, SceneState } from "@/lib/scene-state";
import { dockInformationCard } from "@/lib/stable-card-layout";
import { intersect } from "@/lib/panel-framing";
import type { SelectedMarkerProjection } from "./HeartAnnotations";
import StructureEducation from "./StructureEducation";

export default function FloatingStructureEducation({ state, dispatch, projectionRef, surface, collectionId }: {
  state: SceneState; dispatch: Dispatch<SceneAction>; projectionRef: RefObject<SelectedMarkerProjection | null>;
  surface: RefObject<HTMLDivElement | null>;
  collectionId?: string;
}) {
  const layer = useRef<HTMLDivElement>(null);
  const card = useRef<HTMLDivElement>(null);
  const line = useRef<SVGLineElement>(null);
  const dock = useRef<{ key: string; placement: ReturnType<typeof dockInformationCard> } | null>(null);
  useLayoutEffect(() => {
    if (!state.selectedId) { dock.current = null; return; }
    let frame: number;
    const update = () => {
      if (layer.current && card.current && line.current) {
        const root = layer.current.getBoundingClientRect();
        const view = surface.current?.getBoundingClientRect();
        const tutor = layer.current.closest(".workspace-content")?.querySelector<HTMLElement>("#anatomy-tutor");
        const tutorRect = tutor && !tutor.hidden ? tutor.getBoundingClientRect() : null;
        const tutorOverlap = view && tutorRect ? intersect(view, tutorRect) : null;
        const usableWidth = view ? view.width - (tutorOverlap?.width ?? 0) : 0;
        const compact = !view || usableWidth < 600 || view.height < 300;
        const sheetWidth = tutorRect && view && tutorRect.y <= view.y && tutorRect.height >= view.height
          ? Math.max(0, Math.min(root.width, tutorRect.x - root.x)) : root.width;
        const bounds = !compact && view ? { x: view.x - root.x, y: view.y - root.y, width: view.width, height: view.height }
          : { x: 0, y: 0, width: sheetWidth, height: root.height };
        const anchor = projectionRef.current?.id === state.selectedId ? projectionRef.current : null;
        const point = anchor && view ? { x: view.x - root.x + anchor.x, y: view.y - root.y + anchor.y } : null;
        const width = compact ? Math.min(356, root.width - 16) : 356;
        const height = compact ? Math.min(400, root.height * .42) : Math.min(560, bounds.height - 16);
        const key = [bounds.x, bounds.y, bounds.width, bounds.height, compact].map(v => typeof v === "number" ? Math.round(v) : v).join(":");
        if (dock.current?.key !== key) {
          const placement = dockInformationCard(bounds, width, height, compact);
          dock.current = { key, placement };
          Object.assign(card.current.style, { left: `${placement.x}px`, top: `${placement.y}px`, width: `${placement.width}px`, height: `${placement.height}px` });
        }
        const placed = dock.current.placement;
        card.current.dataset.placement = compact ? "sheet" : placed.side;
        card.current.dataset.anchorVisible = String(!!point);
        const inside = !!point && point.x >= placed.x && point.x <= placed.x + placed.width && point.y >= placed.y && point.y <= placed.y + placed.height;
        line.current.style.display = point && !inside ? "" : "none";
        line.current.setAttribute("x1", String(point?.x ?? 0));
        line.current.setAttribute("y1", String(point?.y ?? 0));
        line.current.setAttribute("x2", String(Math.max(placed.x, Math.min(placed.x + placed.width, point?.x ?? placed.x))));
        line.current.setAttribute("y2", String(Math.max(placed.y, Math.min(placed.y + placed.height, point?.y ?? placed.y))));
        line.current.dataset.behind = String(!!anchor?.behind);
      }
      frame = requestAnimationFrame(update);
    };
    update();
    return () => cancelAnimationFrame(frame);
  }, [state.selectedId, projectionRef, surface]);
  return <div className="information-overlay" ref={layer} hidden={!state.selectedId}>
    <svg aria-hidden="true"><line ref={line} className="information-leader" style={{ display: "none" }} /></svg>
    <div className="information-card-position" ref={card}>
      <StructureEducation state={state} dispatch={dispatch} collectionId={collectionId} />
    </div>
  </div>;
}
