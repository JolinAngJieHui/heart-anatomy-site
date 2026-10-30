import type OpenAI from "openai";
import { validateTutorDraft } from "./core";
import { claimSchema, generationInstructions, verificationInstructions, verificationSchema } from "./instructions";
import type { EvidencePassage } from "./retrieval";
import type { TutorRequest } from "./types";
import { evidencePayload, evidenceTokenCount } from "./evidence-budget";
import { requestCategory, resolveMixedNavigation } from "./routing";
import { usageTracker } from "./usage";
export interface GenerationProvider {
  readonly mode: "mock" | "live";
  generate(input: TutorRequest, passages: EvidencePassage[], signal: AbortSignal): Promise<{ value: unknown; verified: boolean; navigationNotice?: string }>;
}
export class MockGenerationProvider implements GenerationProvider {
  readonly mode = "mock" as const;
  async generate(input: TutorRequest, passages: EvidencePassage[], signal: AbortSignal) {
    signal.throwIfAborted();
    const first = passages[0];
    return { verified: false, value: first ? { sufficient: true, claims: [{ text: `Synthetic test response: the ${input.learningLevel} question was received${input.selectedStructureId ? ` for ${input.selectedStructureId}` : " for general study"}. Local retrieval found a fictional fixture; this is not an anatomical answer.`, passageIds: [first.citationId], quotes: [first.text.slice(0, 60)] }] } : { sufficient: false, claims: [] } };
  }
}
export class OpenAIGenerationProvider implements GenerationProvider {
  readonly mode = "live" as const;
  constructor(private client: OpenAI, private model: string, private tokens: number) {}
  async generate(input: TutorRequest, passages: EvidencePassage[], signal: AbortSignal) {
    signal.throwIfAborted();
    if (passages.some(p => p.source.materialKind !== "reference")) throw new Error("Live generation cannot use synthetic evidence");
    const evidence = evidencePayload(passages).passages;
    const mixed = requestCategory(input.question) === "mixed";
    const resolved = mixed ? resolveMixedNavigation(input) : null;
    const navigationNotice = resolved && "message" in resolved ? resolved.message : undefined;
    const usage = usageTracker(mixed ? "mixed" : "anatomy", this.model, passages.length, evidenceTokenCount(passages));
    let outcome = "failed";
    try {
    const instructions = generationInstructions(input.learningLevel) + " Never issue viewer tools. viewerExecution is the application execution result, not a screenshot or visual inspection. If it reports success, do not claim that no model context was supplied or that navigation needs references/images. Answer the anatomy question separately and preserve genuine scientific uncertainty. Do not reinterpret the navigation target.";
    const schema = claimSchema;
    const response = await this.client.responses.create({ model: this.model, store: false, reasoning: { effort: "low" }, max_output_tokens: this.tokens, instructions,
      input: JSON.stringify({ question: input.question, selectedStructureId: input.selectedStructureId, learningLevel: input.learningLevel, conversation: input.conversation ?? [], viewerExecution: input.viewerExecution ?? null, passages: evidence }),
      text: { format: { type: "json_schema", name: "grounded_anatomy", strict: true, schema } },
    }, { signal });
    usage.add(response);
    if (response.status !== "completed") return { value: null, verified: false };
    let value: unknown;
    try { value = JSON.parse(response.output_text); } catch { return { value: null, verified: false }; }
    const draft = validateTutorDraft(value, evidence);
    if (!draft) return { value: null, verified: false };
    const { claims } = draft;
    // General knowledge is generated in the SAME request. With no reference
    // claims there is nothing to cite/audit, and no fallback generation call.
    if (!claims.length) { outcome = draft.generalExplanation ? "unverified" : "uncertain"; return { value, verified: false, ...(navigationNotice ? { navigationNotice } : {}) }; }
    const check = await this.client.responses.create({ model: this.model, store: false, reasoning: { effort: "low" }, max_output_tokens: 800, instructions: verificationInstructions + " Verify educational aspects only. Viewer execution status comes only from viewerExecution, not from visual inspection. Audit anatomy claims separately.", input: JSON.stringify({ question: input.question, learningLevel: input.learningLevel, conversation: input.conversation ?? [], viewerExecution: input.viewerExecution ?? null, claims, passages: evidence }), text: { format: { type: "json_schema", name: "verify_evidence", strict: true, schema: verificationSchema } } }, { signal });
    usage.add(check);
    let verified = false;
    try { verified = check.status === "completed" && JSON.parse(check.output_text).supported === true; } catch { /* Incomplete verification refuses. */ }
    outcome = verified ? "verified" : "insufficient";
    return { value, verified, ...(navigationNotice ? { navigationNotice } : {}) };
    } finally { usage.finish(outcome); }
  }
}
