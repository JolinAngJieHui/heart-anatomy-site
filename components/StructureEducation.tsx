"use client";
import { useEffect, useRef, type Dispatch } from "react";
import { getHeartPart } from "@/lib/heart-parts";
import { EDUCATION, REFERENCES } from "@/lib/education";
import type { SceneAction, SceneState } from "@/lib/scene-state";
import { minimalReadingReferences } from "@/lib/knowledge-base/minimal-public";

export default function StructureEducation({ state, dispatch, collectionId }: { state: SceneState; dispatch: Dispatch<SceneAction>; collectionId?: string }) {
  const selected = getHeartPart(state.selectedId);
  const entry = selected && EDUCATION[selected.id];
  const reading = selected ? minimalReadingReferences(selected.id, collectionId) : null;
  const explanation = useRef<HTMLDivElement>(null);
  useEffect(() => { if (explanation.current) explanation.current.scrollTop = 0; }, [state.selectedId, state.learningLevel]);
  return <article className="detail-card" id="structure-details" aria-labelledby="detail-title">
    <div className="detail-card-controls">
      <button className="control" type="button" aria-label="Close anatomical information"
        onClick={() => dispatch({ type: "select", id: null })}>Close <span aria-hidden="true">&times;</span></button>
    </div>
    <div className="detail-body" ref={explanation} tabIndex={0} aria-label="Anatomical explanation">
      {selected && entry ? <>
        <p className="eyebrow">Marker {selected.number} <span>{selected.shortName}</span></p>
        <h2 id="detail-title">{selected.name}</h2>
        <p className="explanation-level">{state.learningLevel} explanation</p>
        <p className="detail-summary">{entry[state.learningLevel]}</p>
        <div className="blood-flow"><h3>Blood flow</h3><ol>{entry.bloodFlow.map((step, index) => <li key={index}>{step}</li>)}</ol></div>
        <div className="education-references"><h3>References</h3>{reading && <small>Reading from the active reference collection.</small>}<ul>{reading ? reading.map(source => <li key={source.id}><a href={source.url} target="_blank" rel="noopener noreferrer">[{source.id}] {source.title}</a></li>) : entry.references.map((id) => <li key={id}>
          <a href={REFERENCES[id].url} target="_blank" rel="noopener noreferrer">{REFERENCES[id].title}</a>
        </li>)}</ul></div>
      </> : <><h2 id="detail-title">What would you like to explore?</h2><p className="detail-summary">Select a numbered marker or vessel from the list.</p></>}
    </div>
  </article>;
}
