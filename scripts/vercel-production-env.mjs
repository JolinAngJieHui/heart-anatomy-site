// Secure, explicit transfer of this app's Production configuration. No secret
// values are printed, written to staging files, or passed as process arguments.
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const cli = process.argv[2];
if (!cli || !fs.existsSync(cli)) throw Error("Supply the installed Vercel CLI entry point");
const project = JSON.parse(fs.readFileSync(".vercel/project.json", "utf8"));
if (project.projectName !== "anabuddy" || project.orgId !== "team_QsmFABDyXN8GF052drCZpEG6") throw Error("Unexpected deployment project; verify ownership first");
require("@next/env").loadEnvConfig(process.cwd());
const env = process.env;
for (const key of ["OPENAI_API_KEY", "OPENAI_TUTOR_MODEL", "OPENAI_NAVIGATION_MODEL"]) {
  if (!env[key]?.trim()) throw Error(`Missing local ${key}; enter it privately`);
}
const values = {
  OPENAI_API_KEY: env.OPENAI_API_KEY.trim(),
  OPENAI_TUTOR_MODEL: env.OPENAI_TUTOR_MODEL.trim(),
  OPENAI_NAVIGATION_MODEL: env.OPENAI_NAVIGATION_MODEL.trim(),
  TUTOR_MODE: "live",
  TUTOR_LIVE_ENABLED: "true",
  LESSON_REVIEW_LIVE_ENABLED: "true",
  QUIZ_LIVE_ENABLED: "true",
  ASSESSMENT_DISABLE_USAGE_LIMITS: "true",
  TUTOR_TIMEOUT_MS: env.TUTOR_TIMEOUT_MS || "60000",
  LEARNING_GENERATION_TIMEOUT_MS: env.LEARNING_GENERATION_TIMEOUT_MS || "60000",
  TUTOR_MAX_OUTPUT_TOKENS: env.TUTOR_MAX_OUTPUT_TOKENS || "1600",
  RAG_TOP_K: env.RAG_TOP_K || "5",
  RAG_MAX_CONTEXT_TOKENS: env.RAG_MAX_CONTEXT_TOKENS || "3500",
};
const childEnv = { ...env, NO_COLOR: "1" };
// The CLI only needs its own persisted authentication; do not inherit API keys.
for (const key of Object.keys(childEnv)) if (/^(OPENAI_|TUTOR_REDIS_|VERCEL_OIDC_TOKEN$)/.test(key)) delete childEnv[key];
for (const [key, value] of Object.entries(values)) {
  const result = spawnSync(process.execPath, [path.resolve(cli), "env", "add", key,
    "--environment", "production", key === "OPENAI_API_KEY" ? "--sensitive" : "--no-sensitive",
    "--force", "--yes", "--scope", "ana-buddy"],
    { input: value, encoding: "utf8", env: childEnv, windowsHide: true, timeout: 60000 });
  // Do not relay CLI output: a provider error could contain a supplied value.
  if (result.status !== 0) throw Error(`Production setting ${key} failed (exit ${result.status}); no values logged`);
  console.log(`Configured Production: ${key}${key === "OPENAI_API_KEY" ? " (secret)" : ""}`);
}
