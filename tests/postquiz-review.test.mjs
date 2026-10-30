import assert from 'node:assert/strict';
import {test} from 'node:test';
import {load} from './helpers/load-module.mjs';
const R=load('lib/learning/lesson-review.ts'),S=load('lib/learning/session.ts');
const {validateAnswer}=load('lib/learning/quiz.ts'),{currentQuizAssessment}=load('lib/learning/quiz-revision.ts');
const {generateLessonReview}=load('lib/learning/review-generation.ts'),{createReviewClient}=load('lib/learning/review-client.ts');
const {createLessonReviewHandler}=load('lib/learning/review-http.ts');
const source={id:'fixture',sourceId:'fixture',title:'SYNTHETIC TEST, not medical evidence',url:'https://example.org/test',section:'Fixture',documentVersion:'v1',materialKind:'reference',available:true,reviewStatus:'approved',externalProcessingAllowed:true};
const p={id:'test-passage',structureId:'coronary-sinus',text:'SYNTHETIC TEST: Violet beads are round; amber beads are square.',sourceId:source.id,title:source.title,url:source.url,section:source.section,documentVersion:source.documentVersion,pattern:'Synthetic test only',levels:['basic','intermediate','advanced'],domain:'anatomy',reviewStatus:'approved'};
const cat={sources:[source],passages:[p],gaps:[],mode:'approved-local',generatedAt:'fixture'};
const quiz=(i=0,kind='multiple-choice')=>({id:'test-question-'+i,structureId:'coronary-sinus',level:'basic',kind,prompt:'SYNTHETIC TEST: Which bead is round? '+i,concept:'SYNTHETIC bead shape '+i,options:kind==='multiple-choice'?[{id:'A',label:'Violet'},{id:'B',label:'Amber'},{id:'C',label:'Blue'}]:[{id:'coronary-sinus',label:'Coronary Sinus'},{id:'ascending-aorta',label:'Ascending Aorta'},{id:'superior-vena-cava',label:'Superior Vena Cava'}],correctAnswer:kind==='multiple-choice'?'A':'coronary-sinus',explanation:'SYNTHETIC: Violet is round; amber is square.',evidence:p,supportingEvidence:[p],reviewStatus:'ai-verified'});
function session(attempt='attempt-1',correctCount=4,level='basic'){
 const s=S.newSession('test-session','2026-10-23T00:00:00Z');s.events=[{...S.stamp(),type:'card-opened',structureId:'coronary-sinus',level}];
 const results=Array.from({length:5},(_,i)=>validateAnswer(quiz(i),i<correctCount?'A':'B'));
 const completion={...S.stamp(),type:'quiz-completed',attemptId:attempt,level,completed:true,score:{correct:correctCount,total:5},results};
 return {s,completion,committed:S.sessionWithQuizCompletion(s,completion)};
}
function selection(input){const choices=R.reviewChoices(input,cat),assessment=currentQuizAssessment(input);return {introduction:choices.introductions[0],closing:choices.closings[0],structures:input.structures,questions:[],takeawayIds:choices.candidates.slice(0,4).map(c=>c.id),personalisation:{title:'Synthetic lesson',introduction:'You explored the test structure.',closing:'',questions:[],takeaways:[{heading:assessment.missed.length?'SYNTHETIC bead shapes to revisit':'SYNTHETIC bead shapes reinforced',text:'SYNTHETIC TEST: Violet beads are round; amber beads are square. Distinguish the shapes before selecting a bead.',kind:'reference',evidenceIds:[p.id],questionIds:[],quizQuestionIds:(assessment.missed.length?assessment.missed:assessment.correct).map(r=>r.questionId),purpose:assessment.missed.length?'revision':assessment.correct.length?'reinforcement':'recap'}]}};}

