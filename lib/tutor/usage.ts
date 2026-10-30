import { diagnosticRequestId } from "./diagnostics";
type Usage = { input_tokens?: number; output_tokens?: number; input_tokens_details?: { cached_tokens?: number } };
export type RequestCategory = "anatomy" | "mixed" | "navigation" | "review" | "quiz";
export function usageTracker(category: RequestCategory, model: string, passages = 0, evidenceTokens = 0) {
  const started = Date.now();
  let calls = 0, input = 0, output = 0, cached = 0;
  let reported = false, cacheReported = false;
  const requestId = diagnosticRequestId() ?? crypto.randomUUID();
  const returnedModels = new Set<string>(), responseIds: string[] = [];
  return {
    add(response: { usage?: Usage | null; model?: string; id?: string }) {
      if (response.model) returnedModels.add(response.model);
      if (response.id) responseIds.push(response.id);
      calls++; input += response.usage?.input_tokens ?? 0; output += response.usage?.output_tokens ?? 0;
      cached += response.usage?.input_tokens_details?.cached_tokens ?? 0;
      reported ||= typeof response.usage?.input_tokens === "number" && typeof response.usage?.output_tokens === "number";
      cacheReported ||= typeof response.usage?.input_tokens_details?.cached_tokens === "number";
    },
    finish(status: string, toolStatus = "none") {
      // Correlation IDs only: no student text, source text, keys or request bodies.
      console.info(JSON.stringify({ event: "anatomy_request", requestId, category, model, requestedModel: model, returnedModels: [...returnedModels], responseIds, passages, evidenceTokens,
        evidenceTokenMethod: "utf8-byte-upper-bound", inputTokens: reported ? input : null, outputTokens: reported ? output : null,
        cachedInputTokens: cacheReported ? cached : null, calls, retries: 0, latencyMs: Date.now() - started, status, toolStatus }));
    },
  };
}
