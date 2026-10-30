import { validateGeneratedQuiz } from "./generated-quiz";
import { retrieveQuizEvidence } from "./quiz-evidence";
import { quizFailureCode, type QuizStage } from "./quiz-status";
import { createHash } from "node:crypto";
import { applyQuizSelection, quizCandidates, quizRequestSchema, type QuizInput } from "./quiz-personalisation";
import type { EvidenceCatalogue } from "./evidence";
import type { QuizQuestion, ReviewedQuestion } from "./quiz";
import type { ReviewConfig } from "./review-http";
import { withSignal } from "../tutor/deadline";
import { diagnosticRequestId } from "../tutor/diagnostics";

type Dependencies = { config: () => ReviewConfig; evidence: () => Promise<EvidenceCatalogue>; bank?: ReviewedQuestion[];
  reserve: (minute: number, daily: number) => Promise<boolean>;
  generate: (input: QuizInput, pool: QuizQuestion[], config: ReviewConfig, signal: AbortSignal, catalogue: EvidenceCatalogue, progress?: (stage: QuizStage) => void) => Promise<unknown> };
export function createQuizHandler(deps: Dependencies) {
  const pending = new Map<string, { result:Promise<unknown>; stage:QuizStage; listeners:Set<(stage:QuizStage)=>void> }>();
  const handle = async (request: Request, progress: (stage:QuizStage)=>void) => {
    const headers = { "Cache-Control": "no-store" };
    const fallback = (reason: string, status = 200) => {
      console.info(JSON.stringify({ event: "anatomy_fallback", requestId: diagnosticRequestId(), category: "quiz", reason, status }));
      return Response.json({ mode: "basic", reason }, { status, headers: { ...headers, ...(status === 429 ? { "Retry-After": "60" } : {}) } });
    };
    if (request.headers.get("origin") && request.headers.get("origin") !== new URL(request.url).origin) return fallback("origin", 403);
    if (!request.headers.get("content-type")?.startsWith("application/json")) return fallback("format", 415);
    let input: QuizInput;
    try {
      const reader = request.body?.getReader(); if (!reader) return fallback("input", 400);
      const parts: Uint8Array[] = []; let size = 0;
      try { const timeout = AbortSignal.timeout(5000); while (true) { const p = await withSignal(reader.read(), timeout); if (p.done) break; size += p.value.length; if (size > 512000) throw new Error("Input too large"); parts.push(p.value); } }
      catch (error) { void reader.cancel().catch(() => {}); throw error; }
      input = quizRequestSchema.parse(JSON.parse(Buffer.concat(parts).toString("utf8")));
    } catch { return fallback("input", 400); }
    if (!input.review) return fallback("review_required", 400);
    try {
      const config = deps.config();
      if (!config.enabled) return fallback("disabled");
      progress("finding");
      const catalogue = await deps.evidence();
      const pool = quizCandidates(input, catalogue, deps.bank);
      if (!pool.length && !retrieveQuizEvidence(input, catalogue).length) return fallback("evidence");
      const key = createHash("sha256").update(JSON.stringify({ input, model: config.model, sources:catalogue.sources, pool })).digest("hex");
      let job = pending.get(key);
      if (!job) {
        if (pending.size >= 32) return fallback("rate_limit", 429);
        // Shared generation has one deadline, independent of a joining browser disconnect.
        const signal = AbortSignal.timeout(config.timeout);
        const listeners = new Set([progress]);
        const update = (stage:QuizStage) => { const current=pending.get(key); if(current) current.stage=stage; for(const listener of listeners) listener(stage); };
        const result = (async () => { if (!await deps.reserve(config.minute, config.daily)) throw Error("rate_limit"); return withSignal(deps.generate(input, pool, config, signal, catalogue, update), signal); })().then(selection => {
          if (selection && typeof selection === "object" && "questions" in selection) validateGeneratedQuiz(input, catalogue, selection);
          else applyQuizSelection(pool, input.count, selection);
          return selection;
        });
        job = { result, stage:"finding", listeners };
        pending.set(key, job);
        const remove = () => { if (pending.get(key)?.result === result) pending.delete(key); };
        void result.then(remove, remove);
      }
      job.listeners.add(progress); progress(job.stage);
      // The client validates the structured questions against this session and catalogue.
      return Response.json({ mode: "ai", selection: await job.result }, { headers });
    } catch (error) {
      const status = typeof error === "object" && error !== null && "status" in error ? error.status : null;
      return (error instanceof Error && error.message === "rate_limit") || status === 429 ? fallback("rate_limit", 429)
        : fallback(quizFailureCode(error), 503);
    }
  };
  return async (request:Request) => {
    if (!request.headers.get("accept")?.includes("application/x-ndjson")) return handle(request,()=>{});
    let cancelled=false;
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        const emit = (data:unknown) => { if(!cancelled) controller.enqueue(new TextEncoder().encode(JSON.stringify(data)+"\n")); };
        void handle(request,stage=>emit({stage})).then(async response=>{
          emit({result:await response.json()}); if(!cancelled) controller.close();
        },()=>{ emit({result:{mode:"basic",reason:"unavailable"}}); if(!cancelled) controller.close(); });
      },
      cancel() { cancelled=true; },
    });
    return new Response(stream,{headers:{"Content-Type":"application/x-ndjson", "Cache-Control":"no-store", "X-Accel-Buffering":"no"}});
  };
}
