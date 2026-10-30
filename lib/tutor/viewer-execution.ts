import { z } from "zod";
import { navigationCommandSchema } from "./scene-actions";
import { HEART_PARTS } from "../heart-parts";
import { vesselGroups } from "./vessel-groups";

/** Application execution receipt, not an image or a claim of visual inspection. */
export const viewerExecutionSchema = z.object({
  actionId: z.string().min(1).max(100), command: navigationCommandSchema,
  requestedId: z.string().max(120).nullable(),
  status: z.enum(["success", "failed", "interrupted"]),
  modelLoaded: z.boolean(), cameraSettled: z.boolean(), panelOpen: z.boolean(),
  message: z.string().max(1000),
}).strict().refine(v => v.status !== "success" || (v.modelLoaded && v.cameraSettled && (!["select_structure", "focus_structure", "select_vessel_group"].includes(v.command.type) || v.panelOpen)), "Unconfirmed viewer execution");
export type ViewerExecution = z.infer<typeof viewerExecutionSchema>;
export function executionNotice(result: ViewerExecution) {
  if (result.status !== "success") return result.message;
  const command = result.command;
  if (command.type === "select_vessel_group") return `I’ve brought ${vesselGroups.find(g => g.id === command.groupId)?.label ?? command.groupId} into view and opened its segment information panel. Choose a numbered segment for its anatomical details.`;
  if (command.type === "select_structure" || command.type === "focus_structure") return `I’ve brought ${HEART_PARTS.find(p => p.id === command.structureId)!.name} into view and opened its information panel.`;
  return command.type === "reset_view" ? "The view has been reset." : "The selection has been cleared.";
}
