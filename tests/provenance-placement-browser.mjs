import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {load} from './helpers/load-module.mjs';
const {chromium}=await import(new URL('../.next/cache/browser-tools/node_modules/playwright/index.mjs',import.meta.url).href);
const R=load('lib/learning/lesson-review.ts'),A=load('lib/tutor/answer-provenance.ts');
const catalogue=await load('lib/learning/evidence-server.ts').loadLearningEvidence();
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
const general='SYNTHETIC GENERAL TEST: this text tests presentation only and makes no medical claim.';
const report={paidApiCalls:0,checks:[]};
try{
 const context=await browser.newContext({viewport:{width:1440,height:1000}});context.setDefaultTimeout(30000);
 await context.route('**/*',async route=>{
  const url=new URL(route.request().url());if(!['localhost','127.0.0.1'].includes(url.hostname))return route.abort();
  if(url.pathname==='/models/heart-model.json')return route.fulfill({json:{version:1,url:null,rotationDegrees:[0,0,0],structures:{}}});
  if(url.pathname==='/api/learning/evidence')return route.fulfill({json:catalogue});
  if(url.pathname==='/api/chat'){
   const input=route.request().postDataJSON();const sections=[{kind:'general',text:general,sourceIds:[]}];
   return route.fulfill({json:{answer:A.answerWithProvenance(sections),sections,mode:'live',status:'general_knowledge',evidenceStatus:'unverified',sources:[],selectedStructureId:input.selectedStructureId,learningLevel:input.learningLevel}});
  }
  if(url.pathname==='/api/learning/review'){
   const input=route.request().postDataJSON(),choices=R.reviewChoices(input,catalogue),qid=input.questions[0].id;
   return route.fulfill({json:{mode:'ai',selection:{introduction:choices.introductions[0],closing:choices.closings[0],structures:input.structures,questions:input.questions.map(q=>({id:q.id,paragraphIndexes:[]})),takeawayIds:choices.candidates.slice(0,4).map(t=>t.id),personalisation:{title:'TEST discussion review',introduction:'TEST review of a saved discussion.',closing:'',questions:[],overview:{text:general,evidenceIds:[],kind:'general',questionIds:[qid]},takeaways:[{heading:'TEST saved general discussion',text:general,evidenceIds:[],kind:'general',questionIds:[qid]}]}}}});
  }
  if(url.pathname.startsWith('/api/'))return route.abort();return route.continue();
 });
 const page=await context.newPage();await page.goto(process.env.EXPLORER_TEST_URL??'http://localhost:3000',{waitUntil:'networkidle'});
 await page.getByRole('button',{name:'Ask AI Tutor',exact:true}).click();await page.locator('#tutor-question').fill('Explain a synthetic test topic');await page.locator('#tutor-question').press('Enter');
 await page.locator('.tutor-answer-general small').waitFor();
 async function check(selector){const result=await page.locator(selector).evaluate(el=>{const last=el.lastElementChild,s=getComputedStyle(last);return{tag:last.tagName,text:last.textContent,border:s.borderLeftWidth,size:parseFloat(s.fontSize),background:s.backgroundColor}});assert.equal(result.tag,'SMALL');assert.equal(result.text,A.GENERAL_KNOWLEDGE_NOTICE);assert.equal(result.border,'0px');assert.ok(result.size<=14);assert.equal(result.background,'rgba(0, 0, 0, 0)');}
 await check('.tutor-answer-general');report.checks.push('General chatbot notice follows its text in small, muted, readable styling without a banner');
 await page.getByRole('button',{name:'Close AI Anatomy Tutor',exact:true}).click();await page.getByRole('button',{name:'Review Session',exact:true}).click();
 await page.waitForFunction(()=>document.querySelector('.review-generation-status')?.dataset.state==='ready');
 await check('.lesson-overview .lesson-card-body');await check('.lesson-takeaway-card .lesson-card-body');
 assert.ok(await page.locator('.workspace-learning-toolbar').isHidden());report.checks.push('Overview and takeaway general notices follow their respective content with the same styling and toolbar hidden');report.passed=true;
}finally{await fs.mkdir('artifacts/review-quiz-workflow',{recursive:true});await fs.writeFile('artifacts/review-quiz-workflow/provenance.json',JSON.stringify(report,null,2)+'\n');await browser.close();console.log(JSON.stringify(report,null,2));}
