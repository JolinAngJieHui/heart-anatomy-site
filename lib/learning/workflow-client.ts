import type { LearningLevel } from "../education";
import type { LearningSession } from "./session";
import type { EvidenceCatalogue } from "./evidence";
import { collectReviewInput } from "./lesson-review";
import { lessonReviewClient, type ReviewResult } from "./review-client";
import { createReviewSnapshot, type ReviewSnapshot } from "./review-snapshot";

export type PreparedLesson = { catalogue: EvidenceCatalogue | null; result: ReviewResult; snapshot: ReviewSnapshot };
export async function prepareLesson(session: LearningSession, level: LearningLevel, signal: AbortSignal): Promise<PreparedLesson> {
  let catalogue: EvidenceCatalogue | null = null;
  try {
    const response = await fetch("/api/learning/evidence", { signal: AbortSignal.any([signal, AbortSignal.timeout(15000)]), cache: "no-store" });
    if (response.ok) catalogue = await response.json();
  } catch { /* The local review remains usable without the reference service. */ }
  signal.throwIfAborted();
  const input = collectReviewInput(session, level);
  const result = await lessonReviewClient.get(input, catalogue, false, signal, session.id);
  signal.throwIfAborted();
  return { catalogue, result, snapshot: createReviewSnapshot(result.input ?? input, result.selection ?? null, catalogue) };
}
