"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import type { HeartPartId } from "@/lib/heart-parts";

import { type LearningLevel } from "@/lib/education";

import { generateSummary } from "@/lib/learning/summary";

import { stamp, sessionWithQuizCompletion, type LearningEvent, type LearningSession } from "@/lib/learning/session";

import { type EvidenceCatalogue } from "@/lib/learning/evidence";

import { type ReviewedQuestion } from "@/lib/learning/quiz";

import { collectQuizInput, quizCandidates } from "@/lib/learning/quiz-personalisation";

import { createReviewSnapshot, type ReviewSnapshot } from "@/lib/learning/review-snapshot";

import type { PreparedLesson } from "@/lib/learning/workflow-client";

import type { LearningIntent } from "@/lib/learning/intent";

import bank from "@/knowledge-base/quiz-bank.json";

import PersonalisedQuiz from "./PersonalisedQuiz";

import LessonRecap from "./LessonRecap";

import { basicReview, collectReviewInput, reviewFingerprint } from "@/lib/learning/lesson-review";

import { lessonReviewClient, type ReviewResult } from "@/lib/learning/review-client";

export default function LearningReview({ session, initialSession, level: initialLevel, record, onReturn, onStructure, onRestart, storageError, prepared, requested }: { session: LearningSession; initialSession?: LearningSession; level: LearningLevel; record: (event: LearningEvent) => void; onReturn: () => void; onStructure: (id: HeartPartId) => void; onRestart: () => void; storageError: string | null; prepared?: PreparedLesson; requested?: LearningIntent }) {

  const [catalogue, setCatalogue] = useState<EvidenceCatalogue | null>(prepared?.catalogue ?? null), [error, setError] = useState("");

  const [view, setView] = useState<"review" | "quiz">(requested?.type === "quiz" ? "quiz" : "review");

  const level = initialLevel;

  const [quizSnapshot, setQuizSnapshot] = useState<ReviewSnapshot | null>(() => requested?.type === "quiz" && prepared ? createReviewSnapshot(collectReviewInput(initialSession ?? session, initialLevel), prepared.result.needsUpdate ? null : prepared.result.selection ?? null, prepared.catalogue) : null);

  const [exporting, setExporting] = useState(false);

  const exportAbort = useRef<AbortController | null>(null);

  useEffect(() => () => { exportAbort.current?.abort(); }, []);

  const [catalogueReady, setCatalogueReady] = useState(!!prepared);

  const [generated, setGenerated] = useState<{ key: string; result: ReviewResult } | null>(() => prepared ? { key: `${reviewFingerprint(prepared.snapshot.input)}:0`, result: prepared.result } : null);

  const [reviewSession,setReviewSession] = useState(initialSession??session);

  const [refresh, setRefresh] = useState(0);

  // One snapshot per review opening or completed-quiz return; no render-driven generation.

  const [input, setInput] = useState(() => prepared?.snapshot.input ?? collectReviewInput(initialSession ?? session, initialLevel));

  const fingerprint = reviewFingerprint(input);

  const resultKey = `${fingerprint}:${refresh}`;

  useEffect(() => {

    if (prepared) return;

    const abort = new AbortController();

    fetch("/api/learning/evidence", { signal: AbortSignal.any([abort.signal, AbortSignal.timeout(15000)]), cache: "no-store" }).then(async r => { if (!r.ok) throw new Error("Supporting passages are unavailable. Your saved activity is still shown."); return r.json(); }).then(setCatalogue).catch(() => { if (!abort.signal.aborted) setError("Supporting passages are unavailable. Your saved activity is still shown."); }).finally(() => { if (!abort.signal.aborted) setCatalogueReady(true); });

    return () => abort.abort();

  }, [prepared]);

  useEffect(() => {

    if (!catalogueReady || view === "quiz") return;

    let current = true;

    void lessonReviewClient.get(input, catalogue, refresh > 0, undefined, session.id).then(result => { if (current) setGenerated({ key: resultKey, result }); });

    return () => { current = false; };

  }, [input, catalogue, catalogueReady, refresh, resultKey, session.id, view]);

  const ready = generated?.key === resultKey;

  const reviewInput = ready ? generated.result.displayInput ?? generated.result.input ?? input : input;

  const review = ready ? generated.result.review : generated?.result.review.mode==="ai" ? generated.result.review : basicReview(input, catalogue);

  // The displayed recap and its vessel chips describe the captured review.

  const displayReview = review;

  const summary = generateSummary(reviewSession, catalogue, displayReview);
  if(ready&&generated.result.needsUpdate) {summary.kind += " · Previous summary, not yet updated"; summary.sections.unshift({title:"Update status",paragraphs:["This summary has not yet been updated with your latest activity or quiz results. Recorded practice results are retained separately."]});}

  const snapshot = useMemo(() => createReviewSnapshot(reviewInput, ready ? generated.result.selection ?? null : null, catalogue), [reviewInput, ready, generated, catalogue]);

  const activeQuizSnapshot = quizSnapshot ?? snapshot;

  function openQuiz() { setQuizSnapshot(snapshot); setView("quiz"); }

  function returnToSummary(completion?:Extract<LearningEvent,{type:"quiz-completed"}>) { const committed=sessionWithQuizCompletion(session,completion); if(completion)record(completion); setReviewSession(committed); setQuizSnapshot(null); setInput(collectReviewInput(committed, level)); setRefresh(0); setView("review"); }

  const pool = useMemo(() => {

    if (!catalogue) return [];

    try { return quizCandidates({ ...collectQuizInput(session, level, 5, activeQuizSnapshot), ...(requested?.type === "quiz" && requested.focusIds ? { focusIds: requested.focusIds } : {}) }, catalogue, bank as ReviewedQuestion[]); }

    catch { return []; }

  }, [session, catalogue, level, activeQuizSnapshot, requested]);

  const recordedReview = useRef("");

  useEffect(() => {

    if (ready && recordedReview.current !== snapshot.version && (input.structures.length || input.questions.length)) {

      recordedReview.current = snapshot.version;

      record({ ...stamp(), type: "review-prepared", reviewVersion: snapshot.version, mode: generated.result.review.mode, level: input.level });

    }

  }, [ready, snapshot.version, generated, input, record]);

  async function download() {

    const abort = new AbortController(); exportAbort.current = abort;

    setExporting(true);

    try { const { downloadSummary } = await import("@/lib/learning/word-export"); abort.signal.throwIfAborted(); await downloadSummary(summary, abort.signal); }

    catch { if (!abort.signal.aborted) setError("The Word document could not be created. Please retry."); }

    finally { if (!abort.signal.aborted) setExporting(false); }

  }

  if (view === "quiz") return catalogueReady ? <PersonalisedQuiz catalogue={catalogue} key={activeQuizSnapshot.version} snapshot={activeQuizSnapshot} autoStart focusIds={requested?.type === "quiz" ? requested.focusIds : undefined} onReturnSummary={returnToSummary} onNewQuiz={() => setQuizSnapshot(createReviewSnapshot(collectReviewInput(session, level), null, catalogue))} session={session} pool={pool} level={level} record={record} onExit={onReturn} onDownload={() => void download()} exporting={exporting} exportError={error} /> : <section className="learning-review"><button className="control" onClick={onReturn}>Return to Model</button><p role="status">Preparing your five-question quiz…</p></section>;

  return <section className="learning-review" aria-labelledby="review-title">

    <header className="learning-review-heading"><div className="learning-actions" aria-label="Lesson review actions"><button className="ask-tutor-button" disabled={!ready || !!generated?.result.needsUpdate} onClick={openQuiz}>Take Personalised Quiz</button>{ready && generated.result.retryable && <button className="control" onClick={() => setRefresh(n => n + 1)}>Retry summary</button>}<button className="control" disabled={exporting || !ready} onClick={() => void download()}>{exporting ? "Preparing Word…" : generated?.result.needsUpdate ? "Download previous summary" : "Download Word"}</button><button className="control review-return" onClick={onReturn}>Return to Model</button></div></header>

    <div className="review-generation-status" data-state={!ready ? "loading" : generated.result.retryable ? "error" : "ready"}><p role="status">{!ready ? input.quizResults?.length ? "Updating your review with your quiz results…" : "Preparing your personalised summary..." : generated.result.message}</p></div>

    <div className="learning-review-scroll">

      <div className="lesson-review-content">

      {(storageError || error) && <p role="alert">{storageError || error}</p>}

      {!ready && generated?.result.review.mode==="ai" && <p role="status">Previous summary — updating with your latest activity.</p>}

      <LessonRecap review={displayReview} onStructure={onStructure} loading={!ready} />

      <details className="learning-entry review-tools"><summary>This session</summary>

      <p>Your activity and conversations belong to this tab. Refresh keeps this lesson; a new visit starts fresh. Download Word before closing the tab if you want to keep your review.</p>

      <button className="control" onClick={onRestart}>Restart Session</button>

      <p className="learning-local-notice">If AI personalisation is enabled, only the relevant session content is sent for your requested review.</p></details>

      <small className="review-footer-note">Your session stays open while you review.</small>

      </div>

    </div>

  </section>;

}

