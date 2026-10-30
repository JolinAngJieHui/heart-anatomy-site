import assert from "node:assert/strict";
import { test } from "node:test";
import { load } from "./helpers/load-module.mjs";
const R=load("lib/learning/lesson-review.ts"), S=load("lib/learning/session.ts");
const {generateLessonReview}=load("lib/learning/review-generation.ts"), {createReviewClient}=load("lib/learning/review-client.ts");
const {clearLearningContent}=load("lib/learning/content-cache.ts");
const source={id:"fixture",sourceId:"fixture",title:"TEST ONLY",url:"https://example.org/fixture",section:"Anatomy",documentVersion:"1",materialKind:"reference",available:true,reviewStatus:"approved",externalProcessingAllowed:true};
const catalogue={sources:[source],passages:[{id:"p1",structureId:"coronary-sinus",text:"Synthetic violet test beads.",pattern:"Not anatomical evidence.",sourceId:source.id,documentVersion:"1",title:source.title,url:source.url,section:source.section,levels:["basic","intermediate","advanced"],domain:"anatomy",reviewStatus:"approved"}],gaps:[],mode:"approved-local",generatedAt:"test"};
const base={structures:["coronary-sinus"],questions:[],level:"basic",levels:["basic"]};
const question={id:"q1",question:"What is the function of the coronary sinus?",structureId:"coronary-sinus",level:"basic",reply:{answer:"Synthetic test explanation. It may vary.",sources:[source],mode:"live",status:"supported",evidenceStatus:"verified"}};
const general={...question,id:"q2",question:"Explain a general physiology concept.",reply:{answer:"Synthetic general explanation. It may vary.",sources:[],mode:"live",status:"general_knowledge",evidenceStatus:"unverified",sections:[{kind:"general",text:"Synthetic general explanation. It may vary.",sourceIds:[]}]}};
function selection(input=base, evidence=catalogue, extra={}) {const c=R.reviewChoices(input,evidence);return {introduction:c.introductions[0],closing:c.closings[0],structures:input.structures,questions:input.questions.map(q=>({id:q.id,paragraphIndexes:[]})),takeawayIds:c.candidates.slice(0,4).map(t=>t.id),personalisation:{introduction:"You explored a structure and brought your questions.",closing:"",questions:input.questions.filter(q=>R.verifiedReply(q.reply,evidence)).map(q=>({id:q.id,summary:"Synthetic test explanation; it may vary.",evidenceIds:["p1"]})),takeaways:[{text:"Synthetic violet test beads; not anatomical evidence.",kind:"reference",evidenceIds:["p1"],questionIds:[]}],...extra}};}

test("review generation receives canonical names, actual discussion and all three level instructions",async()=>{
 for(const level of ["basic","intermediate","advanced"]) for(const kind of ["exploration","questions","mixed"]){
  const input={...base,level,questions:kind==="exploration"?[]:kind==="questions"?[question]:[question,general]};let calls=0;
  const original=JSON.stringify(input), proposed=selection(input).personalisation;
  const client={responses:{parse:async(args)=>{calls++;const body=JSON.parse(args.input);assert.equal(body.session.level,level);assert.deepEqual(body.session.explored,[{id:"coronary-sinus",name:"Coronary Sinus"}]);assert.equal(body.session.questions.length,input.questions.length);assert.ok(body.evidence.every(p=>p.sources[0].documentVersion==="1"));
   if(calls===1){assert.match(args.instructions,/Basic uses simple language/);assert.match(args.instructions,/Intermediate uses university-level/);assert.match(args.instructions,/Advanced includes relevant/);assert.match(args.instructions,/NOT verified evidence/);assert.match(args.instructions,/3–5/);assert.equal(args.text.format.schema.properties.takeaways.maxItems,5);return {status:"completed",output_parsed:proposed};}
   assert.match(args.instructions,/kind general takeaways are explicitly unverified/);return {status:"completed",output_parsed:{supported:true,issues:[]}};}}};
  const result=await generateLessonReview(client,"mocked-model",input,catalogue,new AbortController().signal);assert.equal(calls,2);assert.equal(R.applyReviewSelection(input,catalogue,result).takeawayIntroduction,proposed.introduction);assert.equal(JSON.stringify(input),original);
 }
});

