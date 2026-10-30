import { quizResultSchema } from "./session";
import { currentQuizAssessment } from "./quiz-revision";
import { z } from "zod";
import { LEARNING_INSTRUCTIONS } from "./level-instructions";
import { HEART_PARTS } from "../heart-parts";
import { LEARNING_LEVELS, type LearningLevel } from "../education";
import { chatResponseSchema } from "../tutor/schema";
import { sessionActivity, type LearningSession } from "./session";
import type { EvidenceCatalogue } from "./evidence";
import { resolveAnatomicalTerms } from "../tutor/terminology";
import { learningIntent } from "./intent";
import { passageFit, questionProfile } from "../tutor/question-relevance";
import { GENERAL_KNOWLEDGE_NOTICE } from "../tutor/answer-provenance";
import { requestCategory } from "../tutor/routing";

const levelSchema = z.enum(LEARNING_LEVELS);
const structureSchema = z.enum(HEART_PARTS.map(p => p.id));
// Deliberately excludes timestamps, session IDs, logs, retrieval traces and browser data.
const replySchema = z.object({ answer: chatResponseSchema.shape.answer, sources: chatResponseSchema.shape.sources,
  mode: chatResponseSchema.shape.mode, status: chatResponseSchema.shape.status, evidenceStatus: chatResponseSchema.shape.evidenceStatus, sections: chatResponseSchema.shape.sections });
export const reviewRequestSchema = z.object({
  levelInstructions: z.string().max(500).optional(),
  structures: z.array(structureSchema).max(17), level: levelSchema, levels: z.array(levelSchema).max(3),
  quizResults: z.array(z.object({ attemptId: z.string().max(120).optional(), prompt: z.string().max(800).optional(), correctAnswer: z.string().max(150).optional(), chosenLabel: z.string().max(300).optional(), correctLabel: z.string().max(300).optional(), level: levelSchema.optional(), structureId: structureSchema, questionId: z.string().max(120), correct: z.boolean(), concept: z.string().max(300).optional(), conceptId:z.string().max(500).optional(), chosen: z.string().max(150).optional(), explanation: z.string().max(2000).optional(), kind:quizResultSchema.shape.kind.optional(), options:quizResultSchema.shape.options, citation:quizResultSchema.shape.citation.optional(), supportingCitations:quizResultSchema.shape.supportingCitations, completed:z.boolean().optional(),score:z.object({correct:z.number().int().min(0).max(15),total:z.number().int().min(0).max(15)}).optional() }).strict()).max(150).optional(),
  questions: z.array(z.object({ id: z.string().min(1).max(120), question: z.string().min(1).max(1200), level: levelSchema, structureId: structureSchema.nullable().optional(), reply: replySchema.nullable() }).strict()).max(80),
}).strict().refine(v => new Set(v.structures).size === v.structures.length && new Set(v.questions.map(q => q.id)).size === v.questions.length, "Duplicate activity");
export type ReviewInput = z.infer<typeof reviewRequestSchema>;
export type ReviewSource = z.infer<typeof chatResponseSchema>["sources"][number];
export type ReviewQuestion = { id: string; question: string; summary: string; answer: string | null; notice: string; sources: ReviewSource[]; sections?: import("../tutor/types").TutorAnswerSection[] };
export type Takeaway = { id: string; heading?: string; text: string; sources: ReviewSource[]; kind?: "reference" | "general"; revision?:boolean; quizQuestionIds?:string[] };
export type LessonReview = { quizNotice?:string; mode: "basic" | "ai"; title?: string; introduction: string; takeawayIntroduction?: string; overview?: Omit<Takeaway, "id" | "heading">; structures: ReviewInput["structures"]; questions: ReviewQuestion[]; takeaways: Takeaway[]; closing: string; level: LearningLevel; levels: LearningLevel[] };

