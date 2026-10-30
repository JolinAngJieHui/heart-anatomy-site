"use client";
import { useEffect, type RefObject } from "react";
import { intersect, type FramingBridge, type ScreenRect } from "@/lib/panel-framing";

const rect = (r: DOMRect): ScreenRect => ({ x: r.x, y: r.y, width: r.width, height: r.height });
function significant(a: ScreenRect, b: ScreenRect) { return Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y), Math.abs(a.width - b.width), Math.abs(a.height - b.height)) > .5; }

/** Coalesced pre-paint DOM measurements. Marker projection and chat text updates do not
 * cause a camera transaction. Only significant panel geometry does. */
export default function usePanelMeasurements(workspace: RefObject<HTMLDivElement | null>, surface: RefObject<HTMLDivElement | null>, bridge: RefObject<FramingBridge>) {
  useEffect(() => {
    const node = workspace.current;
    if (!node) return;
    const root: HTMLDivElement = node;
    let frame: number;
    const observed = new Set<Element>();
    const resize = new ResizeObserver(schedule);
    function measure() {
      const view = surface.current;
      if (!view) return;
      const bounds = rect(view.getBoundingClientRect());
      // A hidden review/quiz workspace is not a new zero-sized camera layout.
      if (bounds.width < 1 || bounds.height < 1) return;
      const local = { x: 0, y: 0, width: bounds.width, height: bounds.height };
      const card = root.querySelector<HTMLElement>(".information-card-position");
      const tutor = root.querySelector<HTMLElement>("#anatomy-tutor");
      const cardOpen = !!card && !card.closest("[hidden]");
      const tutorOpen = !!tutor && !tutor.hidden;
      const obstacles = [cardOpen ? card : null, tutorOpen ? tutor : null].flatMap(node => {
        if (!node) return [];
        const r = node.getBoundingClientRect();
        const hit = intersect(local, { x: r.x - bounds.x, y: r.y - bounds.y, width: r.width, height: r.height });
        return hit ? [hit] : [];
      });
      for (const node of [root, view, card, tutor]) if (node && !observed.has(node)) { resize.observe(node); observed.add(node); }
      const previous = bridge.current.layout;
      if (previous.revision === 0 || significant(previous.viewport, bounds) || cardOpen !== previous.cardOpen || tutorOpen !== previous.tutorOpen || obstacles.length !== previous.obstacles.length || obstacles.some((r, i) => significant(r, previous.obstacles[i]))) {
        bridge.current.layout = { revision: previous.revision + 1, viewport: bounds, obstacles, cardOpen, tutorOpen };
        bridge.current.invalidate?.();
      }
    }
    function schedule() { cancelAnimationFrame(frame); frame = requestAnimationFrame(measure); }
    const mutation = new MutationObserver(records => {
      if (records.some(record => record.type === "childList"
        ? [...record.addedNodes].some(node => node instanceof Element && (node.matches(".scene-surface") || node.querySelector(".scene-surface")))
        : record.target instanceof Element && record.target.matches(".information-card-position, .information-overlay, #anatomy-tutor, .workspace-content, .scene-surface"))) schedule();
    });
    mutation.observe(root, { subtree: true, childList: true, attributes: true, attributeFilter: ["hidden", "style", "class"] });
    resize.observe(root);
    window.addEventListener("resize", schedule);
    schedule();
    return () => { cancelAnimationFrame(frame); resize.disconnect(); mutation.disconnect(); window.removeEventListener("resize", schedule); };
  }, [workspace, surface, bridge]);
}
