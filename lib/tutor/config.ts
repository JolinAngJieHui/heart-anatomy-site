import "server-only";
import { readMinimalSelection } from "../knowledge-base/minimal";
import type { TutorMode } from "./types";

export function configuredTutorMode(): TutorMode {
  const selected = readMinimalSelection();
  const mode = process.env.TUTOR_MODE ?? (selected ? process.env.NODE_ENV === "production" ? "disabled" : "review" : "mock");
  if (!["mock", "live", "disabled", "review"].includes(mode)) throw new Error("Invalid tutor mode");
  return mode as TutorMode;
}

function integer(name: string, fallback: number, min: number, max: number) {
  const n = Number(process.env[name] ?? fallback);
  if (!Number.isInteger(n) || n < min || n > max) throw new Error(`Invalid ${name}`);
  return n;
}
export function tutorConfig() {
  const mode = configuredTutorMode();
  if (mode === "review" && process.env.NODE_ENV === "production") throw new Error("Review mode is development-only");
  const config = { mode, timeout: integer("TUTOR_TIMEOUT_MS", 60000, 1000, 60000), tokens: integer("TUTOR_MAX_OUTPUT_TOKENS", 1600, 300, 2500), minute: integer("TUTOR_REQUESTS_PER_MINUTE", 10, 1, 60), daily: integer("TUTOR_DAILY_REQUEST_LIMIT", 100, 1, 10000) };
  if (mode === "live" && (process.env.TUTOR_LIVE_ENABLED !== "true" || !process.env.OPENAI_API_KEY)) throw new Error("Live tutor is not configured");
  if (mode === "live" && process.env.NODE_ENV === "production" && process.env.ASSESSMENT_DISABLE_USAGE_LIMITS !== "true" && (!process.env.TUTOR_REDIS_REST_URL || !process.env.TUTOR_REDIS_REST_TOKEN)) throw new Error("Shared production limiter is required");
  return config;
}
