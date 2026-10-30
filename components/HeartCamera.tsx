"use client";
import { useFrame, useThree } from "@react-three/fiber";
import { useLayoutEffect, useRef, type RefObject } from "react";
import { PerspectiveCamera, Quaternion, Vector3, type Group } from "three";
import { DEFAULT_CAMERA, DEFAULT_TARGET, IMPORTED_RESET_ROTATION, IMPORTED_RESET_TARGET, importedCameraDistance } from "@/lib/heart-model";
import { modelScreenBounds } from "@/lib/model-screen-bounds";
import { planFraming, visibleFraction, type FramingBridge, type ScreenPoint } from "@/lib/panel-framing";
import type { CameraRequest } from "@/lib/scene-state";
import type { HeartPartId } from "@/lib/heart-parts";
import type { ModelRegistry, PointerGesture } from "@/lib/model-registry";
import { applyHeartPan, rotateHeartCamera, zoomHeartCamera, MIN_HEART_DISTANCE, MAX_HEART_DISTANCE } from "@/lib/free-heart-camera";
import { vesselView } from "@/lib/vessel-navigation";
import { vesselGroups } from "@/lib/tutor/vessel-groups";
import { connectHeartNavigation } from "@/lib/heart-navigation-input";

const DURATION = 420;
type Pose = { target: Vector3; rotation: Quaternion; distance: number; zoom: number };
type Transition = { start: number; duration: number; from: ScreenPoint; to: ScreenPoint; fromPose: Pose; toPose: Pose; reset: boolean };

