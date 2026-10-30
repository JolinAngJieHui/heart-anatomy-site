"use client";
import { useThree, type ThreeEvent } from "@react-three/fiber";
import { useLayoutEffect, type Dispatch, type RefObject } from "react";
import type { PreparedHeartModel } from "@/lib/imported-model";
import type { ModelRegistry, PointerGesture } from "@/lib/model-registry";
import type { SceneAction, SceneState } from "@/lib/scene-state";

/** Owns only scene bindings; the asset hook owns loading and disposal. */
export default function ImportedHeart({ model, state, dispatch, registry, gesture }: {
  model: PreparedHeartModel; state: SceneState; dispatch: Dispatch<SceneAction>; registry: RefObject<ModelRegistry>; gesture: RefObject<PointerGesture>;
}) {
  const invalidate = useThree(value => value.invalidate);
  const canvas = useThree(value => value.gl.domElement);
  useLayoutEffect(() => {
    const leave = () => dispatch({ type: "hover", id: null });
    canvas.addEventListener("pointerleave", leave);
    window.addEventListener("blur", leave);
    return () => { canvas.removeEventListener("pointerleave", leave); window.removeEventListener("blur", leave); };
  }, [canvas, dispatch]);
  useLayoutEffect(() => {
    const current = registry.current;
    current.clear();
    model.registry.forEach((structure, id) => current.set(id, structure));
    return () => { current.clear(); };
  }, [model, registry]);
  useLayoutEffect(() => { model.applySelection(state.selectedId, state.hoveredId, state.isolatedId, state.selectedGroupId, state.hoveredGroupId, state.isolatedGroupId); invalidate(); }, [model, state.selectedId, state.hoveredId, state.isolatedId, state.selectedGroupId, state.hoveredGroupId, state.isolatedGroupId, invalidate]);
  // Untagged photographic scans have nothing to pick. Registering an ancestor
  // handler would otherwise raycast every triangle on every pointer movement.
  if (!model.owners.size) return <primitive object={model.container} dispose={null} />;
  function hover(event: ThreeEvent<PointerEvent>) {
    const target = model.owners.get(event.object);
    // The nearest opaque context surface blocks vessels behind the heart too.
    event.stopPropagation();
    if (target?.groupId) {
      if (state.hoveredGroupId !== target.groupId) dispatch({ type: "hover-group", id: target.groupId });
    } else if (state.hoveredId !== (target?.structureIds[0] ?? null) || state.hoveredGroupId) {
      dispatch({ type: "hover", id: target?.structureIds[0] ?? null });
    }
  }
  return <primitive object={model.container} dispose={null}
    onClick={(event: ThreeEvent<MouseEvent>) => {
      const target = model.owners.get(event.object);
      event.stopPropagation();
      if (event.button === 0 && !gesture.current.dragged && event.delta <= 6) {
        // Clicking the already isolated whole vessel retains its chosen segment.
        // Opening segment choices here would exit isolation and reapply a tint.
        if (state.isolatedId && target?.structureIds.includes(state.isolatedId)) dispatch({ type: "select", id: state.isolatedId });
        else dispatch(target?.groupId ? { type: "select-group", id: target.groupId } : { type: "select", id: target?.structureIds[0] ?? null });
      }
    }} onPointerOver={hover} onPointerMove={hover} onPointerOut={(event: ThreeEvent<PointerEvent>) => {
      const previous = model.owners.get(event.object), next = model.owners.get(event.intersections[0]?.object);
      // Moving across texture primitives of the same vessel keeps one highlight.
      if (previous && previous === next) return;
      dispatch({ type: "hover", id: null });
    }} />;
}
