import type { ReviewInput } from "./lesson-review";
import { HEART_PARTS } from "../heart-parts";
import { ANATOMICAL_SYNONYMS } from "../knowledge-base/anatomical-synonyms";

const norm=(s:string)=>s.toLowerCase().replace(/[^a-z0-9]+/g," ").trim();
const canonical=(s:string)=>HEART_PARTS.find(p=>[p.name,p.shortName,...ANATOMICAL_SYNONYMS[p.id].aliases].some(a=>norm(a)===norm(s)))?.id??norm(s);
/** Latest completed attempt is current practice, never a diagnosis of ability. */
export function currentQuizAssessment(input: ReviewInput) {
  const all=input.quizResults??[];
  const latest=all.findLast(r=>r.completed!==false)?.attemptId;
  const current=all.filter(r=>r.completed!==false&&(!latest||r.attemptId===latest))
    .filter((r,i,a)=>a.findIndex(x=>x.questionId===r.questionId)===i);
  const unanswered=current.filter(r=>!r.chosen?.trim());
  const questionable=current.filter(r=>{
    if(!r.chosen?.trim())return false;
    if(!r.correctAnswer||!r.prompt||!r.kind||r.correct!==(r.chosen===r.correctAnswer))return true;
    if(r.kind==="locate-vessel"||r.kind==="identification")return r.correctAnswer!==r.structureId||!HEART_PARTS.some(p=>p.id===r.chosen);
    const options=r.options;
    return !options?.length||new Set(options.map(o=>o.id)).size!==options.length||new Set(options.map(o=>canonical(o.label))).size!==options.length
      ||!options.some(o=>o.id===r.correctAnswer)||!options.some(o=>o.id===r.chosen);
  });
  const valid=current.filter(r=>!unanswered.includes(r)&&!questionable.includes(r));
  return {current,missed:valid.filter(r=>!r.correct),correct:valid.filter(r=>r.correct),unanswered,questionable,
    historical:all.filter(r=>!current.includes(r)),latestAttemptId:latest??null};
}
