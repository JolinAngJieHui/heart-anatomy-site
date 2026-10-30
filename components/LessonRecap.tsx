import { HEART_PARTS, type HeartPartId } from "@/lib/heart-parts";
import type { LessonReview, ReviewSource } from "@/lib/learning/lesson-review";
import { GENERAL_KNOWLEDGE_NOTICE } from "@/lib/tutor/answer-provenance";
import TutorIcon from "./TutorIcon";
import TutorAnswer from "./TutorAnswer";

export function ReviewSources({ sources }: { sources: ReviewSource[] }) {
  return sources.length ? <details className="review-sources"><summary>Supporting sources <span className="review-source-count">{sources.length}</span></summary><ul>{sources.map((s, i) => <li key={`${s.id}-${i}`}>{s.url ? <a href={s.url} target="_blank" rel="noopener noreferrer">{s.title}</a> : s.title}{s.section && <small> · {s.section}</small>}{s.copyrightNotice && <small className="source-credit">{s.copyrightNotice}</small>}{s.changesNotice && <small className="source-credit">{s.changesNotice}</small>}</li>)}</ul></details> : null;
}
export default function LessonRecap({ review, onStructure, loading = false }: { review: LessonReview; onStructure: (id: HeartPartId) => void; loading?: boolean }) {
  // This list comes from the current recorded exploration, never generated prose.
  const structures = HEART_PARTS.filter(p => review.structures.includes(p.id));
  const introduction = review.takeawayIntroduction || review.introduction;
  const overview = review.overview?.text.trim() !== introduction.trim() ? review.overview : undefined;
  return <>
    <header className="lesson-summary-hero">
      <p className="eyebrow">Summary</p>
      <h2 id="review-title">{review.title || "Your lesson review"}</h2>
      <p className="lesson-summary-intro">{introduction}</p>
      <div className="lesson-summary-meta"><span className="review-kind">{loading ? "Preparing your review" : review.mode === "ai" ? "AI-personalised review" : "Basic session review"}</span><span className="level-name">{review.level}</span></div>
    </header>
    {overview && <section className="lesson-overview" aria-labelledby="overview-title">
      <div className="lesson-card-symbol"><TutorIcon /></div>
      <div className="lesson-card-body"><h3 id="overview-title">Overview</h3><p>{overview.text}</p>{overview.kind === "general" && <small className="tutor-knowledge-notice">{GENERAL_KNOWLEDGE_NOTICE}</small>}<ReviewSources sources={overview.sources} /></div>
    </section>}
    <section className="lesson-takeaways-section" aria-labelledby="takeaways-title" aria-busy={loading}>
      <h3 id="takeaways-title" className="lesson-section-label">Key takeaways</h3>
      {review.quizNotice && <p role="status">{review.quizNotice}</p>}
      {review.takeaways.length ? <ol className="review-takeaways">{review.takeaways.map((t, index) => <li key={t.id} className="lesson-takeaway-card">
        <div className="lesson-card-symbol" aria-hidden="true">{index + 1}</div>
        <article className="lesson-card-body" aria-label={t.heading || `Takeaway ${index + 1}`}>
          {t.revision && <small className="eyebrow">Concept to revisit</small>}{t.heading && <h4>{t.heading}</h4>}
          <p>{t.text}</p>{t.kind === "general" && <small className="tutor-knowledge-notice">{GENERAL_KNOWLEDGE_NOTICE}</small>}<ReviewSources sources={t.sources} />
        </article>
      </li>)}</ol> : <div className={`lesson-summary-state${loading ? " is-loading" : ""}`}><TutorIcon /><p>{loading ? "Preparing your personalised summary…" : !structures.length && !review.questions.length ? "Explore a structure or ask an anatomy question to begin your review." : "No AI summary has been generated. You can retry using the review actions and read your saved activity below."}</p></div>}
    </section>
    <section className="lesson-vessels" aria-labelledby="explored-title"><h3 id="explored-title">Vessels explored</h3>
      {structures.length ? <ul className="lesson-vessel-chips">{structures.map(s => <li key={s.id}><button type="button" className="control lesson-vessel-chip" data-review-vessel={s.id} onClick={() => onStructure(s.id)} aria-label={`Show ${s.name} in the model`}>{s.name}<span aria-hidden="true">↗</span></button></li>)}</ul> : <p>No structures selected yet. Choose a marker in the model to begin.</p>}
    </section>
    <details className="lesson-questions"><summary><span>Questions you asked</span><span className="review-source-count">{review.questions.length}</span></summary>
      {!review.questions.length && <p>No tutor questions in this session yet. You can ask one whenever you’re ready.</p>}
      {review.questions.map((q, i) => <article key={q.id} className="review-question"><h4><span>{i + 1}.</span> {q.question}</h4><p>{q.summary.replace(GENERAL_KNOWLEDGE_NOTICE, "").trim()}</p><small className="tutor-knowledge-notice">{q.notice}</small>{q.answer !== null && <details className="review-full-answer"><summary>Read original full answer</summary>{q.sections ? <TutorAnswer reply={{ answer: q.answer, sections: q.sections, sources: q.sources, selectedStructureId: null, learningLevel: review.level, mode: "live", status: "supported" }} /> : <p>{q.answer}</p>}</details>}<ReviewSources sources={q.sources} /></article>)}
    </details>
  </>;
}
