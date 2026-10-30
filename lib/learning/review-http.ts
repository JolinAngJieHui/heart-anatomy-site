import { reviewFailureCode } from "./review-status";
import { tutorModels } from "../tutor/models";
import { createHash } from "node:crypto";
import { applyReviewSelection, reviewRequestSchema, type ReviewInput } from "./lesson-review";
import type { EvidenceCatalogue } from "./evidence";
import { withSignal } from "../tutor/deadline";
import { diagnosticRequestId } from "../tutor/diagnostics";

export type ReviewConfig = { enabled: boolean; model: string; timeout: number; minute: number; daily: number };
export function lessonReviewConfig(enabledFlag = "LESSON_REVIEW_LIVE_ENABLED"): ReviewConfig {
  if (process.env[enabledFlag] !== "true") return { enabled: false, model: "", timeout: 25000, minute: 10, daily: 100 };
  const model = tutorModels().tutor;
  const number = (key: string, fallback: number, max: number) => { const n = Number(process.env[key] ?? fallback); if (!Number.isInteger(n) || n < 1 || n > max) throw new Error("Invalid configuration"); return n; };
  if (!process.env.OPENAI_API_KEY?.trim() || !model.trim()) return { enabled: false, model: "", timeout: 25000, minute: 10, daily: 100 };
  if (process.env.NODE_ENV === "production" && process.env.ASSESSMENT_DISABLE_USAGE_LIMITS !== "true" && (!process.env.TUTOR_REDIS_REST_URL || !process.env.TUTOR_REDIS_REST_TOKEN)) throw new Error("Shared limiter required");
  return { enabled: true, model, timeout: number("LEARNING_GENERATION_TIMEOUT_MS", 60000, 120000), minute: number("TUTOR_REQUESTS_PER_MINUTE", 10, 60), daily: number("TUTOR_DAILY_REQUEST_LIMIT", 100, 10000) };
}
type Dependencies = { config: () => ReviewConfig; evidence: () => Promise<EvidenceCatalogue | null>; reserve: (minute: number, daily: number) => Promise<boolean>; generate: (input: ReviewInput, catalogue: EvidenceCatalogue | null, config: ReviewConfig, signal: AbortSignal) => Promise<unknown> };
// Only in-flight work is shared. Completed reviews live in the resettable browser
// cache, so no student review remains in a server cache after restart.
export function createLessonReviewHandler(deps: Dependencies) {
  const cache = new Map<string, { result: Promise<unknown> }>();
  const headers = { "Cache-Control": "no-store" };
  return async function POST(request: Request) {
    const fallback = (reason: string, status = 200) => {
      console.info(JSON.stringify({ event: "anatomy_fallback", requestId: diagnosticRequestId(), category: "review", reason, status }));
      return Response.json({ mode: "basic", reason }, { status, headers: { ...headers, ...(status === 429 ? { "Retry-After": "60" } : {}) } });
    };
    const origin = request.headers.get("origin");
    if (origin && origin !== new URL(request.url).origin) return fallback("origin", 403);
    if (!request.headers.get("content-type")?.startsWith("application/json")) return fallback("format", 415);
    let input: ReviewInput;
    try {
      const reader = request.body?.getReader(); if (!reader) return fallback("input", 400);
      const chunks: Uint8Array[] = []; let size = 0;
      try { const signal = AbortSignal.timeout(5000); while (true) { const c = await withSignal(reader.read(), signal); if (c.done) break; size += c.value.length; if (size > 512000) throw new Error("Too large"); chunks.push(c.value); } }
      catch (e) { void reader.cancel().catch(() => {}); throw e; }
      const bytes = new Uint8Array(size); let offset = 0; for (const c of chunks) { bytes.set(c, offset); offset += c.length; }
      input = reviewRequestSchema.parse(JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)));
    } catch(error) { if(process.env.NODE_ENV!=="production")console.info(JSON.stringify({event:"review_stage",stage:"request-validation",outcome:"input",errorType:error instanceof Error?error.name:"Unknown"})); return fallback("input", 400); }
    if (!input.structures.length && !input.questions.length && !input.quizResults?.length) return fallback("empty");
    try {
      const config = deps.config();
      if (!config.enabled) return fallback("disabled");
      const catalogue = await deps.evidence().catch(() => null);
      const fingerprint = createHash("sha256").update(JSON.stringify({ input, model: config.model, passages: catalogue?.passages, sources: catalogue?.sources })).digest("hex");
      let entry = cache.get(fingerprint);
      if (!entry) {
        if (cache.size >= 32) return fallback("busy", 429);
        const result = (async () => {
          if (!await deps.reserve(config.minute, config.daily)) throw new Error("rate_limit");
          const signal = AbortSignal.timeout(config.timeout);
          signal.throwIfAborted();
          const selected = await withSignal(deps.generate(input, catalogue, config, signal), signal);
          applyReviewSelection(input, catalogue, selected);
          return selected;
        })();
        entry = { result }; cache.set(fingerprint, entry);
        const current = entry;
        const remove = () => { if (cache.get(fingerprint) === current) cache.delete(fingerprint); };
        void result.then(remove, remove);
      }
      return Response.json({ mode: "ai", selection: await entry.result }, { headers });
    } catch (e) {
      const limited = (e instanceof Error && e.message === "rate_limit") || (typeof e === "object" && e !== null && "status" in e && e.status === 429);
      return fallback(limited ? "rate_limit" : reviewFailureCode(e), limited ? 429 : 503);
    }
  };
}
