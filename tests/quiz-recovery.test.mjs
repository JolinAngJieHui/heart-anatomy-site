import assert from 'node:assert/strict';
import {test} from 'node:test';
import fs from 'node:fs';
import {load} from './helpers/load-module.mjs';
const {loadLearningEvidence}=load('lib/learning/evidence-server.ts');
const {permittedEvidence}=load('lib/learning/evidence.ts');
const catalogue=permittedEvidence(await loadLearningEvidence());
const {createReviewSnapshot}=load('lib/learning/review-snapshot.ts');
const {retrieveQuizEvidence}=load('lib/learning/quiz-evidence.ts');
const {generateQuizSelection}=load('lib/learning/quiz-generation.ts');
const {validateGeneratedQuiz,validateQuizCandidates}=load('lib/learning/generated-quiz.ts');
const {createQuizHandler}=load('lib/learning/quiz-http.ts');
const {createQuizClient}=load('lib/learning/quiz-client.ts');
const {quizFailureMessage}=load('lib/learning/quiz-status.ts');
function input(level='basic',structures=['coronary-sinus']){
 const reviewInput={structures,level,levels:[level],questions:[]};
 return {level,count:5,structures,reviewed:[],topics:[],results:[],generationId:'recovery-test',review:createReviewSnapshot(reviewInput,null,catalogue)};
}
function question(qi,index=0){return {structureId:qi.structures[0],kind:'multiple-choice',prompt:`SYNTHETIC test question ${index}: choose the fictional bead.`,concept:`SYNTHETIC bead concept ${index}`,options:[{id:'A',label:'Violet bead',structureId:null},{id:'B',label:'Amber bead',structureId:null},{id:'C',label:'Blue bead',structureId:null}],correctAnswer:'A',explanation:'SYNTHETIC TEST FIXTURE: violet beads; no anatomy assertion.',evidenceIds:[retrieveQuizEvidence(qi,catalogue)[0].key]};}
const response=output_parsed=>({status:'completed',output_parsed});
const audit=(count,bad=[])=>({questions:Array.from({length:count},(_,index)=>({index,supported:!bad.includes(index),issues:bad.includes(index)?['Unsupported distractor']:[]}))});
const config={enabled:true,model:'mock-only',timeout:10000,minute:10,daily:100};
const req=(qi,stream=false)=>new Request('http://localhost/api/learning/quiz',{method:'POST',headers:{'content-type':'application/json',...(stream?{accept:'application/x-ndjson'}:{})},body:JSON.stringify(qi)});