export function collectReviewInput(session: LearningSession, level: LearningLevel): ReviewInput {
  const activity = sessionActivity(session);
  return { structures: activity.structures.map(s => s.id), level, levelInstructions: LEARNING_INSTRUCTIONS[level], levels: LEARNING_LEVELS.filter(l => l === level || session.events.some(e => (e.type === "card-opened" || e.type === "question-asked") && e.level === l)),
    quizResults: activity.attempts.flatMap(a => a.results.map(r => ({ structureId: r.structureId, questionId: r.questionId, correct: r.correct, concept: r.concept,conceptId:r.conceptId, chosen: r.chosen, explanation: r.explanation, prompt: r.prompt, correctAnswer: r.correctAnswer, chosenLabel: r.chosenLabel, correctLabel: r.correctLabel, level: a.level, attemptId: a.attemptId, kind:r.kind,options:r.options,citation:r.citation,supportingCitations:r.supportingCitations,completed:a.completed??true,score:{correct:a.results.filter(r=>r.correct).length,total:a.results.length} }))).slice(-150),
    questions: activity.questions.filter(q => !learningIntent(q.question) && requestCategory(q.question) !== "navigation" && q.reply?.status !== "navigation" && q.reply?.status !== "workflow").map(q => ({ id: q.id, question: q.question, level: q.level, structureId: q.structureId,
      reply: q.reply ? { answer: q.reply.answer, sources: q.reply.sources, mode: q.reply.mode, status: q.reply.status, evidenceStatus: q.reply.evidenceStatus, sections: q.reply.sections } : null })) };
}
export function reviewFingerprint(input: ReviewInput) {
  // Schema parsing/browser restoration may reorder object properties. Only
  // content and ordered activity matter, not JavaScript insertion order.
  const canonical = (value: unknown): unknown => Array.isArray(value) ? value.map(canonical)
    : value && typeof value === "object" ? Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => [key, canonical(item)])) : value;
  const parsed = reviewRequestSchema.safeParse(input);
  return JSON.stringify(canonical(parsed.success ? parsed.data : input));
}
export function answerParagraphs(answer: string) { return answer.split(/\n\s*\n/).map(p => p.trim()).filter(Boolean); }
// Keep every paragraph carrying a limitation, negation, uncertainty or source caution.
export function requiredParagraphs(answer: string) {
  return answerParagraphs(answer).flatMap((p, i) => /\b(no|not|cannot|can\b|may|might|could|usually|often|typically|vary|varies|variation|some|only|except|however|although|uncertain|limited|limitation|insufficient|caution|pending|review|unsupported|evidence|case|patient)\b/i.test(p) ? [i] : []);
}
export function answerExtract(answer: string, selected = [0]) {
  const paragraphs = answerParagraphs(answer);
  const keep = new Set([...selected, ...requiredParagraphs(answer)]);
  const text = paragraphs.filter((_, i) => keep.has(i)).join("\n\n");
  return text.length <= 1100 ? text : "Read the saved answer below, including its qualifications and source notes.";
}
export function verifiedReply(reply: ReviewInput["questions"][number]["reply"], catalogue: EvidenceCatalogue | null) {
  return !!reply && reply.mode === "live" && reply.status === "supported" && reply.evidenceStatus === "verified" && !!reply.sources.length && reply.sources.every(c => c.materialKind === "reference" && catalogue?.sources.some(s => s.available && (!s.reviewStatus || s.reviewStatus === "approved") && s.id === c.sourceId && s.documentVersion === c.documentVersion && s.title === c.title && s.url === c.url));
}
export function questionNotice(reply: ReviewInput["questions"][number]["reply"], verified: boolean) {
  if (!reply) return "No answer was recorded for this question.";
  if (reply.status === "navigation") return "Viewer navigation recorded; no anatomy explanation was requested.";
  if (reply.mode === "mock") return "Mock preview — this saved response is not an anatomical answer.";
  if (reply.mode === "review") return "Reference preview — scientific review is pending.";
  if (reply.status === "general_knowledge") return GENERAL_KNOWLEDGE_NOTICE;
  if (reply.status === "partially_supported") return "This saved answer combines cited reference information with clearly labelled general AI knowledge. Its additional explanation has not been verified against this website’s references.";
  if (reply.status !== "supported") return "The tutor did not provide a supported answer. Its original limitations are preserved below.";
  return verified ? "From your saved tutor answer." : "Saved answer — its sources could not be verified against the current approved collection.";
}
export function reviewChoices(input: ReviewInput, catalogue: EvidenceCatalogue | null) {
  const names = input.structures.map(id => HEART_PARTS.find(p => p.id === id)!.name);
  const activity = names.length ? `You explored ${names.length === 1 ? names[0] : `${names.length} heart structures`}` : input.questions.length ? "You brought your questions to the anatomy tutor" : "Your next anatomy lesson starts here";
  const introductions = [`${activity}. Here’s a quick review to return to as you revise.`, `${activity}. Take a moment to revisit your session below.`];
  const closings = names.length ? [`Keep building on your exploration. Try revisiting ${names[0]} in the model.`, `When you’re ready, return to ${names.at(-1)} and choose what you’d like to explore next.`] : ["Choose a structure in the model whenever you’re ready to continue.", "Bring another anatomy question when you’re ready to continue."];
  const candidates: Takeaway[] = (catalogue?.passages ?? []).filter(p => input.structures.includes(p.structureId) && (!p.reviewStatus || p.reviewStatus === "approved") && p.levels.includes(input.level) && p.domain !== "clinical" && p.text.length + p.pattern.length <= 800 && catalogue?.sources.some(s => s.id === p.sourceId && s.documentVersion === p.documentVersion && s.available && (!s.reviewStatus || s.reviewStatus === "approved"))).map(p => ({ id: `passage:${p.structureId}:${p.id}`, text: `${p.text}\n${p.pattern}`, sources: [{ id: p.sourceId, sourceId: p.sourceId, title: p.title, section: p.section, url: p.url, documentVersion: p.documentVersion, passageId: p.id, materialKind: "reference" }] }));
  for (const q of input.questions) if (verifiedReply(q.reply, catalogue)) {
    const text = answerExtract(q.reply!.answer);
    if (text !== "Read the saved answer below, including its qualifications and source notes.") candidates.push({ id: `answer:${q.id}`, text, sources: q.reply!.sources });
  }
  const distinct = candidates.filter((c, i) => candidates.findIndex(p => p.text === c.text) === i);
  // Study prompts are useful even when no approved medical evidence is available.
  if (!distinct.length && names.length) distinct.push({ id: "revise-structures", text: `Revisit the structures you selected: ${names.slice(0, 3).join(", ")}${names.length > 3 ? ", and the others listed above" : ""}.`, sources: [] });
  if (!distinct.length && input.questions.length) distinct.push({ id: "revise-questions", text: "Revisit your saved questions and note which answers still need supporting evidence.", sources: [] });
  const missed = [...new Set((input.quizResults ?? []).filter(r => !r.correct).map(r => HEART_PARTS.find(p => p.id === r.structureId)!.name))];
  if (missed.length) distinct.unshift({ id: "quiz-revision", text: `Your recorded quiz answers suggest revisiting: ${missed.join(", ")}. This describes those practice answers only.`, sources: [] });
  return { introductions, closings, candidates: distinct.slice(0, 24) };
}
export function basicReview(input: ReviewInput, catalogue: EvidenceCatalogue | null): LessonReview {
  const choices = reviewChoices(input, catalogue), assessment=currentQuizAssessment(input);
  const quizNotice=[assessment.questionable.length?`${assessment.questionable.length} quiz result(s) have incomplete or inconsistent question records and need question review; they are not treated as demonstrated weaknesses.`:"",assessment.unanswered.length?`${assessment.unanswered.length} unanswered question(s) are not treated as misconceptions.`:""].filter(Boolean).join(" ");
  return { ...(quizNotice?{quizNotice}:{}),mode: "basic", introduction: choices.introductions[0], structures: input.structures, level: input.level, levels: input.levels,
    questions: input.questions.map(q => ({ id: q.id, question: q.question, answer: q.reply?.answer ?? null,
      summary: q.reply ? q.reply.mode === "mock" ? "A mock preview was recorded. Open the original response below." : answerExtract(q.reply.answer) : "No answer was recorded.",
      notice: questionNotice(q.reply, verifiedReply(q.reply, catalogue)), sources: q.reply?.sources ?? [], sections: q.reply?.sections })), takeaways: [], closing: choices.closings[0] };
}

