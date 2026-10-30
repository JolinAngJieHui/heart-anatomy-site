import assert from "node:assert/strict";
import { test } from "node:test";
import fs from "node:fs";
import * as three from "three";
import { load } from "./helpers/load-module.mjs";
import { scanGeometry } from "./helpers/scan-geometry.mjs";
const R = load("lib/learning/lesson-review.ts"), V = load("lib/learning/review-snapshot.ts");
const { validateGeneratedQuiz } = load("lib/learning/generated-quiz.ts");
const { permittedEvidence } = load("lib/learning/evidence.ts");
const catalogue = permittedEvidence(await load("lib/learning/evidence-server.ts").loadLearningEvidence());
const input = { structures:["coronary-sinus","left-circumflex-artery"], level:"basic", levels:["basic"], questions:[] };
const qi = { level:"basic",count:5,structures:input.structures,reviewed:[],topics:[],results:[],review:V.createReviewSnapshot(input,null,catalogue) };
const evidenceId = load("lib/learning/quiz-evidence.ts").retrieveQuizEvidence(qi,catalogue).find(p => p.structureId === "coronary-sinus").key;
const q = { structureId:"coronary-sinus",kind:"identify-vessel",prompt:"Which vessel is highlighted?",concept:"Vessel identification",options:[{id:"coronary-sinus",structureId:"coronary-sinus",label:"Coronary Sinus"},{id:"ascending-aorta",structureId:"ascending-aorta",label:"Ascending Aorta"},{id:"superior-vena-cava",structureId:"superior-vena-cava",label:"Superior Vena Cava"}],correctAnswer:"coronary-sinus",explanation:"TEST FIXTURE: review this structure.",evidenceIds:[evidenceId] };
const five = item => Array.from({length:5},(_,i)=>({...item,prompt:item.prompt+" TEST FIXTURE "+i,concept:item.concept+" TEST "+i}));

test("generated quiz validates stable IDs, keys, source versions, distinct choices and actual session scope", () => {
 assert.equal(validateGeneratedQuiz(qi,catalogue,{questions:five(q)})[0].correctAnswer,"coronary-sinus");
 for(const patch of [{structureId:"ascending-aorta"},{correctAnswer:"D"},{evidenceIds:["invented"]},{options:[q.options[0],q.options[0],q.options[2]]},{options:[{...q.options[0],label:"Ascending Aorta"},...q.options.slice(1)]}]) assert.throws(() => validateGeneratedQuiz(qi,catalogue,{questions:five({...q,...patch})}));
 assert.throws(() => validateGeneratedQuiz(qi,{...catalogue,passages:[]},{questions:five(q)}));
});
test("equivalent vessel names cannot become distinct MCQ options", () => {
 assert.throws(() => validateGeneratedQuiz(qi,catalogue,{questions:[{...q,kind:"multiple-choice",options:[{id:"a",label:"Coronary Sinus",structureId:null},{id:"b",label:"CS",structureId:null},{id:"c",label:"Ascending Aorta",structureId:null}],correctAnswer:"a"}]}));
});
test("whole RCA highlight never claims a particular segment, while numbered location remains valid", () => {
 const study={...input,structures:["right-coronary-proximal"]}; const request={...qi,review:V.createReviewSnapshot(study,null,catalogue)};
 const passage=R.lessonEvidence(study,catalogue)[0]; assert.ok(passage);
 const item={...q,structureId:"right-coronary-proximal",correctAnswer:"right-coronary-proximal",options:[{id:"right-coronary-proximal",structureId:"right-coronary-proximal",label:"Right Coronary Artery (Proximal)"},...q.options.slice(1)],evidenceIds:[passage.key]};
 assert.throws(() => validateGeneratedQuiz(request,catalogue,{questions:five(item)}));
 assert.equal(validateGeneratedQuiz(request,catalogue,{questions:five({...item,kind:"locate-vessel"})}).length,5);
});
test("substantive discussion expands teaching scope without fabricating explored structures", () => {
 const study={...input,structures:["coronary-sinus"],questions:[{id:"q",question:"What does the LAD supply?",level:"basic",reply:null}]};
 assert.ok(R.lessonScope(study).includes("left-anterior-descending-proximal"));
 assert.deepEqual(R.basicReview(study,catalogue).structures,["coronary-sinus"]);
});
test("API audit rejection fails closed without regeneration loops", async () => {
 const {generateQuizSelection}=load("lib/learning/quiz-generation.ts"); let calls=0;
 await assert.rejects(generateQuizSelection({responses:{parse:async () => ({status:"completed",output_parsed:++calls===1?{questions:five(q)}:{questions:[{index:0,supported:false,issues:["Unsupported answer"]}]}})}},"mocked-model",qi,[],new AbortController().signal,catalogue));
 assert.ok(calls<=4);
});
test("every production anchor has a reachable occlusion-tested viewpoint without altering the scan", async () => {
 const config=JSON.parse(fs.readFileSync("public/models/heart-model.json")); const {root}=await scanGeometry(`public${config.url}`);
 const model=load("lib/imported-model.ts",{three}).prepareImportedModel(root,config);
 const {vesselView}=load("lib/vessel-navigation.ts",{three}); const {MarkerVisibility}=load("lib/marker-visibility.ts",{three});
 const camera=new three.PerspectiveCamera(40,1.4,.1,100);camera.position.set(0,0,-6);camera.lookAt(0,.2,0);
 const layout={revision:1,viewport:{x:0,y:0,width:1000,height:714},obstacles:[{x:630,y:10,width:360,height:694}],cardOpen:true,tutorOpen:false};
 const failed=[]; const timings=[];
 for(const [id,entry] of model.registry){ const start=performance.now(),pose=vesselView(camera,model.container,model.registry,id,layout); timings.push(performance.now()-start); if(!pose){failed.push(id);continue;} camera.quaternion.copy(pose.rotation);camera.position.set(0,0,pose.distance).applyQuaternion(pose.rotation).add(pose.target);camera.updateMatrixWorld();assert.equal(new MarkerVisibility().update(camera,model.container,new Map([[id,entry]])).get(id).visible,true,id); }
 fs.mkdirSync("artifacts/navigation-learning",{recursive:true}); fs.writeFileSync("artifacts/navigation-learning/geometry-navigation.json",JSON.stringify({failed,queries:timings.length,maxMs:Math.max(...timings),medianMs:timings.sort((a,b)=>a-b)[8]},null,2));
 model.dispose();assert.deepEqual(failed,[]);
});

