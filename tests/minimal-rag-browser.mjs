import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const {chromium}=await import(new URL('../.next/cache/browser-tools/node_modules/playwright/index.mjs',import.meta.url).href);
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const checks=[],errors=[];
try{
 const page=await browser.newPage({viewport:{width:1600,height:1000}});
 page.on('pageerror',e=>errors.push(e.message));
 await page.goto(process.env.EXPLORER_TEST_URL??'http://localhost:3104',{waitUntil:'networkidle'});
 await page.locator('canvas').waitFor();
 assert.equal(await page.locator('[data-structure-id]').count(),17);
 assert.ok(await page.locator('.information-overlay').isHidden());assert.ok(await page.locator('#anatomy-tutor').isHidden());checks.push('17 stable structures, 3D canvas and initially closed panels');
 await page.locator('[data-structure-id="coronary-sinus"]').click();
 await page.locator('.information-overlay').waitFor({state:'visible'});
 assert.equal(await page.locator('#detail-title').innerText(),'Coronary Sinus');
 assert.ok((await page.locator('.detail-card').innerText()).includes('R11'));
 const basic=await page.locator('.detail-body').innerText();
 await page.getByRole('button',{name:'advanced',exact:true}).click();
 assert.notEqual(await page.locator('.detail-body').innerText(),basic);checks.push('Selection, preserved educational cards, new R11 reading link and level switching');
 await page.getByRole('button',{name:'Ask AI Tutor',exact:true}).click();
 assert.match(await page.locator('.tutor-availability').innerText(),/Development review/);
 
 await page.locator('#tutor-question').fill('Where does CS drain?');
 await page.getByRole('button',{name:'Send',exact:true}).click();
 await page.locator('.tutor-answer').waitFor({timeout:60000});
 assert.match(await page.locator('.tutor-answer').innerText(),/literal article excerpts/);
 assert.ok(await page.locator('[aria-label="Supporting sources"] a[href="https://doi.org/10.1186/s12959-025-00707-x"]').count());
 await page.locator('[aria-label="Supporting sources"] summary').first().click();
 assert.match(await page.locator('[aria-label="Supporting sources"]').innerText(),/CC BY 4.0/);checks.push('Real chatbot request, R11 original DOI citation and visible licence attribution');
 await page.getByRole('button',{name:'Close AI Anatomy Tutor',exact:true}).click();
 await page.getByRole('button',{name:'Close anatomical information',exact:true}).click();
 await page.getByRole('button',{name:'Review Session',exact:true}).click();
 await page.waitForFunction(()=>document.body.innerText.includes('pending scientific approval'));
 await page.locator('.learning-entry summary').first().click();
 const pending=page.getByRole('button',{name:'Scientific approval pending',exact:true});
 for(const button of await pending.all())assert.ok(await button.isDisabled());
 // Case-report excerpts may be absent from the ordinary teaching catalogue.
 const catalogue=await page.request.get(new URL('/api/learning/evidence',page.url()).href).then(r=>r.json());
 assert.equal(catalogue.mode,'review-local');assert.ok(catalogue.sources.every(s=>/^R(?:[1-9]|10|11)$/.test(s.id)));
 assert.match(await page.locator('body').innerText(),/0 source-grounded practice questions/);checks.push('Learning review displays pending evidence and excludes it from approved quizzes');
 assert.deepEqual(errors,[]);
 await fs.writeFile('docs/rag/minimal-browser-verification.json',JSON.stringify({passed:true,checks,errors},null,2)+'\n');
 console.log(JSON.stringify({passed:true,checks},null,2));
}finally{await browser.close();}
