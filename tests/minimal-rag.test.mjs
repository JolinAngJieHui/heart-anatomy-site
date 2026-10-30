import assert from "node:assert/strict";
import { test } from "node:test";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { load } from "./helpers/load-module.mjs";
const { loadMinimalCorpus, approvedMinimal } = load("lib/knowledge-base/minimal.ts");
const { selectApproved } = load("lib/knowledge-base/registry.ts");
const { chunkDocument } = load("lib/tutor/retrieval.ts");
const { MinimalRemoteRetrievalProvider } = load("lib/tutor/minimal-remote.ts");
const { metadataHash } = load("lib/knowledge-base/documents.ts");
const { HEART_PARTS } = load("lib/heart-parts.ts");
const corpus = await loadMinimalCorpus(undefined, "minimal-2026-10-14");

test("a pathology mention cannot certify a diagnostic answer or a regardless-of comparison", () => {
  const { questionProfile, passageFit }=load('lib/tutor/question-relevance.ts');
  const source={section:'Synthetic ranking fixture; not article evidence'};
  assert.equal(passageFit(questionProfile('How is proximal RCA obstruction diagnosed?'),'SYNTHETIC TEST ONLY: Proximal RCA occlusion impairs fictional supply.',source).direct,false);
  assert.equal(passageFit(questionProfile('What happens when left main coronary artery flow is impaired?'),'SYNTHETIC TEST ONLY: Regardless of left main coronary artery disease, fictional LAD occlusion causes infarction.',source).direct,false);
});

test("active replacement has a reversible historical backup and never loads its archived chunks", async t => {
  let active;try{active=JSON.parse(await fs.readFile('knowledge-base/active-collection.json','utf8'));}catch(e){if(e.code==='ENOENT'){t.skip('Collection has not been activated');return;}throw e;}
  if(active.id!==corpus.id){t.skip('A different collection is active');return;}
  const backup=path.join('knowledge-base',active.rollback);
  const old=JSON.parse(await fs.readFile(path.join(backup,'registry.json'),'utf8'));
  const rollback=JSON.parse(await fs.readFile(path.join(backup,'rollback.json'),'utf8'));
  assert.equal(old.length,77);assert.equal(rollback.documents.length,27);
  for(const filename of rollback.documents){assert.ok((await fs.stat(path.join(backup,'documents',filename))).isFile());await assert.rejects(fs.access(path.join('knowledge-base',filename)),e=>e.code==='ENOENT');}
  const current=await loadMinimalCorpus();assert.equal(current.documents.length,11);assert.ok(current.corpus.every(d=>/^R(?:[1-9]|10|11)$/.test(d.source.id)));
});

test("minimal corpus has exactly 11 unique source identities, 17 stable labels and 29 assignments", () => {
  assert.deepEqual(new Set(corpus.records.map(r => r.id)), new Set(Array.from({length:11},(_,i)=>`R${i+1}`)));
  assert.equal(corpus.register.vessels.length,17);assert.equal(corpus.records.reduce((n,r)=>n+r.structureIds.length,0),29);
  for(const p of HEART_PARTS){const v=corpus.register.vessels.find(v=>v.structure_id===p.id);assert.equal(v.label,p.name);assert.equal(v.number,p.number);assert.ok(v.source_ids.length>=1&&v.source_ids.length<=2);}
  assert.equal(new Set(corpus.records.map(r=>r.extraction.doi)).size,11);
});

test("scoped real text keeps original locators and excludes the forbidden length, figures, captions and treatment instructions", () => {
  assert.equal(corpus.documents.length,11);assert.ok(corpus.corpus.length>100);
  assert.ok(corpus.corpus.every(p=>p.source.url.startsWith('https://doi.org/')&&p.source.section.includes('/p[')&&p.text.length>=60));
  assert.ok(corpus.corpus.every(p=>!/^abstract|references|figure|caption|table|supplement/i.test(p.source.section)));
  assert.ok(!corpus.corpus.filter(p=>p.source.id==='R1').some(p=>/2\s*(?:to|[-–—])\s*4\s*mm/i.test(p.text)));
  assert.ok(!corpus.corpus.some(p=>/guiding catheter|guidewire|\d+\s*mg\b|\d+[- ]year[- ]old/i.test(p.text)));
  assert.ok(corpus.corpus.filter(p=>p.source.id==='R7').every(p=>/Individual case/.test(p.source.anatomyPattern)));
  assert.ok(corpus.corpus.filter(p=>p.source.id==='R5').some(p=>/limitations/i.test(p.source.section)));
  assert.ok(corpus.corpus.filter(p=>p.source.id==='R2').some(p=>/electrocard|echocard|magnetic resonance/i.test(p.source.section)));
});

