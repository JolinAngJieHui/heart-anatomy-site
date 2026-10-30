import type { LearningLevel } from "../education";
export const LEARNING_INSTRUCTIONS: Record<LearningLevel, string> = {
  basic: "Use simple language, explain terminology, and teach essential identity and function without unnecessary detail.",
  intermediate: "Use university-level terminology with relevant anatomy, function and spatial relationships.",
  advanced: "Explain detailed mechanisms, anatomical relationships and clinical relevance only where supported and relevant to this session.",
};
