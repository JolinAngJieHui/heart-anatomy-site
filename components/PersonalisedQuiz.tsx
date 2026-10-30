"use client";

import dynamic from "next/dynamic";

import { useEffect, useRef, useState } from "react";

import { getHeartPart, type HeartPartId } from "@/lib/heart-parts";

import { INITIAL_SCENE, sceneReducer } from "@/lib/scene-state";

import { createFramingBridge } from "@/lib/panel-framing";

import type { SelectedMarkerProjection } from "./HeartAnnotations";

import type { LearningLevel } from "@/lib/education";

import type { EvidenceCatalogue } from "@/lib/learning/evidence";

import { scoreQuiz, validateAnswer, type QuizQuestion } from "@/lib/learning/quiz";

import type { ReviewSnapshot } from "@/lib/learning/review-snapshot";

import { collectQuizInput } from "@/lib/learning/quiz-personalisation";

import { QUIZ_STAGE_LABELS, type QuizStage } from "@/lib/learning/quiz-status";

import { personalisedQuizClient } from "@/lib/learning/quiz-client";

import { readLearningCache, writeLearningCache } from "@/lib/learning/content-cache";

import { stamp, type LearningSession, type LearningEvent } from "@/lib/learning/session";

const QuizScene = dynamic(() => import("./HeartScene"), { ssr: false, loading: () => <p role="status">Loading the labelled heart…</p> });

type Answer = ReturnType<typeof validateAnswer>;

type Attempt = { id: string; questions: QuizQuestion[]; results: Answer[]; choices: Record<string, string>; index: number; complete: boolean; ai: boolean; reviewVersion: string };

const optionName = (q: QuizQuestion, id: string) => q.options.find(o => o.id === id)?.label ?? getHeartPart(id as HeartPartId)?.name ?? id;

const isLocate = (q: QuizQuestion) => q.kind === "identification" || q.kind === "locate-vessel";

function restoreAttempt(key: string, catalogue: EvidenceCatalogue | null): Attempt | null {

  const raw = readLearningCache("attempt", key) as Attempt | null;

  try {

    if (!raw || !catalogue || !Array.isArray(raw.questions) || !raw.questions.length || raw.questions.length !== 5 || !Array.isArray(raw.results) || !raw.choices || !Number.isInteger(raw.index) || raw.index < 0 || raw.index >= raw.questions.length) return null;

    if (!raw.questions.every(q => catalogue.passages.some(p => p.id === q.evidence.id && p.documentVersion === q.evidence.documentVersion && p.text === q.evidence.text))) return null;

    raw.results = raw.results.map(r => validateAnswer(raw.questions.find(q => q.id === r.questionId)!, r.chosen));

    return raw;

  } catch { return null; }

}

function ModelQuestion({ question, chosen, submitted, onChoose }: { question: QuizQuestion; chosen: string | null; submitted: boolean; onChoose: (id: HeartPartId | null) => void }) {

  const surface = useRef<HTMLDivElement>(null), projection = useRef<SelectedMarkerProjection | null>(null), framing = useRef(createFramingBridge());

  const [storedScene, setStoredScene] = useState({ questionId: question.id, value: INITIAL_SCENE });

  const scene = storedScene.questionId === question.id ? storedScene.value : INITIAL_SCENE;

  const target = submitted || question.kind === "identify-vessel" ? question.structureId : null;

  return <div className="quiz-model-wrap"><div className="quiz-model" aria-label="Labelled heart question">

    <QuizScene assessment assessmentKey={question.id} assessmentTarget={target} state={{ ...scene, selectedId: isLocate(question) && chosen ? chosen as HeartPartId : null, markersVisible: question.kind !== "identify-vessel", selectionRevision: submitted ? 2 : 1 }}

      dispatch={action => { if (submitted) return; if (action.type === "select") { onChoose(action.id); setStoredScene({ questionId: question.id, value: sceneReducer(scene, action) }); } else if (action.type === "select-group" && isLocate(question)) setStoredScene({ questionId: question.id, value: sceneReducer(scene, action) }); }} surfaceRef={surface} projectionRef={projection} framing={framing} />

    <button className="control" type="button" onClick={() => setStoredScene({ questionId: question.id, value: sceneReducer(scene, { type: "camera", kind: "reset" }) })}>Reset quiz view</button>

  </div><p className="quiz-model-help">Left drag to rotate · Right drag to pan · Scroll to zoom{isLocate(question) && !submitted ? " · Select a vessel or numbered marker" : ""}</p></div>;

}

