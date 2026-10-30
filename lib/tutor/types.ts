import type { HeartPartId } from "../heart-parts";
import type { LearningLevel } from "../education";

export type ConversationMessage = { role: "user" | "assistant"; content: string };
export type TutorRequest = { question: string; selectedStructureId: HeartPartId | null; learningLevel: LearningLevel; privacyConfirmed?: true; conversation?: ConversationMessage[]; viewerExecution?: import("./viewer-execution").ViewerExecution };
export type TutorMode = "mock" | "live" | "disabled" | "review";
export type Citation = { id: string; title: string; url: string | null; section: string; sourceId?: string; passageId?: string; documentVersion?: string; materialKind?: "reference" | "synthetic"; authors?: string[]; year?: number; doi?: string; licenceUrl?: string; copyrightNotice?: string | null; changesNotice?: string; reviewStatus?: string; collectionId?: string };
export type TutorAnswerSection = { kind: "reference" | "general" | "uncertainty"; text: string; sourceIds: string[] };
export type TutorResponse = { viewerExecution?: import("./viewer-execution").ViewerExecution; sections?: TutorAnswerSection[]; navigation?: import("./scene-actions").NavigationProposal; navigationNotice?: string; answer: string; sources: Citation[]; status: "supported" | "partially_supported" | "general_knowledge" | "insufficient_evidence" | "unsupported" | "mock" | "unavailable" | "review" | "navigation" | "workflow"; selectedStructureId: HeartPartId | null; learningLevel: LearningLevel; mode: TutorMode; evidenceStatus?: "verified" | "partial" | "unverified" | "synthetic" | "insufficient" | "unavailable" | "review"; schemaVersion?: 1; responseId?: string; error?: string; errorInfo?: { code: string; retryable: boolean }; collectionId?: string; collectionVersion?: string; retrieval?: { passageId: string; sourceId: string; section: string; score: number; direct: boolean; text: string; warnings: string[] }[] };
export type Source = import("../knowledge-base/registry").Reference;
export type IndexedSource = { sourceId: string; fileId: string; hash: string };
export type Passage = { id: string; source: Source; text: string; score: number };
