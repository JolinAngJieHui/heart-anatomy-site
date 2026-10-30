import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {load} from './helpers/load-module.mjs';
const {chromium}=await import(new URL('../.next/cache/browser-tools/node_modules/playwright/index.mjs',import.meta.url).href);
const R=load('lib/learning/lesson-review.ts'),{loadLearningEvidence}=load('lib/learning/evidence-server.ts');
const catalogue=await loadLearningEvidence();
const {retrieveQuizEvidence}=load('lib/learning/quiz-evidence.ts');
const {createQuizHandler}=load('lib/learning/quiz-http.ts');
const {generateQuizSelection}=load('lib/learning/quiz-generation.ts');
const base=process.env.EXPLORER_TEST_URL??'http://localhost:3000';
const report={paidApiCalls:0,checks:[],navigation:[],reviewRequests:[],quizRequests:[],providerCalls:[],errors:[]};
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
let invalidQuiz=false;
let page;
function reviewSelection(input){
 const choices=R.reviewChoices(input,catalogue),evidence=R.lessonEvidence(input,catalogue);
 return {introduction:choices.introductions[0],closing:choices.closings[0],structures:input.structures,questions:input.questions.map(q=>({id:q.id,paragraphIndexes:[]})),takeawayIds:choices.candidates.slice(0,4).map(t=>t.id),...(evidence.length?{personalisation:{title:'TEST personalised review',introduction:`TEST review at ${input.level}`,closing:'',questions:input.questions.filter(q=>R.verifiedReply(q.reply,catalogue)).map(q=>({id:q.id,summary:'TEST source-supported summary',evidenceIds:[evidence[0].key]})),takeaways:[{heading:'TEST source excerpt',text:evidence[0].text.slice(0,500),kind:'reference',evidenceIds:[evidence[0].key],questionIds:[]}]}}:{})};
}
function quizSelection(input){
 const scope=input.focusIds??R.lessonScope(input.review.input),structureId=scope.includes('coronary-sinus')?'coronary-sinus':scope[0];
 const evidence=retrieveQuizEvidence(input,catalogue).find(p=>p.structureId===structureId)??retrieveQuizEvidence(input,catalogue)[0];
 assert.ok(evidence,'Test source material must exist');
 return {questions:Array.from({length:invalidQuiz?4:5},(_,i)=>({structureId,kind:'multiple-choice',prompt:`SYNTHETIC BROWSER TEST question ${i+1}: select the test correct choice.`,concept:`SYNTHETIC test concept ${i+1}`,options:[{id:'A',label:'TEST correct choice',structureId:null},{id:'B',label:'TEST alternative B',structureId:null},{id:'C',label:'TEST alternative C',structureId:null}],correctAnswer:'A',explanation:'SYNTHETIC BROWSER TEST feedback. No medical claim is made by this test fixture.',evidenceIds:[evidence.key]}))};
}
try{
 const context=await browser.newContext({viewport:{width:1600,height:1000}});
 await context.route('**/*',async route=>{
  const url=new URL(route.request().url());if(!['localhost','127.0.0.1'].includes(url.hostname))return route.abort();
  if(url.pathname==='/api/learning/evidence')return route.fulfill({json:catalogue});
  if(url.pathname==='/api/learning/review'){const input=route.request().postDataJSON();report.reviewRequests.push(input);await new Promise(r=>setTimeout(r,150));return route.fulfill({json:{mode:'ai',selection:reviewSelection(input)}});}
  if(url.pathname==='/api/learning/quiz'){
   const input=route.request().postDataJSON();report.quizRequests.push(input);let round=0;
   const handler=createQuizHandler({config:()=>({enabled:true,model:'SYNTHETIC-browser-provider',timeout:15000,minute:20,daily:200}),evidence:async()=>catalogue,reserve:async()=>true,
    generate:(qi,pool,config,signal,cat,progress)=>generateQuizSelection({responses:{parse:async args=>{
      const payload=JSON.parse(args.input),isGeneration=args.text.format.name==='grounded_session_quiz';
      report.providerCalls.push({level:qi.level,stage:isGeneration?'generation':'audit',count:payload.count??payload.proposed.questions.length});
      await new Promise(r=>setTimeout(r,30));
      if(isGeneration){round++;const batch=quizSelection(qi).questions;if(round>1&&!invalidQuiz){const q={...batch[0],prompt:batch[0].prompt+' REPAIRED',concept:'SYNTHETIC replacement concept'};return {status:'completed',output_parsed:{questions:[q]}};}return {status:'completed',output_parsed:{questions:batch}};}
      return {status:'completed',output_parsed:{questions:payload.proposed.questions.map((_,index)=>({index,supported:invalidQuiz||round>1||index!==2,issues:!invalidQuiz&&round===1&&index===2?['SYNTHETIC unsupported distractor']:[]}))}};
    }}},config.model,qi,pool,signal,cat,progress)});
   const response=await handler(new Request(base+'/api/learning/quiz',{method:'POST',headers:{'content-type':'application/json',accept:'application/x-ndjson'},body:JSON.stringify(input)}));
   return route.fulfill({status:response.status,contentType:response.headers.get('content-type'),body:await response.text()});
  }
  if(url.pathname==='/api/chat'){
   const input=route.request().postDataJSON();report.navigation.push(input);
   // These two requests exercise the actual server receipt path. All anatomy
   // generation is mocked: the test must never bill the configured account.
   if(/^(Locate the ascending aorta|Where is the ascending aorta on the model\?)$/i.test(input.question))return route.continue();
   return route.fulfill({json:{answer:'SYNTHETIC TEST response; no anatomical claim or live model call.',mode:'mock',status:'mock',sources:[],selectedStructureId:input.selectedStructureId,learningLevel:input.learningLevel,viewerExecution:input.viewerExecution}});
  }
  return route.continue();
 });
 context.setDefaultTimeout(30000); page=await context.newPage();page.on('pageerror',e=>report.errors.push(e.message));
 await page.goto(base,{waitUntil:'networkidle'});
 await page.waitForSelector('.scene-surface[data-model-kind="imported"]',{timeout:90000});
 const settled=()=>page.waitForFunction(()=>{const el=document.querySelector('.workspace-content .scene-surface');if(!el?.dataset.framing)return false;const f=JSON.parse(el.dataset.framing);return f.measured&&!f.moving;},{},{timeout:30000});
 await settled();await page.getByRole('button',{name:'Ask AI Tutor',exact:true}).click();
 async function send(question){const count=await page.locator('.tutor-turn').count();await page.locator('#tutor-question').fill(question);await page.locator('#tutor-question').press('Enter');await page.waitForFunction(n=>{const turns=document.querySelectorAll('.tutor-turn');return turns.length>n&&!!turns[turns.length-1].querySelector('.tutor-answer,.tutor-error');},count,{timeout:45000});return page.locator('.tutor-turn').last().innerText();}
 for(const question of ['Locate the ascending aorta','Where is the ascending aorta on the model?']){
  const text=await send(question);assert.match(text,/brought.*Ascending Aorta/);assert.doesNotMatch(text,/No model image|reference passages were supplied/);
  const receipt=report.navigation.at(-1).viewerExecution;assert.equal(receipt.status,'success');assert.equal(receipt.requestedId,'ascending-aorta');assert.ok(receipt.cameraSettled&&receipt.modelLoaded&&receipt.panelOpen);
  assert.equal(await page.locator('#detail-title').innerText(),'Ascending Aorta');await settled();
 }
 console.log('CHECKPOINT',report.navigation.length,report.reviewRequests.length,report.quizRequests.length);report.checks.push('Both reported aorta phrases update the actual production viewer, confirm a structured receipt and complete through the actual chatbot route');
 await send('Show proximal LAD');await send('What does RCA supply?');
 assert.ok(await page.locator('.vessel-segment-choices').isVisible());assert.equal(report.navigation.at(-1).viewerExecution.command.type,'select_vessel_group');
 const before=report.navigation.length;await send('Compare LCx and SVC');assert.equal(report.navigation.length,before+1);assert.equal(report.navigation.at(-1).viewerExecution.requestedId,'left-circumflex-artery');
 await send('Take me to CS');assert.equal(await page.locator('#detail-title').innerText(),'Coronary Sinus');
 console.log('CHECKPOINT',report.navigation.length,report.reviewRequests.length,report.quizRequests.length);report.checks.push('LAD to RCA anatomy request, first-mentioned cross-vessel selection and CS alias navigate once even with no retrieved reference passages');
 await page.getByRole('button',{name:'Close AI Anatomy Tutor',exact:true}).click();
 await page.getByRole('button',{name:'Close anatomical information',exact:true}).click();
 for(const level of ['basic','intermediate','advanced']){ console.log('LEVEL',level);
  await page.getByRole('button',{name:level,exact:true}).click();
  let requests=report.reviewRequests.length;
  await page.getByRole('button',{name:'Review Session',exact:true}).click();
  assert.ok(await page.locator('.workspace-learning-toolbar').isHidden());assert.equal(await page.locator('.workspace-learning-toolbar').getAttribute('inert'),'');
  await page.waitForFunction(()=>document.querySelector('.review-generation-status')?.dataset.state==='ready',{},{timeout:30000});
  assert.equal(report.reviewRequests.length,requests+1);assert.equal(report.reviewRequests.at(-1).level,level);assert.ok(report.reviewRequests.at(-1).levelInstructions);
  await page.getByRole('button',{name:'Return to Model',exact:true}).click();
  assert.ok(await page.locator('.workspace-learning-toolbar').isVisible());
  requests=report.reviewRequests.length;await page.getByRole('button',{name:'Review Session',exact:true}).click();
  await page.waitForFunction(()=>document.querySelector('.review-generation-status')?.dataset.state==='ready');assert.equal(report.reviewRequests.length,requests);
  await page.getByRole('button',{name:'Take Personalised Quiz',exact:true}).click();
  await page.locator('.quiz-prompt').waitFor({timeout:30000});assert.equal(await page.locator('.quiz-navigator button').count(),5);assert.equal(report.quizRequests.at(-1).level,level);assert.equal(report.quizRequests.at(-1).count,5);assert.ok(report.quizRequests.at(-1).levelInstructions);
  assert.equal(await page.getByText('Revisit what you explored',{exact:true}).count(),0);
  const quizCalls=report.quizRequests.length;
  for(let i=0;i<5;i++){
   await page.locator('.quiz-answer').filter({hasText:i===0?'TEST alternative B':'TEST correct choice'}).locator('input').check();
   await page.getByRole('button',{name:'Submit Answer',exact:true}).click();
   await page.getByRole('button',{name:i===4?'Show Results':'Next Question',exact:true}).click();
  }
  assert.match(await page.locator('.quiz-score').innerText(),/4 \/ 5/);assert.equal(report.quizRequests.length,quizCalls);
  requests=report.reviewRequests.length;await page.getByRole('button',{name:'Return to summary',exact:true}).click();
  await page.waitForFunction(()=>document.querySelector('.review-generation-status')?.dataset.state==='ready');assert.equal(report.reviewRequests.length,requests+1);
  const results=report.reviewRequests.at(-1).quizResults;assert.equal(results.filter(r=>r.correct===false).length,level==='basic'?1:level==='intermediate'?2:3);assert.ok(results.every(r=>r.prompt&&r.correctAnswer&&r.chosen&&r.explanation&&r.level));
  await page.getByRole('button',{name:'Return to Model',exact:true}).click();
  requests=report.reviewRequests.length;await page.getByRole('button',{name:'Review Session',exact:true}).click();await page.waitForFunction(()=>document.querySelector('.review-generation-status')?.dataset.state==='ready');assert.equal(report.reviewRequests.length,requests);await page.getByRole('button',{name:'Return to Model',exact:true}).click();
 }
 console.log('CHECKPOINT',report.navigation.length,report.reviewRequests.length,report.quizRequests.length);report.checks.push('All three levels: captured language instructions, hidden/inert toolbar, direct five-question quizzes, local grading and exactly one summary refresh per completed result set');
 await page.getByRole('button',{name:'Ask AI Tutor',exact:true}).click();await send('Quiz me about the coronary sinus');
 await page.locator('.quiz-prompt').waitFor();assert.deepEqual(report.quizRequests.at(-1).focusIds,['coronary-sinus']);assert.equal(await page.locator('.quiz-navigator button').count(),5);assert.ok(await page.locator('.workspace-learning-toolbar').isHidden());
 await page.getByRole('button',{name:'Return to Model',exact:true}).click();
 invalidQuiz=true;await page.getByRole('button',{name:'Ask AI Tutor',exact:true}).click();await send('Quiz me about SVC');
 await page.getByRole('button',{name:'Retry quiz',exact:true}).waitFor();assert.equal(await page.locator('.quiz-prompt').count(),0);assert.ok(await page.locator('.workspace-learning-toolbar').isHidden());
 console.log('CHECKPOINT',report.navigation.length,report.reviewRequests.length,report.quizRequests.length);report.checks.push('Chat vessel-specific quizzes use the same five-question workspace; invalid four-question generation shows recovery with toolbar still hidden');
 assert.equal(await page.getByText('Mark this topic for revision',{exact:true}).count(),0);assert.equal(await page.getByRole('button',{name:'Update review',exact:true}).count(),0);
 assert.deepEqual(report.errors,[]);report.passed=true;
}catch(error){report.passed=false;report.failure=error.stack;if(page){report.visible=await page.locator('body').innerText().catch(()=>null);await page.screenshot({path:'artifacts/quiz-reliability/failure.png',timeout:10000}).catch(()=>{});}throw error;}
finally{await fs.mkdir('artifacts/quiz-reliability',{recursive:true});await fs.writeFile('artifacts/quiz-reliability/recovery-browser-report.json',JSON.stringify(report,null,2)+'\n');await browser.close();console.log(JSON.stringify({passed:report.passed,checks:report.checks,reviewCalls:report.reviewRequests.length,quizCalls:report.quizRequests.length,failure:report.failure},null,2));}
