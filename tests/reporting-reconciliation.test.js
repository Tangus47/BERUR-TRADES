import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here=dirname(fileURLToPath(import.meta.url));
const source=readFileSync(join(here,"..","deriv-trader.js"),"utf8");

function extractFunction(name){
 const marker="function "+name+"(";
 const start=source.indexOf(marker);
 assert.ok(start>=0,"missing "+name+" in deriv-trader.js");
 const open=source.indexOf("{",start);
 let depth=0;
 for(let i=open;i<source.length;i++){
  if(source[i]==="{")depth++;
  if(source[i]==="}")depth--;
  if(depth===0)return source.slice(start,i+1);
 }
 throw new Error("unterminated function "+name);
}
function loadFunction(name,context,alias="tested"){
 vm.runInNewContext(extractFunction(name)+";globalThis."+alias+"="+name,context);
 return context[alias];
}

test("duplicate settlement messages cannot increment P/L or trade count twice",()=>{
 const elements={
  "bt-base":{value:"0.35"},"bt-multiplier":{value:"1.5"},
  "bt-steps":{value:"10"},"bt-cap":{value:"10"},"bt-stake":{value:"0.35"}
 };
 const state={dailyTrades:0,dailyPL:0,sessionPL:0,lossStreak:0,settledContractIds:[]};
 const context={
  riskState:state,ensureRiskDay(){},$:id=>elements[id],saveRiskState(){},
  renderRisk(){},riskLimitReason(){return "";},stopAuto(){},say(){},
  Math,Number,String,Array
 };
 const record=loadFunction("recordRiskTrade",context);
 record(1.25,"contract-101");
 record(1.25,"contract-101");
 assert.equal(state.dailyTrades,1);
 assert.equal(state.dailyPL,1.25);
 assert.equal(state.sessionPL,1.25);
 assert.deepEqual(Array.from(state.settledContractIds),["contract-101"]);
});

test("distinct settled contracts each update the risk totals once",()=>{
 const elements={
  "bt-base":{value:"0.35"},"bt-multiplier":{value:"1.5"},
  "bt-steps":{value:"10"},"bt-cap":{value:"10"},"bt-stake":{value:"0.35"}
 };
 const state={dailyTrades:0,dailyPL:0,sessionPL:0,lossStreak:0,settledContractIds:[]};
 const context={
  riskState:state,ensureRiskDay(){},$:id=>elements[id],saveRiskState(){},
  renderRisk(){},riskLimitReason(){return "";},stopAuto(){},say(){},
  Math,Number,String,Array
 };
 const record=loadFunction("recordRiskTrade",context);
 record(1,"contract-A");
 record(-0.4,"contract-B");
 assert.equal(state.dailyTrades,2);
 assert.equal(state.dailyPL,0.6);
 assert.equal(state.sessionPL,0.6);
 assert.equal(state.lossStreak,1);
});

test("DEMO journal rebuilds today's settled count and preserves known contract IDs",()=>{
 const todayStart=new Date().setHours(0,0,0,0);
 const state={dailyTrades:187,settledContractIds:["older-id"]};
 const context={
  account:{account_type:"demo",account_id:"demo-1"},
  riskState:state,
  readJournal:()=>[
   {at:todayStart+1000,contractId:"today-1"},
   {at:todayStart+2000,contractId:"today-2"},
   {at:todayStart-86400000,contractId:"yesterday-1"}
  ],
  Date,Array,String,Number
 };
 loadFunction("syncDemoRiskFromJournal",context)();
 assert.equal(state.dailyTrades,2);
 assert.deepEqual(Array.from(state.settledContractIds),["older-id","today-1","today-2","yesterday-1"]);
});

test("DEMO journal deduplicates a repeated contract ID",()=>{
 const rows=[{contractId:"contract-55",profit:0.5}];
 let saves=0;
 const context={
  account:{account_type:"demo",account_id:"demo-1"},
  readJournal:()=>rows,
  saveJournal(next){saves++;rows.splice(0,rows.length,...next);},
  renderJournal(){},renderSessionReportOptions(){},
  Date,Number,String
 };
 const record=loadFunction("recordDemoResult",context);
 record({accountType:"demo",accountId:"demo-1"},0.5,"won","contract-55");
 assert.equal(rows.length,1);
 assert.equal(saves,0);
});

test("risk panel and connection header display the same session P/L",()=>{
 const ids=["bt-risk-state","bt-risk-reason","bt-risk-pl","bt-pl","bt-risk-daily-pl","bt-risk-trades","bt-risk-streak","bt-buy"];
 const elements=Object.fromEntries(ids.map(id=>[id,{textContent:"",style:{},disabled:false}]));
 const state={sessionPL:2.04,dailyPL:4.81,dailyTrades:149,lossStreak:0};
 const context={
  riskState:state,$:id=>elements[id],ensureRiskDay(){},riskLimitReason(){return "";},
  proposal:null,reconciliationReady:true,readPendingPurchase(){return null;},
  Number,String
 };
 loadFunction("renderRisk",context)();
 assert.equal(elements["bt-risk-pl"].textContent,"2.04");
 assert.equal(elements["bt-pl"].textContent,"2.04");
 assert.equal(elements["bt-risk-daily-pl"].textContent,"4.81");
 assert.equal(elements["bt-risk-trades"].textContent,"149");
});