test("general takeaways require actual general discussion, zero citations, and preserve provenance in export",async()=>{
 const input={...base,structures:[],questions:[general]}, generalPoint={text:"Synthetic general explanation. It may vary.",kind:"general",evidenceIds:[],questionIds:["q2"]};
 const chosen=selection(input,null,{takeaways:[generalPoint]});
 const review=R.applyReviewSelection(input,null,chosen);assert.equal(review.takeaways[0].kind,"general");assert.deepEqual(review.takeaways[0].sources,[]);
 const summary=load("lib/learning/summary.ts").generateSummary(S.newSession("current","2026-10-22T01:00:00Z"),null,review);assert.match(JSON.stringify(summary.sections.find(s=>s.title==="Key takeaways")),/Not verified against this website/);
 for(const patch of [{evidenceIds:["p1"]},{questionIds:["invented"]},{questionIds:[]},{kind:"reference"}])assert.throws(()=>R.applyReviewSelection(input,null,selection(input,null,{takeaways:[{...generalPoint,...patch}]})));
 let calls=0;await generateLessonReview({responses:{parse:async()=>({status:"completed",output_parsed:++calls===1?chosen.personalisation:{supported:true,issues:[]}})}},"mocked-model",input,null,new AbortController().signal);assert.equal(calls,2);
 assert.throws(()=>R.applyReviewSelection(base,catalogue,selection(base,catalogue,{takeaways:[{text:"Forged citation [R11]",evidenceIds:["p1"]}]})));
});

test("session collection excludes navigation and repetitive events; selected context survives without claiming exploration",()=>{
 const session=S.newSession("current","2026-10-22T01:00:00Z"),event=(type,fields)=>({id:crypto.randomUUID(),at:session.startedAt,type,...fields});
 session.events=[event("card-opened",{structureId:"coronary-sinus",level:"basic"}),event("question-asked",{question:"Pan to LAD",structureId:null,level:"basic"}),event("question-asked",{question:"What does it do?",structureId:"coronary-sinus",level:"basic"})];
 const before=R.collectReviewInput(session,"basic");assert.equal(before.questions.length,1);assert.equal(before.questions[0].structureId,"coronary-sinus");assert.equal("id" in before,false);
 session.events.push(event("card-opened",{structureId:"coronary-sinus",level:"basic"}),event("review-prepared",{reviewVersion:"test",mode:"ai",level:"advanced"}));assert.equal(R.reviewFingerprint(R.collectReviewInput(session,"basic")),R.reviewFingerprint(before));
 assert.equal(R.collectReviewInput(S.newSession("new","2026-10-22T02:00:00Z"),"basic").questions.length,0);
});

test("reviews refresh automatically for new content, level or evidence and reuse unchanged snapshots", async()=>{
 globalThis.sessionStorage={getItem(k){return this[k]??null;},setItem(k,v){this[k]=v;},removeItem(k){delete this[k];}};
 try {
  let calls=0; const fetcher=async(_url,opts)=>{calls++;const input=JSON.parse(opts.body);return Response.json({mode:"ai",selection:selection(input)});};
  const client=createReviewClient(fetcher);
  const get=(input=base,cat=catalogue,id="session-a")=>client.get(input,cat,false,undefined,id);
  await Promise.all([get(),get()]);await get();assert.equal(calls,1);
  const changed={...base,level:"advanced",questions:[question]};
  const updated=await get(changed);assert.equal(updated.input.level,"advanced");assert.equal(calls,2);assert.notEqual(updated.needsUpdate,true);
  await createReviewClient(fetcher).get(changed,catalogue,false,undefined,"session-a");assert.equal(calls,2);
  await get(changed,{...catalogue,passages:[{...catalogue.passages[0],text:"Changed approved text."}]});assert.equal(calls,3);
  await get(base,catalogue,"session-b");assert.equal(calls,4);
  client.clear();clearLearningContent();await get();assert.equal(calls,5);
 } finally {delete globalThis.sessionStorage;}
});

test("empty sessions avoid API, failures are labelled without template takeaways and retry only on request",async()=>{
 let calls=0;const client=createReviewClient(async()=>{calls++;return Response.json({mode:"basic",reason:"unavailable"},{status:503});});
 for(const level of ["basic","intermediate","advanced"])await client.get({...base,structures:[],level},catalogue,false,undefined,"empty");assert.equal(calls,0);
 const failed=await client.get(base,catalogue,false,undefined,"active");assert.equal(failed.retryable,true);assert.deepEqual(failed.review.takeaways,[]);assert.equal(failed.review.mode,"basic");await client.get(base,catalogue,false,undefined,"active");assert.equal(calls,1);await client.get(base,catalogue,true,undefined,"active");assert.equal(calls,2);
});

test("chat no longer requires confirmation but privacy and request protections remain",()=>{
 const {chatRequestSchema}=load("lib/tutor/schema.ts"),{unsafeQuestion}=load("lib/tutor/core.ts");
 assert.equal(chatRequestSchema.safeParse({question:"Explain coronary circulation",learningLevel:"basic",selectedStructureId:null}).success,true);
 assert.equal(unsafeQuestion("Diagnose me; I have chest pain"),true);assert.equal(unsafeQuestion("Email patient@example.org"),true);
 assert.equal(chatRequestSchema.safeParse({question:"Explain coronary circulation",learningLevel:"basic",selectedStructureId:null,apiKey:"not-allowed"}).success,false);
});
