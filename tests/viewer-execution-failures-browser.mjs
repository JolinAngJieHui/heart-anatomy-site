import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const {chromium}=await import(new URL('../.next/cache/browser-tools/node_modules/playwright/index.mjs',import.meta.url).href);
const config=JSON.parse(await fs.readFile('public/models/heart-model.json','utf8'));
const base=process.env.EXPLORER_TEST_URL??'http://localhost:3000';
const report={paidApiCalls:0,cases:[]};
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try{
 for(const scenario of ['missing-marker','model-unavailable','interrupted']){
  const context=await browser.newContext({viewport:{width:1440,height:1000},reducedMotion:scenario==='interrupted'?'no-preference':'reduce'});context.setDefaultTimeout(30000);
  const requests=[];
  await context.route('**/*',async route=>{
   const url=new URL(route.request().url());if(!['localhost','127.0.0.1'].includes(url.hostname))return route.abort();
   if(url.pathname==='/models/heart-model.json'&&scenario!=='interrupted'){
    const value=structuredClone(config);
    if(scenario==='missing-marker')delete value.structures['ascending-aorta'].anchor;
    else value.url=null;
    return route.fulfill({json:value});
   }
   if(url.pathname==='/api/chat')requests.push(route.request().postDataJSON());
   if(url.pathname.startsWith('/api/learning/'))return route.fulfill({status:503,json:{mode:'basic',reason:'TEST no generation'}});
   return route.continue();
  });
  const page=await context.newPage();await page.goto(base,{waitUntil:'networkidle'});
  await page.waitForSelector(`.scene-surface[data-model-kind="${scenario==='model-unavailable'?'error':'imported'}"]`,{timeout:90000});
  await page.getByRole('button',{name:'Ask AI Tutor',exact:true}).click();await page.locator('#tutor-question').fill('Locate the ascending aorta');await page.locator('#tutor-question').press('Enter');
  if(scenario==='interrupted'){
   await page.waitForFunction(()=>{const el=document.querySelector('.workspace-content .scene-surface');return el?.dataset.framing&&JSON.parse(el.dataset.framing).moving;});
   const box=await page.locator('canvas').first().boundingBox();
   await page.mouse.move(box.x+box.width*.45,box.y+box.height*.45);await page.mouse.down();await page.mouse.move(box.x+box.width*.55,box.y+box.height*.46,{steps:3});await page.mouse.up();
  }
  await page.locator('.tutor-answer').waitFor({timeout:45000});
  const text=await page.locator('.tutor-answer').last().innerText(),receipt=requests.at(-1)?.viewerExecution;
  assert.ok(receipt);assert.equal(receipt.requestedId,'ascending-aorta');assert.equal(receipt.status,scenario==='interrupted'?'interrupted':'failed');assert.doesNotMatch(text,/I.ve brought/);
  assert.match(text,scenario==='missing-marker'?/no mapped marker/:scenario==='interrupted'?/interrupted/:/not ready/);
  report.cases.push({scenario,receipt,displayed:text});await context.close();
 }
 report.passed=true;
}finally{await fs.mkdir('artifacts/review-quiz-workflow',{recursive:true});await fs.writeFile('artifacts/review-quiz-workflow/failure-cases.json',JSON.stringify(report,null,2)+'\n');await browser.close();console.log(JSON.stringify(report,null,2));}