// Saved originals remain immutable. New personalised prose must use session IDs
// and approved evidence, then pass a separate server-side grounding audit.
// The paragraph selection shape remains readable for existing saved reviews.
export const reviewPersonalisationSchema = z.object({
  title: z.string().trim().min(1).max(160).optional(),
  overview: z.object({ text: z.string().trim().min(1).max(1200), evidenceIds: z.array(z.string()).max(8), kind: z.enum(["reference", "general"]), questionIds: z.array(z.string()).max(8) }).strict().nullable().optional(),
  introduction: z.string().min(1).max(400), closing: z.string().max(400),
  questions: z.array(z.object({ id: z.string(), summary: z.string().min(1).max(900), evidenceIds: z.array(z.string()).max(8) }).strict()).max(80),
  takeaways: z.array(z.object({ quizQuestionIds:z.array(z.string().max(120)).max(15).optional(), purpose:z.enum(["recap","revision","reinforcement"]).optional(), heading: z.string().trim().min(1).max(160).optional(), text: z.string().min(1).max(650), evidenceIds: z.array(z.string()).max(8), kind: z.enum(["reference", "general"]).optional(), questionIds: z.array(z.string()).max(8).optional() }).strict()).min(1).max(5),
}).strict();
export const reviewSelectionSchema = z.object({
  introduction: z.string(), structures: z.array(z.string()),
  questions: z.array(z.object({ id: z.string(), paragraphIndexes: z.array(z.number().int()) }).strict()),
  takeawayIds: z.array(z.string()), closing: z.string(), personalisation: reviewPersonalisationSchema.optional(),
}).strict();
export type ReviewSelection = z.infer<typeof reviewSelectionSchema>;
export function applyReviewSelection(input: ReviewInput, catalogue: EvidenceCatalogue | null, value: unknown): LessonReview {
  const choice = reviewSelectionSchema.parse(value), options = reviewChoices(input, catalogue);
  const same = (a: string[], b: string[]) => a.length === b.length && new Set(a).size === a.length && a.every(id => b.includes(id));
  if (!options.introductions.includes(choice.introduction) || !options.closings.includes(choice.closing) || !same(choice.structures, input.structures) || !same(choice.questions.map(q => q.id), input.questions.map(q => q.id)) || choice.takeawayIds.length > 4 || choice.takeawayIds.length < Math.min(2, options.candidates.length) || new Set(choice.takeawayIds).size !== choice.takeawayIds.length || choice.takeawayIds.some(id => !options.candidates.some(c => c.id === id))) throw new Error("Review is not grounded in this session");
  const review = basicReview(input, catalogue);
  review.questions = review.questions.map(q => {
    const selected = choice.questions.find(c => c.id === q.id)!.paragraphIndexes;
    const original = input.questions.find(c => c.id === q.id)!;
    const paragraphs = original.reply ? answerParagraphs(original.reply.answer) : [];
    if (selected.length > 3 || new Set(selected).size !== selected.length || selected.some(i => i < 0 || i >= paragraphs.length)) throw new Error("Invalid answer extract");
    return verifiedReply(original.reply, catalogue) && selected.length ? { ...q, summary: answerExtract(q.answer!, selected) } : q;
  });
  if (choice.personalisation) {
    const prose = choice.personalisation, evidence = lessonEvidence(input, catalogue);
    const assessment=currentQuizAssessment(input);
    const ids = new Set(evidence.map(p => p.key));
    const expected = input.questions.filter(q => verifiedReply(q.reply, catalogue));
    if (!same(prose.questions.map(q => q.id), expected.map(q => q.id))) throw Error("Summary questions differ from saved questions");
    for (const item of prose.questions) if (!item.evidenceIds.length || item.evidenceIds.some(id => !ids.has(id))) throw Error("Unsupported summary citation");
    for (const item of [...prose.takeaways, ...(prose.overview ? [prose.overview] : [])]) {
      if (/https?:\/\/|\[(?:P|R)\d+\]/i.test(item.text)) throw Error("Summary citations must use evidence IDs");
      if (item.kind === "general") {
        if (item.evidenceIds.length || !item.questionIds?.length || item.questionIds.some(id => !input.questions.some(q => q.id === id && retainedGeneralAnswer(q)))) throw Error("General summary must come from recorded general discussion");
      } else if (!item.evidenceIds.length || item.evidenceIds.some(id => !ids.has(id))) throw Error("Unsupported summary citation");
      // A legacy response may place actual quiz IDs in questionIds. Classify only
      // known IDs; never accept invented links or relax source validation.
      const chatIds=(item.questionIds??[]).filter(id=>input.questions.some(q=>q.id===id));
      const quizIds=[...new Set([...("quizQuestionIds" in item ? item.quizQuestionIds??[] : []),...(item.questionIds??[]).filter(id=>!chatIds.includes(id))])];
      if(quizIds.some(id=>!(input.quizResults??[]).some(r=>r.questionId===id)))throw Error("Invented summary question");
      if("purpose" in item && item.purpose==="revision" && (!quizIds.length || quizIds.some(id=>!assessment.missed.some(r=>r.questionId===id))))throw Error("Revision does not match a valid current incorrect answer");
      if("purpose" in item && item.purpose==="reinforcement" && (!quizIds.length || quizIds.some(id=>!assessment.correct.some(r=>r.questionId===id))))throw Error("Reinforcement does not match a valid current correct answer");
      if("purpose" in item && item.purpose && item.purpose!=="revision" && quizIds.some(id=>assessment.missed.some(r=>r.questionId===id)))throw Error("Current missed concepts must be marked for revision");
    }
    const covered=new Set(prose.takeaways.flatMap(t=>[...(t.quizQuestionIds??[]),...(t.questionIds??[])]));
    if(assessment.missed.some(r=>!covered.has(r.questionId)))throw Error("Missing explanation for a current missed quiz concept");
    const sources = (keys: string[]) => [...new Map(keys.flatMap(key => evidence.find(p => p.key === key)!.sources).map(s => [`${s.sourceId}:${s.passageId}`, s])).values()];
    // Optional presentation fields keep earlier saved reviews readable without
    // a formatting-only generation request. Repeated introductions are not overviews.
    const overview = prose.overview && prose.overview.text.trim() !== prose.introduction.trim() ? prose.overview : null;
    return { ...review, mode: "ai", title: prose.title, takeawayIntroduction: prose.introduction, closing: prose.closing,
      ...(overview ? { overview: { text: overview.text, sources: sources(overview.evidenceIds), kind: overview.kind } } : {}),
      questions: review.questions.map(q => { const summary = prose.questions.find(s => s.id === q.id); return summary ? { ...q, summary: summary.summary } : q; }),
      takeaways: prose.takeaways.map((t, i) => ({ id: `synthesis-${i}`, heading: t.heading, text: t.text, sources: sources(t.evidenceIds), kind: t.kind ?? "reference", revision:t.purpose==="revision" || (t.purpose===undefined&&[...(t.quizQuestionIds??[]),...(t.questionIds??[])].some(id=>assessment.missed.some(r=>r.questionId===id))), quizQuestionIds:[...new Set([...(t.quizQuestionIds??[]),...(t.questionIds??[]).filter(id=>assessment.current.some(r=>r.questionId===id))])] })) };
  }
  return { ...review, mode: "ai", introduction: choice.introduction, closing: choice.closing, takeaways: choice.takeawayIds.map(id => options.candidates.find(c => c.id === id)!) };
}

