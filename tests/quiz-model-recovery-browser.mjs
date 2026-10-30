import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {load} from './helpers/load-module.mjs';
const {chromium}=await import(new URL('../.next/cache/browser-tools/node_modules/playwright/index.mjs',import.meta.url).href);
const {loadLearningEvidence}=load('lib/learning/evidence-server.ts'),C=await loadLearningEvidence();
const {retrieveQuizEvidence}=load('lib/learning/quiz-evidence.ts');
const {createQuizHandler}=load('lib/learning/quiz-http.ts');
const {generateQuizSelection}=load('lib/learning/quiz-generation.ts');
const base='http://localhost:3000',report={passed:false,paidApiCalls:0,calls:0,errors:[],checks:[]};
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});let page;
try{
 const context=await browser.newContext({viewport:{width:1600,height:1000}});context.setDefaultTimeout(30000);
 await context.route('**/*',async route=>{
  const u=new URL(route.request().url());if(u.hostname!=='localhost')return route.abort();
  if(u.pathname==='/api/chat')throw Error('This test must not call the chat API');
  if(u.pathname==='/api/learning/evidence')return route.fulfill({json:C});
  if(u.pathname==='/api/learning/review')return route.fulfill({json:{mode:'basic',reason:'disabled'}});
  if(u.pathname==='/api/learning/quiz'){
   const input=route.request().postDataJSON();const evidence=retrieveQuizEvidence(input,C);let providerCalls=0;
   const items=Array.from({length:5},(_,i)=>({structureId:i===0?'coronary-sinus':'ascending-aorta',kind:i===0?'identify-vessel':i===1?'locate-vessel':'multiple-choice',prompt:i===0?'SYNTHETIC TEST: Which vessel is highlighted?':i===1?'SYNTHETIC TEST: Select the ascending aorta marker.':`SYNTHETIC TEST question ${i}: choose a bead.`,concept:'SYNTHETIC test concept '+i,options:i<2?null:[{id:'A',label:'Violet bead',structureId:null},{id:'B',label:'Blue bead',structureId:null},{id:'C',label:'Amber bead',structureId:null}],correctAnswer:i<2?null:'A',explanation:'SYNTHETIC workflow fixture; no medical assertion.',evidenceIds:[evidence[0].key]}));
   const handler=createQuizHandler({config:()=>({enabled:true,model:'mock-only',timeout:15000,minute:20,daily:100}),evidence:async()=>C,reserve:async()=>true,generate:(qi,pool,cfg,signal,cat,progress)=>generateQuizSelection({responses:{parse:async()=>{report.calls++;return {status:'completed',output_parsed:++providerCalls===1?{questions:items}:{questions:items.map((_,index)=>({index,supported:true,issues:[]}))}};}}},cfg.model,qi,pool,signal,cat,progress)});
   const response=await handler(new Request(base+'/api/learning/quiz',{method:'POST',headers:{'content-type':'application/json',accept:'application/x-ndjson'},body:JSON.stringify(input)}));return route.fulfill({status:response.status,contentType:response.headers.get('content-type'),body:await response.text()});
  }return route.continue();
 });
 page=await context.newPage();page.on('pageerror',e=>report.errors.push(e.message));await page.goto(base,{waitUntil:'networkidle'});
 await page.waitForSelector('.scene-surface[data-model-kind="imported"]',{timeout:90000});
 for(const id of ['coronary-sinus','ascending-aorta']){
  if(await page.locator('.information-overlay').isVisible())await page.getByRole('button',{name:'Close anatomical information',exact:true}).click();
  await page.locator(`[data-structure-id="${id}"]`).click();
 }
 await page.getByRole('button',{name:'Review Session',exact:true}).click();
 await page.getByRole('button',{name:'Take Personalised Quiz',exact:true}).click();await page.locator('.quiz-prompt').waitFor();
 const modelDownloads=[];page.on('request',r=>{if(r.url().endsWith('.glb'))modelDownloads.push(r.url());});
 for(let i=0;i<5;i++){
  const prompt=await page.locator('.quiz-prompt').innerText();
  if(prompt.includes('Select the ascending aorta')){
   await page.locator('.quiz-model .scene-surface[data-model-kind="imported"]').waitFor({timeout:90000});
   const marker=page.locator('.quiz-model [data-marker-id="ascending-aorta"]');
   for(let rotation=0;rotation<20&&!await marker.isVisible();rotation++){
    const box=await page.locator('.quiz-model canvas').boundingBox();assert.ok(box);
    const x=box.x+box.width/2,y=box.y+box.height/2;
    await page.mouse.move(x,y);await page.mouse.down();await page.mouse.move(x+Math.min(130,box.width/3),y+(rotation%4===3?70:0),{steps:10});await page.mouse.up();await page.waitForTimeout(250);
   }
   assert.ok(await marker.isVisible(),'Student rotation must expose the production aorta marker');await marker.click();
  }else if(prompt.includes('highlighted')){
   await page.locator('.quiz-model .scene-surface[data-model-kind="imported"]').waitFor({timeout:90000});
   await page.locator('.quiz-answer').filter({hasText:'Coronary Sinus'}).locator('input').check();
  }else await page.locator('.quiz-answer').filter({hasText:'Violet bead'}).locator('input').check();
  await page.getByRole('button',{name:'Submit Answer',exact:true}).click();
  await page.getByRole('button',{name:i===4?'Show Results':'Next Question',exact:true}).click();
 }
 assert.match(await page.locator('.quiz-score').innerText(),/5 \/ 5/);assert.equal(report.calls,2);assert.deepEqual(report.errors,[]);assert.equal(modelDownloads.length,0);
 report.checks.push('Visual questions with null MCQ fields render against actual production model; marker selection and identification grade correctly; five questions score locally; no GLB redownloads during the attempt');report.passed=true;
}catch(error){report.failure=error.stack;if(page){report.visible=await page.locator('body').innerText().catch(()=>null);await page.screenshot({path:'artifacts/quiz-reliability/model-failure.png'}).catch(()=>{});}throw error;}
finally{await fs.writeFile('artifacts/quiz-reliability/model-browser-report.json',JSON.stringify(report,null,2));await browser.close();console.log(JSON.stringify(report));}
