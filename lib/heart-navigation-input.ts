import { DRAG_THRESHOLD, wheelZoomFactor } from "./free-heart-camera";
import type { PointerGesture } from "./model-registry";

type Point = { x: number; y: number; startX: number; startY: number; button: number; touch: boolean };
type Navigation = {
  start: () => void; end: () => void;
  rotate: (dx: number, dy: number) => void;
  pan: (dx: number, dy: number) => void;
  zoom: (factor: number) => void;
};

/** One gesture owner for the canvas AND HTML markers. UI panels are excluded.
 * Window listeners plus pointer capture reliably finish drags outside the view. */
export function connectHeartNavigation(surface: HTMLElement, gesture: PointerGesture, navigation: Navigation) {
  const pointers = new Map<number, Point>();
  let active = false;
  const eligible = (target: EventTarget | null) => target instanceof Element &&
    (target === surface || target.tagName === "CANVAS" || !!target.closest(".anatomy-marker"));
  const start = () => { if (!active) { active = true; navigation.start(); } };
  const capture = (id: number) => { try { surface.setPointerCapture(id); } catch { /* Window listeners still finish the gesture. */ } };
  const down = (event: PointerEvent) => {
    if (!eligible(event.target) || ![0, 1, 2].includes(event.button)) return;
    if (!pointers.size) { gesture.dragged = event.button !== 0; gesture.x = event.clientX; gesture.y = event.clientY; }
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY, startX: event.clientX, startY: event.clientY, button: event.button, touch: event.pointerType === "touch" });
    gesture.pointers.add(event.pointerId);
    if (pointers.size > 1) { gesture.dragged = true; start(); pointers.forEach((_point, id) => capture(id)); }
  };
  const move = (event: PointerEvent) => {
    const point = pointers.get(event.pointerId);
    if (!point) return;
    if (!active && Math.hypot(event.clientX - point.startX, event.clientY - point.startY) <= DRAG_THRESHOLD) return;
    if (!active) { gesture.dragged = true; start(); capture(event.pointerId); }
    const dx = event.clientX - point.x, dy = event.clientY - point.y;
    const pair = [...pointers.values()];
    if (point.touch && pair.length === 2) {
      const other = pair.find(value => value !== point)!;
      const before = Math.hypot(point.x - other.x, point.y - other.y);
      const after = Math.hypot(event.clientX - other.x, event.clientY - other.y);
      if (before > 0 && after > 0) navigation.zoom(before / after);
      navigation.pan(dx / 2, dy / 2);
    } else if (pair.length === 1) {
      if (point.button === 2) navigation.pan(dx, dy);
      else if (point.button === 1) navigation.zoom(Math.exp(dy * .01));
      else navigation.rotate(dx, dy);
    }
    point.x = event.clientX; point.y = event.clientY;
    // Do not raycast detailed vessel geometry or send hover events while dragging.
    event.preventDefault(); event.stopPropagation();
  };
  const finish = (event: PointerEvent) => {
    if (!pointers.has(event.pointerId)) return;
    const point = pointers.get(event.pointerId)!;
    // Include the release position even when a browser coalesces the last move.
    if (Math.hypot(event.clientX - point.startX, event.clientY - point.startY) > DRAG_THRESHOLD) gesture.dragged = true;
    if (event.type !== "pointerup") gesture.dragged = true;
    pointers.delete(event.pointerId); gesture.pointers.delete(event.pointerId);
    if (surface.hasPointerCapture(event.pointerId)) surface.releasePointerCapture(event.pointerId);
    if (!pointers.size && active) { active = false; navigation.end(); }
    // A surviving touch starts from its current position, never its old origin.
    pointers.forEach(p => { p.startX = p.x; p.startY = p.y; });
  };
  const cancel = () => {
    if (pointers.size) gesture.dragged = true;
    const ids = [...pointers.keys()]; pointers.clear(); gesture.pointers.clear();
    ids.forEach(id => { if (surface.hasPointerCapture(id)) surface.releasePointerCapture(id); });
    if (active) { active = false; navigation.end(); }
  };
  const wheel = (event: WheelEvent) => {
    if (!eligible(event.target)) return;
    event.preventDefault(); event.stopPropagation();
    if (!active) navigation.start();
    navigation.zoom(wheelZoomFactor(event.deltaY));
    if (!active) navigation.end();
  };
  const contextMenu = (event: MouseEvent) => { if (eligible(event.target)) event.preventDefault(); };
  const click = (event: MouseEvent) => {
    // Keyboard-generated marker activation (detail === 0) remains accessible.
    if (eligible(event.target) && (event.button !== 0 || event.detail !== 0 && gesture.dragged)) {
      event.preventDefault(); event.stopPropagation();
    }
  };
  surface.addEventListener("pointerdown", down, true);
  window.addEventListener("pointermove", move, { capture: true, passive: false });
  window.addEventListener("pointerup", finish, true);
  window.addEventListener("pointercancel", finish, true);
  surface.addEventListener("lostpointercapture", finish, true);
  surface.addEventListener("wheel", wheel, { capture: true, passive: false });
  surface.addEventListener("contextmenu", contextMenu);
  surface.addEventListener("click", click, true);
  window.addEventListener("blur", cancel);
  return () => {
    cancel();
    surface.removeEventListener("pointerdown", down, true);
    window.removeEventListener("pointermove", move, true);
    window.removeEventListener("pointerup", finish, true);
    window.removeEventListener("pointercancel", finish, true);
    surface.removeEventListener("lostpointercapture", finish, true);
    surface.removeEventListener("wheel", wheel, true);
    surface.removeEventListener("contextmenu", contextMenu);
    surface.removeEventListener("click", click, true);
    window.removeEventListener("blur", cancel);
  };
}
