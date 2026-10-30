import type { HeartPartId } from "./heart-parts";
import type { LearningLevel } from "./education";

export type CameraRequest = {
  sequence: number;
  kind: "reset" | "zoom-in" | "zoom-out";
};
export type SceneState = {
  selectedId: HeartPartId | null;
  selectionRevision: number;
  hoveredId: HeartPartId | null;
  selectedGroupId: string | null;
  hoveredGroupId: string | null;
  isolatedId: HeartPartId | null;
  isolatedGroupId?: string | null;
  markersVisible: boolean;
  learningLevel: LearningLevel;
  visitedIds: HeartPartId[];
  cameraRequest: CameraRequest | null;
};
export type SceneAction =
  | { type: "select"; id: HeartPartId | null }
  | { type: "clear-progress" }
  | { type: "hover"; id: HeartPartId | null }
  | { type: "select-group"; id: string }
  | { type: "hover-group"; id: string | null }
  | { type: "markers" }
  | { type: "level"; level: LearningLevel }
  | { type: "isolate" }
  | { type: "show-all" }
  | { type: "camera"; kind: CameraRequest["kind"] };

export const INITIAL_SCENE: SceneState = {
  selectedId: null, selectionRevision: 0, hoveredId: null, isolatedId: null,
  selectedGroupId: null, hoveredGroupId: null, isolatedGroupId: null,
  markersVisible: true, learningLevel: "basic",
  visitedIds: [], cameraRequest: null,
};

export function sceneReducer(state: SceneState, action: SceneAction): SceneState {
  switch (action.type) {
    case "select":
      return { ...state, selectedId: action.id, hoveredId: null, selectedGroupId: null, hoveredGroupId: null,
        selectionRevision: state.selectionRevision + 1,
        visitedIds: action.id && !state.visitedIds.includes(action.id) ? [...state.visitedIds, action.id] : state.visitedIds,
        // Sidebar selection stays useful even inside an isolated view.
        isolatedId: state.isolatedId || state.isolatedGroupId ? action.id : null, isolatedGroupId: null };
    case "clear-progress": return { ...state, visitedIds: [] };
    case "hover": return { ...state, hoveredId: action.id, hoveredGroupId: null };
    // Whole-vessel picking cannot identify or record one of its segments.
    case "select-group": return { ...state, selectedId: null, selectedGroupId: action.id, hoveredId: null, hoveredGroupId: null, isolatedGroupId: state.isolatedId || state.isolatedGroupId ? action.id : null, isolatedId: null, selectionRevision: state.selectionRevision + 1 };
    case "hover-group": return { ...state, hoveredGroupId: action.id, ...(action.id ? { hoveredId: null } : {}) };
    case "markers": return { ...state, markersVisible: !state.markersVisible, hoveredId: null, hoveredGroupId: null };
    case "level": return { ...state, learningLevel: action.level };
    case "isolate": return state.selectedId ? { ...state, isolatedId: state.selectedId, hoveredId: null, hoveredGroupId: null } : state;
    case "show-all": return { ...state, isolatedId: null, isolatedGroupId: null, hoveredId: null, hoveredGroupId: null };
    case "camera": {
      return { ...state, ...(action.kind === "reset" ? { selectedId: null, hoveredId: null, isolatedId: null, isolatedGroupId: null, selectedGroupId: null, hoveredGroupId: null } : {}), cameraRequest: { kind: action.kind,
        sequence: (state.cameraRequest?.sequence ?? 0) + 1 } };
    }
  }
}
