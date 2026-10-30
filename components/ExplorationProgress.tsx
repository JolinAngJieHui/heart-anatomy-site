"use client";
import { useEffect, useLayoutEffect, useReducer, useRef } from "react";
import { createPortal } from "react-dom";
import { HEART_PARTS } from "@/lib/heart-parts";
import { explorationMilestones, type Milestone } from "@/lib/exploration-progress";
import type { SceneState } from "@/lib/scene-state";

const inventory = HEART_PARTS.map(part => part.id);
const milestones = explorationMilestones(inventory.length);
type AchievementState = { achieved: string[]; queue: Milestone[]; closing: boolean; initialized: boolean };
type AchievementAction = { type: "earn" | "restore"; milestones: Milestone[] } | { type: "dismiss"; id: string } | { type: "close" };
function achievementReducer(state: AchievementState, action: AchievementAction): AchievementState {
  if (action.type === "restore") return { achieved: action.milestones.map(m => m.id), queue: [], closing: false, initialized: true };
  if (action.type === "close") return { ...state, closing: true };
  if (action.type === "dismiss") return { ...state, closing: false, queue: state.queue.filter(m => m.id !== action.id) };
  const fresh = action.milestones.filter(m => !state.achieved.includes(m.id));
  return fresh.length ? { ...state, achieved: [...state.achieved, ...fresh.map(m => m.id)], queue: [...state.queue, ...fresh] } : state;
}

function AchievementIcon() {
  return <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
    <path d="M8 3h8v6a4 4 0 0 1-8 0V3Zm4 10v5m-4 3h8m-8-3h8M8 5H4v3a4 4 0 0 0 4 4m8-7h4v3a4 4 0 0 1-4 4" />
  </svg>;
}

export default function ExplorationProgress({ state, ready = true }: { state: SceneState; ready?: boolean }) {
  // Restored selections have already earned their milestones. Only new threshold
  // crossings in this mounted session produce a notification.
  const [achievements, update] = useReducer(achievementReducer, { achieved: milestones.filter(m => m.count <= state.visitedIds.length).map(m => m.id), queue: [], closing: false, initialized: ready });
  const count = state.visitedIds.filter(id => inventory.includes(id)).length;
  const next = milestones.find(m => m.count > count);
  const toast = achievements.queue[0];
  const anchor = useRef<HTMLDivElement>(null);
  const overlay = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    if (!toast) return;
    const position = () => {
      if (!anchor.current || !overlay.current) return;
      const rect = anchor.current.getBoundingClientRect();
      const viewport = window.visualViewport;
      const left = viewport?.offsetLeft ?? 0, top = viewport?.offsetTop ?? 0;
      const width = viewport?.width ?? window.innerWidth;
      const height = viewport?.height ?? window.innerHeight;
      const toastWidth = Math.min(340, width - 24);
      Object.assign(overlay.current.style, {
        width: `${toastWidth}px`,
        left: `${Math.max(left + 12, Math.min(rect.left, left + width - toastWidth - 12))}px`,
        top: `${rect.bottom + 8}px`,
        maxHeight: `${Math.max(48, top + height - rect.bottom - 20)}px`,
        visibility: "visible",
      });
    };
    position();
    const observer = new ResizeObserver(position);
    if (anchor.current) observer.observe(anchor.current);
    if (anchor.current?.parentElement) observer.observe(anchor.current.parentElement);
    window.addEventListener("resize", position);
    window.addEventListener("scroll", position, true);
    window.visualViewport?.addEventListener("resize", position);
    window.visualViewport?.addEventListener("scroll", position);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", position);
      window.removeEventListener("scroll", position, true);
      window.visualViewport?.removeEventListener("resize", position);
      window.visualViewport?.removeEventListener("scroll", position);
    };
  }, [toast]);
  useEffect(() => {
    if (!ready) return;
    if (!achievements.initialized) { update({ type: "restore", milestones: milestones.filter(m => m.count <= count) }); return; }
    const earned = milestones.filter(m => m.count <= count && !achievements.achieved.includes(m.id));
    if (earned.length) update({ type: "earn", milestones: earned });
  }, [count, achievements.achieved, achievements.initialized, ready]);
  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => update(achievements.closing ? { type: "dismiss", id: toast.id } : { type: "close" }), achievements.closing ? 200 : 4000);
    return () => window.clearTimeout(timer);
  }, [toast, achievements.closing]);
  return <>
    <div className="exploration-progress" ref={anchor} aria-busy={!ready}>
      <div className="progress-caption"><AchievementIcon /><span>{ready ? `${count} / ${inventory.length} explored` : "Preparing session…"}</span></div>
      <div className="progress-track" role="progressbar" aria-label="Anatomical exploration" aria-valuemin={0}
        aria-valuemax={inventory.length} aria-valuenow={ready ? count : undefined} aria-valuetext={ready ? `${count} of ${inventory.length} structures explored` : "Preparing session"}>
        <span style={{ width: `${inventory.length ? count / inventory.length * 100 : 0}%` }} />
      </div>
      <span className="progress-milestone">{!ready ? "Your lesson is getting ready" : next ? `Next: ${next.title} (${next.count})` : "All structures explored"}</span>
    </div>
    {toast && createPortal(<div ref={overlay} className="achievement-region" aria-live="polite" aria-atomic="true" style={{ visibility: "hidden" }}>
      {toast && <div className={`achievement-toast ${achievements.closing ? "closing" : ""}`} key={toast.id}>
        <AchievementIcon /><div><strong>{toast.title}</strong><p>{toast.message}</p></div>
        <button type="button" aria-label="Dismiss achievement" onClick={() => update({ type: "close" })}>&times;</button>
      </div>}
    </div>, document.body)}
  </>;
}
