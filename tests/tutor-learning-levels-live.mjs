import fs from "node:fs";
import {createRequire} from "node:module";
import OpenAI from "openai";
import {load} from "./helpers/load-module.mjs";
if(!process.argv.includes("--authorised-live-test"))throw Error("Explicit live-test authorisation required");
createRequire(import.meta.url)("@next/env").loadEnvConfig(process.cwd());
if(process.env.TUTOR_LIVE_ENABLED!=="true" || process.env.TUTOR_MODE!=="live")throw Error("Live tutor must already be enabled");
const followup=process.argv.includes('--partial-followup');
const report=followup?JSON.parse(fs.readFileSync('artifacts/tutor-learning-levels/live-check.json')):{liveAPI:true,syntheticActivity:true,requests:[],calls:[]};
if(report.failure){report.previousFailures??=[];report.previousFailures.push(report.failure);}delete report.failure;delete report.completed;
class ObservedClient extends OpenAI {
 constructor(options){super(options);const create=this.responses.create.bind(this.responses);this.responses.create=async(...args)=>{
  if(report.calls.length>=14)throw Error("Live check call budget reached");
  const call={stage:args[0].text?.format?.name,level:JSON.parse(args[0].input).learningLevel,passages:JSON.parse(args[0].input).passages?.length};report.calls.push(call);
  const response=await create(...args);Object.assign(call,{status:response.status,model:response.model,usage:response.usage});return response;
 };}
}
const {answerTutor}=load("lib/tutor/service.ts",{openai:ObservedClient});
const {chatResponseSchema}=load("lib/tutor/schema.ts");
const cases=[
 ...["basic","intermediate","advanced"].map(level=>({level,coverage:"full",question:"What is the main function of the coronary sinus?"})),
 {level:"intermediate",coverage:"partial",question:"What is the coronary sinus, and how does pacemaker automaticity arise in sinoatrial node cells?"},
 {level:"basic",coverage:"none",question:"What does titin do in cardiac muscle sarcomeres?"},
];
try {
 for(const entry of (followup?[cases[3]]:cases)){
  const started=performance.now(),before=report.calls.length;
  const response=chatResponseSchema.parse(await answerTutor({question:entry.question,selectedStructureId:null,learningLevel:entry.level,privacyConfirmed:true,conversation:[]}));
  report.requests.push({...entry,response,calls:report.calls.length-before,milliseconds:Math.round(performance.now()-started)});
 }
 report.completed=true;
}catch(e){report.failure=e instanceof Error?e.message:"Failed";process.exitCode=1;}
finally{fs.mkdirSync("artifacts/tutor-learning-levels",{recursive:true});fs.writeFileSync("artifacts/tutor-learning-levels/live-check.json",JSON.stringify(report,null,2));console.log(JSON.stringify({completed:report.completed,calls:report.calls.length,results:report.requests.map(r=>({level:r.level,coverage:r.coverage,status:r.response.status,words:r.response.answer.split(/\s+/).length,calls:r.calls,milliseconds:r.milliseconds})),failure:report.failure}));}