test('one and multiple studied vessels at every level produce exactly five with two batched calls',async()=>{
 for(const level of ['basic','intermediate','advanced'])for(const structures of [['coronary-sinus'],['coronary-sinus','superior-vena-cava']]){
  const qi=input(level,structures);let calls=0;
  const result=await generateQuizSelection({responses:{parse:async args=>{calls++;const payload=JSON.parse(args.input);assert.equal(payload.session.level,level);assert.ok(payload.session.levelInstructions);return response(calls===1?{questions:Array.from({length:5},(_,i)=>question(qi,i))}:audit(5));}}},'mock-only',qi,[],AbortSignal.timeout(10000),catalogue);
  assert.equal(calls,2);assert.equal(validateGeneratedQuiz(qi,catalogue,result).length,5);
 }
});
test('four passing candidates survive and only the failed question is replaced and audited',async()=>{
 const qi=input();let calls=0;const payloads=[];
 const result=await generateQuizSelection({responses:{parse:async args=>{payloads.push(JSON.parse(args.input));calls++;return response(calls===1?{questions:Array.from({length:5},(_,i)=>question(qi,i))}:calls===2?audit(5,[2]):calls===3?{questions:[question(qi,8)]}:audit(1));}}},'mock-only',qi,[],AbortSignal.timeout(10000),catalogue);
 assert.equal(calls,4);assert.equal(result.questions.length,5);assert.deepEqual(result.questions.slice(0,4).map(q=>q.concept),[0,1,3,4].map(i=>question(qi,i).concept));
 assert.equal(payloads[2].count,1);assert.equal(payloads[2].retained.length,4);assert.match(payloads[2].rejected[0].issues[0],/Unsupported/);assert.equal(payloads[3].proposed.questions.length,1);
});
test('structurally invalid siblings are repaired without auditing them or discarding good candidates',async()=>{
 const qi=input();let calls=0;
 const result=await generateQuizSelection({responses:{parse:async()=>response(++calls===1?{questions:[...Array.from({length:4},(_,i)=>question(qi,i)),{...question(qi,4),correctAnswer:'missing'}]}:calls===2?audit(4):calls===3?{questions:[question(qi,9)]}:audit(1))}},'mock-only',qi,[],AbortSignal.timeout(10000),catalogue);
 assert.equal(result.questions.length,5);assert.equal(calls,4);
});
test('visual formats derive canonical answers without MCQ fields; recognised aliases normalise; shared-segment highlights reject',()=>{
 const qi=input();const visual={...question(qi),kind:'locate-vessel'};delete visual.options;delete visual.correctAnswer;
 const q=validateQuizCandidates(qi,catalogue,{questions:[visual]})[0];assert.equal(q.correctAnswer,'coronary-sinus');assert.ok(q.options.length>=3);
 const identification={...visual,kind:'identify-vessel'};assert.equal(validateQuizCandidates(qi,catalogue,{questions:[identification]})[0].correctAnswer,'coronary-sinus');
 const alias={...question(qi),options:[{id:'A',label:'CS',structureId:'coronary-sinus'},{id:'B',label:'AAo',structureId:'ascending-aorta'},{id:'C',label:'SVC',structureId:'superior-vena-cava'}]};assert.equal(validateQuizCandidates(qi,catalogue,{questions:[alias]})[0].options[0].label,'Coronary Sinus');
 assert.throws(()=>validateQuizCandidates(qi,catalogue,{questions:[{...alias,options:[alias.options[0],{id:'B',label:'Coronary Sinus',structureId:null},alias.options[2]]}]}));
 const rca=input('basic',['right-coronary-proximal']);assert.throws(()=>validateQuizCandidates(rca,catalogue,{questions:[{...question(rca),kind:'identify-vessel',options:null,correctAnswer:null}]}),/whole vessel/);
});
test('global approved text search ignores unrelated metadata categories and excludes pending, stale or prohibited content',()=>{
 const qi=input();const original=catalogue.passages.find(p=>p.structureId==='coronary-sinus'&&p.text.toLowerCase().includes('coronary sinus'));
 const cat={...catalogue,passages:[{...original,structureId:'ascending-aorta',id:'global-cross-tag'}]};assert.equal(retrieveQuizEvidence(qi,cat)[0].key,'global-cross-tag');
 for(const patch of [{reviewStatus:'pending_review'},{documentVersion:'stale'}])assert.equal(retrieveQuizEvidence(qi,{...cat,passages:cat.passages.map(p=>({...p,...patch}))}).length,0);
 assert.equal(retrieveQuizEvidence(qi,{...cat,sources:cat.sources.map(s=>({...s,externalProcessingAllowed:false}))}).length,0);
});
test('incomplete output is a technical failure, bounded recovery never displays partial answers',async()=>{
 const qi=input();let calls=0;
 await assert.rejects(generateQuizSelection({responses:{parse:async()=>{calls++;return {status:'incomplete',incomplete_details:{reason:'max_output_tokens'},output_parsed:null};}}},'mock-only',qi,[],AbortSignal.timeout(10000),catalogue),e=>e.code==='incomplete');assert.equal(calls,1);
 calls=0;await assert.rejects(generateQuizSelection({responses:{parse:async()=>response(++calls%2?{questions:Array.from({length:5},(_,i)=>question(qi,i))}:audit(5,[0,1,2,3,4]))}},'mock-only',qi,[],AbortSignal.timeout(10000),catalogue),e=>e.code==='validation');assert.equal(calls,4);
});
test('streamed stages coalesce repeated route requests and never expose unvalidated candidates',async()=>{
 const qi=input();let calls=0;
 const handler=createQuizHandler({config:()=>config,evidence:async()=>catalogue,reserve:async()=>true,generate:async(_i,_p,_c,_s,_e,progress)=>{calls++;progress('preparing');await new Promise(r=>setTimeout(r,20));progress('checking');return {questions:Array.from({length:5},(_,i)=>question(qi,i))};}});
 const replies=await Promise.all([handler(req(qi,true)),handler(req(qi,true))]);const bodies=await Promise.all(replies.map(r=>r.text()));assert.equal(calls,1);
 for(const body of bodies){const events=body.trim().split('\n').map(JSON.parse);assert.ok(events.some(e=>e.stage==='checking'));assert.ok(events.slice(0,-1).every(e=>!JSON.stringify(e).includes('questions')));assert.equal(events.at(-1).result.selection.questions.length,5);}
 const stages=[];const client=createQuizClient(async(_u,options)=>handler(req(JSON.parse(options.body),true)));const got=await client.get(qi,[],catalogue,s=>stages.push(s));assert.equal(got.questions.length,5);assert.ok(stages.includes('checking'));
});
test('client reports specific server causes instead of blaming learning coverage',async()=>{
 for(const reason of ['timeout','incomplete','schema','evidence','mapping','rate_limit','model_unavailable']){
 const client=createQuizClient(async()=>Response.json({mode:'basic',reason},{status:503}));const result=await client.get(input(),[],catalogue);assert.equal(result.message,quizFailureMessage(reason));assert.equal(result.questions.length,0);
 }
});
test('hash-verified prepared evidence is reused without rebuilding retrieval indexes',async()=>{assert.equal(await loadLearningEvidence(),await loadLearningEvidence());assert.equal(catalogue.sources.length,11);});

