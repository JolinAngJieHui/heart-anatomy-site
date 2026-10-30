import assert from 'node:assert/strict';
const { chromium } = await import('playwright').catch(() => import(new URL('../.next/cache/browser-tools/node_modules/playwright/index.mjs', import.meta.url).href));
const baseUrl = process.env.EXPLORER_TEST_URL ?? 'http://127.0.0.1:3100';
const browser = await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try {
  const page = await browser.newPage({viewport:{width:1440,height:900}});
  await page.route('**/api/learning/review',r=>r.fulfill({json:{mode:'basic',reason:'disabled'}}));
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto(baseUrl,{waitUntil:'networkidle'});
  await page.locator('canvas').waitFor();
  const count=async n=>page.waitForFunction(expected=>document.querySelector('[role="progressbar"]')?.getAttribute('aria-valuenow')===String(expected),n);
  const entries=await page.locator('[data-structure-id]').evaluateAll(els=>els.map(el=>el.dataset.structureId));
  const key='heart-anatomy:tab-session:v1';
  const legacy=JSON.stringify({version:1,visitedIds:entries,achievedMilestones:['first-discoveries','heart-explorer','almost-there','anatomy-explorer']});
  await page.evaluate(raw=>localStorage.setItem('heart-anatomy:exploration:v1',raw),legacy);
  await page.reload({waitUntil:'networkidle'}); await count(0);
  assert.equal(await page.locator('.achievement-toast').count(),0);
  assert.equal(await page.locator('.information-overlay').isVisible(),false);
  assert.equal(await page.getByRole('button',{name:/selected label/i}).count(),0);
  const achievements=new Map([[5,'First Discoveries'],[10,'Heart Explorer'],[15,'Almost There'],[17,'Anatomy Explorer']]);
  for(let i=0;i<entries.length;i++) {
    await page.locator(`[data-structure-id="${entries[i]}"]`).click(); await count(i+1);
    await page.locator(`[data-structure-id="${entries[i]}"]`).click(); await count(i+1);
    if(achievements.has(i+1)) {
      await page.waitForSelector('.achievement-toast');
      assert.equal(await page.locator('.achievement-toast strong').innerText(),achievements.get(i+1));
      await page.getByRole('button',{name:'Dismiss achievement',exact:true}).click();
      await page.waitForSelector('.achievement-toast',{state:'hidden'});
    }
  }
  assert.equal(await page.locator('.progress-track > span').evaluate(el=>el.style.width),'100%');
  const saved=await page.evaluate(k=>sessionStorage.getItem(k),key);
  assert.equal(JSON.parse(saved).sessions[0].events.filter(e=>e.type==='card-opened').length,17);
  await page.getByRole('button',{name:'Reset view',exact:true}).click(); await count(17);
  await page.reload({waitUntil:'networkidle'}); await count(17);
  assert.equal(await page.evaluate(k=>sessionStorage.getItem(k),key),saved,'saved session untouched on refresh');
  assert.equal(await page.evaluate(()=>localStorage.getItem('heart-anatomy:exploration:v1')),legacy,'legacy storage is ignored, not destroyed');
  assert.equal(await page.locator('.achievement-toast').count(),0);
  await page.getByRole('button',{name:'Review Session',exact:true}).click();
  await page.locator('.learning-review').waitFor();
  await page.getByRole('button',{name:'Return to Model',exact:true}).click();
  await page.locator('.restart-session-button').click();
  await page.getByRole('dialog').getByRole('button',{name:'Restart Session',exact:true}).click(); await count(0);
  for(const id of entries.slice(0,5)) await page.locator(`[data-structure-id="${id}"]`).click();
  await count(5); await page.waitForSelector('.achievement-toast');
  assert.equal(await page.locator('.achievement-toast strong').innerText(),'First Discoveries','milestones earned again in new exploration');
  await page.getByRole('button',{name:'Dismiss achievement',exact:true}).click(); await page.locator('.achievement-toast').waitFor({state:'hidden'});
  await page.locator('.restart-session-button').click();
  await page.getByRole('dialog').getByRole('button',{name:'Restart Session',exact:true}).click(); await count(0);
  const newHistory=await page.evaluate(k=>JSON.parse(sessionStorage.getItem(k)),key);
  assert.equal(newHistory.sessions.length,1); assert.equal(newHistory.sessions[0].events.length,0);
  for(const [width,height] of [[1440,900],[1024,768],[768,1024],[390,844],[320,568],[844,390]]) {
    await page.setViewportSize({width,height}); await page.waitForTimeout(350);
    const sizes=await page.evaluate(()=>({w:document.documentElement.scrollWidth,h:document.documentElement.scrollHeight,bar:document.querySelector('.exploration-progress').getBoundingClientRect().toJSON(),scene:document.querySelector('.scene-surface').getBoundingClientRect().toJSON()}));
    assert.equal(sizes.w,width);assert.equal(sizes.h,height);assert.ok(sizes.bar.right<=width&&sizes.bar.bottom<height);assert.ok(sizes.scene.height>=60);
  }
  await page.setViewportSize({width:320,height:568});
  for(const id of entries.slice(0,5)) { await page.locator(`[data-structure-id="${id}"]`).click(); await page.getByRole('button',{name:'Close anatomical information',exact:true}).click(); }
  await count(5); await page.waitForSelector('.achievement-toast');
  assert.ok(await page.locator('.scene-surface').evaluate(el=>el.getBoundingClientRect().height>=60));
  await page.screenshot({path:'.next/cache/progress-small-achievement.png'});
  const blocked=await browser.newPage();
  await blocked.addInitScript(()=>{ Storage.prototype.getItem=()=>{throw Error('Storage blocked');};Storage.prototype.setItem=()=>{throw Error('Storage blocked');}; });
  await blocked.goto(baseUrl,{waitUntil:'networkidle'});
  await blocked.locator(`[data-structure-id="${entries[0]}"]`).click();
  assert.equal(await blocked.getByRole('progressbar').getAttribute('aria-valuenow'),'1');
  await blocked.reload({waitUntil:'networkidle'});assert.equal(await blocked.getByRole('progressbar').getAttribute('aria-valuenow'),'0');
  await blocked.close();assert.deepEqual(errors,[]);
  console.log('Exploration restored on reload; unique selections; milestones earned again after restart; confirmed restart; unavailable storage; six responsive layouts passed.');
} finally {await browser.close();}
