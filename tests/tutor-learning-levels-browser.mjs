import assert from "node:assert/strict";
import fs from "node:fs";
import {load} from "./helpers/load-module.mjs";
const {chromium}=await import(new URL("../.next/cache/browser-tools/node_modules/playwright/index.mjs",import.meta.url).href);
const {answerWithProvenance,GENERAL_KNOWLEDGE_NOTICE}=load("lib/tutor/answer-provenance.ts");
const collection=await load("lib/knowledge-base/minimal.ts").loadMinimalCorpus(undefined,undefined,true);
const catalogue=await load("lib/learning/evidence-server.ts").loadLearningEvidence();
const reference=collection.corpus.find(p=>p.source.id==="R11").source;
const source={id:"P1",sourceId:reference.id,title:reference.title,url:reference.url,section:reference.section,documentVersion:reference.documentVersion,materialKind:"reference"};
const browser=await chromium.launch({executablePath:"C:/Program Files/Google/Chrome/Application/chrome.exe",headless:true});
const dir="artifacts/tutor-learning-levels",report={mockedAPI:true,checks:[],requests:[],errors:[]};let page,replay;
try{
 const context=await browser.newContext({viewport:{width:1440,height:1000}});
 await context.route("**/*",async route=>{
  const u=new URL(route.request().url());if(!["localhost","127.0.0.1"].includes(u.hostname))return route.abort();
  if(u.pathname==="/api/learning/evidence")return route.fulfill({json:catalogue});
  if(u.pathname==="/api/chat"){
   const input=route.request().postDataJSON();report.requests.push(input);
   if(replay)return route.fulfill({json:replay.response});
   const coverage=["full","partial","none"][(report.requests.length-1)%3],sections=[];
   if(coverage!=="none")sections.push({kind:"reference",text:`${input.learningLevel} reference fixture for UI testing.`,sourceIds:["P1"]});
   if(coverage!=="full")sections.push({kind:"general",text:`${input.learningLevel} general-knowledge fixture for UI testing; not an anatomical answer.`,sourceIds:[]});
   return route.fulfill({json:{answer:answerWithProvenance(sections),sections,status:{full:"supported",partial:"partially_supported",none:"general_knowledge"}[coverage],evidenceStatus:{full:"verified",partial:"partial",none:"unverified"}[coverage],mode:"live",learningLevel:input.learningLevel,selectedStructureId:input.selectedStructureId,sources:coverage==="none"?[]:[source],collectionId:collection.id,collectionVersion:collection.collectionVersion,schemaVersion:1}});
  }
  if(u.pathname.startsWith("/api/"))return route.fulfill({json:{mode:"basic",reason:"disabled"}});
  return route.continue();
 });
 page=await context.newPage();page.setDefaultTimeout(45000);page.on("pageerror",e=>report.errors.push(e.message));
 await page.goto("http://localhost:3000",{waitUntil:"domcontentloaded"});await page.getByRole("button",{name:"Ask AI Tutor",exact:true}).click();
 for(const learningLevel of ["basic","intermediate","advanced"]){
  const before=report.requests.length;await page.getByRole('group',{name:'Learning level',exact:true}).getByRole('button',{name:learningLevel,exact:true}).click();assert.equal(report.requests.length,before);
  for(const coverage of ["full","partial","none"]){
   await page.locator('#tutor-question').fill('What is the main function of the coronary sinus?');await page.locator('#tutor-question').press('Enter');
   await page.getByRole('button',{name:'Send',exact:true}).waitFor();
   const last=page.locator('.tutor-turn').last();await last.locator('.tutor-answer').waitFor();
   assert.equal(report.requests.at(-1).learningLevel,learningLevel);assert.equal(await last.locator('.tutor-knowledge-notice').count(),coverage==='full'?0:1);
   assert.equal(await last.getByRole('list',{name:'Supporting sources'}).count(),coverage==='none'?0:1);
   assert.equal(await last.locator('.tutor-answer-general a').count(),0);
   if(coverage!=='full')assert.equal(await last.locator('.tutor-knowledge-notice').innerText(),GENERAL_KNOWLEDGE_NOTICE);
   if(report.requests.length>1)assert.ok(report.requests.at(-1).conversation.length>0,'Existing conversation is retained when changing level');
  }
 }
 assert.equal(report.requests.length,9);report.checks.push('Three learning levels × full/partial/no coverage render correct labels and citations; level changes affect the next request without a new conversation or extra calls');
 await page.reload();await page.getByRole('button',{name:'Ask AI Tutor',exact:true}).click();await page.locator('.tutor-turn').last().locator('.tutor-answer').waitFor();
 assert.equal(await page.locator('.tutor-turn').count(),9);assert.equal(await page.locator('.tutor-knowledge-notice').count(),6);assert.equal(report.requests.length,9);
 report.checks.push('Refresh restores all nine answers with provenance and makes no generation request');
 // Display a previously generated live response if the bounded live check ran.
 const saved=fs.existsSync(`${dir}/live-check.json`)?JSON.parse(fs.readFileSync(`${dir}/live-check.json`)):null;
 replay=saved?.requests.findLast(r=>r.coverage==='partial' && r.response.status==='partially_supported') ?? saved?.requests.find(r=>r.response.status==='partially_supported');
 if(replay){
  await page.getByRole('group',{name:'Learning level',exact:true}).getByRole('button',{name:replay.level,exact:true}).click();
  await page.locator('#tutor-question').fill(replay.question);await page.locator('#tutor-question').press('Enter');await page.locator('.tutor-turn').last().locator('.tutor-answer-general').waitFor();
  await page.locator('.scene-surface[data-model-kind="imported"]').waitFor({timeout:90000});
  await page.locator('.tutor-turn').last().locator('.tutor-knowledge-notice').scrollIntoViewIfNeeded();
  await page.screenshot({path:`${dir}/desktop.png`});
 }
 await page.setViewportSize({width:390,height:844});
 if(replay)await page.locator('.tutor-turn').last().locator('.tutor-knowledge-notice').scrollIntoViewIfNeeded();
 await page.screenshot({path:`${dir}/mobile.png`});
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
 report.checks.push('Mobile notice remains readable without horizontal overflow; recorded live answer replay requires no provider call');
 assert.deepEqual(report.errors,[]);report.passed=true;
}catch(e){report.failure=e.stack;process.exitCode=1;if(page)await page.screenshot({path:`${dir}/failure.png`}).catch(()=>{});}
finally{await browser.close();fs.writeFileSync(`${dir}/browser-report.json`,JSON.stringify(report,null,2));console.log(JSON.stringify({passed:report.passed,checks:report.checks,requests:report.requests.length,errors:report.errors,failure:report.failure}));}
