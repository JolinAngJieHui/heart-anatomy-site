"use client";
import { useId, useLayoutEffect, useRef, useState, type Dispatch } from "react";
import { createPortal } from "react-dom";
import { LEARNING_LEVELS, LEARNING_LEVEL_DESCRIPTIONS, type LearningLevel } from "@/lib/education";
import type { SceneAction, SceneState } from "@/lib/scene-state";

type DescriptionAnchor = { element: HTMLElement; level?: LearningLevel };
function LevelDescription({ anchor, level, id }: { anchor: HTMLElement; level: LearningLevel; id: string }) {
  const overlay = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const position = () => {
      if (!overlay.current) return;
      const rect = anchor.getBoundingClientRect(), viewport = window.visualViewport;
      if (!anchor.isConnected || !rect.width || !rect.height || anchor.closest('[hidden], [inert]')) { overlay.current.style.visibility = "hidden"; return; }
      const left = viewport?.offsetLeft ?? 0, top = viewport?.offsetTop ?? 0;
      const width = viewport?.width ?? innerWidth, height = viewport?.height ?? innerHeight;
      const tooltipWidth = Math.min(300, width - 24);
      Object.assign(overlay.current.style, {
        width: `${tooltipWidth}px`, left: `${Math.max(left + 12, Math.min(rect.left + rect.width / 2 - tooltipWidth / 2, left + width - tooltipWidth - 12))}px`,
        top: `${rect.bottom + 8}px`, maxHeight: `${Math.max(48, top + height - rect.bottom - 20)}px`, visibility: "visible",
      });
    };
    position();
    const observer = new ResizeObserver(position);
    for (const element of [anchor, anchor.parentElement, anchor.parentElement?.parentElement]) if (element) observer.observe(element);
    window.addEventListener("resize", position); window.addEventListener("scroll", position, true);
    window.visualViewport?.addEventListener("resize", position); window.visualViewport?.addEventListener("scroll", position);
    return () => {
      observer.disconnect(); window.removeEventListener("resize", position); window.removeEventListener("scroll", position, true);
      window.visualViewport?.removeEventListener("resize", position); window.visualViewport?.removeEventListener("scroll", position);
    };
  }, [anchor]);
  return createPortal(<div ref={overlay} id={id} role="tooltip" className="learning-level-tooltip" style={{ visibility: "hidden" }}>{LEARNING_LEVEL_DESCRIPTIONS[level]}</div>, document.body);
}

export default function LearningLevelControls({ state, dispatch }: { state: SceneState; dispatch: Dispatch<SceneAction> }) {
  const id = useId();
  const [hovered, setHovered] = useState<DescriptionAnchor | null>(null), [focused, setFocused] = useState<DescriptionAnchor | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const active = dismissed ? null : hovered ?? focused;
  const activeLevel = active?.level ?? state.learningLevel;
  return <div className="learning-levels" role="group" aria-label="Learning level" onKeyDown={event => { if (event.key === "Escape" && active) { setDismissed(true); event.preventDefault(); event.stopPropagation(); } }}>
    {LEARNING_LEVELS.map((level) => <button type="button" key={level} className="control"
      aria-describedby={active?.level === level ? id : undefined}
      onPointerEnter={event => { if (event.pointerType !== "touch") { setHovered({ element: event.currentTarget, level }); setDismissed(false); } }} onPointerLeave={() => setHovered(null)}
      onFocus={event => { setFocused({ element: event.currentTarget, level }); setDismissed(false); }} onBlur={() => setFocused(null)}
      aria-pressed={state.learningLevel === level} onClick={() => dispatch({ type: "level", level })}>{level}</button>)}
    <select className="learning-level-select control" aria-label="Learning level" value={state.learningLevel}
      aria-describedby={active && !active.level ? id : undefined}
      onPointerEnter={event => { if (event.pointerType !== "touch") { setHovered({ element: event.currentTarget }); setDismissed(false); } }} onPointerLeave={() => setHovered(null)}
      onFocus={event => { setFocused({ element: event.currentTarget }); setDismissed(false); }} onBlur={() => setFocused(null)}
      onChange={(event) => dispatch({ type: "level", level: event.target.value as LearningLevel })}>
      {LEARNING_LEVELS.map((level) => <option key={level} value={level}>{level[0].toUpperCase() + level.slice(1)}</option>)}
    </select>
    {active && <LevelDescription anchor={active.element} level={activeLevel} id={id} />}
  </div>;
}