test("explorer navigation preserves zoom and pivot while exposing all 17 anchors at the clear-area centre", async () => {
 const config=JSON.parse(fs.readFileSync("public/models/heart-model.json")); const {root}=await scanGeometry(`public${config.url}`);
 const model=load("lib/imported-model.ts",{three}).prepareImportedModel(root,config);
 const {vesselView}=load("lib/vessel-navigation.ts",{three}),{MarkerVisibility}=load("lib/marker-visibility.ts",{three});
 const {applyHeartPan}=load("lib/free-heart-camera.ts",{three}),{planFraming}=load("lib/panel-framing.ts");
 const {modelScreenBounds}=load("lib/model-screen-bounds.ts",{three});
 const target=new three.Vector3(-.002052616,.048079248,.059062299);
 const layouts=[
  {viewport:{x:0,y:0,width:1300,height:658},obstacles:[{x:800,y:12,width:480,height:634}]},
  {viewport:{x:0,y:0,width:380,height:660},obstacles:[{x:10,y:360,width:360,height:290}]},
 ];
 try { for(const distance of [1.6,3.72227,7]) for(const zoom of [1,1.35]) for(const l of layouts){
  const camera=new three.PerspectiveCamera(40,l.viewport.width/l.viewport.height,.1,100); camera.zoom=zoom;
  camera.position.set(0,0,-distance).add(target);camera.lookAt(target);camera.updateProjectionMatrix();
  const layout={revision:1,cardOpen:true,tutorOpen:false,...l};
  for(const [id,entry] of model.registry){
   const label=`${id}, distance ${distance}, zoom ${zoom}, width ${l.viewport.width}`;
   const pose=vesselView(camera,model.container,model.registry,id,layout,{target,distance,zoom});assert.ok(pose,label);
   assert.equal(pose.distance,distance,label);assert.equal(pose.zoom,zoom,label);assert.deepEqual(pose.target.toArray(),target.toArray(),label);
   camera.quaternion.copy(pose.rotation);camera.position.set(0,0,distance).applyQuaternion(pose.rotation).add(target);camera.clearViewOffset();camera.updateMatrixWorld(true);
   const bounds=modelScreenBounds(model.container,camera,l.viewport.width,l.viewport.height);assert.ok(bounds,`Bounds available: ${label}`);
   const anchor=entry.anchorObject.localToWorld(new three.Vector3(...entry.anchor)).project(camera);
   const plan=planFraming({...l,model:bounds,marker:{x:(anchor.x+1)*l.viewport.width/2,y:(1-anchor.y)*l.viewport.height/2}});
   applyHeartPan(camera,plan,l.viewport.width,l.viewport.height);
   const result=new MarkerVisibility().update(camera,model.container,new Map([[id,entry]])).get(id);
   assert.equal(result.visible,true,label);
   assert.ok(Math.abs((result.projected.x+1)*l.viewport.width/2-plan.region.x-plan.region.width/2)<1e-6,label);
   assert.ok(Math.abs((1-result.projected.y)*l.viewport.height/2-plan.region.y-plan.region.height/2)<1e-6,label);
  }
 }} finally {model.dispose();}
});


