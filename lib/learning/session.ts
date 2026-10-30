import { z } from "zod";
import { HEART_PARTS, type HeartPartId } from "../heart-parts";
import { LEARNING_LEVELS, type LearningLevel } from "../education";
import { chatResponseSchema } from "../tutor/schema";
import type { TutorResponse } from "../tutor/types";
import { resolveAnatomicalTerms } from "../tutor/terminology";

export const SESSION_STORAGE_KEY = "heart-anatomy:learning-sessions:v1";
const id = z.string().min(1).max(120);
const date = z.string().datetime();
const structure = z.enum(HEART_PARTS.map(p => p.id));
const level = z.enum(LEARNING_LEVELS);
const base = { id, at: date };
const citation = z.object({ sourceId: id, documentVersion: z.string().max(64), passageId: z.string().max(250) });
export const quizResultSchema = z.object({ prompt: z.string().max(800).optional(), correctAnswer: z.string().max(150).optional(), chosenLabel: z.string().max(300).optional(), correctLabel: z.string().max(300).optional(), questionId: id, structureId: structure, concept: z.string().max(300), conceptId:z.string().max(500).optional(), chosen: z.string().max(150), correct: z.boolean(), explanation: z.string().max(2000), options: z.array(z.object({id:z.string().max(150),label:z.string().max(300)})).max(5).optional(), supportingCitations:z.array(citation.extend({title:z.string().max(500).optional(),url:z.string().max(2000).optional(),section:z.string().max(1000).optional()})).max(6).optional(), citation: citation.extend({title:z.string().max(500).optional(),url:z.string().max(2000).optional(),section:z.string().max(1000).optional()}), kind: z.enum(["multiple-choice", "identification", "application", "identify-vessel", "locate-vessel"]) });
export const eventSchema = z.discriminatedUnion("type", [
  z.object({ ...base, type: z.literal("card-opened"), structureId: structure, level }),
  z.object({ ...base, type: z.literal("card-content-displayed"), structureId: structure, level }),
  z.object({ ...base, type: z.literal("conversation-reset") }),
  z.object({ ...base, type: z.literal("level-used"), level }),
  z.object({ ...base, type: z.literal("passage-reviewed"), structureId: structure, level, citation }),
  z.object({ ...base, type: z.literal("question-asked"), question: z.string().trim().min(1).max(1200), structureId: structure.nullable(), level }),
  z.object({ ...base, type: z.literal("tutor-replied"), questionId: id, reply: chatResponseSchema }),
  z.object({ ...base, type: z.literal("tutor-error"), questionId: id, message: z.string().max(500) }),
  z.object({ ...base, type: z.literal("confusion-noted"), text: z.string().trim().min(1).max(500), structureId: structure.nullable() }),
  z.object({ ...base, type: z.literal("navigation-completed"), actionId: id, structureId: structure.nullable(), level }),
  z.object({ ...base, type: z.literal("review-prepared"), reviewVersion: id, mode: z.enum(["basic", "ai"]), level }),
  z.object({ ...base, type: z.literal("quiz-started"), questions: z.array(z.object({ id, structureId: structure, prompt: z.string().max(800), concept: z.string().max(300), correctAnswer: z.string().max(150), explanation: z.string().max(2000), kind:quizResultSchema.shape.kind.optional(), options:quizResultSchema.shape.options, citation:quizResultSchema.shape.citation.optional(), supportingCitations:quizResultSchema.shape.supportingCitations })).length(5).optional(), reviewVersion: id.optional(), attemptId: id, level, questionIds: z.array(id).min(1).max(15) }),
  z.object({ ...base, type: z.literal("quiz-answer-submitted"), attemptId: id, result: quizResultSchema }),
  z.object({ ...base, type: z.literal("quiz-completed"), attemptId: id, level, completed:z.boolean().optional(),score:z.object({correct:z.number().int().min(0).max(15),total:z.number().int().min(0).max(15)}).optional(), results: z.array(quizResultSchema).min(1).max(15) }),
]);
export type LearningEvent = z.infer<typeof eventSchema>;
export const sessionSchema = z.object({ id, title: z.string().min(1).max(120), startedAt: date, updatedAt: date, timeZone: z.string().max(100).refine(zone => { try { new Intl.DateTimeFormat("en", { timeZone: zone }); return true; } catch { return false; } }).optional(), events: z.array(eventSchema).max(10000) });
export type LearningSession = z.infer<typeof sessionSchema>;
export const historySchema = z.object({ version: z.literal(1), activeId: id, sessions: z.array(sessionSchema).min(1).max(200) }).refine(h => new Set(h.sessions.map(s => s.id)).size === h.sessions.length && h.sessions.some(s => s.id === h.activeId), "Invalid session identities");
export type SessionHistory = z.infer<typeof historySchema>;
export const stamp = () => ({ id: crypto.randomUUID(), at: new Date().toISOString() });
export function newSession(sessionId: string, at: string): LearningSession {
  return { id: sessionId, title: "Heart Anatomy Learning Session", startedAt: at, updatedAt: at, timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone, events: [] };
}
export function calendarDate(at: string, timeZone?: string) {
  const parts = new Intl.DateTimeFormat("en", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date(at));
  const get = (type: string) => parts.find(p => p.type === type)!.value;
  return `${get("year")}-${get("month")}-${get("day")}`;
}
export function newHistory(sessionId: string, at: string): SessionHistory {
  return { version: 1, activeId: sessionId, sessions: [newSession(sessionId, at)] };
}
export function appendEvent(history: SessionHistory, sessionId: string, input: LearningEvent): SessionHistory {
  // A reply or quiz callback may arrive after this session was deleted.
  if (!history.sessions.some(s => s.id === sessionId)) return history;
  const event = eventSchema.parse(input);
  if(event.type === "quiz-completed" && history.sessions.find(s=>s.id===sessionId)?.events.some(e=>e.type==="quiz-completed"&&e.attemptId===event.attemptId))return history;
  if (event.type === "tutor-replied") {
    const question = history.sessions.find(s => s.id === sessionId)?.events.find(e => e.type === "question-asked" && e.id === event.questionId);
    if (!question || question.type !== "question-asked" || question.level !== event.reply.learningLevel || question.structureId !== event.reply.selectedStructureId) throw new Error("Tutor reply must match its recorded question and session");
  }
  return { ...history, sessions: history.sessions.map(s => s.id !== sessionId || s.events.some(e => e.id === event.id) ? s : { ...s, updatedAt: event.at, events: [...s.events, event] }) };
}
export function startSession(history: SessionHistory, sessionId: string, at: string): SessionHistory {
  if (history.sessions.some(s => s.id === sessionId)) throw new Error("Duplicate session ID");
  return { ...history, activeId: sessionId, sessions: [...history.sessions, newSession(sessionId, at)] };
}
export function resumeSession(history: SessionHistory, sessionId: string): SessionHistory {
  if (!history.sessions.some(s => s.id === sessionId)) throw new Error("Unknown session");
  return { ...history, activeId: sessionId };
}
export function sessionActivity(session: LearningSession) {
  const cards = session.events.filter(e => e.type === "card-opened");
  const structures = HEART_PARTS.filter(p => cards.some(e => e.structureId === p.id));
  const levels = LEARNING_LEVELS.filter(l => session.events.some(e => "level" in e && e.level === l));
  const questions = session.events.filter(e => e.type === "question-asked").map(e => {
    const reply = session.events.filter(r => r.type === "tutor-replied" && r.questionId === e.id).at(-1);
    const error = session.events.filter(r => r.type === "tutor-error" && r.questionId === e.id).at(-1);
    return { ...e, reply: reply?.type === "tutor-replied" ? reply.reply : undefined, error: error?.type === "tutor-error" ? error.message : undefined,
      topicIds: [...new Set([...(e.structureId ? [e.structureId] : []), ...resolveAnatomicalTerms(e.question).matches.filter(m => m.usable).flatMap(m => m.structureIds)])] };
  });
  const reviews = session.events.filter(e => e.type === "passage-reviewed");
  const attempts = session.events.filter(e => e.type === "quiz-completed").filter((e,i,all)=>all.findIndex(a=>a.attemptId===e.attemptId)===i);
  return { structures, cards, levels, questions, reviews, attempts };
}
export function recordReply(questionId: string, reply: TutorResponse): LearningEvent {
  return { ...stamp(), type: "tutor-replied", questionId, reply };
}
export function sessionExploration(session: LearningSession) {
  const visited = new Set(session.events.filter(e => e.type === "card-opened").map(e => e.structureId));
  const lastLevel = session.events.findLast(e => e.type === "level-used" || e.type === "card-opened" || e.type === "card-content-displayed");
  return { visitedIds: HEART_PARTS.filter(p => visited.has(p.id)).map(p => p.id), learningLevel: lastLevel && "level" in lastLevel ? lastLevel.level : "basic" as LearningLevel };
}
export function recordCard(structureId: HeartPartId, level: LearningLevel): LearningEvent {
  return { ...stamp(), type: "card-opened", structureId, level };
}

/** Include an acknowledged result directly, independent of a pending React render. */
export function sessionWithQuizCompletion(session:LearningSession, completion?:Extract<LearningEvent,{type:"quiz-completed"}>):LearningSession {
  if(!completion)return session;
  return appendEvent({version:1,activeId:session.id,sessions:[session]},session.id,completion).sessions[0];
}
