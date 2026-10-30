import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as three from 'three';
import {load} from './helpers/load-module.mjs';
import {scanGeometry} from './helpers/scan-geometry.mjs';
const {HEART_PARTS}=load('lib/heart-parts.ts'),{LEARNING_LEVEL_DESCRIPTIONS}=load('lib/education.ts'),{vesselHighlightColor,VESSEL_HIGHLIGHT_OPACITY}=load('lib/vessel-highlight.ts');
const config=JSON.parse(fs.readFileSync('public/models/heart-model.json')),{root}=await scanGeometry(`public${config.url}`);
const model=load('lib/imported-model.ts',{three}).prepareImportedModel(root,config),meshes=[];root.traverse(o=>{if(o.isMesh)meshes.push(o);});
function surfaceProbe(id,f){
 const camera=new three.PerspectiveCamera(f.fov,f.viewport.width/f.viewport.height,.1,1000);camera.position.fromArray(f.position);camera.quaternion.fromArray(f.quaternion);camera.zoom=f.zoom;camera.setViewOffset(f.viewport.width,f.viewport.height,-f.offset.x,-f.offset.y,f.viewport.width,f.viewport.height);camera.updateMatrixWorld();
 const ray=new three.Raycaster();
 for(const [mesh,target] of model.owners){if(!target.structureIds.includes(id))continue;
  const pos=mesh.geometry.attributes.position,index=mesh.geometry.index,count=index?index.count:pos.count;
  for(let face=0;face<count/3;face+=Math.max(1,Math.floor(count/3/1200))){
   const point=new three.Vector3();for(let j=0;j<3;j++)point.add(new three.Vector3().fromBufferAttribute(pos,index?index.getX(face*3+j):face*3+j));
   const p=mesh.localToWorld(point.multiplyScalar(1/3)).project(camera);if(Math.abs(p.x)>.9||Math.abs(p.y)>.85)continue;
   const x=Math.round((p.x+1)*f.viewport.width/2),y=Math.round((1-p.y)*f.viewport.height/2);
   if(f.obstacles.some(r=>x>=r.x-15&&x<=r.x+r.width+15&&y>=r.y-15&&y<=r.y+r.height+15))continue;
   if([[0,0],[1,0],[-1,0],[0,1],[0,-1]].every(([dx,dy])=>{ray.setFromCamera(new three.Vector2((x+dx)/f.viewport.width*2-1,1-(y+dy)/f.viewport.height*2),camera);return model.owners.get(ray.intersectObjects(meshes,false)[0]?.object)?.structureIds.includes(id);}))return {x,y};
  }
 }throw Error('No visible surface probe for '+id);
}
const {chromium}=await import(new URL('../.next/cache/browser-tools/node_modules/playwright/index.mjs',import.meta.url).href);
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
const dir=process.env.VESSEL_TEST_ARTIFACTS??'artifacts/vessel-level';fs.mkdirSync(dir,{recursive:true});const report={checks:[],errors:[],paidApiCalls:0};let page;
try{
 const context=await browser.newContext({viewport:{width:1440,height:1000}});
 await context.route('**/*',route=>{const u=new URL(route.request().url());if(!['localhost','127.0.0.1'].includes(u.hostname))return route.abort();
  if(u.pathname==='/api/chat'){const b=route.request().postDataJSON();return route.fulfill({json:{answer:'Synthetic navigation test only.',mode:'mock',status:'navigation',sources:[],selectedStructureId:b.selectedStructureId,learningLevel:b.learningLevel,viewerExecution:b.viewerExecution}});}
  if(u.pathname.startsWith('/api/'))return route.fulfill({json:{mode:'basic',reason:'disabled',sources:[],passages:[],gaps:[]}});return route.continue();});
 page=await context.newPage();page.setDefaultTimeout(30000);page.on('pageerror',e=>report.errors.push(e.message));
 await page.goto(process.env.EXPLORER_TEST_URL??'http://localhost:3000',{waitUntil:'domcontentloaded'});await page.locator('.scene-surface[data-model-kind="imported"]').waitFor({timeout:90000});
 const settle=()=>page.waitForFunction(()=>{const f=document.querySelector('.scene-surface')?.dataset.framing;return f&&!JSON.parse(f).moving;});
 const frame=()=>page.locator('.scene-surface').evaluate(e=>JSON.parse(e.dataset.framing));
 const materials=()=>page.locator('.scene-surface').evaluate(e=>JSON.parse(e.dataset.modelMaterials));
 const progress=()=>page.locator('[aria-label="Anatomical exploration"]').getAttribute('aria-valuenow');
 const saved=()=>page.evaluate(()=>sessionStorage.getItem('heart-anatomy:tab-session:v1'));
 const rects=()=>page.locator('.workspace-heading,.viewer-panel,.learning-panel').evaluateAll(es=>es.map(e=>{const r=e.getBoundingClientRect();return [r.x,r.y,r.width,r.height];}));
 const levelGroup=page.getByRole('group',{name:'Learning level',exact:true});
 await settle();const baseline=await materials(),before=await rects(),initialSession=await saved();
 async function tooltipFor(anchor,level){
  const tip=page.getByRole('tooltip');await tip.waitFor();assert.equal(await tip.innerText(),LEARNING_LEVEL_DESCRIPTIONS[level]);assert.equal(await anchor.getAttribute('aria-describedby'),await tip.getAttribute('id'));
  const a=await anchor.boundingBox(),t=await tip.boundingBox();assert.ok(Math.abs(t.y-(a.y+a.height+8))<1);assert.ok(t.x>=0&&t.x+t.width<=page.viewportSize().width);assert.equal(await tip.evaluate(e=>e.parentElement.tagName),'BODY');assert.equal(await tip.evaluate(e=>getComputedStyle(e).position),'fixed');
 }
 for(const level of ['basic','intermediate','advanced']){
  const b=levelGroup.getByRole('button',{name:level,exact:true});await b.hover();await tooltipFor(b,level);assert.deepEqual(await rects(),before);assert.equal(await saved(),initialSession);assert.equal(await levelGroup.getByRole('button',{name:'basic',exact:true}).getAttribute('aria-pressed'),'true');
  await page.screenshot({path:`${dir}/tooltip-${level}.png`});await page.mouse.move(0,0);await page.getByRole('tooltip').waitFor({state:'hidden'});
  await b.focus();await tooltipFor(b,level);assert.equal(await saved(),initialSession);await b.press('Escape');await page.getByRole('tooltip').waitFor({state:'hidden'});assert.equal(await b.evaluate(e=>document.activeElement===e),true);await b.evaluate(e=>e.blur());
 }
 report.checks.push('All descriptions on first-load hover and focus, associated with the correct button and portalled below it; no layout shift, selection, session writes or reset; Escape dismisses');
 const assertColour=async(id,intensity)=>{const colour=vesselHighlightColor([id]).slice(1),expected=baseline.filter(m=>m.structures.includes(id)).map(m=>({name:m.name,colors:m.colors.map(c=>new three.Color('#'+c).lerp(new three.Color('#'+colour),VESSEL_HIGHLIGHT_OPACITY).getHexString())}));await page.waitForFunction(({id,colour,intensity,expected,opacity})=>{const own=JSON.parse(document.querySelector('.scene-surface').dataset.modelMaterials).filter(m=>m.structures.includes(id));return own.length&&own.every(m=>m.colors.every((c,i)=>c===expected.find(e=>e.name===m.name).colors[i])&&m.materials.every(v=>v.emissive===colour&&v.emissiveIntensity===intensity*opacity));},{id,colour,intensity,expected,opacity:VESSEL_HIGHLIGHT_OPACITY});
  for(const mesh of await materials()){const orig=baseline.find(m=>m.name===mesh.name);mesh.materials.forEach((m,i)=>{for(const key of ['map','normalMap','roughness','metalness','uuid','opacity','transparent'])assert.equal(m[key],orig.materials[i][key]);});}
 };
 const closeInfo=async()=>{const b=page.getByRole('button',{name:'Close anatomical information',exact:true});if(await b.isVisible())await b.click();await page.mouse.move(0,0);await settle();};
 const select=async id=>{await closeInfo();await page.locator(`[data-structure-id="${id}"]`).click();await page.mouse.move(0,0);await assertColour(id,.22);await settle();};
 for(const part of HEART_PARTS)await select(part.id);
 assert.equal(await progress(),'17');report.checks.push(`All 17 catalogue selections blend red/blue tint at ${VESSEL_HIGHLIGHT_OPACITY*100}% with matching emissive strength; texture IDs, maps, normals, shading and vessel opacity remain intact`);
 const active=page.locator('[data-marker-id="coronary-sinus"]');assert.equal(await active.getAttribute('data-explored'),'true');assert.equal(await active.evaluate(e=>getComputedStyle(e).backgroundColor),'rgb(59, 130, 246)');
 await closeInfo();assert.equal(await active.evaluate(e=>getComputedStyle(e).backgroundColor),'rgb(251, 113, 133)');
 // Dismiss queued milestones so they cannot obstruct the toolbar during checks.
 for(let i=0;i<5;i++){const dismiss=page.getByRole('button',{name:'Dismiss achievement'});if(await dismiss.isVisible()){await dismiss.click();await page.waitForTimeout(230);}}
 await page.getByRole('button',{name:'Hide Markers',exact:true}).click();
 for(const id of ['ascending-aorta','superior-vena-cava']){
  await select(id);await closeInfo();const p=surfaceProbe(id,await frame()),box=await page.locator('canvas').boundingBox();await page.mouse.move(box.x+p.x,box.y+p.y);await assertColour(id,.12);assert.equal(await progress(),'17');
  await page.screenshot({path:`${dir}/hover-${id}.png`});await page.mouse.click(box.x+p.x,box.y+p.y);await page.mouse.move(0,0);await assertColour(id,.22);assert.equal(await page.locator('#detail-title').innerText(),HEART_PARTS.find(p=>p.id===id).name);
 }
 report.checks.push('Actual arterial and venous mesh hover and click work; hover does not add progress; active blue marker returns to explored rose when deselected');
 await page.getByRole('button',{name:'Ask AI Tutor',exact:true}).click();
 for(const name of ['Coronary Sinus','Ascending Aorta']){
  const id=HEART_PARTS.find(p=>p.name===name).id;await page.locator('#tutor-question').fill('Show '+name);await page.locator('#tutor-question').press('Enter');await page.waitForFunction(()=>document.querySelector('.tutor-send')?.textContent==='Send');await assertColour(id,.22);await settle();
 }
 await page.getByRole('button',{name:'Close AI Anatomy Tutor',exact:true}).click();await select('coronary-sinus');
 const isolation=page.getByRole('switch',{name:'Isolate Structure',exact:true});await isolation.click();await page.waitForFunction(()=>JSON.parse(document.querySelector('.scene-surface').dataset.modelMaterials).filter(m=>m.structures.includes('coronary-sinus')).every(m=>m.colors.every(c=>c==='ffffff')));
 for(const mesh of await materials()){assert.deepEqual(mesh.colors,baseline.find(m=>m.name===mesh.name).colors);assert.ok(mesh.materials.every(m=>m.opacity===(mesh.structures.includes('coronary-sinus')?1:.2)));}
 await isolation.click();await assertColour('coronary-sinus',.22);
 report.checks.push('Mocked AI Tutor navigation applies the same colours; isolation preserves original appearance and opacity and restores highlighting when disabled');
 for(const level of ['basic','intermediate','advanced']){const b=levelGroup.getByRole('button',{name:level,exact:true});await b.click();await tooltipFor(b,level);assert.match(await page.locator('.information-overlay').innerText(),new RegExp(level+' Explanation','i'));assert.equal(await progress(),'17');}
 for(const [width,height] of [[1024,768],[390,844],[320,568]]){
  await page.setViewportSize({width,height});const control=levelGroup.getByRole('button',{name:'advanced',exact:true});const anchor=await control.isVisible()?control:levelGroup.getByRole('combobox',{name:'Learning level',exact:true});await page.mouse.move(0,0);await anchor.focus();await tooltipFor(anchor,'advanced');assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await page.screenshot({path:`${dir}/tooltip-${width}.png`});await anchor.evaluate(e=>e.blur());
 }
 const mobile=levelGroup.getByRole('combobox',{name:'Learning level',exact:true});await mobile.focus();await mobile.selectOption('intermediate');await tooltipFor(mobile,'intermediate');assert.equal(await progress(),'17');await mobile.evaluate(e=>e.blur());await page.getByRole('tooltip').waitFor({state:'hidden'});
 await page.setViewportSize({width:1440,height:1000});await page.getByRole('button',{name:'Reset view',exact:true}).click();await page.mouse.move(0,0);await settle();assert.equal(await page.locator('.information-overlay').isVisible(),false);assert.equal(await progress(),'17');
 report.checks.push('Selecting levels still updates anatomical content; mobile dropdown descriptions and resize alignment work without overflow; Reset View preserves exploration');
 assert.deepEqual(report.errors,[]);report.passed=true;
}catch(error){report.failure=error.stack;process.exitCode=1;if(page)await page.screenshot({path:`${dir}/failure.png`}).catch(()=>{});}
finally{fs.writeFileSync(`${dir}/browser-report.json`,JSON.stringify(report,null,2));console.log(JSON.stringify(report));await browser.close();model.dispose();}
