import OpenAI from "openai";
import { loadTypeScript } from "./load-typescript.mjs";
const { tutorModels } = loadTypeScript("lib/tutor/models.ts");
if (!process.env.OPENAI_API_KEY) {
  console.log("Account access unverified: OPENAI_API_KEY is not configured. No network request was made.");
  process.exitCode = 1;
} else {
  const client = new OpenAI({ maxRetries: 0, timeout: 15000 });
  for (const model of new Set(Object.values(tutorModels()))) {
    try { const response = await client.models.retrieve(model); console.log(`${model}: visible to this account (${response.id}). Generation and tool execution still require an authorised live test.`); }
    catch (error) { console.log(`${model}: access could not be verified (HTTP ${error.status ?? "network/configuration failure"}). No substitute selected.`); process.exitCode = 1; }
  }
}
