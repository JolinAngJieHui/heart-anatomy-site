"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";

import { getHeartPart, type HeartPartId } from "@/lib/heart-parts";

import type { LearningLevel } from "@/lib/education";

import type { TutorResponse, TutorMode } from "@/lib/tutor/types";

import { boundedConversation } from "@/lib/tutor/conversation";

import { readTutorResponse } from "@/lib/tutor/client";

import TutorIcon from "./TutorIcon";
import TutorAnswer from "./TutorAnswer";

import { resolveNavigation, requestCategory } from "@/lib/tutor/routing";
import { executionNotice, type ViewerExecution } from "@/lib/tutor/viewer-execution";

import type { NavigationProposal } from "@/lib/tutor/scene-actions";

import { learningIntent, type LearningIntent } from "@/lib/learning/intent";

import { unsafeQuestion } from "@/lib/tutor/core";

export type Turn = { id?: string; question: string; reply?: TutorResponse; error?: string; context: string };

export default function AnatomyTutor({ selectedStructureId, learningLevel, open, onClose, mode, collectionVersion, initialTurns = [], onReset, onQuestion, onReply, onError, onNavigate, onLearningAction }: { selectedStructureId: HeartPartId | null; learningLevel: LearningLevel; open: boolean; onClose: () => void; mode: TutorMode; collectionVersion?: string; initialTurns?: Turn[]; onReset?: () => void; onQuestion?: (question: string, structureId: HeartPartId | null, level: LearningLevel) => string; onReply?: (id: string, reply: TutorResponse) => void; onError?: (id: string, message: string) => void; onLearningAction?: (intent: LearningIntent, signal: AbortSignal) => Promise<string>; onNavigate?: (proposal: NavigationProposal, signal: AbortSignal) => Promise<ViewerExecution> }) {

  const [question, setQuestion] = useState("");

  const [turns, setTurns] = useState<Turn[]>(() => initialTurns.slice(-20).map(turn => collectionVersion && turn.reply && turn.reply.status !== "navigation" && turn.reply.status !== "workflow" && turn.reply.collectionVersion !== collectionVersion ? { ...turn, reply: undefined, error: "Earlier collection answer retained in saved history; excluded from this tutor's evidence and conversation." } : turn));

  const [busy, setBusy] = useState(false);

  const controller = useRef<AbortController | null>(null);

  const history = useRef<HTMLDivElement>(null);

  const input = useRef<HTMLTextAreaElement>(null);

  const generation = useRef(0);

  const structure = getHeartPart(selectedStructureId);

  useEffect(() => { history.current?.scrollTo({ top: turns.length ? history.current.scrollHeight : 0 }); }, [turns, busy, open]);

  useEffect(() => { if (open) input.current?.focus(); }, [open]);

  useEffect(() => () => { generation.current++; controller.current?.abort(); }, []);

  function reset() { generation.current++; controller.current?.abort(); controller.current = null; setBusy(false); setTurns([]); setQuestion(""); onReset?.(); input.current?.focus(); }

  async function send(message: string) {

    if (!message.trim() || busy || controller.current) return;

    if (unsafeQuestion(message)) { setTurns(previous => [...previous, { question: "Question not saved", context: "Privacy check", error: "Please use a general educational question without personal or patient information." }]); return; }

    input.current?.focus();

    const turn: Turn = { id: onQuestion?.(message.trim(), selectedStructureId, learningLevel), question: message.trim(), context: `${structure?.name ?? "General cardiovascular anatomy"} · ${learningLevel}` };

    setTurns(previous => [...previous.slice(-19), turn]); setQuestion(""); setBusy(true);

    const current = ++generation.current;

    const abort = new AbortController(); controller.current = abort;

    const intent = learningIntent(message);

    const timer = window.setTimeout(() => abort.abort(), intent ? 90000 : 65000);

    let viewerExecution: ViewerExecution | undefined;
    try {

      if (intent && onLearningAction) {

        const answer = await onLearningAction(intent, abort.signal);

        const reply: TutorResponse = { answer, status: "workflow", mode, sources: [], selectedStructureId, learningLevel };

        if (generation.current === current) { setTurns(previous => previous.map(t => t === turn ? { ...t, reply } : t)); if (turn.id) onReply?.(turn.id, reply); }

        return;

      }

      const conversation = boundedConversation(turns.filter(t => t.reply && !t.error && t.reply.status !== "workflow").flatMap(t => [{ role: "user" as const, content: t.question }, { role: "assistant" as const, content: t.reply!.answer }]));

      // Execute once, before evidence retrieval or generation, using only the
      // submitted student message and unambiguous prior student context.
      const resolved = resolveNavigation({ question: turn.question, selectedStructureId, learningLevel, conversation });
      if (resolved && "command" in resolved && onNavigate) viewerExecution = await onNavigate({ id: turn.id ?? crypto.randomUUID(), command: resolved.command }, abort.signal);
      if (generation.current !== current) return;
      if (requestCategory(turn.question) === "navigation" && !viewerExecution && (!resolved || "message" in resolved)) {
        const reply: TutorResponse = { answer: resolved && "message" in resolved ? resolved.message : "Please name one supported vessel from Heart structures. I could not identify an unambiguous target.", status: "navigation", mode, sources: [], selectedStructureId, learningLevel };
        setTurns(previous => previous.map(t => t === turn ? { ...t, reply } : t)); if (turn.id) onReply?.(turn.id, reply); return;
      }
      const response = await fetch("/api/chat", { method: "POST", headers: { "Content-Type": "application/json" }, signal: abort.signal, body: JSON.stringify({ question: turn.question, selectedStructureId, learningLevel, conversation, viewerExecution }) });

      let data = await readTutorResponse(response);

      if (data.selectedStructureId !== selectedStructureId || data.learningLevel !== learningLevel) throw new Error("Tutor response context did not match the question. Please retry.");

      if (generation.current === current && data.navigation && !viewerExecution) {

        let notice: string;

        let execution: "confirmed" | "failed" = "failed";

        try { if (!onNavigate) throw new Error("Viewer navigation is unavailable."); viewerExecution = await onNavigate(data.navigation, abort.signal); notice = executionNotice(viewerExecution); execution = viewerExecution.status === "success" ? "confirmed" : "failed"; }

        catch (error) { notice = error instanceof Error ? error.message : "Navigation could not be confirmed."; }

        void fetch("/api/chat/action-result", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: data.navigation.id, status: execution }), keepalive: true }).catch(() => {});

        // Keep the original teaching answer intact. No action executes on restore.

        const { navigation: _proposal, ...saved } = data;

        void _proposal;

        data = { ...saved, ...(data.status === "navigation" ? { answer: notice } : { navigationNotice: notice }) };

      }

      if (viewerExecution) data = { ...data, viewerExecution, navigation: undefined, ...(data.status === "navigation" ? { answer: executionNotice(viewerExecution) } : { navigationNotice: executionNotice(viewerExecution) }) };
      if (generation.current === current) { setTurns(previous => previous.map(t => t === turn ? { ...t, reply: data } : t)); if (turn.id) onReply?.(turn.id, data); }

    } catch (error) {

      if (generation.current === current) { const message = error instanceof Error && error.name !== "AbortError" ? error.message : "Request timed out. Please retry."; const reply: TutorResponse | undefined = viewerExecution ? { answer: executionNotice(viewerExecution) + (requestCategory(turn.question) === "navigation" ? "" : "\n\nThe anatomy explanation is unavailable. Please retry your question."), viewerExecution, status: requestCategory(turn.question) === "navigation" ? "navigation" : "unavailable", mode, sources: [], selectedStructureId, learningLevel, evidenceStatus: "unavailable" } : undefined; setTurns(previous => previous.map(t => t === turn ? { ...t, reply, error: message } : t)); if (turn.id) { if (reply) onReply?.(turn.id, reply); onError?.(turn.id, message.slice(0, 500)); } }

    } finally { window.clearTimeout(timer); if (generation.current === current) { setBusy(false); controller.current = null; } }

  }

  function submit(event: FormEvent) { event.preventDefault(); void send(question); }

  const suggestions = structure ? [

    `What is the main function of ${structure.name}?`,

    structure.category === "coronary-artery" ? "What does this artery supply?" : "How does this structure relate to coronary circulation?",

    learningLevel === "advanced" ? "What clinical concepts relate to this structure?" : "Where is this structure located?",

    "What determines coronary dominance?",

  ] : ["What does the right coronary artery supply?", "Explain coronary circulation.", "Why is proximal LAD blockage dangerous?", "What determines coronary dominance?"];

  return <section id="anatomy-tutor" hidden={!open} className="anatomy-tutor" aria-label="AI Anatomy Tutor" onKeyDown={event => { if (event.key === "Escape") { event.stopPropagation(); onClose(); } }}>

    <header className="tutor-heading"><div className="tutor-heading-title"><span className="tutor-icon"><TutorIcon /></span><div><p className="eyebrow">Learn alongside the model</p><h2>AI Anatomy Tutor</h2></div></div><button className="tutor-close" type="button" aria-label="Close AI Anatomy Tutor" onClick={onClose}>×</button></header>

    <div className="tutor-context-bar"><div><span className="tutor-context-label">Exploring</span><p className="tutor-context">{structure?.name ?? "General cardiovascular anatomy"}</p></div><span className="tutor-level">{learningLevel}</span></div>

    <div id="tutor-panel" className="tutor-panel">

      {mode !== "live" && <p className="tutor-availability" role="status">{mode === "review" ? "Development review · real article excerpts · no AI-generated answer." : mode === "mock" ? "Mock preview only · live tutor unavailable. No anatomical answers." : "The tutor is currently unavailable."}</p>}

      <div className="tutor-conversation-toolbar"><span>Conversation</span><button type="button" onClick={reset}>New Conversation</button></div>

      <div ref={history} className="tutor-history" role="log" aria-label="Tutor conversation" aria-live="polite" aria-relevant="additions text">

        {!turns.length && <div className="tutor-welcome"><span className="tutor-welcome-icon"><TutorIcon /></span><h3>Your AI Anatomy Tutor</h3><p>Ask questions about heart anatomy, explore clinical concepts, and learn alongside the interactive 3D model.</p><p className="tutor-suggestion-label">Start with a question</p><div className="tutor-suggestions">{suggestions.map(suggestion => <button type="button" key={suggestion} disabled={busy || mode === "disabled"} onClick={() => void send(suggestion)}>{suggestion}<span aria-hidden="true">↗</span></button>)}</div><small>Suggestions use your current structure and learning level.</small></div>}

        {turns.map((turn, index) => <article className="tutor-turn" key={index}>

          <div className="tutor-student-message"><small>You · {turn.context}</small><p className="tutor-question">{turn.question}</p></div>

          {turn.reply && <div className="tutor-ai-message"><strong className="tutor-message-author"><TutorIcon />AI Tutor</strong><span className="tutor-status">{turn.reply.mode === "mock" ? "MOCK · no live RAG" : turn.reply.status.replaceAll("_", " ")}</span><TutorAnswer reply={turn.reply} />{turn.reply.navigationNotice && <p role="status">{turn.reply.navigationNotice}</p>}

            {turn.reply.mode === "mock" && turn.reply.status === "insufficient_evidence" && <small>Insufficient synthetic test evidence</small>}

            {!!turn.reply.sources.length && <ul aria-label="Supporting sources">{turn.reply.sources.map(source => <li key={source.id}>{source.url ? <a href={source.url} target="_blank" rel="noopener noreferrer">[{source.id}] {source.title}</a> : <span>[{source.id}] {source.title}</span>}<small>{source.sourceId ? `${source.sourceId} · ` : ""}{source.section}</small>{source.licenceUrl && <details><summary>Source details and attribution</summary><p>{source.authors?.join("; ")} · {source.year} · {source.doi}</p><a href={source.licenceUrl} target="_blank" rel="noopener noreferrer">CC BY 4.0 licence</a><p>{source.copyrightNotice}</p><p>{source.changesNotice}</p><small>{source.reviewStatus}</small></details>}</li>)}</ul>}</div>}

          {turn.error && <p role="alert" className="tutor-error">{turn.error}</p>}

        </article>)}

        {busy && <p role="status">Checking available evidence…</p>}

      </div>

      <form onSubmit={submit}>

        <label htmlFor="tutor-question">Your question or study request</label>

        <textarea ref={input} id="tutor-question" value={question} maxLength={1200} rows={2} onChange={event => setQuestion(event.target.value)} onKeyDown={event => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); event.currentTarget.form?.requestSubmit(); } }} placeholder={structure?.category === "coronary-artery" ? "What does this artery supply?" : "Ask about this structure…"} />

        <div className="tutor-submit"><small>{question.length}/1200 · Shift+Enter for a new line</small><button className="tutor-send" type="submit" disabled={busy || !question.trim() || false}>{busy ? "Working…" : "Send"}</button></div>

      </form>

    </div>

  </section>;

}

