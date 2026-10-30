"use client";
import { useEffect, useRef, type Dispatch } from "react";
import { HEART_PARTS, STRUCTURE_GROUPS, CATEGORY_NAMES } from "@/lib/heart-parts";
import type { SceneAction, SceneState } from "@/lib/scene-state";

export default function StructureCatalog({ state, dispatch }: { state: SceneState; dispatch: Dispatch<SceneAction> }) {
  const catalog = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const container = catalog.current;
    const button = container?.querySelector<HTMLButtonElement>(`[data-structure-id="${state.selectedId}"]`);
    if (!container || !button) return;
    const region = container.getBoundingClientRect();
    const item = button.getBoundingClientRect();
    if (item.top < region.top) container.scrollTop += item.top - region.top - 4;
    else if (item.bottom > region.bottom) container.scrollTop += item.bottom - region.bottom + 4;
  }, [state.selectedId]);
  return <div className="structure-list structure-catalog" ref={catalog}>
    {STRUCTURE_GROUPS.map((group) => <section key={group.id} aria-labelledby={`category-${group.id}`}>
      <h3 className="category-heading" id={`category-${group.id}`}>{group.name}</h3>
      <p className="category-note">{group.note}</p>
      <ul className="category-list">{HEART_PARTS.filter((part) => part.group === group.id).map((part) =>
        <li key={part.id}><button type="button" data-structure-id={part.id}
          className={`structure-button ${state.selectedId === part.id ? "selected" : ""} ${state.hoveredId === part.id ? "hovered" : ""}`}
          aria-pressed={state.selectedId === part.id} aria-controls="structure-details"
          onClick={() => dispatch({ type: "select", id: part.id })}
          onPointerEnter={() => dispatch({ type: "hover", id: part.id })}
          onPointerLeave={() => dispatch({ type: "hover", id: null })}
          onFocus={() => dispatch({ type: "hover", id: part.id })}
          onBlur={() => dispatch({ type: "hover", id: null })}>
          <span className="structure-number">{part.number}</span>
          <span className="structure-name">{part.name}<small>{CATEGORY_NAMES[part.category]}</small></span>
          <span className="structure-abbr" aria-hidden="true">{part.shortName}</span>
        </button></li>
      )}</ul>
    </section>)}
  </div>;
}
