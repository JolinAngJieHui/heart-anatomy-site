import assert from "node:assert/strict";
import {test} from "node:test";
import {load} from "./helpers/load-module.mjs";
const {runPipeline}=load("lib/tutor/pipeline.ts"),{OpenAIGenerationProvider}=load("lib/tutor/generation.ts");
const {chatResponseSchema}=load("lib/tutor/schema.ts"),{LEVEL_INSTRUCTIONS}=load("lib/tutor/instructions.ts");
const {GENERAL_KNOWLEDGE_NOTICE}=load("lib/tutor/answer-provenance.ts");
const {loadMinimalCorpus}=load("lib/knowledge-base/minimal.ts");
const collection=await loadMinimalCorpus(undefined,undefined,true);
const input={question:"What is the main function of Coronary Sinus?",learningLevel:"basic",selectedStructureId:null,privacyConfirmed:true,conversation:[]};
const actual=await collection.provider.retrieve(input,AbortSignal.timeout(10000));assert.ok(actual.length);

async function answer(coverage,level="basic",change={}) {
 const calls=[];
 const client={responses:{create:async params=>{
  calls.push(params);const payload=JSON.parse(params.input);
  assert.equal(payload.learningLevel,level);assert.equal(params.tools,undefined);
  if(params.text.format.name==="verify_evidence"){
   assert.equal(payload.generalExplanation,undefined);assert.match(params.instructions,/only PART/);
   return {status:"completed",output_text:JSON.stringify({supported:change.audit??true})};
  }
  assert.ok(params.instructions.includes(LEVEL_INSTRUCTIONS[level]));assert.match(params.instructions,/CURRENT learningLevel/);
  const p=payload.passages[0];
  let draft={sufficient:true,claims:coverage==="none"?[]:[{text:p.text.slice(0,80).replace(/\[[^\]]+\]/g,""),passageIds:[p.id],quotes:[p.text.slice(0,80)]}],generalExplanation:coverage==="full"?"":`Synthetic ${level} fixture only; not an anatomical explanation.`,uncertainty:""};
  if(change.draft)draft=change.draft(draft);
  return {status:"completed",output_text:JSON.stringify(draft)};
 }}};
 const response=await runPipeline({...input,learningLevel:level,conversation:[{role:"user",content:"Earlier Advanced discussion."}]},{mode:"local",retrieve:async()=>coverage==="none"?[]:actual},new OpenAIGenerationProvider(client,"mocked-model",2000),AbortSignal.timeout(10000));
 assert.ok(chatResponseSchema.safeParse(response).success,JSON.stringify(response));return {response,calls};
}
test("all three current levels reach generation for full, partial and absent reference coverage",async()=>{
 for(const level of ["basic","intermediate","advanced"])for(const coverage of ["full","partial","none"]){
  const {response,calls}=await answer(coverage,level);
  assert.equal(response.learningLevel,level);assert.equal(calls.length,coverage==="none"?1:2);
  assert.equal(response.status,{full:"supported",partial:"partially_supported",none:"general_knowledge"}[coverage]);
  assert.equal(response.evidenceStatus,{full:"verified",partial:"partial",none:"unverified"}[coverage]);
  assert.equal(response.answer.includes(GENERAL_KNOWLEDGE_NOTICE),coverage!=="full");
  assert.equal(response.sources.length>0,coverage!=="none");
  for(const section of response.sections)assert.equal(section.sourceIds.length>0,section.kind==="reference");
 }
});
test("unknown citations, changed quotations and citation-looking general prose cannot reach the UI",async()=>{
 for(const draft of [d=>({...d,claims:[{...d.claims[0],passageIds:["made-up"]}]}),d=>({...d,claims:[{...d.claims[0],quotes:["This was never in the source passage"]}]}),d=>({...d,generalExplanation:"Unsupported assertion [R11]"}),d=>({...d,generalExplanation:"Read https://invented.example/reference"}),d=>({...d,generalExplanation:{text:"malformed"}})]){
  const {response,calls}=await answer("partial","basic",{draft});assert.equal(response.status,"insufficient_evidence");assert.deepEqual(response.sources,[]);assert.equal(calls.length,1);
 }
});
test("failed reference audit never converts rejected claims into uncited general knowledge or regenerates",async()=>{
 const {response,calls}=await answer("partial","intermediate",{audit:false});
 assert.equal(response.status,"general_knowledge");assert.deepEqual(response.sources,[]);assert.equal(calls.length,2);
 assert.equal(response.sections.some(s=>s.kind==="reference"),false);assert.match(response.answer,/omitted/);
});
test("uncertain answers acknowledge limitations without guessing or another API call",async()=>{
 const {response,calls}=await answer("none","advanced",{draft:()=>({sufficient:false,claims:[],generalExplanation:"",uncertainty:"I cannot give a reliable explanation for this highly specific example."})});
 assert.equal(calls.length,1);assert.equal(response.status,"insufficient_evidence");assert.match(response.answer,/cannot give a reliable/);assert.deepEqual(response.sources,[]);
});
test("provenance validation prevents missing notices, invented citation links and falsely verified general answers",async()=>{
 const {response}=await answer("partial");
 for(const patch of [{answer:"Notice silently removed"},{status:"supported",evidenceStatus:"verified"},{sections:undefined},{sources:[]},{mode:"mock"}])assert.equal(chatResponseSchema.safeParse({...response,...patch}).success,false);
});
test("saved review and export text retain general-knowledge cautions and exclude it from verified takeaways",async()=>{
 const {response}=await answer("partial");
 const R=load("lib/learning/lesson-review.ts");
 const study={structures:[],level:"basic",levels:["basic"],questions:[{id:"one",question:input.question,level:"basic",reply:response}]};
 const parsed=R.reviewRequestSchema.parse(study),review=R.basicReview(parsed,null);
 assert.equal(R.verifiedReply(parsed.questions[0].reply,null),false);
 assert.ok(review.questions[0].answer.includes(GENERAL_KNOWLEDGE_NOTICE));assert.match(review.questions[0].notice,/not been verified/);
 assert.equal(review.takeaways.some(t=>t.text.includes("Synthetic")),false);
 const S=load("lib/learning/session.ts"),saved=S.recordReply("one",response);
 assert.equal(saved.reply.sections.find(s=>s.kind==="general").sourceIds.length,0);
});
test("reference collection remains the existing 11 approved sources",()=>{
 assert.equal(collection.records.length,11);assert.ok(collection.records.every(r=>r.status==="approved"));
});

