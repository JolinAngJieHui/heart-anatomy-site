import assert from 'node:assert/strict';
import {test} from 'node:test';
import {load} from './helpers/load-module.mjs';
const {resolveNavigation,requestCategory}=load('lib/tutor/routing.ts');
const {viewerExecutionSchema,executionNotice}=load('lib/tutor/viewer-execution.ts');
const {createActionLedger}=load('lib/tutor/scene-actions.ts');
const {learningIntent}=load('lib/learning/intent.ts');
const input={question:'',selectedStructureId:null,learningLevel:'basic',conversation:[]};
test('model-location phrasing, all aliases and first-mentioned targets are deterministic',()=>{
 for(const question of ['Locate the ascending aorta','Where is the ascending aorta on the model?']){assert.equal(requestCategory(question),'navigation');assert.equal(resolveNavigation({...input,question}).command.structureId,'ascending-aorta');}
 for(const [question,id] of [['Take me to CS','coronary-sinus'],['Show SVC before AAo','superior-vena-cava'],['Compare LCx and RCA then focus RCA','left-circumflex-artery']])assert.equal(resolveNavigation({...input,question}).command.structureId,id);
 const {ANATOMICAL_SYNONYMS}=load('lib/knowledge-base/anatomical-synonyms.ts');
 for(const [id,v] of Object.entries(ANATOMICAL_SYNONYMS))for(const alias of v.aliases){const result=resolveNavigation({...input,question:`Locate ${alias}`});assert.equal(result.command?.structureId,id,alias);}
 assert.equal(resolveNavigation({...input,question:'What does RCA supply?'}).command.type,'select_vessel_group');
 assert.equal(resolveNavigation({...input,question:'Show OM2'}).command,undefined);
 assert.equal(resolveNavigation({...input,question:'Show it',conversation:[{role:'user',content:'Compare LCx and RCA'}]}).command,undefined);
 assert.equal(resolveNavigation({...input,question:'Show it',conversation:[{role:'user',content:'What is SVC?'}]}).command.structureId,'superior-vena-cava');
});
test('execution receipts cannot confirm a loading model, unsettled camera or closed target panel',()=>{
 const receipt={actionId:'test',command:{type:'focus_structure',structureId:'ascending-aorta'},requestedId:'ascending-aorta',status:'success',modelLoaded:true,cameraSettled:true,panelOpen:true,message:'confirmed'};
 assert.match(executionNotice(viewerExecutionSchema.parse(receipt)),/brought.*Ascending Aorta/);
 for(const field of ['modelLoaded','cameraSettled','panelOpen'])assert.equal(viewerExecutionSchema.safeParse({...receipt,[field]:false}).success,false);
 assert.equal(executionNotice({...receipt,status:'failed',modelLoaded:false,message:'Model failed to load. Retry loading.'}),'Model failed to load. Retry loading.');
 const ledger=createActionLedger(),proposal={id:'one-student-message',command:receipt.command};
 assert.ok(ledger.accept(proposal,ledger.epoch()));assert.equal(ledger.accept(proposal,ledger.epoch()),null);
});
test('a confirmed navigation-only request uses the receipt without retrieval or a model API',async()=>{
 let providerCalls=0;
 const {answerTutor}=load('lib/tutor/service.ts',{'./config':{tutorConfig:()=>({mode:'mock',timeout:1000})},openai:class{constructor(){providerCalls++;throw Error('No model call allowed');}}});
 const viewerExecution={actionId:'receipt',command:{type:'focus_structure',structureId:'ascending-aorta'},requestedId:'ascending-aorta',status:'success',modelLoaded:true,cameraSettled:true,panelOpen:true,message:'confirmed'};
 const response=await answerTutor({...input,question:'Locate the ascending aorta',viewerExecution});
 assert.equal(response.status,'navigation');assert.match(response.answer,/information panel/);assert.doesNotMatch(response.answer,/No model image|reference passages/);assert.equal(providerCalls,0);
 const failed=await answerTutor({...input,question:'Locate the ascending aorta',viewerExecution:{...viewerExecution,status:'failed',modelLoaded:false,message:'The heart model is not ready. Reload the model.'}});
 assert.match(failed.answer,/not ready/);assert.doesNotMatch(failed.answer,/brought/);
});
test('all quiz intents request five questions and preserve a named-vessel focus',()=>{
 for(const q of ['Quiz me','Give me a 3-question quiz','Create a personalised quiz'])assert.equal(learningIntent(q).count,5);
 assert.deepEqual(learningIntent('Quiz me about CS').focusIds,['coronary-sinus']);
 const {quizRequestSchema}=load('lib/learning/quiz-personalisation.ts');
 const request={level:'basic',count:5,structures:[],reviewed:[],topics:[],results:[]};
 for(const count of [0,1,3,4,6,10])assert.equal(quizRequestSchema.safeParse({...request,count}).success,false);
 assert.equal(quizRequestSchema.safeParse(request).success,true);
});
test('isolation survives a group navigation and returns to normal highlighting only on request',()=>{
 const {INITIAL_SCENE,sceneReducer}=load('lib/scene-state.ts');
 let state=sceneReducer(INITIAL_SCENE,{type:'select',id:'left-circumflex-artery'});
 state=sceneReducer(state,{type:'isolate'});
 state=sceneReducer(state,{type:'select-group',id:'right-coronary-artery'});
 assert.equal(state.isolatedGroupId,'right-coronary-artery');assert.equal(state.isolatedId,null);
 state=sceneReducer(state,{type:'select',id:'right-coronary-distal'});
 assert.equal(state.isolatedId,'right-coronary-distal');assert.equal(state.isolatedGroupId,null);
 state=sceneReducer(state,{type:'show-all'});assert.equal(state.isolatedId,null);assert.equal(state.isolatedGroupId,null);
});
test('a quiz-only session records actual answers, the attempt level and evidence scope without inventing exploration',()=>{
 const S=load('lib/learning/session.ts'),R=load('lib/learning/lesson-review.ts');
 const session=S.newSession('test-quiz-only','2026-10-23T00:00:00.000Z');
 const result={questionId:'test-question',structureId:'coronary-sinus',concept:'TEST concept',chosen:'B',correct:false,correctAnswer:'A',chosenLabel:'TEST B',correctLabel:'TEST A',prompt:'SYNTHETIC TEST question',explanation:'SYNTHETIC TEST explanation',kind:'multiple-choice',citation:{sourceId:'test-source',passageId:'test-passage',documentVersion:'test-v1'}};
 session.events.push({id:'test-complete',at:session.startedAt,type:'quiz-completed',attemptId:'test-attempt',level:'advanced',results:[result]});
 const input=R.collectReviewInput(session,'intermediate');
 assert.deepEqual(input.structures,[]);assert.equal(input.quizResults[0].level,'advanced');assert.equal(input.quizResults[0].attemptId,'test-attempt');assert.equal(input.quizResults[0].chosen,'B');assert.equal(input.quizResults[0].correctAnswer,'A');assert.equal(input.quizResults[0].prompt,result.prompt);
 assert.ok(R.lessonScope(input).includes('coronary-sinus'));
 const correct={...input,quizResults:input.quizResults.map(r=>({...r,correct:true}))};assert.ok(!R.reviewChoices(correct,null).candidates.some(c=>c.id==='quiz-revision'));
});
