import { validateRequest } from "@/lib/tutor/core";
import { answerTutor } from "@/lib/tutor/service";
import { tutorConfig } from "@/lib/tutor/config";
import { reserveUsage, type UsageLimiter } from "@/lib/tutor/limiter";
import type { TutorRequest, TutorMode } from "./types";
import { withSignal } from "./deadline";
import { chatResponseSchema } from "./schema";
import { diagnosticRequestId } from "./diagnostics";

type Dependencies = { answer: typeof answerTutor; config: typeof tutorConfig; limiter: UsageLimiter };
const headers = { "Cache-Control": "no-store" };
export function createChatHandler(deps: Dependencies = { answer: answerTutor, config: tutorConfig, limiter: { reserve: reserveUsage } }) {
  return async function POST(request: Request) {
    let input: TutorRequest | undefined;
    let mode: TutorMode = process.env.TUTOR_MODE === "live" ? "live" : process.env.TUTOR_MODE === "review" ? "review" : process.env.TUTOR_MODE === "disabled" ? "disabled" : "mock";
    const error = (status: number, code: string, message: string, retryable = false) => {
      console.info(JSON.stringify({ event: "anatomy_error", requestId: diagnosticRequestId(), category: "chat", code, status }));
      return Response.json({ schemaVersion: 1, answer: message, sources: [], selectedStructureId: input?.selectedStructureId ?? null, learningLevel: input?.learningLevel ?? "basic", status: "unavailable", evidenceStatus: "unavailable", mode, error: message, errorInfo: { code, retryable } }, { status, headers: { ...headers, ...(status === 429 ? { "Retry-After": "60" } : {}) } });
    };
    const origin = request.headers.get("origin");
    if (origin) {
      try { const parsed = new URL(origin); if (parsed.host !== (request.headers.get("host") ?? new URL(request.url).host) || !["http:", "https:"].includes(parsed.protocol)) throw new Error("Origin"); }
      catch { return error(403, "ORIGIN_REJECTED", "Cross-origin request rejected."); }
    }
    if (!request.headers.get("content-type")?.startsWith("application/json")) return error(415, "JSON_REQUIRED", "JSON required.");
    try {
      const reader = request.body?.getReader();
      if (!reader) throw new Error("Missing body");
      const signal = AbortSignal.timeout(5000), chunks: Uint8Array[] = []; let size = 0;
      try {
        while (true) {
          const chunk = await withSignal(reader.read(), signal);
          if (chunk.done) break;
          size += chunk.value.byteLength;
          if (size > 32768) throw new Error("Input size");
          chunks.push(chunk.value);
        }
      } catch (failure) { void reader.cancel().catch(() => {}); throw failure; }
      const bytes = new Uint8Array(size); let offset = 0;
      for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
      input = validateRequest(JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)));
    } catch { return error(400, "INVALID_INPUT", "Invalid question, anatomy context or conversation."); }
    try {
      const config = deps.config(); mode = config.mode ?? "mock";
      if (!await deps.limiter.reserve(config.minute, config.daily)) return error(429, "RATE_LIMITED", "Tutor usage limit reached. Please try later.", true);
      return Response.json(chatResponseSchema.parse(await deps.answer(input, request.signal)), { headers });
    } catch (failure) {
      if (typeof failure === "object" && failure !== null && "retrievalFailed" in failure) return error(503, "RETRIEVAL_FAILED", "The reference search failed. Please try later; this does not mean the references contain no answer.", true);
      const status = typeof failure === "object" && failure !== null && "status" in failure ? failure.status : null;
      if (status === 429) return error(429, "RATE_LIMITED", "The API usage limit was reached. Please try later.", true);
      if (status === 401 || status === 403 || status === 404) return error(503, "MODEL_UNAVAILABLE", "The configured model or API credentials are unavailable to this account. No other model was substituted.");
      return error(503, "PROVIDER_UNAVAILABLE", "The tutor is unavailable. Check server configuration or try again later.", true);
    }
  };
}
