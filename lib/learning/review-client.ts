import { reviewFailureMessage, reviewFailureCode } from "./review-status";
import { readLearningCache, writeLearningCache } from "./content-cache";
import { applyReviewSelection, basicReview, reviewFingerprint, reviewRequestSchema, reviewSelectionSchema, type ReviewSelection, type LessonReview, type ReviewInput } from "./lesson-review";
import type { EvidenceCatalogue } from "./evidence";
import { permittedEvidence } from "./evidence";

export type ReviewResult = { review: LessonReview; message: string; selection?: ReviewSelection; input?: ReviewInput; needsUpdate?: boolean; displayInput?:ReviewInput; retryable?: boolean };
export function createReviewClient(fetcher: typeof fetch = fetch) {
  const lastSuccessful=new Map<string,{input:ReviewInput;selection:ReviewSelection}>();
  const cache = new Map<string, Promise<ReviewResult>>();
  const sessionRunning = new Map<string, Promise<ReviewResult>>();
  const pending = new Set<AbortController>();
  const running = new Map<string, AbortController>();
  return { clear: () => { for (const controller of pending) controller.abort(); pending.clear(); running.clear(); sessionRunning.clear(); cache.clear();lastSuccessful.clear(); }, async get(input: ReviewInput, catalogue: EvidenceCatalogue | null, refresh = false, signal?: AbortSignal, sessionKey?: string): Promise<ReviewResult> {
    // The tab/session ID scopes browser storage only; it is never sent to the API.
    const evidenceKey = JSON.stringify([catalogue?.sources, catalogue?.passages]);
    const previousKey=JSON.stringify({session:sessionKey??"",level:input.level,sources:catalogue?.sources});
    const remember=(selection:ReviewSelection)=>{const saved={input,selection};lastSuccessful.set(previousKey,saved);writeLearningCache("review-last",previousKey,saved);};
    const key = `takeaways-v4:${sessionKey ?? ""}:` + reviewFingerprint(input) + evidenceKey;
    if (sessionKey && sessionRunning.has(sessionKey)) {
      const result = await sessionRunning.get(sessionKey)!;
      if (reviewFingerprint(result.input ?? input) === reviewFingerprint(input)) return result;
      return this.get(input, catalogue, refresh, signal, sessionKey);
    }
    if ((!refresh || running.has(key)) && cache.has(key)) return cache.get(key)!;
    const saved = !refresh ? readLearningCache("review", key) : null;
    if (saved) try { const selection = reviewSelectionSchema.parse(saved), review = applyReviewSelection(input, permittedEvidence(catalogue), selection); remember(selection); return { review, selection, input, message: "" }; } catch { /* Stale reference/schema. */ }
    const controller = new AbortController(); pending.add(controller); running.set(key, controller);
    const abort = () => controller.abort();
    if (signal?.aborted) controller.abort(); else signal?.addEventListener("abort", abort, { once: true });
    const result = (async () => {
      const local = basicReview(input, catalogue);
      const failed=(code:string):ReviewResult=>{
        const saved=lastSuccessful.get(previousKey)??readLearningCache("review-last",previousKey) as {input:ReviewInput;selection:ReviewSelection}|null;
        if(saved)try{const previous=applyReviewSelection(saved.input,permittedEvidence(catalogue),saved.selection);return {review:previous,input,displayInput:saved.input,selection:saved.selection,retryable:true,needsUpdate:true,message:"Previous summary — not yet updated with your latest activity. "+reviewFailureMessage(code)};}catch{/* Changed sources cannot restore old prose. */}
        return {review:local,input,retryable:true,needsUpdate:true,message:reviewFailureMessage(code)};
      };
      if (!input.structures.length && !input.questions.length && !input.quizResults?.length) return { review: local, input, message: "Explore a structure or ask an anatomy question to begin your review." };
      try {
        reviewRequestSchema.parse(input);
        const body = JSON.stringify(input);
        if (new TextEncoder().encode(body).length > 512000) return failed("input_size");
        const response = await fetcher("/api/learning/review", { method: "POST", headers: { "Content-Type": "application/json", ...(refresh ? { "X-Review-Refresh": "true" } : {}) }, body, signal: AbortSignal.any([controller.signal, AbortSignal.timeout(125000)]), cache: "no-store" });
        // Bound the response too; provider diagnostics are never rendered.
        const reader = response.body?.getReader(); if (!reader) throw new Error("Empty response");
        const chunks: Uint8Array[] = []; let size = 0;
        while (true) { const c = await reader.read(); if (c.done) break; size += c.value.length; if (size > 128000) { await reader.cancel(); throw new Error("Oversized response"); } chunks.push(c.value); }
        const bytes = new Uint8Array(size); let offset = 0; for (const c of chunks) { bytes.set(c, offset); offset += c.length; }
        const value = JSON.parse(new TextDecoder().decode(bytes));
        controller.signal.throwIfAborted();
        if (response.ok && value.mode === "ai") { const review = applyReviewSelection(input, permittedEvidence(catalogue), value.selection), selection = reviewSelectionSchema.parse(value.selection); writeLearningCache("review", key, selection); remember(selection); return { review, input, selection, message: "" }; }
        return failed(value.reason??"unavailable");
      } catch(error) { return failed(reviewFailureCode(error)); }

    })().finally(() => { pending.delete(controller); signal?.removeEventListener("abort", abort); if (sessionKey && sessionRunning.get(sessionKey) === result) sessionRunning.delete(sessionKey); if (running.get(key) === controller) { running.delete(key); if (controller.signal.aborted) cache.delete(key); } });
    if (cache.size >= 16) cache.delete(cache.keys().next().value!);
    cache.set(key, result);
    if (sessionKey) sessionRunning.set(sessionKey, result);
    return result;
  } };
}
export const lessonReviewClient = createReviewClient();