export default function HeartCamera({ request, model, registry, surface, framing, gesture, selectedId, selectionRevision, selectedGroupId = null, assessmentTarget = null, assessmentKey = "", assessment = false, modelRevision = "loading" }: {
  request: CameraRequest | null; model: RefObject<Group | null>;
  registry: RefObject<ModelRegistry>; selectionRevision: number; selectedGroupId?: string | null; assessmentTarget?: HeartPartId | null; assessmentKey?: string; assessment?: boolean; modelRevision?: string;
  surface: RefObject<HTMLDivElement | null>; framing: RefObject<FramingBridge>; selectedId: HeartPartId | null;
  gesture: RefObject<PointerGesture>;
}) {
  const target = useRef(new Vector3(...DEFAULT_TARGET));
  const shift = useRef<ScreenPoint>({ x: 0, y: 0 });
  const pending = useRef(true), manual = useRef(false);
  const transition = useRef<Transition | null>(null);
  const trigger = useRef({ key: "", since: 0 });
  const consumedRequest = useRef(0);
  const diagnosticsTime = useRef(0), transactions = useRef(0);
  const dimension = useRef({ width: 0, height: 0 });
  const fittedImport = useRef(false);
  const navigatedRevision = useRef(-1);
  const previousAssessment = useRef("");
  const invalidate = useThree(state => state.invalidate);
  const liveCamera = useThree(state => state.camera);
  const get = useThree(state => state.get);
  const latestRequest = useRef(0);
  useLayoutEffect(() => { latestRequest.current = request?.sequence ?? 0; }, [request]);
  useLayoutEffect(() => {
    const element = surface.current;
    if (!element || !(liveCamera instanceof PerspectiveCamera)) return;
    liveCamera.up.set(0, 1, 0); liveCamera.lookAt(target.current);
    const changed = () => {
      const { width, height } = get().size;
      applyHeartPan(liveCamera, shift.current, width, height); invalidate();
    };
    changed();
    return connectHeartNavigation(element, gesture.current, {
      start: () => { pending.current = false; transition.current = null; manual.current = true; consumedRequest.current = latestRequest.current; },
      end: () => { manual.current = false; pending.current = false; invalidate(); },
      rotate: (dx, dy) => { rotateHeartCamera(liveCamera, target.current, dx, dy, get().size.height); changed(); },
      pan: (dx, dy) => { shift.current = { x: shift.current.x + dx, y: shift.current.y + dy }; changed(); },
      zoom: factor => { zoomHeartCamera(liveCamera, target.current, factor); changed(); },
    });
  }, [liveCamera, surface, gesture, invalidate, get]);
  useLayoutEffect(() => {
    const bridge = framing.current;
    Object.assign(bridge, { invalidate });
    invalidate();
    return () => { if (bridge.invalidate === invalidate) Object.assign(bridge, { invalidate: undefined }); };
  }, [framing, invalidate]);
  useLayoutEffect(() => { invalidate(); }, [invalidate, request, selectedId, selectedGroupId, assessmentTarget, assessmentKey, selectionRevision, modelRevision]);
  useFrame(({ camera, size }) => {
    const root = model.current;
    if (!root || !(camera instanceof PerspectiveCamera) || size.width < 1 || size.height < 1) return;
    const now = performance.now();
    const apply = () => {
      // Reuse the existing off-axis pan: orientation, orbit distance and anatomy
      // stay unchanged while the projected marker moves to the clear area.
      applyHeartPan(camera, shift.current, size.width, size.height);
    };
    if (dimension.current.width !== size.width || dimension.current.height !== size.height) {
      dimension.current = { width: size.width, height: size.height }; apply();
    }
    if (camera.view?.offsetX !== -shift.current.x || camera.view?.offsetY !== -shift.current.y) apply();
    // Complete the single automatic transition before annotations project at 0.
    // Manual input always reads this live pose, with no cached spherical angles.
    const active = transition.current;
    if (active) {
      const t = Math.min(1, (now - active.start) / active.duration);
      const ease = t * t * (3 - 2 * t);
      shift.current = { x: active.from.x + (active.to.x - active.from.x) * ease, y: active.from.y + (active.to.y - active.from.y) * ease };
      target.current.lerpVectors(active.fromPose.target, active.toPose.target, ease);
      camera.quaternion.slerpQuaternions(active.fromPose.rotation, active.toPose.rotation, ease);
      const distance = active.fromPose.distance + (active.toPose.distance - active.fromPose.distance) * ease;
      camera.position.set(0, 0, distance).applyQuaternion(camera.quaternion).add(target.current);
      camera.zoom = active.fromPose.zoom + (active.toPose.zoom - active.fromPose.zoom) * ease;
      apply();
      if (t === 1) transition.current = null;
    }
    const viewport = { x: 0, y: 0, width: size.width, height: size.height };
    const layout = assessment ? { revision: 1, viewport, obstacles: [], cardOpen: false, tutorOpen: false } : framing.current.layout;
    const subjectId = assessment ? null : selectedId;
    const focusId = assessmentTarget ?? subjectId ?? (!assessment && selectedGroupId ? vesselGroups.find(g => g.id === selectedGroupId)?.structureIds[0] as HeartPartId | undefined : null);
    const key = `${modelRevision}:${layout.revision}:${size.width}:${size.height}:${subjectId}:${selectedGroupId}:${assessmentTarget}:${assessmentKey}:${assessment ? 0 : selectionRevision}:${request?.sequence ?? 0}`;
    if (key !== trigger.current.key) {
      trigger.current = { key, since: now }; pending.current = !manual.current;
    }
    const measured = layout.revision > 0 && Math.abs(layout.viewport.width - size.width) < 3 && Math.abs(layout.viewport.height - size.height) < 3
      && layout.cardOpen === !!subjectId;
    // Wait for the card and canvas measurements to agree and settle, instead of
    // starting separate movements for selection, card opening and panel resize.
    if (pending.current && measured && !manual.current && now - trigger.current.since >= 32) {
      const freshRequest = request && request.sequence !== consumedRequest.current ? request : null;
      const reset = (assessment && previousAssessment.current !== assessmentKey && !assessmentTarget) || freshRequest?.kind === "reset" || (modelRevision === "imported" && !fittedImport.current) || (!subjectId && !!transition.current?.reset);
      const fromPose: Pose = { target: target.current.clone(), rotation: camera.quaternion.clone(), distance: camera.position.distanceTo(target.current), zoom: camera.zoom };
      const toPose: Pose = { ...fromPose };
      const destinationCamera = camera.clone();
      let focused = false;
      if (reset) {
        const resetTarget = new Vector3(...(modelRevision === "imported" ? IMPORTED_RESET_TARGET : DEFAULT_TARGET));
        destinationCamera.position.fromArray(DEFAULT_CAMERA); destinationCamera.zoom = 1;
        if (modelRevision === "imported") {
          destinationCamera.quaternion.fromArray(IMPORTED_RESET_ROTATION).normalize();
          destinationCamera.position.set(0, 0, importedCameraDistance(camera.fov, size.width / size.height))
            .applyQuaternion(destinationCamera.quaternion).add(resetTarget);
          destinationCamera.up.set(0, 1, 0).applyQuaternion(destinationCamera.quaternion);
        } else {
          destinationCamera.up.set(0, 1, 0);
          destinationCamera.lookAt(resetTarget);
        }
        destinationCamera.clearViewOffset();
        Object.assign(toPose, { target: resetTarget, rotation: destinationCamera.quaternion.clone(), distance: destinationCamera.position.distanceTo(resetTarget), zoom: 1 });
      } else if (freshRequest) {
        toPose.distance = Math.min(MAX_HEART_DISTANCE, Math.max(MIN_HEART_DISTANCE, fromPose.distance * (freshRequest.kind === "zoom-in" ? .8 : 1.25)));
        destinationCamera.position.set(0, 0, toPose.distance).applyQuaternion(toPose.rotation).add(toPose.target);
      }
      if (focusId && modelRevision === "imported" && (assessment ? previousAssessment.current !== `${assessmentKey}:${assessmentTarget}` : navigatedRevision.current !== selectionRevision) && !freshRequest) {
        const pose = vesselView(destinationCamera, root, registry.current, focusId, layout, assessment ? undefined : toPose);
        if (pose) {
          focused = true;
          Object.assign(toPose, pose);
          destinationCamera.quaternion.copy(pose.rotation);
          destinationCamera.position.set(0, 0, pose.distance).applyQuaternion(pose.rotation).add(pose.target);
          destinationCamera.zoom = pose.zoom; destinationCamera.clearViewOffset(); destinationCamera.updateProjectionMatrix();
        }
        navigatedRevision.current = selectionRevision;
      }
      destinationCamera.updateMatrixWorld();
      const bounds = modelScreenBounds(root, destinationCamera, size.width, size.height);
      const structure = focusId ? registry.current.get(focusId) : null;
      // The scan preset centres the visible anatomy. Its oblique world bounding
      // box includes empty corners that would otherwise pan this view off-centre.
      const anchor = structure?.anchorObject.localToWorld(new Vector3(...structure.anchor)).project(destinationCamera)
        ?? (reset && modelRevision === "imported" ? toPose.target.clone().project(destinationCamera) : null);
      if (bounds) {
        if (assessment) previousAssessment.current = assessmentTarget ? `${assessmentKey}:${assessmentTarget}` : assessmentKey;
        const marker = anchor ? { x: (anchor.x + 1) * size.width / 2, y: (1 - anchor.y) * size.height / 2 } : null;
        const plan = planFraming({ model: bounds, viewport, obstacles: layout.obstacles, marker });
        if (assessment && (focused || reset)) {
          // Centre the anchor only as far as the whole scan still fits. Lower
          // vessel anchors must not pan the top of the heart out of the quiz.
          const r = plan.region, margin = 12;
          if (bounds.width <= r.width - margin * 2) plan.x = Math.max(r.x + margin - bounds.x, Math.min(r.x + r.width - margin - bounds.x - bounds.width, plan.x));
          if (bounds.height <= r.height - margin * 2) plan.y = Math.max(r.y + margin - bounds.y, Math.min(r.y + r.height - margin - bounds.y - bounds.height, plan.y));
        }
        const offsetCleared = !destinationCamera.view?.enabled;
        const to = { x: (reset || offsetCleared ? 0 : shift.current.x) + plan.x, y: (reset || offsetCleared ? 0 : shift.current.y) + plan.y };
        pending.current = false; consumedRequest.current = request?.sequence ?? 0;
        if (modelRevision === "imported") fittedImport.current = true;
        transition.current = { start: now, duration: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 1 : DURATION,
          from: { ...shift.current }, to, fromPose, toPose, reset };
        transactions.current++;
      }
    }
    Object.assign(framing.current, { modelBounds: modelScreenBounds(root, camera, size.width, size.height), animating: !!transition.current || pending.current, navigation: { revision: selectionRevision, selectedId, selectedGroupId, manual: manual.current } });
    // Direct input has no residual inertia to fight Reset View or panel framing.
    if (framing.current.animating) invalidate();
    if (surface.current && framing.current.modelBounds && (now - diagnosticsTime.current > 100 || !framing.current.animating)) {
      diagnosticsTime.current = now;
      const finalBounds = framing.current.modelBounds;
      const region = planFraming({ model: finalBounds, viewport, obstacles: layout.obstacles }).region;
      surface.current.setAttribute("data-framing", JSON.stringify({ model: finalBounds, viewport, region, measured, cardOpen: layout.cardOpen, tutorOpen: layout.tutorOpen, obstacles: layout.obstacles,
        visibility: visibleFraction(finalBounds, viewport, layout.obstacles), offset: shift.current,
        position: camera.position.toArray(), target: target.current.toArray(), quaternion: camera.quaternion.toArray(),
        distance: camera.position.distanceTo(target.current), zoom: camera.zoom, fov: camera.fov, revision: layout.revision,
        transactions: transactions.current, moving: framing.current.animating, manual: manual.current, selectedId }));
    }
  }, -.5);
  return null;
}
