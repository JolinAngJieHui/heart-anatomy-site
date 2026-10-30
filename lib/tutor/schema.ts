import { z } from "zod";
import { HEART_PARTS } from "../heart-parts";
import { navigationProposalSchema } from "./scene-actions";
import { LEARNING_LEVELS } from "../education";
import { answerWithProvenance } from "./answer-provenance";
import { viewerExecutionSchema } from "./viewer-execution";

const structure = z.enum(HEART_PARTS.map(p => p.id)).nullable();
export const chatRequestSchema = z.object({
  question: z.string().max(1200).trim().min(1), selectedStructureId: structure,
  learningLevel: z.enum(LEARNING_LEVELS), privacyConfirmed: z.literal(true).optional(),
  viewerExecution: viewerExecutionSchema.optional(),
  conversation: z.array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().max(1800).trim().min(1) }).strict()).max(6).default([]),
}).strict().refine(value => value.conversation.reduce((n, m) => n + m.content.length, 0) <= 4800, "Conversation exceeds 4800 characters");

export const chatResponseSchema = z.object({
  viewerExecution: viewerExecutionSchema.optional(),
  navigation: navigationProposalSchema.optional(), navigationNotice: z.string().max(1000).optional(),
  answer: z.string().max(7000), selectedStructureId: structure, learningLevel: z.enum(LEARNING_LEVELS),
  mode: z.enum(["mock", "live", "disabled", "review"]), status: z.enum(["supported", "partially_supported", "general_knowledge", "insufficient_evidence", "unsupported", "mock", "unavailable", "review", "navigation", "workflow"]),
  evidenceStatus: z.enum(["verified", "partial", "unverified", "synthetic", "insufficient", "unavailable", "review"]).optional(),
  sections: z.array(z.object({ kind: z.enum(["reference", "general", "uncertainty"]), text: z.string().min(1).max(4000), sourceIds: z.array(z.string().max(100)).max(12) }).strict()).min(1).max(13).optional(),
  collectionId: z.string().max(100).optional(), collectionVersion: z.string().max(64).optional(),
  retrieval: z.array(z.object({ passageId: z.string().max(250), sourceId: z.string().max(100), section: z.string().max(1000), score: z.number().min(0).max(1), direct: z.boolean(), text: z.string().max(5000), warnings: z.array(z.string().max(1000)) })).max(6).optional(),
  schemaVersion: z.literal(1).optional(), responseId: z.string().max(100).optional(),
  sources: z.array(z.object({ id: z.string().max(100), title: z.string().max(500), section: z.string().max(1000),
    url: z.string().max(2048).url().refine(url => new URL(url).protocol === "https:").nullable(), sourceId: z.string().max(100).optional(), passageId: z.string().max(200).optional(), documentVersion: z.string().max(64).optional(), materialKind: z.enum(["reference", "synthetic"]).optional(), authors: z.array(z.string()).optional(), year: z.number().optional(), doi: z.string().optional(), licenceUrl: z.string().url().optional(), copyrightNotice: z.string().nullable().optional(), changesNotice: z.string().optional(), reviewStatus: z.string().optional(), collectionId: z.string().optional(),
  })).max(12), error: z.string().max(500).optional(), errorInfo: z.object({ code: z.string().max(100), retryable: z.boolean() }).optional(),
}).refine(value => value.mode !== "mock" || (value.status !== "supported" && value.evidenceStatus !== "verified" && value.sources.every(source => source.materialKind !== "reference")), "Mock output cannot claim verified evidence")
  .refine(value => value.mode !== "review" || (value.status !== "supported" && value.evidenceStatus !== "verified" && value.sources.every(source => source.materialKind === "reference")), "Review output cannot claim production scientific approval")
  .refine(value => {
    const general = value.sections?.some(s => s.kind === "general"), references = value.sections?.some(s => s.kind === "reference");
    if (value.status === "general_knowledge" && (value.mode !== "live" || !general || references || value.sources.length || value.evidenceStatus !== "unverified")) return false;
    if (value.status === "partially_supported" && (value.mode !== "live" || !general || !references || !value.sources.length || value.evidenceStatus !== "partial")) return false;
    if (!value.sections) return !["partial", "unverified"].includes(value.evidenceStatus ?? "");
    if (value.mode !== "live" || value.answer !== answerWithProvenance(value.sections)) return false;
    if (general && !["partially_supported", "general_knowledge"].includes(value.status)) return false;
    if (references && !["verified", "partial"].includes(value.evidenceStatus ?? "")) return false;
    const ids = value.sections.flatMap(s => s.sourceIds);
    return value.sources.every(s => ids.includes(s.id) && s.materialKind === "reference") && value.sections.every(s => s.kind === "reference"
      ? !!s.sourceIds.length && s.sourceIds.every(id => value.sources.some(source => source.id === id))
      : !s.sourceIds.length && !/https?:\/\/|www\.|\[[^\]]+\]/i.test(s.text));
  }, "Answer provenance, citations and saved notice must agree");