test("a compound question retains its covered clause through local retrieval, with only one answer generation",async()=>{
 let generations=0,checks=0,received=[];
 const client={responses:{create:async params=>{
  if(params.text.format.name==='verify_evidence'){checks++;return {status:'completed',output_text:'{"supported":true}'};}
  generations++;received=JSON.parse(params.input).passages;assert.ok(received.some(p=>p.sourceId==='R11' && p.section.includes('Sec2/')),'Retain actual anatomy/function text, not only clinical paragraphs about the same vessel');
  assert.equal(new Set(received.map(p=>p.id)).size,received.length);
  const p=received.find(p=>p.sourceId==='R11');
  return {status:'completed',output_text:JSON.stringify({sufficient:true,claims:[{text:p.text.slice(0,80).replace(/\[[^\]]+\]/g,""),passageIds:[p.id],quotes:[p.text.slice(0,80)]}],generalExplanation:'Synthetic additional explanation for a compound-question fixture.',uncertainty:''})};
 }}};
 const response=await runPipeline({...input,question:'What is the coronary sinus, and how does pacemaker automaticity arise in sinoatrial node cells?'},collection.provider,new OpenAIGenerationProvider(client,'mocked-model',2000),AbortSignal.timeout(10000));
 assert.equal(response.status,'partially_supported');assert.equal(generations,1);assert.equal(checks,1);
});
