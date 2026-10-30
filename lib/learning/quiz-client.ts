import { QUIZ_STAGE_LABELS, quizFailureMessage, quizFailureCode, type QuizStage } from "./quiz-status";
import type { EvidenceCatalogue } from "./evidence";
import { validateGeneratedQuiz } from "./generated-quiz";
import { readLearningCache, writeLearningCache } from "./content-cache";
import { applyQuizSelection, type QuizInput } from "./quiz-personalisation";
import type { QuizQuestion } from "./quiz";

export function createQuizClient(fetcher: typeof fetch = fetch) {
  const cache = new Map<string, Promise<{ questions: QuizQuestion[]; ai: boolean; message?: string }>>(), pending = new Set<AbortController>();
  const stages=new Map<string,{stage:QuizStage;listeners:Set<(stage:QuizStage)=>void>}>();
  return {
    clear() { for (const controller of pending) controller.abort(); pending.clear(); cache.clear(); stages.clear(); },
    get(input: QuizInput, pool: QuizQuestion[], catalogue?: EvidenceCatalogue, onStage?: (stage:QuizStage)=>void) {
      const key = JSON.stringify({ input, pool, sources: catalogue?.sources });
      if (cache.has(key)) { const job=stages.get(key); if(job&&onStage){job.listeners.add(onStage);onStage(job.stage);} return cache.get(key)!; }
      const saved = readLearningCache("quiz", key);
      if (saved && catalogue) try {
        const questions = validateGeneratedQuiz(input, catalogue, saved);
        const result = Promise.resolve({ questions, ai: true }); cache.set(key, result); return result;
      } catch { /* Source/version or schema changed: generate on request. */ }
      const controller = new AbortController(); pending.add(controller);
      const state={stage:"finding" as QuizStage,listeners:new Set(onStage?[onStage]:[])}; stages.set(key,state);
      const progress=(stage:QuizStage)=>{state.stage=stage;for(const listener of state.listeners)listener(stage);};
      const result = (async () => {
        const fallback = { questions: [] as QuizQuestion[], ai: false, message: quizFailureMessage("unavailable") };
        if (!pool.length && !catalogue) return { ...fallback, message: "There is not enough approved material in this review for a quiz yet." };
        try {
          const response = await fetcher("/api/learning/quiz", { method: "POST", headers: { "Content-Type": "application/json", Accept:"application/x-ndjson" }, cache: "no-store", body: JSON.stringify(input), signal: AbortSignal.any([controller.signal, AbortSignal.timeout(125000)]) });
          const reader = response.body?.getReader(); if (!reader) return fallback;
          const chunks: Uint8Array[] = []; let size = 0;
          const streaming=response.headers.get("content-type")?.includes("application/x-ndjson");
          const decoder=new TextDecoder(); let buffer="", terminal:unknown;
          const consume=(line:string)=>{ if(!line.trim())return; const event=JSON.parse(line); if(event.stage && event.stage in QUIZ_STAGE_LABELS) progress(event.stage); if(event.result)terminal=event.result; };
          while (true) { const c = await reader.read(); if (c.done) break; size += c.value.length; if (size > 128000) { await reader.cancel(); return fallback; } if(streaming){ buffer+=decoder.decode(c.value,{stream:true}); let end; while((end=buffer.indexOf("\n"))>=0){consume(buffer.slice(0,end));buffer=buffer.slice(end+1);} } else chunks.push(c.value); }
          if(streaming){buffer+=decoder.decode();if(buffer.trim())consume(buffer);}
          const bytes = new Uint8Array(size); let offset = 0; for (const c of chunks) { bytes.set(c, offset); offset += c.length; }
          const data = streaming ? terminal as { mode?:string; reason?:string; selection?:{questions?:unknown} } : JSON.parse(new TextDecoder().decode(bytes)); controller.signal.throwIfAborted();
          if (!response.ok || data?.mode !== "ai") return { ...fallback, message:quizFailureMessage(data?.reason ?? "unavailable") };
          const questions = catalogue && data.selection?.questions ? validateGeneratedQuiz(input, catalogue, data.selection) : applyQuizSelection(pool, input.count, data.selection);
          if (!controller.signal.aborted) writeLearningCache("quiz", key, data.selection);
          return { questions: questions as QuizQuestion[], ai: true };
        } catch(error) { return { ...fallback, message:quizFailureMessage(quizFailureCode(error)) }; }
      })().finally(() => { pending.delete(controller); stages.delete(key); });
      if (cache.size >= 16) cache.delete(cache.keys().next().value!);
      cache.set(key, result); return result;
    },
  };
}
export const personalisedQuizClient = createQuizClient();