/** Whole-artery evidence is available across categories, with original limitations.
 * Names mentioned in substantive discussion extend teaching scope, never exploration. */
export function lessonScope(input: ReviewInput) {
  return [...new Set([...input.structures, ...(input.quizResults ?? []).map(r => r.structureId), ...input.questions.filter(q => q.reply?.status !== "navigation").flatMap(q => [...(q.structureId ? [q.structureId] : []), ...resolveAnatomicalTerms(q.question).matches.filter(m => m.usable).flatMap(m => m.structureIds)])])];
}
export function retainedGeneralAnswer(q: ReviewInput["questions"][number]) {
  return q.reply?.mode === "live" && ["general_knowledge", "partially_supported"].includes(q.reply.status)
    ? q.reply.sections?.filter(s => s.kind === "general" || s.kind === "uncertainty").map(s => s.text).join("\n\n") || q.reply.answer : null;
}
export function lessonEvidence(input: ReviewInput, catalogue: EvidenceCatalogue | null) {
  const scope = lessonScope(input), words = [...input.questions.map(q => q.question.toLowerCase()),...(input.quizResults??[]).map(r=>`${r.prompt??""} ${r.concept??""}`.toLowerCase())].join(" ").split(/\W+/).filter(w => w.length > 3);
  const quizCitations=(input.quizResults??[]).flatMap(r=>[...(r.supportingCitations??[]),...(r.citation?[r.citation]:[])]);
  const citations = input.questions.flatMap(q => q.reply?.mode === "live" ? q.reply.sources : []);
  const quizCited=(p:NonNullable<EvidenceCatalogue>["passages"][number])=>quizCitations.some(c=>c.sourceId===p.sourceId&&c.documentVersion===p.documentVersion&&c.passageId===p.id);
  const cited = (p: NonNullable<EvidenceCatalogue>["passages"][number]) => citations.some(c => c.sourceId === p.sourceId && c.documentVersion === p.documentVersion && (c.passageId === p.id || c.section === p.section));
  const eligible = (catalogue?.passages ?? []).filter(p => (scope.includes(p.structureId) || cited(p) || quizCited(p)) && p.levels.includes(input.level) && (!p.reviewStatus || p.reviewStatus === "approved") && catalogue?.sources.some(s => s.id === p.sourceId && s.documentVersion === p.documentVersion && s.available && (!s.reviewStatus || s.reviewStatus === "approved")));
  const profiles = input.questions.map(q => questionProfile(q.question));
  const rank = (p: typeof eligible[number]) => (cited(p) || quizCited(p) ? 1000 : 0)
    + Math.max(0, ...profiles.map(profile => { const fit = passageFit(profile, p.text, { section: p.section, anatomyPattern: p.pattern }); return (fit.direct ? 20 : 0) + fit.matchedFacets.length * 3; }))
    + (/anatomy|function|introduction/i.test(p.section.split(">").at(-1) ?? "") ? 5 : 0) + words.filter(w => p.text.toLowerCase().includes(w)).length;
  const ranked = eligible.sort((a,b) => rank(b) - rank(a));
  const chosen: typeof eligible = [];
  const add = (p: typeof eligible[number]) => { if (!chosen.some(c => c.id === p.id) && chosen.reduce((sum,c) => sum + c.text.length, 0) + p.text.length < 24000 && chosen.length < 24) chosen.push(p); };
  for(const result of currentQuizAssessment(input).current) for(const citation of [...(result.supportingCitations??[]),...(result.citation?[result.citation]:[])]) {
    const p=(catalogue?.passages??[]).find(p=>p.id===citation.passageId&&p.sourceId===citation.sourceId&&p.documentVersion===citation.documentVersion&&eligible.some(e=>e.id===p.id));if(p)add(p);
  }
  for (const p of ranked.filter(p => rank(p) >= 1000)) add(p);
  // Give every studied structure a chance before more passages for one vessel.
  for (const id of scope) for (const p of ranked.filter(p => p.structureId === id).slice(0, 2)) add(p);
  for (const id of scope) for (const p of ranked.filter(p => p.structureId === id).slice(2, 4)) add(p);
  return chosen.map(p => ({ key: p.id, text: p.text, qualifications: p.pattern, structureId: p.structureId, domain: p.domain,
    sources: [{ id: p.sourceId, sourceId: p.sourceId, title: p.title, section: p.section, url: p.url, documentVersion: p.documentVersion, passageId: p.id, materialKind: "reference" as const }] }));
}
