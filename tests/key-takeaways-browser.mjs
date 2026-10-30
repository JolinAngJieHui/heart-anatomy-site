import assert from "node:assert/strict";
import fs from "node:fs";
import JSZip from "jszip";
import {load} from "./helpers/load-module.mjs";
const R=load("lib/learning/lesson-review.ts"), {answerWithProvenance}=load("lib/tutor/answer-provenance.ts");
const catalogue=await load("lib/learning/evidence-server.ts").loadLearningEvidence();
const collection=await load("lib/knowledge-base/minimal.ts").loadMinimalCorpus(undefined,undefined,true);
const {chromium}=await import(new URL("../.next/cache/browser-tools/node_modules/playwright/index.mjs",import.meta.url).href);
const browser=await chromium.launch({executablePath:"C:/Program Files/Google/Chrome/Application/chrome.exe",headless:true});
const dir="artifacts/key-takeaways";fs.mkdirSync(dir,{recursive:true});
const report={mockedAPI:true,paidCalls:0,checks:[],reviews:[],chat:[],quizCalls:0,errors:[]};let page,fail=false,hold=null;
try{
 const context=await browser.newContext({viewport:{width:1440,height:1000},acceptDownloads:true});
 await context.route("**/*",async route=>{
  const u=new URL(route.request().url());if(!["localhost","127.0.0.1"].includes(u.hostname))return route.abort();
  if(u.pathname==="/api/learning/evidence")return route.fulfill({json:catalogue});
  if(u.pathname==="/api/chat"){
   const b=route.request().postDataJSON();report.chat.push(b);assert.equal("privacyConfirmed" in b,false);
   if(b.question.startsWith("Show"))return route.fulfill({json:{answer:"Viewer navigation fixture.",mode:"live",status:"navigation",sources:[],selectedStructureId:b.selectedStructureId,learningLevel:b.learningLevel}});
   const p=R.lessonEvidence({structures:["coronary-sinus"],questions:[],level:b.learningLevel,levels:[]},catalogue)[0];
   const sections=[{kind:"reference",text:"Browser fixture: a cited discussion was recorded.",sourceIds:["P1"]},{kind:"general",text:"Browser fixture: a general explanation was recorded; its limitations remain.",sourceIds:[]}];
   return route.fulfill({json:{answer:answerWithProvenance(sections),sections,mode:"live",status:"partially_supported",evidenceStatus:"partial",sources:[{...p.sources[0],id:"P1"}],selectedStructureId:b.selectedStructureId,learningLevel:b.learningLevel,collectionVersion:collection.collectionVersion,collectionId:collection.id,schemaVersion:1}});
  }
  if(u.pathname==="/api/learning/review"){
   const b=route.request().postDataJSON();report.reviews.push(b);assert.ok(!b.questions.some(q=>q.question.startsWith("Show")));assert.equal("sessionId" in b,false);
   if(hold)await hold;
   if(fail)return route.fulfill({status:503,json:{mode:"basic",reason:"unavailable"}});
   const c=R.reviewChoices(b,catalogue),e=R.lessonEvidence(b,catalogue),g=b.questions.find(R.retainedGeneralAnswer);
   const takeaways=[{text:`${b.level} browser fixture: a summary based on the selected structure.`,kind:"reference",evidenceIds:[e[0].key],questionIds:[]}];
   if(g)takeaways.push({text:"Browser fixture: the discussed general explanation retains its limitations.",kind:"general",evidenceIds:[],questionIds:[g.id]});
   return route.fulfill({json:{mode:"ai",selection:{introduction:c.introductions[0],closing:c.closings[0],structures:b.structures,questions:b.questions.map(q=>({id:q.id,paragraphIndexes:[]})),takeawayIds:c.candidates.slice(0,4).map(t=>t.id),personalisation:{introduction:"You explored the coronary sinus. Here are the points from this browser test.",closing:"",questions:[],takeaways}}}});
  }
  if(u.pathname==="/api/learning/quiz"){
   report.quizCalls++;const b=route.request().postDataJSON(),e=R.lessonEvidence(b.review.input,catalogue);
   return route.fulfill({json:{mode:"ai",selection:{questions:[{structureId:"coronary-sinus",kind:"multiple-choice",prompt:"Browser fixture: choose Violet.",concept:"Browser fixture",options:[{id:"a",label:"Violet",structureId:null},{id:"b",label:"Orange",structureId:null},{id:"c",label:"Blue",structureId:null}],correctAnswer:"a",explanation:"Browser fixture: Violet is the recorded test answer.",evidenceIds:[e[0].key]}]}}});
  }
  if(u.pathname.startsWith("/api/"))return route.fulfill({status:204});return route.continue();
 });
 page=await context.newPage();page.setDefaultTimeout(45000);page.on("pageerror",e=>report.errors.push(e.message));
 await page.goto(process.env.EXPLORER_TEST_URL??"http://localhost:3000",{waitUntil:"domcontentloaded"});
 await page.locator('.scene-surface[data-model-kind="imported"]').waitFor({timeout:90000});
 const open=async()=>{await page.getByRole("button",{name:"Review Session",exact:true}).click();await page.waitForFunction(()=>{const p=document.querySelector('.review-generation-status [role="status"]');return p&&!p.textContent.includes('Preparing');});};
 const back=()=>page.getByRole("button",{name:"Return to Model",exact:true}).click();
 const setLevel=level=>page.getByRole('group',{name:'Learning level',exact:true}).getByRole('button',{name:level,exact:true}).click();
 const update=async()=>{await page.getByRole('button',{name:/^(Update|Retry) review$/}).click();await page.getByText('AI-personalised review',{exact:true}).waitFor();};
 const keySection=()=>page.locator('section[aria-labelledby="takeaways-title"]');
 for(const level of ['basic','intermediate','advanced']){await setLevel(level);await open();assert.match(await keySection().innerText(),/Explore a structure or ask an anatomy question/);assert.equal(report.reviews.length,0);await back();}
 report.checks.push('Empty sessions at all three levels make no review request');
 await setLevel('basic');await page.locator('[data-structure-id="coronary-sinus"]').click();await open();assert.equal(report.reviews.length,1);
 assert.equal(await page.getByText('Continue your revision',{exact:true}).count(),0);assert.equal(await page.locator('[data-review-structure]').count(),0);
 assert.match(await keySection().innerText(),/basic browser fixture/);assert.equal(await keySection().locator('.review-sources > summary').count(),1);
 await back();await open();assert.equal(report.reviews.length,1);await back();
 for(const level of ['intermediate','advanced']){await setLevel(level);const count=report.reviews.length;await open();assert.equal(report.reviews.length,count);assert.match(await page.locator('.review-generation-status').innerText(),/session has changed/);await update();assert.equal(report.reviews.at(-1).level,level);assert.equal(report.reviews.at(-1).questions.length,0);await back();}
 report.checks.push('Exploration-only summaries at every level; reopening and level changes wait for explicit Update review');
 if(await page.getByRole('button',{name:'Close anatomical information'}).isVisible())await page.getByRole('button',{name:'Close anatomical information'}).click();
 await page.getByRole('button',{name:'Ask AI Tutor',exact:true}).click();
 assert.equal(await page.locator('.tutor-privacy,.tutor-notice').count(),0);assert.doesNotMatch(await page.locator('.anatomy-tutor').innerText(),/Educational use only|My questions contain/);
 const send=async question=>{await page.locator('#tutor-question').fill(question);await page.locator('#tutor-question').press('Enter');await page.getByRole('button',{name:'Send',exact:true}).waitFor();await page.locator('.tutor-turn').last().locator('.tutor-answer').waitFor();};
 await send('Show coronary sinus');await send('What is the function of the coronary sinus?');assert.equal(report.chat.length,2);assert.equal(await page.locator('.tutor-knowledge-notice').count(),1);
 report.checks.push('Chat sends immediately without a confirmation and retains answer-specific notices');
 await open();const before=report.reviews.length;assert.match(await page.locator('.review-generation-status').innerText(),/session has changed/);assert.equal(report.reviews.length,before);await update();assert.equal(report.reviews.at(-1).questions.length,1);
 for(const level of ['basic','intermediate']){await setLevel(level);await page.waitForFunction(()=>!document.querySelector('.review-generation-status [role="status"]')?.textContent.includes('Preparing'));const count=report.reviews.length;assert.match(await page.locator('.review-generation-status').innerText(),/session has changed/);assert.equal(report.reviews.length,count);await update();assert.equal(report.reviews.at(-1).level,level);assert.equal(report.reviews.at(-1).questions.length,1);}
 assert.equal(await keySection().locator('.tutor-knowledge-notice').count(),1);assert.equal(await keySection().locator('.review-sources').count(),1);
 await keySection().scrollIntoViewIfNeeded();await page.screenshot({path:`${dir}/desktop.png`});
 const download=page.waitForEvent('download');await page.getByRole('button',{name:'Download Word',exact:true}).click();const output=await download;await output.saveAs(`${dir}/review.docx`);const xml=await(await JSZip.loadAsync(fs.readFileSync(`${dir}/review.docx`))).file('word/document.xml').async('string');assert.match(xml,/Not verified against this website/);assert.match(xml,/Key takeaways/);assert.doesNotMatch(xml,/Continue your revision/);
 report.checks.push('Question-based summaries at all levels, navigation excluded, cited/general content distinct in UI and Word');
 await page.setViewportSize({width:390,height:844});await keySection().scrollIntoViewIfNeeded();await page.screenshot({path:`${dir}/mobile.png`});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
 await page.setViewportSize({width:1440,height:1000});
 const restoredCalls=report.reviews.length;await page.reload();await open();assert.equal(report.reviews.length,restoredCalls);assert.equal(await page.getByText('AI-personalised review',{exact:true}).count(),1);assert.doesNotMatch(await page.locator('.review-generation-status').innerText(),/session has changed/);report.checks.push('Refresh restores an unchanged successful summary without generation or a false stale notice');
 let release;hold=new Promise(r=>release=r);const count=report.reviews.length;await page.getByRole('button',{name:'Update review',exact:true}).click();await page.waitForFunction(()=>document.querySelector('.review-generation-status')?.dataset.state === 'loading');await back();await openPending();assert.equal(report.reviews.length,count+1);release();hold=null;await page.getByText('AI-personalised review',{exact:true}).waitFor();
 async function openPending(){await page.getByRole('button',{name:'Review Session',exact:true}).click();await page.locator('.review-generation-status').waitFor();}
 fail=true;await page.getByRole('button',{name:'Update review',exact:true}).click();await page.getByRole('button',{name:'Retry review',exact:true}).waitFor();assert.equal(await page.getByText('AI-personalised review',{exact:true}).count(),0);assert.equal(await keySection().locator('li').count(),0);fail=false;await update();
 report.checks.push('In-flight reopen coalesces requests; failures show no fabricated takeaways and offer an explicit retry');
 const beforeQuiz=report.reviews.length;await page.getByRole('button',{name:'Take Personalised Quiz',exact:true}).click();await page.getByRole('button',{name:'Start Personalised Quiz',exact:true}).click();await page.getByLabel('Violet',{exact:false}).check();await page.getByRole('button',{name:'Submit Answer',exact:true}).click();await page.getByRole('button',{name:'Show Results',exact:true}).click();await page.getByRole('heading',{name:'Quiz Results',exact:true}).waitFor();assert.match(await page.locator('.quiz-score').innerText(),/1 \/ 1/);assert.equal(report.reviews.length,beforeQuiz);assert.equal(report.quizCalls,1);
 report.checks.push('Quiz button remains accessible beside review actions; completing a quiz does not remount it or regenerate the review');
 await page.getByRole('button',{name:'Exit Quiz',exact:true}).click();await page.getByRole('button',{name:'Restart Session',exact:true}).click();await page.getByRole('dialog').getByRole('button',{name:'Restart Session',exact:true}).click();await open();assert.equal(report.reviews.length,beforeQuiz);assert.equal(await page.locator('.review-question').count(),0);assert.match(await keySection().innerText(),/Explore a structure/);
 await back();await page.reload();await open();assert.equal(report.reviews.length,beforeQuiz);assert.equal(await page.locator('.review-question').count(),0);report.checks.push('Restart and refresh cannot restore the old summary or questions');
 assert.deepEqual(report.errors,[]);report.passed=true;
}catch(error){report.failure=error.stack;process.exitCode=1;if(page)await page.screenshot({path:`${dir}/failure.png`}).catch(()=>{});}finally{fs.writeFileSync(`${dir}/browser-report.json`,JSON.stringify(report,null,2));console.log(JSON.stringify({...report,reviews:report.reviews.length,chat:report.chat.length}));await browser.close();}