test('completed snapshot reaches review before React/session prop updates, preserving stable keys, source metadata and score',()=>{
 const {s,completion}=session();const saved=S.sessionWithQuizCompletion(s,completion),input=R.collectReviewInput(saved,'basic');assert.equal(input.quizResults.length,5);assert.equal(input.quizResults[4].chosen,'B');assert.equal(input.quizResults[4].correctAnswer,'A');assert.equal(input.quizResults[4].citation.url,source.url);assert.equal(input.quizResults[4].kind,'multiple-choice');assert.equal(input.quizResults[4].completed,true);assert.deepEqual(input.quizResults[4].score,{correct:4,total:5});
 assert.equal(S.sessionWithQuizCompletion(saved,{...completion,...S.stamp()}).events.length,saved.events.length);assert.notEqual(R.reviewFingerprint(R.collectReviewInput(s,'basic')),R.reviewFingerprint(input));
 const shuffled={...quiz(),options:[...quiz().options].reverse()};assert.equal(validateAnswer(shuffled,'A').correct,true);
});
test('all correct, mixed, all wrong, unanswered and model-selection mistakes are classified accurately at all three levels',()=>{
 for(const level of ['basic','intermediate','advanced'])for(const n of [0,3,5]){
 const input=R.collectReviewInput(session('a',n,level).committed,level),assessment=currentQuizAssessment(input);assert.equal(assessment.missed.length,5-n);assert.equal(assessment.correct.length,n);const review=R.applyReviewSelection(input,cat,selection(input));assert.equal(!!review.takeaways[0].revision,n<5);assert.equal(review.takeaways[0].sources[0].url,source.url);
 }
 const input=R.collectReviewInput(session().committed,'basic');input.quizResults[0]={...input.quizResults[0],chosen:'',correct:false};input.quizResults[1]={...input.quizResults[1],...validateAnswer(quiz(1,'locate-vessel'),'ascending-aorta')};const a=currentQuizAssessment(input);assert.equal(a.unanswered.length,1);assert.ok(a.missed.some(r=>r.kind==='locate-vessel'&&r.chosen==='ascending-aorta'));
});
test('legacy quiz IDs in chat-link field are safely classified; invented IDs, unsupported evidence and score-only missing revision links reject',()=>{
 const input=R.collectReviewInput(session().committed,'basic'),valid=selection(input);const legacy=structuredClone(valid);legacy.personalisation.takeaways[0].questionIds=legacy.personalisation.takeaways[0].quizQuestionIds;delete legacy.personalisation.takeaways[0].quizQuestionIds;assert.equal(R.applyReviewSelection(input,cat,legacy).takeaways[0].revision,true);
 for(const patch of [{quizQuestionIds:['invented']},{evidenceIds:['invented']},{quizQuestionIds:[],text:'You scored four of five.'}]){const invalid=structuredClone(valid);Object.assign(invalid.personalisation.takeaways[0],patch);assert.throws(()=>R.applyReviewSelection(input,cat,invalid));}
});
test('inconsistent answer keys and synonymous answer choices are questionable, never student weaknesses',()=>{
 const input=R.collectReviewInput(session().committed,'basic');input.quizResults[4].correct=true;assert.equal(currentQuizAssessment(input).questionable.length,1);assert.equal(currentQuizAssessment(input).missed.length,0);
 input.quizResults[0].options=[{id:'A',label:'CS'},{id:'B',label:'Coronary Sinus'}];assert.equal(currentQuizAssessment(input).questionable.length,2);
});
test('later successful attempt supersedes historical errors and does not invent unresolved weaknesses',()=>{
 const first=session('first',0),second=session('second',5);const combined=S.sessionWithQuizCompletion(first.committed,second.completion);const input=R.collectReviewInput(combined,'basic'),assessment=currentQuizAssessment(input);assert.equal(assessment.current.length,5);assert.equal(assessment.historical.length,5);assert.equal(assessment.missed.length,0);assert.equal(R.applyReviewSelection(input,cat,selection(input)).takeaways[0].revision,false);
});
test('exact original quiz citations are retrieved globally even under a different vessel metadata mapping',()=>{
 const input=R.collectReviewInput(session().committed,'basic');const supplied=R.lessonEvidence(input,{...cat,passages:[{...p,structureId:'ascending-aorta'}]});assert.equal(supplied[0].key,p.id);
});
test('post-quiz generator receives full assessment and performs at most one correction, preserving factual audit',async()=>{
 const input=R.collectReviewInput(session().committed,'basic');let calls=0;
 const result=await generateLessonReview({responses:{parse:async args=>{calls++;const payload=JSON.parse(args.input);if(args.text.format.name==='personalised_lesson_recap'){assert.equal(payload.session.quizAssessment.missed.length,1);assert.ok(payload.session.latestQuizResults[0].citation);const proposed=selection(input).personalisation;if(calls===1)proposed.takeaways[0].quizQuestionIds=['invalid-id'];else assert.ok(payload.correction.issues.length);return {status:'completed',output_parsed:proposed};}return {status:'completed',output_parsed:{supported:true,issues:[]}};}}},'mock-only',input,cat,AbortSignal.timeout(10000));assert.equal(calls,3);assert.equal(R.applyReviewSelection(input,cat,result).takeaways[0].revision,true);
});
test('failed update preserves previous successful review, retry uses saved results, unchanged reopen causes no call',async()=>{
 const before=R.collectReviewInput(session().s,'basic'),after=R.collectReviewInput(session().committed,'basic');let fail=false,calls=0;
 const client=createReviewClient(async(_url,args)=>{calls++;const input=JSON.parse(args.body);return fail?Response.json({mode:'basic',reason:'incomplete'},{status:503}):Response.json({mode:'ai',selection:selection(input)});});
 assert.equal((await client.get(before,cat,false,undefined,'test-session')).review.mode,'ai');fail=true;const failed=await client.get(after,cat,false,undefined,'test-session');assert.equal(failed.needsUpdate,true);assert.equal(failed.review.mode,'ai');assert.equal(failed.input.quizResults.length,5);assert.match(failed.message,/Previous summary|incomplete/);fail=false;
 await Promise.all([client.get(after,cat,true,undefined,'test-session'),client.get(after,cat,true,undefined,'test-session')]);assert.equal(calls,3);await client.get(after,cat,false,undefined,'test-session');assert.equal(calls,3);
});
test('HTTP failures distinguish incomplete, schema and timeout; shared generation survives an initiating request abort',async()=>{
 const config={enabled:true,model:'mock-only',timeout:1000,minute:20,daily:100},input=R.collectReviewInput(session().committed,'basic');const {ReviewPreparationError}=load('lib/learning/review-status.ts');
 for(const reason of ['incomplete','schema','audit']){const h=createLessonReviewHandler({config:()=>config,evidence:async()=>cat,reserve:async()=>true,generate:async()=>{throw new ReviewPreparationError(reason,'test');}});const r=await h(new Request('http://localhost/api/learning/review',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(input)}));assert.equal((await r.json()).reason,reason);}
 const controller=new AbortController();let calls=0;const h=createLessonReviewHandler({config:()=>config,evidence:async()=>cat,reserve:async()=>true,generate:async(_i,_c,_cfg,signal)=>{calls++;await new Promise(r=>setTimeout(r,20));assert.equal(signal.aborted,false);return selection(input);}});const request=()=>new Request('http://localhost/api/learning/review',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(input),signal:controller.signal});const first=h(request());controller.abort();const second=h(new Request('http://localhost/api/learning/review',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(input)}));assert.equal((await first).status,200);assert.equal((await second).status,200);assert.equal(calls,1);
});
