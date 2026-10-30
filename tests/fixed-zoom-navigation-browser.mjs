import assert from "node:assert/strict";
import fs from "node:fs";
const {chromium}=await import(new URL("../.next/cache/browser-tools/node_modules/playwright/index.mjs",import.meta.url).href);
const browser=await chromium.launch({executablePath:"C:/Program Files/Google/Chrome/Application/chrome.exe",headless:true});
const dir="artifacts/fixed-zoom-navigation";fs.mkdirSync(dir,{recursive:true});
const report={checks:[],errors:[],poses:[],mockedAPI:true};let page;
try {
 const context=await browser.newContext({viewport:{width:1890,height:966},deviceScaleFactor:1});
 await context.route("**/*",route=>{
  const u=new URL(route.request().url());if(!["localhost","127.0.0.1"].includes(u.hostname))return route.abort();
  if(u.pathname==="/api/chat")return route.fulfill({json:{schemaVersion:1,mode:"review",status:"navigation",answer:"Waiting for viewer navigation.",sources:[],selectedStructureId:null,learningLevel:"basic",navigation:{id:"fixed-zoom",command:{type:"focus_structure",structureId:"coronary-sinus"}}}});
  if(u.pathname.startsWith("/api/"))return route.fulfill({json:{mode:"basic",reason:"disabled",sources:[],passages:[],gaps:[]}});
  return route.continue();
 });
 page=await context.newPage();page.setDefaultTimeout(45000);page.on("pageerror",e=>report.errors.push(e.message));
 await page.goto(process.env.EXPLORER_TEST_URL??"http://localhost:3000",{waitUntil:"domcontentloaded"});
 await page.locator('.scene-surface[data-model-kind="imported"]').waitFor({timeout:90000});
 const frame=()=>page.locator('.scene-surface').evaluate(el=>JSON.parse(el.dataset.framing));
 const settle=async()=>{await page.waitForTimeout(700);await page.waitForFunction(()=>{const f=document.querySelector('.scene-surface')?.dataset.framing;return f&&!JSON.parse(f).moving;});};
 const close=async()=>{const button=page.getByRole('button',{name:'Close anatomical information'});if(await button.isVisible())await button.click();await settle();};
 const check=async(id,before)=>{
  await settle();const after=await frame();assert.ok(Math.abs(after.distance-before.distance)<1e-8,`${id}: camera distance changed`);assert.equal(after.zoom,before.zoom);
  before.target.forEach((v,i)=>assert.ok(Math.abs(v-after.target[i])<1e-8,`${id}: pivot changed`));
  const marker=page.locator(`[data-marker-id="${id}"]`);assert.equal(await marker.isVisible(),true,id);
  const b=await marker.boundingBox(),s=await page.locator('.scene-surface').boundingBox(),r=after.region;
  assert.ok(Math.abs(b.x+b.width/2-s.x-r.x-r.width/2)<2,`${id}: marker x centre`);
  assert.ok(Math.abs(b.y+b.height/2-s.y-r.y-r.height/2)<2,`${id}: marker y centre`);
  report.poses.push({id,distance:after.distance,zoom:after.zoom,region:r});return after;
 };
 await settle();const initial=await frame();
 await page.locator('[data-structure-id="right-coronary-distal"]').click();const distal=await check('right-coronary-distal',initial);
 const dot=Math.abs(initial.quaternion.reduce((s,v,i)=>s+v*distal.quaternion[i],0));assert.ok(dot<.99,'Hidden distal RCA requires rotation');
 await page.mouse.move(5,5);await page.screenshot({path:`${dir}/distal-rca.png`});
 report.checks.push('Reference view: distal RCA rotates into view and its marker is centred beside the card without changing zoom');
 const ids=Object.keys(JSON.parse(fs.readFileSync('public/models/heart-model.json')).structures);
 for(const id of ids){await close();const before=await frame();await page.locator(`[data-structure-id="${id}"]`).click();await check(id,before);}
 report.checks.push('All 17 sidebar targets keep camera distance, zoom and pivot and centre their visible marker');
 await close();await page.getByRole('button',{name:'Reset view',exact:true}).click();await settle();
 const visible=page.locator('.anatomy-marker:not([hidden])').first(),markerId=await visible.getAttribute('data-marker-id'),beforeClick=await frame();
 await visible.click();await check(markerId,beforeClick);report.checks.push('Direct numbered-marker selection uses the same fixed-zoom navigation');
 await close();const box=await page.locator('canvas').boundingBox();await page.mouse.move(box.x+box.width*.4,box.y+box.height*.5);
 for(let n=0;n<8;n++)await page.mouse.wheel(0,-100);await page.waitForTimeout(300);
 await page.mouse.down({button:'right'});await page.mouse.move(box.x+box.width*.4+70,box.y+box.height*.5-40,{steps:10});await page.mouse.up({button:'right'});
 const zoomed=await frame();assert.ok(zoomed.distance<initial.distance);
 await page.locator('[data-structure-id="coronary-sinus"]').click();const near=await check('coronary-sinus',zoomed);
 await page.mouse.move(box.x+80,box.y+80);await page.mouse.down();await page.mouse.up();await page.waitForTimeout(150);
 const resumed=await frame();assert.ok(Math.abs(resumed.distance-near.distance)<1e-8);near.quaternion.forEach((v,i)=>assert.ok(Math.abs(v-resumed.quaternion[i])<1e-8));
 report.checks.push('Selection after manual zoom and pan keeps the close-up; the next mouse gesture does not jump');
 await close();await page.getByRole('button',{name:'Ask AI Tutor',exact:true}).click();await settle();const withTutor=await frame();
 await page.locator('#tutor-question').fill('Show coronary sinus');await page.locator('#tutor-question').press('Enter');
 await page.waitForFunction(()=>document.querySelector('.tutor-answer')?.textContent.includes('Opened'));await check('coronary-sinus',withTutor);
 report.checks.push('Mocked tutor navigation preserves zoom with both panels open');
 await page.getByRole('button',{name:'Close AI Anatomy Tutor',exact:true}).click();await page.getByRole('button',{name:'Reset view',exact:true}).click();await settle();
 const reset=await frame();assert.ok(Math.abs(reset.distance-initial.distance)<1e-8);initial.quaternion.forEach((v,i)=>assert.ok(Math.abs(v-reset.quaternion[i])<1e-8));
 await page.setViewportSize({width:390,height:844});await settle();const mobile=await frame();await page.locator('[data-structure-id="right-coronary-distal"]').click();await check('right-coronary-distal',mobile);
 await page.screenshot({path:`${dir}/mobile.png`});report.checks.push('Reset restores the starting view; mobile selection centres the marker above the card without zooming');
 assert.deepEqual(report.errors,[]);report.passed=true;
}catch(e){report.failure=e.stack;process.exitCode=1;if(page)await page.screenshot({path:`${dir}/failure.png`}).catch(()=>{});}
finally{await browser.close();fs.writeFileSync(`${dir}/report.json`,JSON.stringify(report,null,2));console.log(JSON.stringify(report));}
