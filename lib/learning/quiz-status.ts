export type QuizStage = "finding" | "preparing" | "checking" | "repairing";
export const QUIZ_STAGE_LABELS: Record<QuizStage, string> = {
  finding: "Finding relevant material…", preparing: "Preparing five questions…",
  checking: "Checking answers against the references…", repairing: "Replacing questions that need correction…",
};
export class QuizPreparationError extends Error {
  constructor(public code: string, message: string = code) { super(message); }
}
export function quizFailureCode(error: unknown): string {
  if (error instanceof QuizPreparationError) return error.code;
  const e = error as { name?: string; status?: number; message?: string };
  if (/Abort|Timeout/i.test(e?.name ?? "")) return "timeout";
  if (e?.status === 429 || e?.message === "rate_limit") return "rate_limit";
  if ([401,403,404].includes(e?.status ?? 0)) return "model_unavailable";
  if (/LengthFinishReason|ContentFilterFinishReason/.test(e?.name ?? "")) return "incomplete";
  if (e?.name === "ZodError" || e?.name === "SyntaxError") return "schema";
  return "unavailable";
}
export function quizFailureMessage(code: string) {
  const messages: Record<string,string> = {
    timeout: "Quiz preparation reached its time limit. Please retry; your learning session is saved.",
    incomplete: "The AI returned an incomplete response. Please retry; this is not an evidence-coverage result.",
    duplicate: "The AI repeatedly returned duplicate or ambiguous question choices. Please retry; those questions were excluded.",
    schema: "The AI response had invalid question fields or IDs. Please retry.",
    evidence: "No eligible approved passages were found for this quiz scope. Return to the summary to check the source coverage.",
    validation: "Five supported, distinct questions were not ready after a targeted correction pass. Retry or return to the summary; no unvalidated questions were displayed.",
    mapping: "A question could not be matched to the installed heart model. Return to the model and retry after it loads.",
    rate_limit: "The quiz request limit was reached. Please wait a minute and retry.",
    disabled: "Live quiz generation is not enabled. Check the server configuration before retrying.",
    model_unavailable: "The configured AI service or model is unavailable. Check server credentials and model access.",
  };
  return messages[code] ?? "Quiz preparation could not connect or complete. Please retry; your learning session is saved.";
}
