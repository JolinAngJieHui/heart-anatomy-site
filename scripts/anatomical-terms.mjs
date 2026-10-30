import { loadTypeScript } from "./load-typescript.mjs";
const question = process.argv[2];
if (!question?.trim() || question.length > 1200) throw new Error("Supply a non-empty question of at most 1200 characters");
const { resolveAnatomicalTerms } = loadTypeScript("lib/tutor/terminology.ts");
console.log(JSON.stringify({ network: false, question, ...resolveAnatomicalTerms(question) }, null, 2));
