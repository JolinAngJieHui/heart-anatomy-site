import fs from "node:fs/promises";
import { loadTypeScript } from "./load-typescript.mjs";
const { loadMinimalCorpus }=loadTypeScript('lib/knowledge-base/minimal.ts');
const { HEART_PARTS }=loadTypeScript('lib/heart-parts.ts');
const candidate=process.argv.includes('--candidate');
const c=await loadMinimalCorpus(undefined,candidate?'minimal-2026-10-14':undefined);
const base=process.argv.find(a=>a.startsWith('http://'))??'http://localhost:3000';
if(!/^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(base))throw new Error('Use a local development server URL');
const report={collectionId:c.id,collectionVersion:c.collectionVersion,localRoute:true,remoteApiTested:false,sourceProbes:[],sourceRouteProbes:[],comparisons:[],vessels:[],negative:[],errors:[]};
const queries={R1:'Where does the right coronary artery arise?',R2:'What is the right marginal artery blood supply?',R3:'What does the left main coronary artery supply?',R4:'How is coronary artery disease diagnosed with CCTA?',R5:'What happens when diagonal branch flow is impaired?',R6:'Where is the LCx located?',R7:'What is rare about conus artery occlusion?',R8:'Where is the ascending aorta located?',R9:'What are the consequences of ascending aorta thrombus?',R10:'How is superior vena cava obstruction investigated?',R11:'Where does the coronary sinus drain?'};
for(const source of c.records){
  let query=queries[source.id],passages=await c.provider.retrieve({question:query,selectedStructureId:null},AbortSignal.timeout(5000));
  if(!passages.some(p=>p.source.id===source.id))for(const unit of c.corpus.filter(p=>p.source.id===source.id)){query=unit.text.slice(0,1000);passages=await c.provider.retrieve({question:query,selectedStructureId:null},AbortSignal.timeout(5000));if(passages.some(p=>p.source.id===source.id))break;}
  report.sourceProbes.push({sourceId:source.id,query,pass:passages.some(p=>p.source.id===source.id),passages:passages.filter(p=>p.source.id===source.id).map(p=>({id:p.id,section:p.source.section,direct:p.relevance.answerFit.direct,text:p.text}))});
}
if(candidate){console.log(JSON.stringify(report.sourceProbes.map(p=>({id:p.sourceId,pass:p.pass})),null,2));if(report.sourceProbes.some(p=>!p.pass))process.exitCode=1;else process.exit(0);}
async function post(question,id,level='basic'){
 await new Promise(resolve=>setTimeout(resolve,1100)); // Respect the existing 60/minute test-server ceiling.
 const response=await fetch(base+'/api/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({question,selectedStructureId:id,learningLevel:level,privacyConfirmed:true,conversation:[]})});
 const data=await response.json();
 if(!response.ok||data.collectionId!==c.id||data.collectionVersion!==c.collectionVersion||data.mode!=='review')throw new Error('Chat route did not use this development collection: '+response.status);
 if(data.sources.some(s=>!c.records.some(r=>r.id===s.sourceId&&r.location===s.url))||(data.retrieval??[]).some(p=>!c.records.some(r=>r.id===p.sourceId)))throw new Error('Old-only or invented citation');
 return{question,status:data.status,answer:data.answer,sources:data.sources,retrieval:data.retrieval??[],scientificApproval:false};
}
for(const part of HEART_PARTS){
 const results=[];
 for(const [kind,question,level] of [['anatomy',`Where is ${part.name} located?`,'basic'],['impaired-flow',`What happens when blood flow in ${part.name} is impaired?`,'intermediate'],['diagnostic',`How is ${part.name} obstruction diagnosed?`,'advanced']]){
  try{const r=await post(question,part.id,level);results.push({kind,...r,outcome:r.status==='review'?'direct text candidate; scientific review required':'documented evidence gap'});}catch(e){report.errors.push({id:part.id,kind,error:e.message});}
 }
 report.vessels.push({number:part.number,id:part.id,name:part.name,limitation:c.register.vessels.find(v=>v.structure_id===part.id).limitation,results});
}
for(const [question,id] of [['Where does the SVC drain?','right-coronary-proximal'],['What is the ECG diagnosis of isolated D2 occlusion?','left-diagonal-d2'],['What is the lunarbotany mechanism?','coronary-sinus']]){
 try{report.negative.push(await post(question,id));}catch(e){report.errors.push({question,error:e.message});}
}
const evidence=await fetch(base+'/api/learning/evidence').then(r=>r.json());
for(const source of c.records){
 let response=await post(queries[source.id],null);
 if(!response.sources.some(s=>s.sourceId===source.id))for(const unit of c.corpus.filter(p=>p.source.id===source.id)){response=await post(unit.text.slice(0,1000),null);if(response.sources.some(s=>s.sourceId===source.id))break;}
 report.sourceRouteProbes.push({sourceId:source.id,pass:response.sources.some(s=>s.sourceId===source.id),...response});
}
for(const question of ['What determines coronary dominance?','What does pRCA supply?','Where does CS drain?','Compare the origins of RCA and LCx','What is the difference between proximal and distal RCA?'])report.comparisons.push(await post(question,null));
report.learningEvidence={mode:evidence.mode,sources:evidence.sources?.map(s=>s.id),passages:evidence.passages?.length,gaps:evidence.gaps};
if(evidence.sources?.some(s=>!c.records.some(r=>r.id===s.id)))report.errors.push({error:'Lesson evidence includes superseded source'});
report.passed=report.errors.length===0&&report.sourceProbes.every(p=>p.pass)&&report.sourceRouteProbes.every(p=>p.pass)&&report.negative[0]?.sources.some(s=>s.sourceId==='R10')&&report.negative[1]?.status==='insufficient_evidence'&&report.negative[2]?.status==='insufficient_evidence';
await fs.writeFile('docs/rag/minimal-chat-verification.json',JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({passed:report.passed,sourceProbes:report.sourceRouteProbes.map(p=>({id:p.sourceId,pass:p.pass})),documentedRouteResults:report.vessels.reduce((n,v)=>n+v.results.length,0)+report.negative.length+report.sourceRouteProbes.length+report.comparisons.length,documentedGaps:report.vessels.flatMap(v=>v.results).filter(r=>r.status==='insufficient_evidence').length,errors:report.errors},null,2));
if(!report.passed)process.exitCode=1;
