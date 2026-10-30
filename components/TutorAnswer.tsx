import type { TutorResponse } from "@/lib/tutor/types";
import { GENERAL_KNOWLEDGE_NOTICE } from "@/lib/tutor/answer-provenance";

export default function TutorAnswer({ reply }: { reply: TutorResponse }) {
  if (!reply.sections) return <p className="tutor-answer">{reply.answer}</p>;
  return <div className="tutor-answer">
    {reply.sections.some(section => section.kind === "reference") && <p className="tutor-evidence-heading">From this website’s references</p>}
    {reply.sections.map((section, index) => <div key={index} className={`tutor-answer-section tutor-answer-${section.kind}`}>
      {section.kind === "uncertainty" && <span className="tutor-evidence-heading">Limitations and uncertainty</span>}
      <p>{section.text}{section.kind === "reference" && <> {section.sourceIds.map(id => `[${id}]`).join(" ")}</>}</p>
      {section.kind === "general" && <small className="tutor-knowledge-notice">{GENERAL_KNOWLEDGE_NOTICE}</small>}
    </div>)}
    {!!reply.sources.length && <p className="tutor-evidence-heading">Sources for the reference-supported statements</p>}
  </div>;
}
