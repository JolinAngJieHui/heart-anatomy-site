import { calendarDate, sessionActivity, type LearningSession } from "./session";
import type { EvidenceCatalogue } from "./evidence";
import { HEART_PARTS } from "../heart-parts";
import { basicReview, collectReviewInput, type LessonReview, type ReviewSource } from "./lesson-review";
import { GENERAL_KNOWLEDGE_NOTICE } from "../tutor/answer-provenance";

export type SummarySection = { title: string; paragraphs: string[] };
export type LearningSummary = { title: string; date: string; kind: string; sections: SummarySection[] };
export function generateSummary(session: LearningSession, catalogue: EvidenceCatalogue | null, chosen?: LessonReview): LearningSummary {
  const review = chosen ?? basicReview(collectReviewInput(session, "basic"), catalogue);
  const sources = (items: ReviewSource[]) => items.map(s => `${s.title} — ${s.section}${s.url ? `\n${s.url}` : ""}${s.copyrightNotice ? `\n${s.copyrightNotice}` : ""}${s.changesNotice ? `\n${s.changesNotice}` : ""}`).join("\n");
  const introduction = review.takeawayIntroduction || review.introduction;
  const overview = review.overview?.text.trim() !== introduction.trim() ? review.overview : undefined;
  return { title: review.title || "Your lesson review", date: calendarDate(session.startedAt, session.timeZone), kind: review.mode === "ai" ? "AI-personalised review · based on your recorded session" : "Basic session review · based on your recorded session", sections: [
    { title: "Your session", paragraphs: [introduction, `Learning level: ${review.level}${review.levels.length > 1 ? ` · Also used: ${review.levels.filter(l => l !== review.level).join(", ")}` : ""}`] },
    ...(overview ? [{ title: "Overview", paragraphs: [`${overview.kind === "general" ? `${GENERAL_KNOWLEDGE_NOTICE}\n` : ""}${overview.text}${overview.sources.length ? `\n${sources(overview.sources)}` : ""}`] }] : []),
    { title: "Key takeaways", paragraphs: review.takeaways.length ? review.takeaways.map(t => `${t.heading ? `${t.heading}\n` : ""}${t.kind === "general" ? `${GENERAL_KNOWLEDGE_NOTICE}\n` : ""}${t.text}${t.sources.length ? `\n${sources(t.sources)}` : ""}`) : ["No AI summary has been generated. Your saved activity is included in this review."] },
    { title: "Vessels explored", paragraphs: review.structures.length ? HEART_PARTS.filter(s => review.structures.includes(s.id)).map(s => s.name) : ["No structures selected yet. Choose a marker in the model to begin."] },
    { title: "Questions you asked", paragraphs: review.questions.length ? review.questions.map(q => `${q.question}\n${q.notice}\n${q.summary}\n${sources(q.sources)}`) : ["No tutor questions in this session yet."] },
    ...sessionActivity(session).attempts.map((a, i) => ({ title: `Practice ${i + 1}: ${a.results.filter(r => r.correct).length} / ${a.results.length} correct`, paragraphs: a.results.map(r => `${r.correct ? "Correct" : "Revisit"}: ${r.concept}\n${r.explanation}`) })),
    ...(session.events.some(e => e.type === "confusion-noted") ? [{ title: "Your revision notes", paragraphs: session.events.filter(e => e.type === "confusion-noted").map(e => e.text) }] : []),
    ...(review.questions.some(q => q.answer !== null) ? [{ title: "Original tutor answers", paragraphs: review.questions.filter(q => q.answer !== null).map(q => `${q.question}\n${q.notice}\n${q.answer}\n${sources(q.sources)}`) }] : []),
  ] };
}
