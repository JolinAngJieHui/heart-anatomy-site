export class ReviewPreparationError extends Error {
  constructor(public code:string, public stage:string, public issues:string[]=[]){super(code);}
}
export function reviewFailureCode(error:unknown) {
  if(error instanceof ReviewPreparationError)return error.code;
  const e=error as {name?:string;status?:number;message?:string};
  if(/Abort|Timeout/i.test(e?.name??""))return "timeout";
  if(e?.status===429||e?.message==="rate_limit")return "rate_limit";
  if([401,403,404].includes(e?.status??0))return "model_unavailable";
  if(/Zod|Syntax/.test(e?.name??""))return "schema";
  return "unavailable";
}
export function reviewFailureMessage(code:string) {
  return ({input_size:"This recorded session exceeds the review request size limit. Your results and previous summary are retained; no updated AI summary has been generated.",timeout:"Updating your review reached its time limit. Retry using your saved quiz results.",
    incomplete:"The AI returned an incomplete review. Retry using your saved results; you do not need to retake the quiz.",
    schema:"The review response contained invalid fields, citations or activity links. Retry using your saved quiz results.",
    evidence:"Relevant approved reference passages could not be loaded. Your quiz results remain saved; retry when the references are available.",
    audit:"The updated review did not pass its source or quiz-result checks. Retry using your saved results.",
    revision:"The review did not explain the recorded missed concepts adequately. Retry using your saved results.",
    disabled:"AI personalisation is not enabled. Your saved activity is available below; no AI summary has been generated.",
    rate_limit:"The review request limit was reached. Wait a minute, then retry using your saved results.",
    model_unavailable:"The configured AI service or model is unavailable. Your results are saved; check the server configuration.",
  } as Record<string,string>)[code]??"Your review could not be updated because the request failed. Retry using your saved results; you do not need to retake the quiz.";
}
