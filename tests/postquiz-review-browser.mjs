import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {load} from './helpers/load-module.mjs';
const {chromium}=await import(new URL('../.next/cache/browser-tools/node_modules/playwright/index.mjs',import.meta.url).href);
const {loadLearningEvidence}=load('lib/learning/evidence-server.ts'),{retrieveQuizEvidence}=load('lib/learning/quiz-evidence.ts');
const {generateLessonReview}=load('lib/learning/review-generation.ts'),{createLessonReviewHandler}=load('lib/learning/review-http.ts');
const cat=await loadLearningEvidence(),base='http://localhost:3000';
const report={passed:false,paidApiCalls:0,requests:[],providerCalls:[],quizCalls:0,checks:[],errors:[]};let failPostQuizOnce=true,page;
const handler=createLessonReviewHandler({config:()=>({enabled:true,model:'synthetic-browser-provider',timeout:15000,minute:30,daily:200}),evidence:async()=>cat,reserve:async()=>true,
 generate:(input,catalogue,cfg,signal)=>generateLessonReview({responses:{parse:async args=>{
  const body=JSON.parse(args.input);report.providerCalls.push({stage:args.text.format.name,level:input.level,quizResults:input.quizResults?.length??0});
  await new Promise(r=>setTimeout(r,200));
  if(args.text.format.name!=='personalised_lesson_recap')return {status:'completed',output_parsed:{supported:true,issues:[]}};
  if(input.quizResults?.length&&failPostQuizOnce){failPostQuizOnce=false;return {status:'incomplete',output_parsed:null};}
  const assessment=body.session.quizAssessment,missed=assessment.missed,ids=(missed.length?missed:assessment.correct).map(r=>r.questionId);
  return {status:'completed',output_parsed:{title:'SYNTHETIC TEST lesson '+input.level,introduction:'SYNTHETIC TEST: recorded exploration and practice.',closing:'',overview:null,questions:[],takeaways:[{heading:missed.length?'SYNTHETIC concept clarification':ids.length?'SYNTHETIC assessed concepts reinforced':'SYNTHETIC prior summary',text:missed.length?'SYNTHETIC WORKFLOW TEST: Violet is the fictional correct choice; amber is a different fictional choice. Distinguish the two before answering.':'SYNTHETIC WORKFLOW TEST: This is a saved lesson recap, not a medical claim.',kind:'reference',evidenceIds:[body.evidence[0].key],questionIds:[],quizQuestionIds:ids,purpose:missed.length?'revision':ids.length?'reinforcement':'recap'}]}};
 }}},cfg.model,input,catalogue,signal)});
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try{
 const context=await browser.newContext({viewport:{width:1600,height:1000}});context.setDefaultTimeout(30000);
 await context.route('**/*',async route=>{
  const u=new URL(route.request().url());if(u.hostname!=='localhost')return route.abort();
  if(u.pathname==='/api/chat')throw Error('Unexpected chatbot API request');
  if(u.pathname==='/api/learning/evidence')return route.fulfill({json:cat});
  if(u.pathname==='/api/learning/review'){
   const input=route.request().postDataJSON();report.requests.push(input);const response=await handler(new Request(base+u.pathname,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(input)}));
   return route.fulfill({status:response.status,json:await response.json()});
  }
  if(u.pathname==='/api/learning/quiz'){
   report.quizCalls++;
   const input=route.request().postDataJSON(),evidence=retrieveQuizEvidence(input,cat);
   return route.fulfill({json:{mode:'ai',selection:{questions:Array.from({length:5},(_,i)=>({structureId:'coronary-sinus',kind:'multiple-choice',prompt:'SYNTHETIC TEST: choose a bead '+i,concept:'SYNTHETIC bead concept '+i,options:[{id:'A',label:'Violet',structureId:null},{id:'B',label:'Amber',structureId:null},{id:'C',label:'Blue',structureId:null}],correctAnswer:'A',explanation:'SYNTHETIC TEST: Violet is round; amber is square. This is not anatomy.',evidenceIds:[evidence[0].key]}))}}});
  }return route.continue();
 });
 page=await context.newPage();page.on('pageerror',e=>report.errors.push(e.message));await page.goto(base,{waitUntil:'networkidle'});await page.waitForSelector('.scene-surface[data-model-kind="imported"]',{timeout:90000});
 await fs.mkdir('artifacts/postquiz-review',{recursive:true});
 const shortcuts=async()=>{
  await page.getByRole('button',{name:'Ask AI Tutor',exact:true}).click();
  const prompts=await page.locator('.tutor-suggestions button').allTextContents();
  assert.equal(prompts.length,4);assert.ok(prompts.every(p=>!/summar|quiz/i.test(p)));
  await page.getByRole('button',{name:'Close AI Anatomy Tutor',exact:true}).click();
 };
 await shortcuts();await page.locator('[data-structure-id="coronary-sinus"]').click();await shortcuts();
 for(const [width,height] of [[1440,900],[1024,768],[390,844],[320,568]]){
  await page.setViewportSize({width,height});
  const button=page.getByRole('button',{name:'Review Session',exact:true});assert.equal(await button.count(),1);
  const layout=await button.evaluate(el=>{const r=el.getBoundingClientRect(),s=getComputedStyle(el),t=el.closest('.workspace-learning-toolbar');return {height:r.height,left:r.left,right:r.right,fontSize:parseFloat(s.fontSize),colour:s.backgroundColor,primary:getComputedStyle(t.querySelector('.ask-tutor-button')).backgroundColor,overflow:document.documentElement.scrollWidth>innerWidth+1||t.scrollWidth>t.clientWidth+1,clipped:el.scrollWidth>el.clientWidth};});
  assert.ok(layout.height>=44&&layout.fontSize>=12);assert.equal(layout.colour,layout.primary);assert.equal(layout.overflow,false);assert.equal(layout.clipped,false);assert.ok(layout.left>=0&&layout.right<=width);
  await button.focus();await page.keyboard.press('Shift+Tab');await page.keyboard.press('Tab');assert.equal(await button.evaluate(el=>el.matches(':focus-visible')),true);
  await page.screenshot({path:`artifacts/postquiz-review/controls-${width}.png`});
 }
 await page.setViewportSize({width:1600,height:1000});
 report.checks.push('General and structure-specific tutor suggestions contain only anatomy questions; one rose primary Review Session button stays readable, keyboard focusable and at least 44px high at four sizes');
 const ready=()=>page.waitForFunction(()=>document.querySelector('.review-generation-status')?.dataset.state==='ready',{},{timeout:30000});
 async function answer(count){
  await page.locator('.quiz-prompt').waitFor();for(let i=0;i<5;i++){
   await page.locator('.quiz-answer').filter({hasText:i<count?'Violet':'Amber'}).locator('input').check();await page.getByRole('button',{name:'Submit Answer',exact:true}).click();await page.getByRole('button',{name:i===4?'Show Results':'Next Question',exact:true}).click();
  }assert.match(await page.locator('.quiz-score').innerText(),new RegExp(count+' / 5'));
  assert.equal(await page.getByRole('button',{name:'View structure',exact:true}).count(),0);assert.equal(await page.getByRole('link',{name:'View structure',exact:true}).count(),0);
  for(const item of await page.locator('.quiz-result-item').all()){
   await item.locator('summary').click();assert.match(await item.innerText(),/Your answer:/);assert.match(await item.innerText(),/Correct answer:/);assert.ok(await item.locator('.quiz-explanation').isVisible());assert.ok(await item.locator('.quiz-explanation a').count());
  }
  assert.ok(await page.getByRole('button',{name:'Return to summary',exact:true}).isVisible());assert.ok(await page.getByRole('button',{name:'Return to Model',exact:true}).isVisible());
 }
 for(const [level,correct] of [['basic',4],['intermediate',0],['advanced',5]]){
  await page.getByRole('button',{name:level,exact:true}).click();
  await page.getByRole('button',{name:'Review Session',exact:true}).click();await ready();
  assert.equal(await page.locator('.workspace-learning-toolbar').getAttribute('inert'),'');assert.ok(await page.locator('.workspace-learning-toolbar').isHidden());await page.locator('.review-session-button').evaluate(el=>el.focus());assert.equal(await page.locator('.review-session-button').evaluate(el=>document.activeElement===el),false);
  await page.getByRole('button',{name:'Take Personalised Quiz',exact:true}).click();await answer(correct);
  assert.ok(await page.locator('.workspace-learning-toolbar').isHidden());
  await page.getByRole('button',{name:'Return to summary',exact:true}).click();
  if(level==='basic'){
   await page.getByRole('button',{name:'Retry summary',exact:true}).waitFor();assert.match(await page.locator('.review-generation-status').innerText(),/Previous summary.*not yet updated/);assert.match(await page.locator('.lesson-takeaway-card').innerText(),/prior summary/);
   const before=report.requests.length;await page.getByRole('button',{name:'Retry summary',exact:true}).dblclick();await ready();assert.equal(report.requests.length,before+1);report.checks.push('Incomplete update retains labelled previous summary; repeated retry uses the saved five results in one request');
  }else await ready();
  const latest=report.requests.at(-1);assert.equal(latest.level,level);assert.equal(latest.quizResults.length,level==='basic'?5:level==='intermediate'?10:15);assert.ok(latest.quizResults.every(r=>r.kind&&r.citation&&r.options&&r.completed&&r.score));
  if(correct<5){assert.match(await page.locator('.lesson-takeaway-card').innerText(),/Concept to revisit/i);assert.match(await page.locator('.lesson-takeaway-card').innerText(),/Violet.*amber/);}else{assert.equal(await page.getByText('Concept to revisit',{exact:true}).count(),0);assert.match(await page.locator('.lesson-takeaway-card').innerText(),/reinforced/);}
  assert.ok(await page.locator('.review-sources a').count());
  const calls=report.requests.length;await page.getByRole('button',{name:'Return to Model',exact:true}).click();assert.ok(await page.locator('.workspace-learning-toolbar').isVisible());await page.getByRole('button',{name:'Review Session',exact:true}).click();await ready();assert.equal(report.requests.length,calls);await page.getByRole('button',{name:'Return to Model',exact:true}).click();
  report.checks.push(level+': complete results, level adaptation, source-linked takeaways, summary reuse and toolbar restoration');
 }
 report.checks.push('Quiz results omit View structure while retaining scores, submitted/correct answers, explanations, citations and both return actions; hidden toolbar cannot receive focus');
 const beforeTyped=report.requests.length;
 await page.getByRole('button',{name:'Ask AI Tutor',exact:true}).click();await page.locator('#tutor-question').fill('Summarise my session');await page.locator('#tutor-question').press('Enter');await ready();assert.equal(report.requests.length,beforeTyped);
 await page.getByRole('button',{name:'Return to Model',exact:true}).click();await page.getByRole('button',{name:'Ask AI Tutor',exact:true}).click();assert.equal(await page.locator('.tutor-question').last().innerText(),'Summarise my session');
 await page.locator('#tutor-question').fill('Give me a quiz on coronary sinus');await page.locator('#tutor-question').press('Enter');await page.locator('.quiz-prompt').waitFor();assert.ok(await page.locator('.workspace-learning-toolbar').isHidden());assert.equal(report.requests.length,beforeTyped);
 await page.getByRole('button',{name:'Return to Model',exact:true}).click();await page.getByRole('button',{name:'Ask AI Tutor',exact:true}).click();assert.deepEqual(await page.locator('.tutor-question').allTextContents(),['Summarise my session','Give me a quiz on coronary sinus']);assert.equal(await page.locator('.tutor-suggestions').count(),0);
 await page.getByRole('button',{name:'Close AI Anatomy Tutor',exact:true}).click();await page.getByRole('button',{name:'Review Session',exact:true}).click();await ready();
 await page.getByRole('button',{name:'Show Coronary Sinus in the model',exact:true}).click();assert.equal(await page.locator('#detail-title').innerText(),'Coronary Sinus');
 report.checks.push('Manually typed summary and quiz requests still open their workspaces and remain intact in chat; cached summary reuse and vessel navigation outside quiz results are preserved');
 assert.deepEqual(report.errors,[]);report.passed=true;await page.screenshot({path:'artifacts/postquiz-review/workflow.png'});
}catch(error){report.failure=error.stack;if(page){report.visible=await page.locator('body').innerText().catch(()=>null);await page.screenshot({path:'artifacts/postquiz-review/failure.png'}).catch(()=>{});}throw error;}
finally{await fs.writeFile('artifacts/postquiz-review/browser-report.json',JSON.stringify(report,null,2));await browser.close();console.log(JSON.stringify({passed:report.passed,requests:report.requests.length,checks:report.checks,failure:report.failure}));}
