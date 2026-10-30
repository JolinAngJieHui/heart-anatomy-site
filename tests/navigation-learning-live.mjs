import fs from 'node:fs';
import {createRequire} from 'node:module';
import OpenAI from 'openai';
import {load} from './helpers/load-module.mjs';
if(!process.argv.includes('--authorised-live-test')) throw Error('Explicit live-test authorisation required');
createRequire(import.meta.url)('@next/env').loadEnvConfig(process.cwd());
if(process.env.LESSON_REVIEW_LIVE_ENABLED !== 'true' || process.env.QUIZ_LIVE_ENABLED !== 'true') throw Error('Live learning features must be explicitly enabled');
const C=await load('lib/learning/evidence-server.ts').loadLearningEvidence();
const passage=C.passages.find(p=>p.structureId==='coronary-sinus' && p.sourceId==='R11' && p.section.includes('Sec2/p[2]'));
const input={structures:['coronary-sinus'],level:'basic',levels:['basic'],questions:[{id:'live-smoke-cs-function',question:'What is the main function of Coronary Sinus?',level:'basic',reply:{answer:'The coronary sinus mainly collects blood draining from the heart muscle and returns it to the right atrium.',mode:'live',status:'supported',evidenceStatus:'verified',sources:[{id:'P2',sourceId:passage.sourceId,title:passage.title,url:passage.url,section:passage.section,documentVersion:passage.documentVersion,materialKind:'reference',passageId:passage.id}]}}]};
const actual=new OpenAI({apiKey:process.env.OPENAI_API_KEY,maxRetries:0,timeout:60000});
const report={syntheticActivity:true,liveAPI:true,outputs:[]};
const client={responses:{parse:async(...args)=>{const response=await actual.responses.parse(...args);report.outputs.push({stage:args[0].text.format.name,status:response.status,model:response.model,usage:response.usage,value:response.output_parsed});return response;}}};
try {
 const saved = process.argv.includes('--reuse-verified-review') ? JSON.parse(fs.readFileSync('artifacts/navigation-learning/live-learning.json','utf8')) : null;
 const choices=load('lib/learning/lesson-review.ts').reviewChoices(input,C);
 const selection=saved?.review?.mode==='ai' ? {introduction:choices.introductions[0],closing:choices.closings[0],structures:input.structures,questions:input.questions.map(q=>({id:q.id,paragraphIndexes:[]})),takeawayIds:choices.candidates.slice(0,4).map(t=>t.id),personalisation:saved.outputs.find(o=>o.stage==='personalised_lesson_recap').value} : await load('lib/learning/review-generation.ts').generateLessonReview(client,load('lib/tutor/models.ts').tutorModels().tutor,input,C,AbortSignal.timeout(60000));
 if(saved) report.outputs.push(...saved.outputs);
 report.review=load('lib/learning/lesson-review.ts').applyReviewSelection(input,C,selection);
 const review=load('lib/learning/review-snapshot.ts').createReviewSnapshot(input,selection,C);
 if(process.argv.includes('--include-quiz')) {
 const qi={level:'basic',count:3,structures:input.structures,reviewed:[],topics:[],results:[],review,generationId:crypto.randomUUID()};
 const draft=await load('lib/learning/quiz-generation.ts').generateQuizSelection(client,load('lib/tutor/models.ts').tutorModels().tutor,qi,[],AbortSignal.timeout(60000),C);
 report.quiz=load('lib/learning/generated-quiz.ts').validateGeneratedQuiz(qi,C,draft);
 }
 report.passed=true;
} catch(e){report.passed=false;report.failure=e instanceof Error ? e.message : 'Failed';process.exitCode=1;}
finally {fs.mkdirSync('artifacts/navigation-learning',{recursive:true});fs.writeFileSync('artifacts/navigation-learning/live-learning.json',JSON.stringify(report,null,2));console.log(JSON.stringify({passed:report.passed,calls:report.outputs.length,stages:report.outputs.map(o=>o.stage),failure:report.failure}));}

