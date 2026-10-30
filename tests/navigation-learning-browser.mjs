import assert from "node:assert/strict";
import fs from "node:fs";
import {load} from "./helpers/load-module.mjs";
const R=load("lib/learning/lesson-review.ts");
const catalogue=await load("lib/learning/evidence-server.ts").loadLearningEvidence();
const {chromium}=await import(new URL("../.next/cache/browser-tools/node_modules/playwright/index.mjs",import.meta.url).href);
const browser=await chromium.launch({executablePath:"C:/Program Files/Google/Chrome/Application/chrome.exe",headless:true});
const dir="artifacts/navigation-learning";fs.mkdirSync(dir,{recursive:true});
const report={mockedAPI:true,realGLB:true,checks:[],errors:[],calls:{review:0,quiz:0,chat:0}};let page;
try {
 const context=await browser.newContext({viewport:{width:1440,height:1000},deviceScaleFactor:1});
 await context.route("**/*",async route=>{
  const u=new URL(route.request().url());if(!["localhost","127.0.0.1"].includes(u.hostname)) return route.abort();
  if(u.pathname==="/api/learning/evidence") return route.fulfill({json:catalogue});
  if(u.pathname==="/api/learning/review") {report.calls.review++; const body=route.request().postDataJSON(),c=R.reviewChoices(body,catalogue);return route.fulfill({json:{mode:"ai",selection:{introduction:c.introductions[0],closing:c.closings[0],structures:body.structures,questions:body.questions.map(q=>({id:q.id,paragraphIndexes:[]})),takeawayIds:c.candidates.slice(0,4).map(q=>q.id)}}});}
  if(u.pathname==="/api/learning/quiz") {report.calls.quiz++;const body=route.request().postDataJSON(),e=R.lessonEvidence(body.review.input,catalogue);const cs=e.find(p=>p.structureId==="coronary-sinus"),lcx=e.find(p=>p.structureId==="left-circumflex-artery");assert.ok(cs&&lcx);
   const opts=[{id:"coronary-sinus",label:"Coronary Sinus",structureId:"coronary-sinus"},{id:"left-circumflex-artery",label:"Left Circumflex Artery",structureId:"left-circumflex-artery"},{id:"ascending-aorta",label:"Ascending Aorta",structureId:"ascending-aorta"}];
   const common={concept:"Browser fixture: vessel recognition",options:opts,explanation:"Browser fixture: review the labelled structure and its approved source.",evidenceIds:[cs.key]};
   return route.fulfill({json:{mode:"ai",selection:{questions:[{...common,structureId:"coronary-sinus",kind:"locate-vessel",prompt:"Select the numbered marker associated with the Coronary Sinus.",correctAnswer:"coronary-sinus"},{...common,structureId:"left-circumflex-artery",kind:"identify-vessel",prompt:"Which vessel is highlighted?",correctAnswer:"left-circumflex-artery",evidenceIds:[lcx.key]},{...common,structureId:"coronary-sinus",kind:"multiple-choice",prompt:"Browser fixture: choose option Violet.",options:[{id:"a",label:"Violet",structureId:null},{id:"b",label:"Orange",structureId:null},{id:"c",label:"Blue",structureId:null}],correctAnswer:"a"}]}}});
  }
  if(u.pathname==="/api/chat") {report.calls.chat++;const b=route.request().postDataJSON();return route.fulfill({json:{schemaVersion:1,mode:"live",status:"navigation",answer:"Waiting for viewer.",sources:[],selectedStructureId:b.selectedStructureId,learningLevel:b.learningLevel,navigation:{id:crypto.randomUUID(),command:{type:"focus_structure",structureId:"posterior-descending-artery"}}}});}
  if(u.pathname.startsWith("/api/")) return route.fulfill({status:204});return route.continue();
 });
 page=await context.newPage();page.setDefaultTimeout(45000);page.on("pageerror",e=>report.errors.push(e.message));
 await page.goto("http://localhost:3000",{waitUntil:"domcontentloaded"});await page.waitForSelector('.scene-surface[data-model-kind="imported"]',{timeout:90000});
 const settle=async()=>{await page.waitForTimeout(700);await page.waitForFunction(()=>{const f=document.querySelector('.workspace-content .scene-surface')?.dataset.framing;return f&&!JSON.parse(f).moving;});};
 await settle();
 const ids=Object.keys(JSON.parse(fs.readFileSync("public/models/heart-model.json")).structures);
 for(const id of ids){if(await page.getByRole("button",{name:"Close anatomical information"}).isVisible())await page.getByRole("button",{name:"Close anatomical information"}).click();await page.locator(`[data-structure-id="${id}"]`).click();await settle();assert.equal(await page.locator(`[data-marker-id="${id}"]`).isVisible(),true,id);}
 report.checks.push("All 17 side-panel targets are visible after navigation on the actual scan");
 await page.getByRole("button",{name:"Close anatomical information"}).click();await page.getByRole("button",{name:"Ask AI Tutor",exact:true}).click();
 await page.locator('#tutor-question').fill("Pan to PDA");await page.locator('#tutor-question').press("Enter");await page.waitForFunction(()=>document.querySelector('.tutor-answer')?.textContent.includes('Opened'));await settle();assert.equal(await page.locator('[data-marker-id="posterior-descending-artery"]').isVisible(),true);
 report.checks.push("Chat navigation confirms the actual visible PDA target");

 await page.getByRole("button",{name:"Restart Session",exact:true}).click();await page.getByRole("dialog").getByRole("button",{name:"Restart Session",exact:true}).click();await settle();
 for(const id of ["coronary-sinus","left-circumflex-artery"]){if(await page.getByRole("button",{name:"Close anatomical information"}).isVisible())await page.getByRole("button",{name:"Close anatomical information"}).click();await page.locator(`[data-structure-id="${id}"]`).click();await settle();}
 const mainSelection=await page.locator('.workspace-content .scene-surface').getAttribute('data-model-selection');
 await page.getByRole("button",{name:"Review Session",exact:true}).click();await page.getByRole("button",{name:"Take Personalised Quiz",exact:true}).click();await page.getByRole("button",{name:"Start Personalised Quiz",exact:true}).click();await page.locator('.quiz-prompt').waitFor();
 const originalPrompt=await page.locator('.quiz-prompt').innerText(),originalOptions=await page.locator('.quiz-answer label').allTextContents();
 await page.getByRole("button",{name:"Exit Quiz",exact:true}).click();await page.getByRole("button",{name:"Review Session",exact:true}).click();await page.getByRole("button",{name:"Take Personalised Quiz",exact:true}).click();await page.locator('.quiz-prompt').waitFor();
 assert.equal(await page.locator('.quiz-prompt').innerText(),originalPrompt);assert.deepEqual(await page.locator('.quiz-answer label').allTextContents(),originalOptions);assert.equal(report.calls.quiz,1);assert.equal(report.calls.review,1);
 report.checks.push("Reopening the existing quiz preserves question order and makes no generation call");
 for(let i=0;i<3;i++){
  const prompt=await page.locator('.quiz-prompt').innerText();
  if(prompt.includes('numbered marker')){
   await page.locator('.quiz-model .scene-surface[data-model-kind="imported"]').waitFor();await page.waitForTimeout(800);
   assert.equal(JSON.parse(await page.locator('.quiz-model .scene-surface').getAttribute('data-model-selection')).selected,null);
   assert.equal(await page.locator('.quiz-model .marker-tooltip').count(),0);assert.equal(await page.locator('.quiz-model .vessel-highlight-label').count(),0);
   const marker=page.locator('.quiz-model .anatomy-marker:not([hidden]):not([data-marker-id="coronary-sinus"])').first();await marker.click();
   await page.getByRole('button',{name:'Submit Answer',exact:true}).click();await page.waitForTimeout(800);
   assert.equal(JSON.parse(await page.locator('.quiz-model .scene-surface').getAttribute('data-model-selection')).selected,'coronary-sinus');
   assert.match(await page.locator('.quiz-location-feedback').innerText(),/Coronary Sinus/);
   await page.screenshot({path:`${dir}/quiz-location-feedback.png`});
  }else if(prompt.includes('highlighted')){
   await page.locator('.quiz-model .scene-surface[data-model-kind="imported"]').waitFor();await page.waitForTimeout(800);
   assert.equal(JSON.parse(await page.locator('.quiz-model .scene-surface').getAttribute('data-model-selection')).selected,'left-circumflex-artery');
   const frame=JSON.parse(await page.locator('.quiz-model .scene-surface').getAttribute('data-framing'));assert.ok(frame.visibility>.99,`Quiz scan must fit, got ${frame.visibility}`);
   assert.equal(await page.locator('.quiz-model .marker-tooltip').count(),0);
   await page.locator('.quiz-answer-list').getByRole('radio',{name:'Left Circumflex Artery',exact:false}).check();await page.getByRole('button',{name:'Submit Answer',exact:true}).click();
   await page.screenshot({path:`${dir}/quiz-identification.png`});
  }else{
   await page.getByLabel('Orange',{exact:false}).check();await page.getByRole('button',{name:'Submit Answer',exact:true}).click();
   assert.equal(await page.locator('.quiz-answer.is-wrong').count(),1);assert.equal(await page.locator('.quiz-answer.is-correct').count(),1);assert.equal(await page.locator('.quiz-answer input:enabled').count(),0);
   await page.screenshot({path:`${dir}/quiz-desktop.png`});
  }
  assert.equal(await page.locator('.workspace-content .scene-surface').getAttribute('data-model-selection'),mainSelection);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollHeight>innerHeight+1),false);
  if(i===2){await page.setViewportSize({width:390,height:844});await page.screenshot({path:`${dir}/quiz-mobile.png`});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);}
  await page.getByRole('button',{name:i===2?'Show Results':'Next Question',exact:true}).click();
 }
 await page.getByRole('heading',{name:'Quiz Results',exact:true}).waitFor();assert.match(await page.locator('.quiz-score').innerText(),/1 \/ 3/);assert.equal(await page.locator('.quiz-result-item').count(),3);
 const download=page.waitForEvent('download');await page.getByRole('button',{name:'Download Updated Summary',exact:true}).click();await(await download).saveAs(`${dir}/quiz-review.docx`);
 report.checks.push("All three quiz formats use the real model, neutral location selection, hidden labels, stable IDs and locked feedback", "Quiz materials remain independent of the explorer", "Desktop fits viewport; mobile has no horizontal overflow; Word export downloads");
 assert.deepEqual(report.errors,[]);report.passed=true;
}catch(error){report.failure=error.stack;process.exitCode=1;if(page)await page.screenshot({path:`${dir}/failure.png`}).catch(()=>{});}
finally{await browser.close();fs.writeFileSync(`${dir}/browser-report.json`,JSON.stringify(report,null,2));console.log(JSON.stringify(report));}
