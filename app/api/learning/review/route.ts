import { withDiagnostics } from "@/lib/tutor/diagnostics";
import OpenAI from "openai";
import { createLessonReviewHandler, lessonReviewConfig } from "@/lib/learning/review-http";
import { generateLessonReview } from "@/lib/learning/review-generation";
import { permittedEvidence } from "@/lib/learning/evidence";
import { loadLearningEvidence } from "@/lib/learning/evidence-server";
import { reserveUsage } from "@/lib/tutor/limiter";

export const runtime = "nodejs";
export const POST = withDiagnostics(createLessonReviewHandler({
  config: lessonReviewConfig,
  evidence: async () => permittedEvidence(await loadLearningEvidence()),
  reserve: reserveUsage,
  generate: (input, catalogue, config, signal) => generateLessonReview(new OpenAI({ apiKey: process.env.OPENAI_API_KEY, timeout: config.timeout, maxRetries: 0 }), config.model, input, catalogue, signal),
}));
