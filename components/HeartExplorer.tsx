"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import { getHeartPart, HEART_PARTS } from "@/lib/heart-parts";
import { INITIAL_SCENE, sceneReducer } from "@/lib/scene-state";
import SceneBoundary from "./SceneBoundary";
import SceneControls from "./SceneControls";
import StructureCatalog from "./StructureCatalog";
import FloatingStructureEducation from "./FloatingStructureEducation";
import ExplorationProgress from "./ExplorationProgress";
import LearningLevelControls from "./LearningLevelControls";
import AnatomyTutor from "./AnatomyTutor";
import TutorIcon from "./TutorIcon";
import usePanelMeasurements from "./usePanelMeasurements";
import { createFramingBridge } from "@/lib/panel-framing";
import type { SelectedMarkerProjection } from "./HeartAnnotations";
import useLearningSession from "./useLearningSession";
import { recordCard, recordReply, sessionActivity, sessionExploration, stamp } from "@/lib/learning/session";
import type { LearningSession } from "@/lib/learning/session";
import type { ViewerExecution } from "@/lib/tutor/viewer-execution";
import type { LearningIntent } from "@/lib/learning/intent";
import RestartSessionDialog from "./RestartSessionDialog";
import type { SceneAction } from "@/lib/scene-state";
import type { HeartPartId } from "@/lib/heart-parts";
import type { LearningLevel } from "@/lib/education";
import type { TutorResponse, TutorMode } from "@/lib/tutor/types";
import { createActionLedger, type NavigationProposal } from "@/lib/tutor/scene-actions";
import { UNLOADED_MODEL } from "@/lib/model-config";
const LearningReview = dynamic(() => import("./LearningReview"), { loading: () => <p role="status">Preparing session review…</p> });

const HeartScene = dynamic(() => import("./HeartScene"), {
  ssr: false,
  loading: () => (
    <div className="scene-message" role="status">
      <span className="loading-dot" />
      Preparing your 3D workspace…
    </div>
  ),
});

export default function HeartExplorer({ tutorMode = "mock", collectionId, collectionVersion }: { tutorMode?: TutorMode; collectionId?: string; collectionVersion?: string }) {
  const learning = useLearningSession();
  return <LearningWorkspace key={learning.revision} learning={learning} tutorMode={tutorMode} collectionId={collectionId} collectionVersion={collectionVersion} />;
}

