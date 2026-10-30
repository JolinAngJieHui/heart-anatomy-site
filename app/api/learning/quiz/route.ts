import { withDiagnostics } from "@/lib/tutor/diagnostics";
import OpenAI from "openai";
import { createQuizHandler } from "@/lib/learning/quiz-http";
import { generateQuizSelection } from "@/lib/learning/quiz-generation";
import { lessonReviewConfig } from "@/lib/learning/review-http";
import { loadLearningEvidence } from "@/lib/learning/evidence-server";
import { permittedEvidence } from "@/lib/learning/evidence";
import { reserveUsage } from "@/lib/tutor/limiter";
import bank from "@/knowledge-base/quiz-bank.json";
import type { ReviewedQuestion } from "@/lib/learning/quiz";

export const runtime = "nodejs";
export const POST = withDiagnostics(createQuizHandler({
  config: () => lessonReviewConfig("QUIZ_LIVE_ENABLED"),
  evidence: async () => permittedEvidence(await loadLearningEvidence())!, bank: bank as ReviewedQuestion[], reserve: reserveUsage,
  generate: (input, pool, config, signal, catalogue, progress) => generateQuizSelection(new OpenAI({ apiKey: process.env.OPENAI_API_KEY, maxRetries: 0, timeout: config.timeout }), config.model, input, pool, signal, catalogue, progress),
}));
