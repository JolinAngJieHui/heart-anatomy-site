import { learningIntent } from "../learning/intent";
import { vesselGroups } from "./vessel-groups";
import { ANATOMICAL_SYNONYMS } from "../knowledge-base/anatomical-synonyms";
import { HEART_PARTS, getHeartPart } from "../heart-parts";
import { resolveAnatomicalTerms } from "./terminology";
import type { TutorRequest } from "./types";
import type { NavigationCommand } from "./scene-actions";

export function requestCategory(question: string): "anatomy" | "mixed" | "navigation" | "review" | "quiz" {
  const workflow = learningIntent(question);
  if (workflow) return workflow.type;
  if (/\bwhere\b.*\b(on|in) (?:the |this )?(?:3d |heart )?model\b/i.test(question)) return /\b(explain|why|how|what|function|supply|drain|clinical)\b/i.test(question) ? "mixed" : "navigation";
  const navigate = /\b(locate|show|find|pan to|focus|select|highlight|display|zoom|reset|clear|deselect|take me|bring up|look at|go to)\b/i.test(question) || /\b(return|restore)\b.*\b(view|camera)\b/i.test(question);
  const education = /\b(explain|compare|why|how|what|which|describe|function|supply|supplies|supplying|drain|drains|draining|branches|branching|origin|arises|dominance|clinical|disease|blockage|occlusion|relationship|located|feeds|feeding|blood|from|into)\b/i.test(question);
  return navigate ? education ? "mixed" : "navigation" : "anatomy";
}
export type NavigationResolution = { command: NavigationCommand } | { message: string } | null;
export function resolveNavigation(input: TutorRequest): NavigationResolution {
  const q = input.question;
  if (/^(?:please\s+)?reset (?:the )?(?:view|camera)[.!?]?$/i.test(q)) return { command: { type: "reset_view" } };
  if (/^(?:please\s+)?(?:clear (?:the )?selection|deselect(?: everything)?)[.!?]?$/i.test(q)) return { command: { type: "clear_selection" } };
  const matches = resolveAnatomicalTerms(q).matches;
  // Ordered parser matches the student's first supported name, not a later
  // imperative or the order of IDs in the registry.
  const ids = matches.find(m => m.usable)?.structureIds ?? [];
  if (ids.length > 1) {
    const group = vesselGroups.find(g => ids.every(id => g.structureIds.includes(id)));
    if (group) return { command: { type: "select_vessel_group", groupId: group.id } };
    return { message: `Which structure do you mean: ${ids.map(id => getHeartPart(id)!.name).join(", ")}?` };
  }
  if (ids.length === 1) return { command: { type: "focus_structure", structureId: ids[0] } };
  if (matches.length) return { message: "That structure is not separately available in this viewer. Please choose a structure from Heart structures." };
  if (/\b(?:show|focus|select|highlight|display)\s+(?:on\s+)?(?:it|this|that)[.!?]?$/i.test(q)) {
    const previous = input.conversation?.filter(m => m.role === "user").at(-1);
    if (previous) {
      const context = resolveAnatomicalTerms(previous.content).matches.filter(m => m.usable);
      const targets = [...new Set(context.map(m => JSON.stringify(m.structureIds)))];
      if (targets.length > 1) return { message: "Which vessel do you mean? Please name one structure." };
      if (targets.length === 1) return resolveNavigation({ ...input, question: context[0].term, conversation: [] });
    }
  }
  if (/\b(?:this|that|selected)\s+(?:vessel|structure|artery|vein)\b|\b(?:show|focus|select|highlight|display)\s+(?:on\s+)?(?:it|this|that)[.!?]?$/i.test(q)) return input.selectedStructureId
    ? { command: { type: "focus_structure", structureId: input.selectedStructureId } }
    : { message: "Which structure would you like to view? Choose one from Heart structures or name its annotated segment." };
  return null;
}
export const navigationRegistry = () => HEART_PARTS.map(p => ({ id: p.id, name: p.name, aliases: [p.shortName, ...ANATOMICAL_SYNONYMS[p.id].aliases] }));

export function resolveMixedNavigation(input: TutorRequest): NavigationResolution {
  if (resolveAnatomicalTerms(input.question).matches.some(m => m.usable)) return resolveNavigation(input);
  const tail = input.question.match(/\b(?:and|then)\s+((?:show|find|pan to|focus|select|highlight|display|reset|clear|deselect)\b.*)$/i)?.[1];
  const navigationText = tail ?? input.question;
  if (/\b(show|find|pan to|focus|select|highlight|display)\b.*\b(supplies|supplying|drains|draining|from|into|feeds)\b/i.test(navigationText)
    || /\b(vessel|structure|artery|vein)\s+(that|which)\b/i.test(navigationText)) return null;
  // In "compare RCA and LCx, then focus LCx", only the final clause names the
  // navigation target. A pronoun instead refers back to the question's names.
  if (tail && (resolveAnatomicalTerms(tail).matches.length || /\b(reset|clear|deselect)\b/i.test(tail))) return resolveNavigation({ ...input, question: tail });
  // A referenced vessel can describe a relationship rather than be the target:
  // "show the artery that branches from the left main" must not select LM.
  return resolveNavigation(input);
}