export default function PersonalisedQuiz({ pool, catalogue, session, level, record, onExit, onDownload, exporting = false, exportError = "", snapshot, autoStart = true, focusIds, onReturnSummary, onNewQuiz }: {

  pool: QuizQuestion[]; catalogue: EvidenceCatalogue | null; session: LearningSession; level: LearningLevel; record: (event: LearningEvent) => void;

  onExit: () => void; onDownload: () => void; exporting?: boolean; exportError?: string;

  snapshot: ReviewSnapshot; autoStart?: boolean; focusIds?: HeartPartId[]; onReturnSummary: (completion?:Extract<LearningEvent,{type:"quiz-completed"}>) => void; onNewQuiz: () => void;

}) {

  const cacheKey = JSON.stringify({ session: session.id, level, review: snapshot.version, focusIds, sources: catalogue?.sources });

  const [attempt, setAttempt] = useState<Attempt | null>(() => restoreAttempt(cacheKey, catalogue));

  const [stage,setStage] = useState<QuizStage>("finding");

  const [preparing, setPreparing] = useState(false), [notice, setNotice] = useState("");

  // Warm the quiz module during preparation; GLB bytes are reused by loadHeartAsset.
  useEffect(() => { void import("./HeartScene").catch(() => {}); }, []);

  const active = useRef(true), inFlight = useRef(false), submission = useRef("");

  useEffect(() => { active.current = true; return () => { active.current = false; }; }, []);

  useEffect(() => { if (attempt) writeLearningCache("attempt", cacheKey, attempt); }, [attempt, cacheKey]);

  async function begin() {

    if (inFlight.current) return;

    inFlight.current = true; setPreparing(true);

    // Reopening while generation is running joins the same cached request.
    const storedGeneration = readLearningCache("quiz-preparation", cacheKey);
    const generationId = typeof storedGeneration === "string" ? storedGeneration : crypto.randomUUID();
    writeLearningCache("quiz-preparation", cacheKey, generationId);

    const generated = await personalisedQuizClient.get({ ...collectQuizInput(session, level, 5, snapshot), ...(focusIds ? { focusIds } : {}), generationId }, pool, catalogue ?? undefined, next => { if(active.current)setStage(next); });

    inFlight.current = false; if (!active.current) return;

    setPreparing(false); setNotice("message" in generated && typeof generated.message === "string" ? generated.message : "");

    if (generated.questions.length !== 5) { writeLearningCache("quiz-preparation", cacheKey, null);  return; }

    // Randomise once, then preserve exact order for the attempt and saved review.

    const shuffle = <T,>(values: T[]) => { const a = [...values]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

    const questions = shuffle(generated.questions).map(q => ({ ...q, options: shuffle(q.options) }));

    const next: Attempt = { id: generationId, questions, results: [], choices: {}, index: 0, complete: false, ai: generated.ai, reviewVersion: snapshot.version };

    writeLearningCache("attempt", cacheKey, next);
    setAttempt(next); submission.current = "";

    record({ ...stamp(), type: "quiz-started", reviewVersion: snapshot.version, attemptId: next.id, level, questions: questions.map(q => ({ id: q.id, structureId: q.structureId, prompt: q.prompt, concept: q.concept, correctAnswer: q.correctAnswer, explanation: q.explanation,kind:q.kind,options:q.options,citation:validateAnswer(q,q.correctAnswer).citation,supportingCitations:validateAnswer(q,q.correctAnswer).supportingCitations })), questionIds: questions.map(q => q.id) });

  }

  const beginRef = useRef(begin); useEffect(() => { beginRef.current = begin; });

  useEffect(() => { if (autoStart && !attempt) void beginRef.current(); }, [autoStart, attempt]);

  const current = attempt?.questions[attempt.index];

  const chosen = current ? attempt!.choices[current.id] ?? null : null;

  const result = attempt?.results.find(r => r.questionId === current?.id);

  function choose(id: string | null) { if (!attempt || !current || result) return; setAttempt({ ...attempt, choices: { ...attempt.choices, [current.id]: id ?? "" } }); }

  function submit() {

    if (!attempt || !current || !chosen || result || submission.current === current.id) return;

    submission.current = current.id;

    const answer = validateAnswer(current, chosen); setAttempt({ ...attempt, results: [...attempt.results, answer] });

    record({ ...stamp(), type: "quiz-answer-submitted", attemptId: attempt.id, result: answer });

  }

  function next() {

    if (!attempt || !result) return;

    const missing = attempt.questions.findIndex(q => !attempt.results.some(r => r.questionId === q.id));

    if (missing < 0) {

      setAttempt({ ...attempt, complete: true });

      record({ ...stamp(), type: "quiz-completed", attemptId: attempt.id, level, completed:true,score:{correct:attempt.results.filter(r=>r.correct).length,total:attempt.results.length},results: attempt.results });

    } else setAttempt({ ...attempt, index: missing });

  }

  const score = scoreQuiz(attempt?.results ?? []);

  const feedback = (q: QuizQuestion) => {
    const sources = [...new Map([q.evidence, ...(q.supportingEvidence ?? [])].map(p => [`${p.sourceId}:${p.documentVersion}`, p])).values()];
    return <div className="quiz-explanation"><p>{q.explanation}</p>{sources.map(source => <div key={`${source.sourceId}:${source.documentVersion}`}><a href={source.url} target="_blank" rel="noopener noreferrer">[{source.sourceId}] {source.title}</a></div>)}</div>;
  };

  return <section className="learning-review quiz-workspace" aria-labelledby="quiz-title">

    <header className="learning-review-heading"><div><p className="eyebrow">Practice from your session</p><h2 id="quiz-title">Personalised Quiz</h2></div><div className="learning-actions"><button className="control" onClick={() => onReturnSummary(attempt?.complete ? {...stamp(),type:"quiz-completed",attemptId:attempt.id,level,completed:true,score:{correct:attempt.results.filter(r=>r.correct).length,total:attempt.results.length},results:attempt.results}:undefined)}>Return to summary</button><button className="control" onClick={onExit}>Return to Model</button></div></header>

    {exportError && <p role="alert">{exportError}</p>}

    {!attempt ? <div className="quiz-generation" aria-busy={preparing}><p role="status">{preparing || !notice ? QUIZ_STAGE_LABELS[stage] : notice}</p>{!preparing && notice && <button className="ask-tutor-button" onClick={() => void begin()}>Retry quiz</button>}</div>

      : attempt.complete ? <div className="quiz-results"><h3>Quiz Results</h3><p className="quiz-score" role="status">{score.correct} / {score.total} correct</p><p>{score.revisit.length ? "Revisit the questions marked below when you’re ready." : "You completed this practice. Choose what to explore next."}</p>

        <div className="learning-actions"><button className="control" onClick={() => { setAttempt(null); writeLearningCache("attempt", cacheKey, null); onNewQuiz(); }}>Take Another Quiz</button><button className="control" disabled={exporting} onClick={onDownload}>{exporting ? "Preparing Word…" : "Download Updated Summary"}</button></div>

        {attempt.questions.map((q,i) => { const r = attempt.results.find(a => a.questionId === q.id)!; return <details className="quiz-result-item" key={q.id}><summary><span className={r.correct ? "quiz-correct-icon" : "quiz-wrong-icon"}>{r.correct ? "✓" : "✕"}</span> {i+1}. {q.prompt}<span>{r.correct ? "Correct" : "Revisit"}</span></summary><p>Your answer: {optionName(q,r.chosen)}</p><p>Correct answer: {optionName(q,q.correctAnswer)}</p>{feedback(q)}</details>; })}</div>

      : current && <div className="quiz-layout"><div className="quiz-question-panel"><div className="quiz-question-scroll"><p className="quiz-position">Question {attempt.index+1} of {attempt.questions.length} · {level} · {attempt.ai ? "AI-personalised" : "Source-based practice"}</p><h3 className="quiz-prompt">{current.prompt}</h3>

        {(isLocate(current) || current.kind === "identify-vessel") && <ModelQuestion question={current} chosen={chosen} submitted={!!result} onChoose={id => { if (isLocate(current)) choose(id); }} />}

        {isLocate(current) ? <div className="quiz-location-feedback" role="status">{result ? <><p className={result.correct ? "quiz-correct-icon" : "quiz-wrong-icon"}>{result.correct ? "✓ Correct" : `✕ Your answer: ${optionName(current,chosen!)}`}</p><p className="quiz-correct-icon">✓ {optionName(current,current.correctAnswer)}</p>{feedback(current)}</> : <p>{chosen ? `Marker ${getHeartPart(chosen as HeartPartId)?.number} selected. Submit when ready.` : "Select your answer on the heart. You can rotate it freely."}</p>}</div>

        : <fieldset className="quiz-answer-list" disabled={!!result}><legend className="sr-only">Choose one answer</legend>{current.options.map((option, i) => {

          const correct = !!result && option.id === current.correctAnswer, wrong = !!result && option.id === chosen && !correct;

          return <div className={`quiz-answer ${correct ? "is-correct" : wrong ? "is-wrong" : option.id === chosen ? "is-chosen" : ""}`} key={option.id}><label><input type="radio" name="quiz-answer" checked={chosen === option.id} onChange={() => choose(option.id)} /><span className="quiz-letter" aria-hidden="true">{String.fromCharCode(65+i)}</span><span>{option.label}</span>{correct && <span className="quiz-correct-icon" aria-label="Correct answer">✓</span>}{wrong && <span className="quiz-wrong-icon" aria-label="Incorrect answer">✕</span>}</label>{correct && feedback(current)}</div>;

        })}</fieldset>}

        </div><footer className="quiz-question-actions">{!result ? <button className="ask-tutor-button" disabled={!chosen} onClick={submit}>Submit Answer</button> : <><span role="status">{result.correct ? "✓ Correct" : "✕ Incorrect — review the explanation"}</span><button className="ask-tutor-button" onClick={next}>{attempt.results.length === attempt.questions.length ? "Show Results" : "Next Question"}</button></>}</footer></div>

        <nav className="quiz-navigator" aria-label="Quiz questions"><h3>Questions</h3><p>{attempt.results.length} / {attempt.questions.length} submitted</p>{attempt.questions.map((q,i) => { const r = attempt.results.find(a => a.questionId === q.id); return <button key={q.id} className="control" aria-current={i===attempt.index ? "step" : undefined} onClick={() => setAttempt({ ...attempt, index:i })}>Question {i+1}<span aria-label={r ? r.correct ? "Correct" : "Incorrect" : "Not submitted"} className={r ? r.correct ? "quiz-correct-icon" : "quiz-wrong-icon" : ""}>{r ? r.correct ? "✓" : "✕" : "○"}</span></button>; })}</nav>

      </div>}

  </section>;

}

