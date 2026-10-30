import { HEART_PARTS, type HeartPartId } from "../heart-parts";
import type { SceneAction } from "../scene-state";
import { z } from "zod";
import { vesselGroups } from "./vessel-groups";

export const navigationCommandSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("clear_selection") }).strict(),
  z.object({ type: z.literal("reset_view") }).strict(),
  z.object({ type: z.literal("select_vessel_group"), groupId: z.enum(vesselGroups.map(g => g.id) as [string, ...string[]]) }).strict(),
  z.object({ type: z.enum(["select_structure", "focus_structure"]), structureId: z.enum(HEART_PARTS.map(p => p.id)) }).strict(),
]);
export type NavigationCommand = z.infer<typeof navigationCommandSchema>;
export const navigationProposalSchema = z.object({ id: z.string().min(1).max(100), command: navigationCommandSchema }).strict();
export type NavigationProposal = z.infer<typeof navigationProposalSchema>;
export const navigationTools = ["select_structure", "focus_structure", "select_vessel_group", "clear_selection", "reset_view"].map(name => ({
  type: "function" as const, name, description: `${name.replaceAll("_", " ")} in the existing anatomy viewer. This proposes an action; execution must be confirmed by the viewer.`, strict: true,
  parameters: { type: "object", additionalProperties: false, required: name === "select_vessel_group" ? ["groupId"] : name.endsWith("structure") ? ["structureId"] : [],
    properties: name === "select_vessel_group" ? { groupId: { type: "string", enum: vesselGroups.map(g => g.id) } } : name.endsWith("structure") ? { structureId: { type: "string", enum: HEART_PARTS.map(p => p.id) } } : {} },
}));
export function parseNavigationCall(name: string, args: string): NavigationCommand {
  if (!navigationTools.some(t => t.name === name)) throw new Error("Unsupported navigation tool");
  const value = JSON.parse(args);
  if (!value || Array.isArray(value) || typeof value !== "object" || "type" in value) throw new Error("Invalid navigation arguments");
  return navigationCommandSchema.parse({ type: name, ...value });
}

// The same allow-list protects both server proposals and client execution.
export function validateSceneAction(value: unknown): SceneAction | null {
  const parsed = navigationCommandSchema.safeParse(value);
  if (!parsed.success) return null;
  if (parsed.data.type === "select_vessel_group") return { type: "select-group", id: parsed.data.groupId };
  const action = parsed.data as { type?: string; structureId?: HeartPartId };
  if (action.type === "clear_selection" && action.structureId === undefined) return { type: "select", id: null };
  if (action.type === "reset_view" && action.structureId === undefined) return { type: "camera", kind: "reset" };
  if (["select_structure", "focus_structure"].includes(action.type ?? "") && HEART_PARTS.some(p => p.id === action.structureId)) return { type: "select", id: action.structureId! };
  return null;
}

export function createActionLedger() {
  const seen = new Set<string>(); let epoch = 0;
  return {
    epoch: () => epoch,
    reset() { epoch++; seen.clear(); },
    accept(value: unknown, expectedEpoch: number) {
      const parsed = navigationProposalSchema.safeParse(value);
      if (epoch !== expectedEpoch || !parsed.success || seen.has(parsed.data.id)) return null;
      const action = validateSceneAction(parsed.data.command);
      if (!action) return null;
      seen.add(parsed.data.id); return action;
    },
  };
}