test("licence verification and upload authorisation never fabricate scientific approval or quiz eligibility", async () => {
  // Test pending policy on isolated records, independently of subsequent real approvals.
  const pending=corpus.records.map(r=>({...r,status:'pending_review',approvedBy:null,approvalDate:null,approvedVersion:null,approvedSha256:null}));
  assert.deepEqual(selectApproved(pending),[]);assert.ok(pending.every(r=>!approvedMinimal(r)));
  const root=await fs.mkdtemp(path.join(os.tmpdir(),'minimal-pending-'));
  try {
    const dir=path.join(root,'collections',corpus.id);await fs.mkdir(dir,{recursive:true});
    await fs.writeFile(path.join(dir,'registry.json'),JSON.stringify(pending));
    await fs.copyFile(path.join('knowledge-base/collections',corpus.id,'register.json'),path.join(dir,'register.json'));
    const production=await loadMinimalCorpus(root,corpus.id,true);assert.equal(production.documents.length,0);assert.equal(production.excluded.length,11);
  } finally {await fs.rm(root,{recursive:true,force:true});}
  const { questionPool }=load('lib/learning/quiz.ts'); const { newSession,recordCard }=load('lib/learning/session.ts');
  const s=newSession('test-session','2026-10-14T00:00:00Z');s.events=[recordCard('coronary-sinus','basic')];
  assert.deepEqual(questionPool(s,[{id:'test',structureId:'coronary-sinus',levels:['basic'],reviewStatus:'pending_review'}],'basic'),[]);
});

test("content tampering fails closed before retrieval", async () => {
  const root=await fs.mkdtemp(path.join(os.tmpdir(),'minimal-integrity-'));
  try{
    await fs.mkdir(path.join(root,'collections',corpus.id),{recursive:true});
    for(const name of ['registry.json','register.json'])await fs.copyFile(path.join('knowledge-base/collections',corpus.id,name),path.join(root,'collections',corpus.id,name));
    for(const d of corpus.documents){const target=path.join(root,d.source.documentPath);await fs.mkdir(path.dirname(target),{recursive:true});await fs.writeFile(target,d.bytes);}
    await fs.appendFile(path.join(root,corpus.documents[0].source.documentPath),'tampered');
    await assert.rejects(loadMinimalCorpus(root,corpus.id),/Stale extraction/);
  }finally{await fs.rm(root,{recursive:true,force:true});}
});

test("paragraph passage identity is repeatable and explicit vessels outrank unrelated selected labels", async () => {
  assert.deepEqual(corpus.corpus.flatMap(chunkDocument),corpus.corpus.flatMap(chunkDocument));
  const p=await corpus.provider.retrieve({question:'Where does the coronary sinus drain?',selectedStructureId:'right-coronary-proximal'},AbortSignal.timeout(5000));
  assert.ok(p.length);assert.equal(p[0].source.id,'R11');assert.ok(p.every(p=>/^R(?:[1-9]|10|11)$/.test(p.source.id)));
  assert.deepEqual(await corpus.provider.retrieve({question:'lunarbotany unmatchedxyz',selectedStructureId:'coronary-sinus'},AbortSignal.timeout(5000)),[]);
});

test("remote candidate selection rejects old file IDs, stale attributes and production use of pending text", async () => {
  const original=corpus.documents.find(d=>d.source.id==='R11');
  const source={...original.source,status:'pending_review',approvedBy:null,approvalDate:null,approvedVersion:null,approvedSha256:null};
  const d={...original,source,metadataHash:metadataHash(source)},unit={...corpus.corpus.find(p=>p.source.id==='R11'&&/drain/i.test(p.text))};
  unit.source={...unit.source,reviewStatus:'pending_review'};
  const entry={sourceId:'R11',fileId:'file-review-fixture',hash:d.hash,metadataHash:metadataHash(d.source),documentVersion:d.version};
  let rows=[{file_id:entry.fileId,score:.9,attributes:{source_id:'R11',collection_id:corpus.id,version:d.hash,metadata_hash:d.metadataHash,review_status:'pending_review'},content:[{type:'text',text:unit.text}]}];let calls=0;
  const client={vectorStores:{search:async()=>{calls++;return{data:rows}}}};
  const make=phase=>new MinimalRemoteRetrievalProvider(client,{vectorStoreId:'vs-isolated-fixture',documents:[entry]},[d],[unit],phase);
  const q={question:'Where does the coronary sinus drain?',selectedStructureId:null};
  assert.ok((await make('review').retrieve(q,AbortSignal.timeout(5000))).length);
  rows=[{...rows[0],file_id:'old-only-file'}];assert.deepEqual(await make('review').retrieve(q,AbortSignal.timeout(5000)),[]);
  const before=calls;assert.deepEqual(await make('production').retrieve(q,AbortSignal.timeout(5000)),[]);assert.equal(calls,before);
});
