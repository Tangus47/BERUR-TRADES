import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here=dirname(fileURLToPath(import.meta.url));
const source=readFileSync(join(here,"..","adaptive-market-selection.js"),"utf8");
function selector(){
 const window={};
 vm.runInNewContext(source,{window,Date,Map,Math,Number,String,Array});
 return window.BERURAdaptiveMarketSelector;
}
function candidate(symbol,{age=0,strength=4.5,sample=500,liveTickCount=10,contract="DIGITOVER",ticks}={}){
 const quotes=ticks||Array.from({length:30},(_,i)=>String(500+i/100));
 return {symbol,market:{updated:100000-age,ticks:quotes,liveTickCount},
  analysis:{n:sample},setup:{signal:"OVER 3",contract,strength,score:90,sample}};
}
test("ranks fresh candidates and attaches adaptive reasons",()=>{
 const rank=selector().rank([candidate("A"),candidate("B",{strength:3})],100000);
 assert.equal(rank.length,2);
 assert.equal(rank[0].symbol,"A");
 assert.equal(typeof rank[0].adaptiveScore,"number");
 assert.match(rank[0].adaptiveMeta.reason,/evidence/);
});
test("returns no candidate when every feed is stale",()=>{
 const rank=selector().rank([candidate("A",{age:21000})],100000);
 assert.equal(rank.length,0);
});
test("returns no candidate with fewer than ten distinct recent quotes",()=>{
 const rank=selector().rank([candidate("A",{ticks:Array(30).fill("500.1")})],100000);
 assert.equal(rank.length,0);
});
test("retains the previous leader when a challenger is within six points",()=>{
 const rank=selector();
 const first=rank.rank([candidate("A",{strength:4.5}),candidate("B",{strength:4.0})],100000);
 assert.equal(first[0].symbol,"A");
 const second=rank.rank([candidate("B",{strength:4.1}),candidate("A",{strength:4.5})],100001);
 assert.equal(second[0].symbol,"A");
});
test("switches when a new candidate clearly outranks the previous leader",()=>{
 const rank=selector();
 rank.rank([candidate("A",{strength:3.5}),candidate("B",{strength:3.0})],100000);
 const next=rank.rank([candidate("A",{strength:3.5}),candidate("B",{strength:6.5})],100001);
 assert.equal(next[0].symbol,"B");
});
test("accepts a fresh directional candidate with its lower sample threshold",()=>{
 const c=candidate("CALL",{strength:75,sample:120,contract:"CALL"});
 const rank=selector().rank([c],100000);
 assert.equal(rank.length,1);
 assert.equal(rank[0].symbol,"CALL");
});


test("production page loads the adaptive selector before the inline app code",()=>{
 const page=readFileSync(join(here,"..","index.html"),"utf8");
 assert.match(page,/<script src="\.\/adaptive-market-selection\.js\?v=20261106-adaptive-1"><\/script>/);
 assert.match(page,/BERURAdaptiveMarketSelector\?\.rank\(candidates,now\)/);
});
test("adaptive score is not passed into the existing signal validity guard",()=>{
 const page=readFileSync(join(here,"..","index.html"),"utf8");
 assert.match(page,/refreshSignalValidity\(chosen\.setup\.signal,chosen\.setup\.score,/);
 assert.doesNotMatch(page,/refreshSignalValidity\(chosen\.setup\.signal,chosen\.adaptiveScore,/);
});


test("all inline JavaScript blocks in index.html parse without syntax errors",()=>{
 const page=readFileSync(join(here,"..","index.html"),"utf8");
 const blocks=[...page.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)]
  .map(match=>match[1]).filter(code=>code.trim());
 assert.ok(blocks.length>0,"expected inline JavaScript blocks");
 for(const [index,code] of blocks.entries()){
  assert.doesNotThrow(()=>new vm.Script(code,{filename:"index-inline-"+index+".js"}));
 }
});

test("isolated preview defaults to the dedicated preview Worker",()=>{
 const trader=readFileSync(join(here,"..","deriv-trader.js"),"utf8");
 assert.match(trader,/const ISOLATED_PREVIEW=location\.hostname\.endsWith\("\.pages\.dev"\)/);
 assert.match(trader,/const WORKER=ISOLATED_PREVIEW\?PREVIEW_WORKER:/);
});

test("isolated preview exposes DEMO accounts only",()=>{
 const trader=readFileSync(join(here,"..","deriv-trader.js"),"utf8");
 assert.match(trader,/receivedAccounts\.filter\(a=>a\.account_type===\"demo\"\)/);
});

test("isolated preview blocks REAL account connection and purchases",()=>{
 const trader=readFileSync(join(here,"..","deriv-trader.js"),"utf8");
 assert.match(trader,/ISOLATED_PREVIEW&&account\.account_type!==\"demo\"/);
 assert.match(trader,/Isolated preview is DEMO-only\. REAL-money purchases are blocked\./);
});

test("automatic execution remains DEMO-only outside preview as well",()=>{
 const trader=readFileSync(join(here,"..","deriv-trader.js"),"utf8");
 assert.match(trader,/function startAuto\(\)\{if\(!account\|\|account\.account_type!==\"demo\"\)/);
});

test("execution desk JavaScript parses without syntax errors",()=>{
 const trader=readFileSync(join(here,"..","deriv-trader.js"),"utf8");
 assert.doesNotThrow(()=>new vm.Script(trader,{filename:"deriv-trader.js"}));
});

test("purchase requires broker reconciliation, fresh quote context and risk clearance",()=>{
 const trader=readFileSync(join(here,"..","deriv-trader.js"),"utf8");
 const start=trader.indexOf("function buy(){");
 const end=trader.indexOf("\\nfunction ",start+1);
 assert.ok(start>=0&&end>start,"expected a standalone buy function");
 const buyBody=trader.slice(start,end);
 assert.match(buyBody,/!reconciliationReady\|\|readPendingPurchase\(\)/);
 assert.match(buyBody,/!quoteContextMatches\(\)/);
 assert.match(buyBody,/const blocked=riskLimitReason\(\);if\(blocked\)/);
 assert.match(buyBody,/openContracts\.size>=maxOpenTrades\(\)/);
});

test("persistent uncertain-purchase lock is saved before Deriv buy request",()=>{
 const trader=readFileSync(join(here,"..","deriv-trader.js"),"utf8");
 const lock=trader.indexOf("savePendingPurchase({submittedAt:Date.now()");
 const send=trader.indexOf("send({buy:proposal.id,price:ask})");
 assert.ok(lock>=0&&send>lock,"purchase safety lock must be persisted before sending buy");
});
