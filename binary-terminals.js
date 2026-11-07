(()=>{"use strict";
const MODE="SMART",MARKET_SELECTION="AUTOMATIC";
const $=id=>document.getElementById(id);
let latest={mode:MODE,marketSelection:MARKET_SELECTION,total:0,globalBest:null,familyLeaders:{},riseFallCandidates:[],riseFallWatch:[]};
const text=(id,value)=>{const el=$(id);if(el)el.textContent=value;};
const pctScore=x=>x===null||x===undefined||x===""?"—":Number.isFinite(Number(x))?String(Math.round(Number(x)))+"/100":"—";
function render(data){
 latest={...latest,...(data||{})};
 text("bt-smart-state",latest.globalBest?"RANKED CANDIDATE FOUND":"WAITING FOR QUALIFIED SIGNAL");
 text("bt-smart-contract",latest.globalBest?(latest.globalBest.signal+(latest.globalBest.barrier!==null?" "+latest.globalBest.barrier:"")):"WAIT");
 text("bt-smart-market",latest.globalBest?latest.globalBest.marketName:"WAIT");
 text("bt-smart-score",latest.globalBest?pctScore(latest.globalBest.score):"—");
 text("bt-smart-count",String(Number(latest.total)||0));
 text("bt-smart-reason",latest.globalBest?latest.globalBest.reason:"No contract currently passes the entry evidence checks. The coordinator will continue scanning; no forced selection.");
 const rise=Array.isArray(latest.riseFallCandidates)?latest.riseFallCandidates:[];
 const watch=Array.isArray(latest.riseFallWatch)?latest.riseFallWatch:rise;
 const best=rise[0]||watch[0]||null,qualified=!!rise[0],mtf=best&&best.mtf?best.mtf:null;
 text("bt-rf-state",qualified?"QUALIFIED · 4 TIMEFRAMES":mtf&&mtf.ready?"ANALYSIS READY · WAIT":"WAITING FOR CANDLE HISTORY");
 text("bt-rf-market",best?best.marketName:"WAIT");
 text("bt-rf-signal",qualified?best.signal:"WAIT");
 text("bt-rf-score",qualified?pctScore(best.score):"—");
 text("bt-rf-sample",mtf?String(mtf.count)+" candles":"—");
 text("bt-rf-reason",best?mtf.reason:"Rise/Fall waits for fresh 1M, 5M, 15M and 1H broker candles, EMA 10/25 alignment, RSI 14 and a completed-candle confirmation.");
 const tfRoot=$("bt-rf-timeframes"),confirm=$("bt-rf-confirmation");
 if(tfRoot){
  const frames=[["1M","1M"],["5M","5M"],["15M","15M"],["1H","1H"]];
  tfRoot.innerHTML=frames.map(([label,key])=>{const v=mtf&&mtf.values?mtf.values[key]:null,trend=v&&v.ready?v.trend:"WAIT",cls=trend==="RISE"?"trend-rise":trend==="FALL"?"trend-fall":"";return '<div class="bt-mtf-cell"><b>'+label+' · <span class="'+cls+'">'+trend+'</span></b><small>EMA10 '+(v&&v.ema10!==null?Number(v.ema10).toPrecision(7):"—")+' / EMA25 '+(v&&v.ema25!==null?Number(v.ema25).toPrecision(7):"—")+'</small><small>RSI14 '+(v&&v.rsi!==null?Number(v.rsi).toFixed(1):"—")+' · '+(v?v.count:0)+' closed candles</small><small>'+((v&&v.pattern)||"No pattern")+'</small><small>S '+(v&&v.support!==null&&v.support!==undefined?Number(v.support).toPrecision(7):"—")+' · R '+(v&&v.resistance!==null&&v.resistance!==undefined?Number(v.resistance).toPrecision(7):"—")+'</small></div>';}).join("");
 }
 if(confirm)confirm.textContent=mtf&&qualified?("CONFIRMED "+best.signal+" · "+(mtf.pattern||"Candle confirmation")+" · 1M RSI "+(mtf.entryRsi===null?"—":Number(mtf.entryRsi).toFixed(1))+" · all four timeframe trends aligned. "+mtf.reason):"EMA 10/25 · RSI 14 · engulfing/pin-bar/hammer/doji/star patterns · strong candle body/wick validation · multi-timeframe alignment. WAIT when data is missing or conflicting.";
 const body=$("bt-rf-market-rows");
 if(body){
  if(!watch.length)body.innerHTML='<tr><td colspan="7">WAIT — collecting broker OHLC candle history for all connected markets.</td></tr>';
  else body.innerHTML=watch.map((x,i)=>{const m=x.mtf||{},v=m.values||{},ok=!!m.qualified;return '<tr><td>'+(i+1)+'</td><td>'+String(x.marketName||x.symbol)+'</td><td><b>'+(ok?String(x.signal):"WAIT") +'</b></td><td>'+(ok?pctScore(x.score):"—") +'</td><td>'+String(m.pattern||"—")+' · RSI '+(m.entryRsi===null||m.entryRsi===undefined?"—":Number(m.entryRsi).toFixed(1))+'</td><td>'+["1M","5M","15M","1H"].map(k=>String(v[k]?.count||0)).join("/")+'</td><td>'+(ok?String(x.duration||"—")+" "+String(x.duration_unit||"ticks"):"—") +'</td></tr>';}).join("");
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