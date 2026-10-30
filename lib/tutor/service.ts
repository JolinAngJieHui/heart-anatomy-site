import "server-only";
import OpenAI from "openai";
import fixtures from "../../tests/fixtures/knowledge-base/synthetic.json";
import { externalIndexingAllowed } from "../knowledge-base/registry";
import { LocalRetrievalProvider, syntheticToLocal } from "./retrieval";
import { MockGenerationProvider, OpenAIGenerationProvider } from "./generation";
import { runPipeline } from "./pipeline";
import { tutorConfig } from "./config";
import { result } from "./core";
import type { TutorRequest, TutorResponse } from "./types";
import { answerMinimalReview } from "./minimal-review";
import { loadMinimalCorpus, readMinimalSelection } from "../knowledge-base/minimal";
import { requestCategory, resolveMixedNavigation, resolveNavigation } from "./routing";
import { executionNotice } from "./viewer-execution";
import { answerNavigation, navigationReply } from "./navigation";
import { tutorModels } from "./models";
import { unsafeQuestion } from "./core";

export async function answerTutor(input: TutorRequest, requestSignal?: AbortSignal): Promise<TutorResponse> {
  const config = tutorConfig();
  if (config.mode === "disabled" && !(requestCategory(input.question) === "navigation" && input.viewerExecution)) return { ...result(input, "disabled", "unavailable", "The tutor is currently disabled."), schemaVersion: 1, evidenceStatus: "unavailable" };
  const signal = AbortSignal.any([AbortSignal.timeout(config.timeout), ...(requestSignal ? [requestSignal] : [])]);
  if ([input.question, ...(input.conversation ?? []).map(m => m.content)].some(unsafeQuestion)) return result(input, config.mode, "unsupported", "Please ask a general educational question without personal or patient information.");
  if (["review", "quiz"].includes(requestCategory(input.question))) return result(input, config.mode, "workflow", "Open this study request from the tutor chat to use your current session activity.");
  const resolved = resolveNavigation(input);
  if (input.viewerExecution && (!resolved || !("command" in resolved) || JSON.stringify(resolved.command) !== JSON.stringify(input.viewerExecution.command))) throw new Error("Viewer execution target does not match the student request");
  if (requestCategory(input.question) === "navigation" && input.viewerExecution) return { ...result(input, config.mode, "navigation", executionNotice(input.viewerExecution)), viewerExecution: input.viewerExecution };
  if (requestCategory(input.question) === "navigation" && (!resolved || "message" in resolved)) return navigationReply(input, config.mode, resolved && "message" in resolved ? resolved.message : "Please name one supported structure or segment from Heart structures.");
  const models = tutorModels();
  const client = config.mode === "live" ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY, timeout: config.timeout, maxRetries: 0 }) : undefined;
  if (requestCategory(input.question) === "navigation") return answerNavigation(input, config.mode, client, models.navigation, signal);
  if (config.mode === "review") return answerMinimalReview(input);
  if (config.mode === "mock") return runPipeline(input, new LocalRetrievalProvider(syntheticToLocal(fixtures)), new MockGenerationProvider(), signal);
  let records;
  let minimal: Awaited<ReturnType<typeof loadMinimalCorpus>> | null = null;
  try {
    minimal = readMinimalSelection() ? await loadMinimalCorpus(undefined, undefined, true) : null;
    if (!minimal) throw Error("No authoritative collection selected");
    records = minimal.records;
  }
  catch { return { ...result(input, "live", "unavailable", "The approved reference collection could not be loaded. Please try later; this is not evidence that your question has no answer."), schemaVersion: 1, evidenceStatus: "unavailable", errorInfo: { code: "REFERENCE_LOAD_FAILED", retryable: true } }; }
  const corpus = minimal.corpus.filter(d => records.some(r => r.id === d.source.id && externalIndexingAllowed(r)));
  if (!corpus.length) return { ...result(input, "live", "unavailable", "Approved reference text is not available for this tutor. Please ask the site maintainer to check the collection."), evidenceStatus: "unavailable", errorInfo: { code: "REFERENCE_CONTENT_MISSING", retryable: false } };
  const retrieval = minimal && corpus.length === minimal.corpus.length ? minimal.provider : new LocalRetrievalProvider(corpus);
  const generation = new OpenAIGenerationProvider(client!, models.tutor, config.tokens);
  const response = await runPipeline(input, retrieval, generation, signal);
  if (requestCategory(input.question) === "mixed" && !input.viewerExecution) {
    const resolved = resolveMixedNavigation(input);
    const command = resolved && "command" in resolved ? resolved.command : undefined;
    if (command) {
      try {
        const navigation = await answerNavigation(input, "live", client, models.navigation, signal, command);
        response.navigation = navigation.navigation;
        if (!navigation.navigation) response.navigationNotice = navigation.answer;
      } catch {
        response.navigationNotice = "The explanation is available, but viewer navigation could not be completed. Please try the structure list.";
      }
    } else response.navigationNotice = resolved && "message" in resolved ? resolved.message : "I could not identify one unambiguous, supported viewer target. Please name an annotated structure or segment.";
  }
  return minimal ? { ...response, collectionId: minimal.id, collectionVersion: minimal.collectionVersion } : response;
}