test('controlled before/after benchmark: retain four vs discard five and repeat a whole batch',async()=>{
 const qi=input();const timings={kind:'controlled mock timings; not live API or scientific validation',perCallOverheadMs:20,perQuestionMs:8};
 const pause=n=>new Promise(r=>setTimeout(r,20+8*n));let oldCalls=0,newCalls=0;
 const oldStart=performance.now();let oldFailed=false;
 // Reproduce the former all-or-nothing two-call path and a manual full-batch retry.
 const set={questions:Array.from({length:5},(_,i)=>question(qi,i))};
 await pause(5);oldCalls++;await pause(5);oldCalls++;
 try{validateGeneratedQuiz(qi,catalogue,{questions:set.questions.filter((_,i)=>i!==2)});}catch{oldFailed=true;}
 timings.beforeFirstFailureMs=performance.now()-oldStart;
 await pause(5);oldCalls++;await pause(5);oldCalls++;validateGeneratedQuiz(qi,catalogue,set);
 timings.beforeWithWholeRetryMs=performance.now()-oldStart;
 const start=performance.now();const result=await generateQuizSelection({responses:{parse:async args=>{newCalls++;const payload=JSON.parse(args.input);const count=payload.count??payload.proposed.questions.length;await pause(count);return response(newCalls===1?set:newCalls===2?audit(5,[2]):newCalls===3?{questions:[question(qi,9)]}:audit(1));}}},'mock-only',qi,[],AbortSignal.timeout(10000),catalogue);
 timings.afterRecoveredMs=performance.now()-start;Object.assign(timings,{beforeFirstAttemptCalls:2,beforeCallsIncludingRetry:oldCalls,afterCalls:newCalls,beforeGeneratedQuestionsIncludingRetry:10,afterGeneratedQuestions:6,oldFailed,finalCount:result.questions.length});
 fs.mkdirSync('artifacts/quiz-reliability',{recursive:true});fs.writeFileSync('artifacts/quiz-reliability/benchmark.json',JSON.stringify(timings,null,2));assert.equal(oldFailed,true);assert.equal(result.questions.length,5);assert.equal(newCalls,4);
});
