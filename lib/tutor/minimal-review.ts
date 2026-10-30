import { loadMinimalCorpus, minimalCitation } from "../knowledge-base/minimal";
import { result, unsafeQuestion } from "./core";
import type { TutorRequest, TutorResponse } from "./types";
import { resolveAnatomicalTerms } from "./terminology";
import { questionProfile } from "./question-relevance";
import { readFile } from "node:fs/promises";
import path from "node:path";
import OpenAI from "openai";
import { validateManifest } from "../knowledge-base/documents";
import { MinimalRemoteRetrievalProvider } from "./minimal-remote";

/** Real reference retrieval, explicitly not approved production teaching or LLM
 * generation. Uses the existing global local retriever through the chat route. */
export async function answerMinimalReview(input: TutorRequest): Promise<TutorResponse> {
  if (process.env.NODE_ENV === "production") throw new Error("Review mode is development-only");
  const collection = await loadMinimalCorpus();
  if (unsafeQuestion(input.question)) return { ...result(input, "review", "unsupported", "Please ask a general educational question without personal or patient information."), collectionId: collection.id, collectionVersion: collection.collectionVersion, evidenceStatus: "review" };
  const explicit = resolveAnatomicalTerms(input.question).matches.filter(m => m.usable).flatMap(m => m.structureIds);
  const requested = explicit[0] ?? input.selectedStructureId;
  const vessel = collection.register.vessels.find((v: { structure_id: string }) => v.structure_id === requested);
  const limitation = vessel?.limitation ?? "Selected labels and source titles are context, not evidence. No scientific approval is implied.";
  const unsupportedD2 = (explicit.includes("left-diagonal-d2") || (!explicit.length && requested === "left-diagonal-d2")) && (questionProfile(input.question).domain !== "normal-anatomy" || /isolated|prognos|survival|outcome|ECG|diagnos|treatment/i.test(input.question));
  if (unsupportedD2) return { ...result(input, "review", "insufficient_evidence", `DEVELOPMENT REVIEW — this collection does not establish an isolated-D2 diagnosis or prognosis.\n\n${limitation}`), schemaVersion: 1, evidenceStatus: "review", collectionId: collection.id, collectionVersion: collection.collectionVersion, retrieval: [] };
  let provider = collection.provider as import("./retrieval").RetrievalProvider;
  if (process.env.TUTOR_REVIEW_BACKEND && !["local", "openai"].includes(process.env.TUTOR_REVIEW_BACKEND)) throw new Error("Invalid review retrieval backend");
  if (process.env.TUTOR_REVIEW_BACKEND === "openai") {
    if (!process.env.OPENAI_API_KEY) throw new Error("OpenAI review credentials missing");
    const manifest = validateManifest(JSON.parse(await readFile(path.join(process.cwd(), "knowledge-base", "collections", collection.id, "review-index-manifest.json"), "utf8")));
    const probes = JSON.parse(await readFile(path.join(process.cwd(), "knowledge-base", "collections", collection.id, "remote-search-verification.json"), "utf8"));
    if (probes.collectionVersion !== collection.collectionVersion || !Array.isArray(probes.results) || probes.results.length !== collection.records.length || collection.records.some(r => !probes.results.some((p: { sourceId: string; pass: boolean }) => p.sourceId === r.id && p.pass))) throw new Error("Remote review index is not search-verified for this version");
    provider = new MinimalRemoteRetrievalProvider(new OpenAI({ apiKey: process.env.OPENAI_API_KEY, maxRetries: 0, timeout: 20000 }), manifest, collection.documents, collection.corpus, "review");
  }
  const retrieved = await provider.retrieve({ question: input.question, selectedStructureId: input.selectedStructureId, conversation: input.conversation ?? [] }, AbortSignal.timeout(20000));
  const usable = retrieved.filter(p => p.relevance?.answerFit?.direct);
  let length = 0;
  const passages = usable.filter(p => { if (length + p.text.length > 5000) return false; length += p.text.length; return true; }).slice(0, 2);
  const cautions = [...new Set(passages.flatMap(p => p.source.cautions ?? []))].join(" ");
  const answer = passages.length
    ? `DEVELOPMENT REVIEW — literal article excerpts; ${passages.every(p => p.source.reviewStatus === "approved") ? "source records marked approved" : "source scientific review pending"}. No AI-generated anatomical explanation.\n\n${passages.map(p => `[${p.citationId}] ${p.source.anatomyPattern}\n${p.text}`).join("\n\n")}\n\nCoverage limitation (review guidance, not article evidence): ${limitation}\nSource cautions: ${cautions}`
    : `DEVELOPMENT REVIEW — insufficient direct evidence in the replacement collection for this question. No old sources or generated passages were substituted.\n\n${limitation}`;
  return { ...result(input, "review", passages.length ? "review" : "insufficient_evidence", answer), schemaVersion: 1, evidenceStatus: "review", collectionId: collection.id, collectionVersion: collection.collectionVersion,
    sources: passages.map(p => minimalCitation(p.source, p.citationId, p.id)),
    retrieval: retrieved.map(p => ({ passageId: p.id, sourceId: p.source.id, section: p.source.section, score: p.score, direct: p.relevance?.answerFit?.direct ?? false, text: p.text, warnings: p.relevance?.answerFit?.warnings ?? [] })),
  };
}