function LearningWorkspace({ learning, tutorMode, collectionId, collectionVersion }: { learning: ReturnType<typeof useLearningSession>; tutorMode: TutorMode; collectionId?: string; collectionVersion?: string }) {
  const exploration = useMemo(() => learning.session ? sessionExploration(learning.session) : { visitedIds: [], learningLevel: INITIAL_SCENE.learningLevel }, [learning.session]);
  const [scene, sceneDispatch] = useReducer(sceneReducer, { ...INITIAL_SCENE, learningLevel: exploration.learningLevel });
  const [modelCapabilities, setModelCapabilities] = useState(UNLOADED_MODEL);
  // History is the only source of exploration truth; do not persist a second counter.
  const state = { ...scene, ...exploration };
  const { record } = learning;
  const [reviewOpen, setReviewOpen] = useState(false);
  const [reviewRequest, setReviewRequest] = useState<{ session: LearningSession; level: LearningLevel; intent?: LearningIntent; sequence: number } | null>(null);
  const [restartOpen, setRestartOpen] = useState(false);
  const restartButton = useRef<HTMLButtonElement>(null);
  const reviewButton = useRef<HTMLButtonElement>(null);
  // Sidebar, marker and tutor actions share the same selection/camera transaction.
  const navigateVessel = useCallback((action: SceneAction, track = true) => {
    if (track && action.type === "select" && action.id && action.id !== state.selectedId) record(recordCard(action.id, state.learningLevel));
    sceneDispatch(action);
  }, [record, state.selectedId, state.learningLevel]);
  const dispatch = useCallback((action: SceneAction) => {
    if (action.type === "select" || action.type === "select-group") { navigateVessel(action); return; }
    if (action.type === "level") { record({ ...stamp(), type: "level-used", level: action.level }); if (state.selectedId) record({ ...stamp(), type: "card-content-displayed", structureId: state.selectedId, level: action.level }); }
    sceneDispatch(action);
  }, [record, state.selectedId, navigateVessel]);
  const [tutorOpen, setTutorOpen] = useState(false);
  const tutorButton = useRef<HTMLButtonElement>(null);
  const projectionRef = useRef<SelectedMarkerProjection | null>(null);
  const surface = useRef<HTMLDivElement>(null);
  const workspace = useRef<HTMLDivElement>(null);
  const framing = useRef(createFramingBridge());
  usePanelMeasurements(workspace, surface, framing);
  const selected = getHeartPart(state.selectedId);
  const sessionId = learning.session?.id;
  const actionLedger = useRef(createActionLedger());
  const committedScene = useRef(scene);
  useEffect(() => { committedScene.current = scene; }, [scene]);
  useEffect(() => () => { actionLedger.current.reset(); }, []);
  async function executeNavigation(proposal: NavigationProposal, signal: AbortSignal): Promise<ViewerExecution> {
    const command = proposal.command;
    const requestedId = "structureId" in command ? command.structureId : "groupId" in command ? command.groupId : null;
    const receipt = (status: ViewerExecution["status"], message: string, panelOpen = false): ViewerExecution => ({ actionId: proposal.id, command, requestedId, status, modelLoaded: modelCapabilities.kind === "imported" && !!framing.current.modelBounds, cameraSettled: !framing.current.animating, panelOpen, message });
    const ledger = actionLedger.current, epoch = ledger.epoch();
    try {
      signal.throwIfAborted();
      if (reviewOpen) throw new Error("Navigation is disabled during review and quizzes. Return to model first.");
      const action = ledger.accept(proposal, epoch);
      if (!action) throw new Error("This navigation action is stale, invalid or already applied.");
      if (!framing.current.modelBounds || modelCapabilities.kind !== "imported") throw new Error("The heart model is not ready. Wait for it to load, or reload the page if loading failed.");
      if (action.type === "select-group" && !modelCapabilities.groupIds?.includes(action.id)) throw new Error("This artery has no geometry mapping in the loaded model. Please choose an available structure.");
      if (action.type === "select" && action.id && !modelCapabilities.markerIds.includes(action.id)) throw new Error("This structure has no mapped marker in the loaded model. Please choose an available structure or contact the site maintainer.");
      const revision = committedScene.current.selectionRevision;
      const cameraSequence = committedScene.current.cameraRequest?.sequence ?? 0;
      navigateVessel(action, false);
      const started = performance.now();
      await new Promise<void>((resolve, reject) => {
        const check = () => {
          if (signal.aborted || ledger.epoch() !== epoch) { reject(new Error("Navigation was interrupted. Please retry or use Heart structures.")); return; }
          const current = committedScene.current, view = framing.current.navigation;
          const applied = action.type === "select-group" ? current.selectedGroupId === action.id && current.selectionRevision > revision
            : action.type === "select" ? current.selectedId === action.id && current.selectionRevision > revision
            : action.type === "camera" && current.cameraRequest?.kind === "reset" && current.cameraRequest.sequence > cameraSequence && current.selectedId === null;
          if (current.selectionRevision > revision + 1 || (view && view.revision > revision && view.manual)) { reject(new Error("Navigation was interrupted by another viewer interaction. Please retry.")); return; }
          const panel = action.type === "select-group" ? !!document.querySelector('.vessel-segment-choices') : action.type === "select" && action.id ? framing.current.layout.cardOpen && projectionRef.current?.id === action.id : true;
          const rendered = view && view.selectedId === current.selectedId && view.selectedGroupId === current.selectedGroupId && view.revision === current.selectionRevision;
          if (applied && rendered && panel && framing.current.modelBounds && !framing.current.animating && performance.now() - started > 650) { resolve(); return; }
          if (performance.now() - started > 10000) { reject(new Error("The viewer did not confirm the camera and information panel. Try the structure list or Reset View.")); return; }
          window.requestAnimationFrame(check);
        };
        window.requestAnimationFrame(check);
      });
      signal.throwIfAborted();
      learning.record({ ...stamp(), type: "navigation-completed", actionId: proposal.id, structureId: action.type === "select" ? action.id : null, level: state.learningLevel }, sessionId);
      if (action.type === "select" && action.id) learning.record(recordCard(action.id, state.learningLevel), sessionId);
      return receipt("success", "Viewer selection, camera framing and information panel confirmed.", action.type === "select-group" || (action.type === "select" && !!action.id));
    } catch (error) { const message = error instanceof Error ? error.message : "Viewer navigation failed. Please try Heart structures."; return receipt(/interrupt|cancel/i.test(message) ? "interrupted" : "failed", message); }
  }
  function openReview(intent?: LearningIntent) {
    if (!learning.session) throw new Error("Your session is still loading. Please try again.");
    // Capture activity and level before changing visibility; render updates never
    // replace the input snapshot or the level of an ongoing attempt.
    setReviewRequest(previous => ({ session: structuredClone(learning.session!), level: state.learningLevel, intent, sequence: (previous?.sequence ?? 0) + 1 }));
    setReviewOpen(true); setTutorOpen(false);
  }
  async function openLearningAction(intent: LearningIntent, signal: AbortSignal) {
    signal.throwIfAborted(); openReview(intent);
    return intent.type === "quiz" ? "Your five-question quiz workspace is open. Return to the model to continue our conversation." : "Your personalised summary workspace is open.";
  }
  function returnToModel(id?: HeartPartId) { setReviewOpen(false); if (id) dispatch({ type: "select", id }); window.requestAnimationFrame(() => { if (!id) reviewButton.current?.focus(); else workspace.current?.querySelector<HTMLButtonElement>(`[data-structure-id="${id}"]`)?.focus(); }); }
  function questionAsked(question: string, structureId: HeartPartId | null, level: LearningLevel) { const event = { ...stamp(), type: "question-asked" as const, question, structureId, level }; learning.record(event, sessionId); return event.id; }
  function replyReceived(id: string, reply: TutorResponse) { learning.record(recordReply(id, reply), sessionId); }
  const restoredTurns = useMemo(() => {
    if (!learning.session) return [];
    const lastReset = learning.session.events.findLastIndex(e => e.type === "conversation-reset");
    const visibleQuestions = new Set(learning.session.events.slice(lastReset + 1).filter(e => e.type === "question-asked").map(e => e.id));
    return sessionActivity(learning.session).questions.filter(q => visibleQuestions.has(q.id)).map(q => ({ id: q.id, question: q.question, reply: q.reply, error: q.error ?? (!q.reply ? "No answer was recorded; you can ask again." : undefined), context: `${getHeartPart(q.structureId)?.name ?? "General cardiovascular anatomy"} · ${q.level}` }));
  }, [learning.session]);

  return (
    <main className="explorer">
          <header className="panel-heading workspace-heading">
            <div className="workspace-brand">
              <h2 id="viewer-title">AnaBuddy</h2>
              <p>An AI-Assisted 3D Heart Anatomy Platform</p>
            </div>
            <div className="workspace-learning-toolbar" hidden={reviewOpen} inert={reviewOpen || !learning.ready}>
              <LearningLevelControls state={state} dispatch={dispatch} />
              <ExplorationProgress state={state} ready={learning.ready} />
              <button ref={reviewButton} type="button" className="review-session-button control" disabled={!learning.ready} aria-pressed={reviewOpen} onClick={() => openReview()}>Review Session</button>
              <button ref={restartButton} type="button" className="restart-session-button control" onClick={() => setRestartOpen(true)}>Restart Session</button>
              <button ref={tutorButton} type="button" className="ask-tutor-button" aria-expanded={tutorOpen} aria-controls="anatomy-tutor" aria-pressed={tutorOpen} onClick={() => { if (reviewOpen) { setReviewOpen(false); setTutorOpen(true); } else setTutorOpen(!tutorOpen); }}><TutorIcon />Ask AI Tutor</button>
            </div>
          </header>
      {learning.error && <div className="learning-save-status" role="status">{learning.error}</div>}
      {restartOpen && <RestartSessionDialog onCancel={() => { setRestartOpen(false); restartButton.current?.focus(); }} onConfirm={async () => { await learning.restart(); window.requestAnimationFrame(() => document.querySelector<HTMLButtonElement>(".restart-session-button")?.focus()); }} />}
      {reviewOpen && learning.session && reviewRequest && <LearningReview requested={reviewRequest.intent} initialSession={reviewRequest.session} key={`${learning.session.id}:${reviewRequest.sequence}`} session={learning.session} level={reviewRequest.level} record={learning.record} storageError={learning.error} onReturn={() => returnToModel()} onStructure={id => returnToModel(id)} onRestart={() => setRestartOpen(true)} />}
      <div ref={workspace} hidden={reviewOpen} inert={!learning.ready} className={`workspace-content ${tutorOpen ? "tutor-open" : ""}`}>
      <div className="explorer-grid" id="explore">
        <section className="viewer-panel" aria-labelledby="viewer-title">

          <SceneControls state={state} dispatch={dispatch} capabilities={modelCapabilities} />
          <SceneBoundary>
            <HeartScene suspended={reviewOpen} state={state} dispatch={dispatch} projectionRef={projectionRef} surfaceRef={surface} framing={framing} onCapabilities={setModelCapabilities} />
          </SceneBoundary>

          <div className="viewer-footer">
            <p>Left drag to rotate · Right drag to pan · Scroll or pinch to zoom · Click empty space to deselect</p>
          </div>
        </section>

        <aside className="learning-panel" aria-labelledby="structures-title">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Explore the anatomy</p>
              <h2 id="structures-title">Heart structures</h2>
            </div>
            <span className="count-badge">{String(HEART_PARTS.length).padStart(2, "0")}</span>
          </div>
          <p className="panel-description">Choose a marker or vessel.</p>

          <StructureCatalog state={state} dispatch={dispatch} />

          <p className="sr-only" role="status" aria-live="polite">
            {selected
              ? `Selected ${selected.name}. Showing its ${state.learningLevel} explanation.`
              : "Selection cleared."}
          </p>
        </aside>
        <FloatingStructureEducation state={state} dispatch={dispatch} projectionRef={projectionRef} surface={surface} collectionId={collectionId} />
      </div>
      <AnatomyTutor onLearningAction={openLearningAction} onNavigate={executeNavigation} key={`${sessionId ?? "loading"}:${collectionVersion ?? "legacy"}`} collectionVersion={collectionVersion} initialTurns={restoredTurns} onReset={() => record({ ...stamp(), type: "conversation-reset" })} onQuestion={questionAsked} onReply={replyReceived} onError={(id, message) => learning.record({ ...stamp(), type: "tutor-error", questionId: id, message }, sessionId)} open={tutorOpen} onClose={() => { setTutorOpen(false); tutorButton.current?.focus(); }} selectedStructureId={state.selectedId} learningLevel={state.learningLevel} mode={learning.ready ? tutorMode : "disabled"} />
      </div>

    </main>
  );
}
