(()=>{"use strict";
const MODE="SMART",MARKET_SELECTION="AUTOMATIC";
const $=id=>document.getElementById(id);
let latest={mode:MODE,marketSelection:MARKET_SELECTION,total:0,globalBest:null,familyLeaders:{},riseFallCandidates:[]};
const text=(id,value)=>{const el=$(id);if(el)el.textContent=value;};
const pctScore=x=>Number.isFinite(Number(x))?String(Math.round(Number(x)))+"/100":"—";
function render(data){
 latest={...latest,...(data||{})};
 text("bt-smart-state",latest.globalBest?"RANKED CANDIDATE FOUND":"WAITING FOR QUALIFIED SIGNAL");
 text("bt-smart-contract",latest.globalBest?(latest.globalBest.signal+(latest.globalBest.barrier!==null?" "+latest.globalBest.barrier:"")):"WAIT");
 text("bt-smart-market",latest.globalBest?latest.globalBest.marketName:"WAIT");
 text("bt-smart-score",latest.globalBest?pctScore(latest.globalBest.score):"—");
 text("bt-smart-count",String(Number(latest.total)||0));
 text("bt-smart-reason",latest.globalBest?latest.globalBest.reason:"No contract currently passes the entry evidence checks. The coordinator will continue scanning; no forced selection.");
 const rise=Array.isArray(latest.riseFallCandidates)?latest.riseFallCandidates:[];
 const best=rise[0]||null;
 text("bt-rf-state",best?"QUALIFIED CANDIDATE":"WAITING FOR CONFIRMATION");
 text("bt-rf-market",best?best.marketName:"WAIT");
 text("bt-rf-signal",best?best.signal:"WAIT");
 text("bt-rf-score",best?pctScore(best.score):"—");
 text("bt-rf-sample",best?String(best.sample):"—");
 text("bt-rf-reason",best?best.reason:"Rise/Fall is scanning connected markets. EMA trend, recent direction, directional balance and minimum-sample checks must agree before a candidate is shown.");
 const body=$("bt-rf-market-rows");
 if(body){
  if(!rise.length)body.innerHTML='<tr><td colspan="6">WAIT — no Rise/Fall market currently passes the entry checks.</td></tr>';
  else body.innerHTML=rise.map((x,i)=>'<tr><td>'+(i+1)+'</td><td>'+String(x.marketName||x.symbol)+'</td><td><b>'+String(x.signal)+'</b></td><td>'+pctScore(x.score)+'</td><td>'+String(x.sample||0)+'</td><td>'+String(x.duration||"—")+' ticks</td></tr>').join("");
 }
 const modules=[["CALL","RISE / FALL"],["PUT","RISE / FALL"],["DIGITOVER","OVER / UNDER"],["DIGITUNDER","OVER / UNDER"],["DIGITEVEN","EVEN / ODD"],["DIGITODD","EVEN / ODD"]];
 const registry=$("bt-module-registry");
 if(registry){
  const current=modules.map(([contract,label])=>({contract,label,leader:latest.familyLeaders?.[contract]||null}));
  const counts={};current.forEach(x=>{if(x.leader)counts[x.label]=(counts[x.label]||0)+1;});
  const items=[["RISE / FALL",(counts["RISE / FALL"]||0)>0?"ACTIVE · CANDIDATE FOUND":"ACTIVE · SCANNING"],["OVER / UNDER",(counts["OVER / UNDER"]||0)>0?"ACTIVE · CANDIDATE FOUND":"ACTIVE · SCANNING"],["EVEN / ODD",(counts["EVEN / ODD"]||0)>0?"ACTIVE · CANDIDATE FOUND":"ACTIVE · SCANNING"],["MATCHES / DIFFERS","NEXT MODULE"],["TOUCH / NO TOUCH","NEXT MODULE"],["ENDS IN / OUT","NEXT MODULE"]];
  registry.innerHTML=items.map(x=>'<div class="bt-module-item '+(x[1].startsWith("ACTIVE")?"active":"")+'"><b>'+x[0]+'</b><span>'+x[1]+'</span></div>').join("");
 }
}
window.addEventListener("berur:terminal-scan-update",event=>render(event.detail||{}));
const start=$("bt-start-smart");
if(start)start.addEventListener("click",()=>{
 const button=$("bt-auto");
 if(!button){text("bt-smart-state","EXECUTION DESK NOT READY");return;}
 button.click();
});
const open=(tab)=>{const button=document.querySelector('.app-tabs button[data-tab="'+tab+'"]');if(button)button.click();};
const execution=$("bt-open-execution");if(execution)execution.addEventListener("click",()=>open("execution"));
const radar=$("bt-open-radar");if(radar)radar.addEventListener("click",()=>open("radar"));
window.BERUR_BINARY_TERMINALS=Object.freeze({mode:MODE,marketSelection:MARKET_SELECTION,modules:Object.freeze(["RISE_FALL","OVER_UNDER","EVEN_ODD","MATCH_DIFFERS","TOUCH_NO_TOUCH","ENDS_IN_OUT"]),getSnapshot:()=>({...latest})});
})();