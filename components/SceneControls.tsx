"use client";
import type { Dispatch } from "react";
import type { SceneAction, SceneState } from "@/lib/scene-state";
import { UNLOADED_MODEL, type ModelCapabilities } from "@/lib/model-config";
export default function SceneControls({ state, dispatch, capabilities = UNLOADED_MODEL }: { state: SceneState; dispatch: Dispatch<SceneAction>; capabilities?: ModelCapabilities }) {
  const isolated = !!(state.isolatedId || state.isolatedGroupId);
  const canIsolate = isolated || (!!state.selectedId && (capabilities.kind !== "imported" || capabilities.meshIds.includes(state.selectedId) || capabilities.markerIds.includes(state.selectedId)));
  const help = state.selectedId ? "This structure has not been tagged on the model yet" : "Select a structure to isolate";
  return <div className="scene-toolbar" role="group" aria-label="3D view controls">
    <button className="control" type="button" onClick={() => dispatch({ type: "camera", kind: "reset" })}>Reset view</button>
    <div className="isolation-control">
      <button type="button" role="switch" className="isolation-switch"
        aria-label="Isolate Structure" aria-checked={isolated && canIsolate} disabled={!canIsolate}
        aria-describedby={!canIsolate ? "isolation-help" : undefined}
        onClick={() => dispatch({ type: isolated ? "show-all" : "isolate" })}>
        <span className="switch-track" aria-hidden="true"><span className="switch-thumb" /></span>
        <span>Isolate Structure</span><span className="switch-status" aria-hidden="true">{isolated ? "ON" : "OFF"}</span>
      </button>
      {!canIsolate && <span id="isolation-help" className="isolation-help">{help}</span>}
    </div>
    <button className="control" type="button" disabled={!capabilities.markerIds.length} aria-pressed={state.markersVisible} onClick={() => dispatch({ type: "markers" })}>{state.markersVisible ? "Hide Markers" : "Show Markers"}</button>
  </div>;
}
