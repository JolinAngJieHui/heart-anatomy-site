import type { TutorAnswerSection } from "./types";

export const GENERAL_KNOWLEDGE_NOTICE = "Not verified against this website’s references: This answer uses general AI knowledge. Please cross-check it with a reliable anatomy textbook or another authoritative source.";

/** Include provenance in the saved plain text as well as the visual sections.
 * Conversation history, lesson reviews and Word exports must retain the notice. */
export function answerWithProvenance(sections: TutorAnswerSection[]) {
  return sections.map(section => section.kind === "general"
    ? `${GENERAL_KNOWLEDGE_NOTICE}\n\n${section.text}`
    : section.kind === "reference"
      ? `${section.text} ${section.sourceIds.map(id => `[${id}]`).join(" ")}`
      : section.text).join("\n\n");
}