test("CS abbreviation and source headings retain the exact function passage used by the tutor", () => {
 const p=catalogue.passages.find(p=>p.sourceId==="R11" && p.structureId==="coronary-sinus" && p.section.includes("Sec2/p[2]"));
 assert.ok(p, "The actual drainage passage must be present, not only imaging passages");
 const study={structures:["coronary-sinus"],level:"basic",levels:["basic"],questions:[{id:"function",question:"What is its main function?",level:"basic",reply:{mode:"live",status:"supported",evidenceStatus:"verified",answer:"Fixture saved answer",sources:[{...p,materialKind:"reference",passageId:p.id}]}}]};
 const supplied=R.lessonEvidence(study,catalogue);assert.equal(supplied[0].key,p.id);assert.ok(supplied.length<=4);
});


test("generated review snapshots survive JSON property-order changes before quiz generation", () => {
 const choices=R.reviewChoices(input,catalogue),selection={closing:choices.closings[0],introduction:choices.introductions[0],structures:input.structures,questions:[],takeawayIds:choices.candidates.slice(0,4).map(p=>p.id)};
 const snapshot=V.createReviewSnapshot(input,selection,catalogue);
 assert.equal(V.restoreReviewSnapshot(JSON.parse(JSON.stringify(snapshot)),catalogue).mode,"ai");
 assert.throws(()=>V.restoreReviewSnapshot(snapshot,{...catalogue,sources:catalogue.sources.map(s=>({...s,documentVersion:"changed"}))}));
});


test("tab cache survives client recreation, invalidates changed evidence, and clears only application content", async () => {
 const descriptor=Object.getOwnPropertyDescriptor(globalThis,"sessionStorage"),storage={unrelated:"keep"};
 Object.defineProperties(storage,{getItem:{value:k=>storage[k]??null},setItem:{value:(k,v)=>{storage[k]=String(v);}},removeItem:{value:k=>{delete storage[k];}}});
 Object.defineProperty(globalThis,"sessionStorage",{configurable:true,value:storage});
 const C=load("lib/learning/content-cache.ts"),{createReviewClient}=load("lib/learning/review-client.ts");
 const choices=R.reviewChoices(input,catalogue),selection={introduction:choices.introductions[0],closing:choices.closings[0],structures:input.structures,questions:[],takeawayIds:choices.candidates.slice(0,4).map(p=>p.id)};
 let calls=0;const fetcher=async()=>{calls++;return Response.json({mode:"ai",selection});};
 try {
  assert.equal((await createReviewClient(fetcher).get(input,catalogue)).review.mode,"ai");
  assert.equal((await createReviewClient(fetcher).get(input,catalogue)).review.mode,"ai");assert.equal(calls,1);
  await createReviewClient(fetcher).get(input,{...catalogue,sources:catalogue.sources.map(s=>({...s,documentVersion:"changed"}))});assert.equal(calls,2);
  C.clearLearningContent();assert.deepEqual(Object.keys(storage),["unrelated"]);
  let finish;const pending=createReviewClient(()=>new Promise(resolve=>{finish=resolve;}));const promise=pending.get(input,catalogue);pending.clear();C.clearLearningContent();finish(Response.json({mode:"ai",selection}));assert.equal((await promise).review.mode,"basic");assert.deepEqual(Object.keys(storage),["unrelated"]);
 } finally {if(descriptor)Object.defineProperty(globalThis,"sessionStorage",descriptor);else delete globalThis.sessionStorage;}
});

test("explicit repeated update clicks share an in-flight review request", async () => {
 const {createReviewClient}=load("lib/learning/review-client.ts");let calls=0,finish;
 const client=createReviewClient(()=>{calls++;return new Promise(resolve=>{finish=resolve;});});
 const a=client.get(input,catalogue,true),b=client.get(input,catalogue,true);assert.equal(calls,1);finish(Response.json({mode:"basic",reason:"unavailable"}));assert.deepEqual(await a,await b);
});


test("quiz recovery is bounded when a provider keeps returning invalid audit coverage", async () => {
 const {generateQuizSelection}=load("lib/learning/quiz-generation.ts");let calls=0;
 const generated={questions:five(q)};
 await assert.rejects(generateQuizSelection({responses:{parse:async()=>({status:"completed",output_parsed:++calls===1?generated:{questions:Array.from({length:5},(_,index)=>({index,supported:index!==1,issues:index===1?["Outside the session concepts"]:[]}))}})}},"mocked-model",qi,[],new AbortController().signal,catalogue));
 assert.ok(calls<=4);
});
