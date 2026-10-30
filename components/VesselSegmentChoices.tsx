"use client";
import { useLayoutEffect, useRef, type Dispatch } from "react";
import { getHeartPart } from "@/lib/heart-parts";
import type { VesselTarget } from "@/lib/imported-model";
import type { SceneAction } from "@/lib/scene-state";

/** A whole-artery surface has no segment boundaries. Let the student choose. */
export default function VesselSegmentChoices({ target, dispatch, assessment = false }: { target: VesselTarget; dispatch: Dispatch<SceneAction>; assessment?: boolean }) {
  const panel = useRef<HTMLElement>(null);
  useLayoutEffect(() => { panel.current?.querySelector<HTMLButtonElement>("[data-vessel-segment]")?.focus({ preventScroll: true }); }, [target.groupId]);
  return <section ref={panel} className="vessel-segment-choices" role="dialog" aria-label={assessment ? "Choose a numbered segment" : `${target.label} segments`} onKeyDown={event => {
    if (event.key === "Escape") { event.stopPropagation(); dispatch({ type: "select", id: null }); }
  }}>
    <div><h3>{assessment ? "Choose a numbered marker" : target.label}</h3><button type="button" className="control" aria-label="Close vessel choices" onClick={() => dispatch({ type: "select", id: null })}>×</button></div>
    <p>Choose the numbered segment you intend to select.</p>
    {target.structureIds.map(id => { const part = getHeartPart(id)!; return <button type="button" className="control" data-vessel-segment={id} key={id} onClick={() => dispatch({ type: "select", id })}><span>{part.number}</span>{assessment ? `Marker ${part.number}` : part.name}</button>; })}
  </section>;
}
