(() => {
"use strict";
const API="https://showmytrades.com/api/public/calendar/v1?impact=high,medium&days=7";
const REFRESH_MS=900000;
const PAIRS=[
{value:"ALL",label:"All tracked pairs",ccy:[]},
{value:"EUR/USD",label:"EUR/USD",ccy:["EUR","USD"]},
{value:"GBP/USD",label:"GBP/USD",ccy:["GBP","USD"]},
{value:"USD/JPY",label:"USD/JPY",ccy:["USD","JPY"]},
{value:"AUD/USD",label:"AUD/USD",ccy:["AUD","USD"]},
{value:"USD/CAD",label:"USD/CAD",ccy:["USD","CAD"]},
{value:"USD/CHF",label:"USD/CHF",ccy:["USD","CHF"]},
{value:"NZD/USD",label:"NZD/USD",ccy:["NZD","USD"]},
{value:"XAU/USD",label:"XAU/USD (Gold)",ccy:["USD"]}
];
const CURRENCIES=["USD","EUR","GBP","JPY","AUD","NZD","CAD","CHF","CNY"];
const state={events:[],lastSuccess:0,serverTime:null,error:"",loading:false,pair:"ALL",impact:"all",before:15,after:15};
const $=id=>document.getElementById(id);
const calendarNow=()=>state.serverTime?state.serverTime+(Date.now()-state.lastSuccess)/1000:Date.now()/1000;
const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const fmt=ts=>new Intl.DateTimeFormat(undefined,{weekday:"short",day:"2-digit",month:"short",hour:"2-digit",minute:"2-digit",timeZoneName:"short"}).format(new Date(ts*1000));
const countdown=s=>{const n=Math.max(0,Math.floor(Math.abs(s))),d=Math.floor(n/86400),h=Math.floor(n%86400/3600),m=Math.floor(n%3600/60);return (s<0?"Released ":"In ")+(d?d+"d ":"")+(h?String(h).padStart(2,"0")+"h ":"")+String(m).padStart(2,"0")+"m";};
const pairsFor=ccy=>PAIRS.filter(p=>p.value!=="ALL"&&p.ccy.includes(ccy)).map(p=>p.label);
const filtered=()=>state.events.filter(e=>(state.impact==="all"||e.impact===state.impact)&&(state.pair==="ALL"||PAIRS.find(p=>p.value===state.pair).ccy.includes(e.currency)));
function eventRisk(e,now){const d=e.ts-now;if(e.impact==="high"&&d>=-state.after*60&&d<=state.before*60)return"ACTIVE";if(e.impact==="high"&&d>state.before*60&&d<=3600)return"SOON";return"";}
function bannerMarkup(){
const now=calendarNow();
const hot=state.events.filter(e=>e.impact==="high"&&eventRisk(e,now)==="ACTIVE").sort((a,b)=>Math.abs(a.ts-now)-Math.abs(b.ts-now))[0];
const next=state.events.filter(e=>e.impact==="high"&&e.ts>=now).sort((a,b)=>a.ts-b.ts)[0];
if(Date.now()-state.lastSuccess>1200000&&state.lastSuccess)return '<div class="news-mini news-stale"><b>NEWS FEED STALE</b><span>Refresh before relying on event warnings.</span></div>';
if(!state.lastSuccess)return '<div class="news-mini news-stale"><b>NEWS FEED NOT VERIFIED</b><span>Connect to the calendar to check event risk.</span></div>';
if(hot)return '<div class="news-mini news-hot"><b>HIGH-IMPACT NEWS WINDOW</b><span>'+esc(hot.currency)+' · '+esc(hot.title)+' · '+countdown(hot.ts-now)+' · '+esc(pairsFor(hot.currency).join(", "))+'</span></div>';
if(next)return '<div class="news-mini"><b>NEXT HIGH-IMPACT EVENT</b><span>'+esc(next.currency)+' · '+esc(next.title)+' · '+countdown(next.ts-now)+'</span></div>';
return '<div class="news-mini"><b>NO HIGH-IMPACT EVENTS IN THE CURRENT WINDOW</b><span>Continue checking the calendar and live market conditions.</span></div>';
}
function render(){
const panel=$("economic-news-centre");if(!panel)return;
const age=state.lastSuccess?Math.floor((Date.now()-state.lastSuccess)/60000):null,status=$("newsFeedStatus");
if(status){status.textContent=state.loading?"Refreshing calendar…":state.lastSuccess?(age>20?"STALE DATA · "+age+"m since last successful update":"LIVE FEED · updated "+age+"m ago"):(state.error?"FEED UNAVAILABLE":"WAITING FOR FIRST UPDATE");status.className="pill "+(state.lastSuccess&&age<=20?"news-ok":"news-warn");}
const clock=$("newsClockNote");if(clock)clock.textContent=state.serverTime?"Calendar server clock: "+new Date(state.serverTime*1000).toLocaleString()+" · Display timezone: "+(Intl.DateTimeFormat().resolvedOptions().timeZone||"device local"):"Times will appear after the first successful feed.";
const rows=$("economicNewsRows");
if(rows){
const events=filtered().sort((a,b)=>a.ts-b.ts);
rows.innerHTML=events.length?events.map(e=>{
const now=calendarNow(),d=e.ts-now,risk=eventRisk(e,now),pairs=pairsFor(e.currency);
return '<tr><td><span class="news-impact '+esc(e.impact)+'">'+esc(e.impact.toUpperCase())+'</span></td><td><b>'+esc(e.currency)+'</b></td><td>'+esc(e.title)+(e.status==="moved"?' <span class="news-moved">MOVED</span>':"")+(e.status==="tentative"?' <span class="news-moved">TENTATIVE</span>':"")+'</td><td>'+esc(fmt(e.ts))+'<div class="news-count">'+esc(countdown(d))+'</div></td><td>'+esc(pairs.join(", ")||"No tracked pair mapping")+'</td><td>'+esc(e.actual||"—")+'</td><td>'+esc(e.forecast||"—")+'</td><td>'+esc(e.previous||"—")+'</td><td>'+(risk==="ACTIVE"?'<span class="news-impact high">NEWS WINDOW</span>':risk==="SOON"?'<span class="news-impact medium">APPROACHING</span>':"—")+'</td></tr>';
}).join(""):'<tr><td colspan="9">'+(state.lastSuccess?"No events match these filters.":"Calendar data is not available yet. Use Refresh to retry.")+'</td></tr>';
const summary=$("newsResultSummary");if(summary)summary.textContent=events.length+" matching events · "+state.events.length+" events received · High and medium impact calendar";
}
const banners=bannerMarkup();["newsHomeBanner","newsForexBanner"].forEach(id=>{const el=$(id);if(el)el.innerHTML=banners;});
const nowForRisk=calendarNow();
const activeCurrencies=[...new Set(state.events.filter(e=>e.impact==="high"&&e.ts-nowForRisk>=-state.after*60&&e.ts-nowForRisk<=state.before*60).map(e=>e.currency))];
const soonCurrencies=[...new Set(state.events.filter(e=>e.impact==="high"&&e.ts-nowForRisk>state.before*60&&e.ts-nowForRisk<=3600).map(e=>e.currency))];
window.dispatchEvent(new CustomEvent("berur-news-risk-update",{detail:{active:activeCurrencies,soon:soonCurrencies,received:!!state.lastSuccess&&Date.now()-state.lastSuccess<=1200000}}));
const syn=$("newsSyntheticNotice");if(syn)syn.textContent="Synthetic Volatility indices (including 1-second indices), Boom and Crash are not mapped to macroeconomic releases. This panel does not apply economic-news blackout warnings to those markets.";
}
async function refresh(){
if(state.loading)return;state.loading=true;state.error="";render();
try{
const response=await fetch(API,{method:"GET",cache:"no-store",headers:{Accept:"application/json"}});
if(!response.ok)throw new Error("Calendar HTTP "+response.status);
const data=await response.json();if(!data||!Array.isArray(data.events))throw new Error("Unexpected calendar response");
state.events=data.events.map(e=>({ts:Number(e.ts),currency:String(e.currency||"").toUpperCase(),impact:String(e.impact||"").toLowerCase(),title:String(e.title||"Untitled event"),actual:String(e.actual||""),forecast:String(e.forecast||""),previous:String(e.previous||""),status:String(e.status||"scheduled"),confidence:String(e.confidence||"")})).filter(e=>Number.isFinite(e.ts)&&CURRENCIES.includes(e.currency)&&["high","medium"].includes(e.impact));
state.serverTime=Number(data.server_time)||Math.floor(Date.now()/1000);state.lastSuccess=Date.now();
}catch(error){state.error=error&&error.message?error.message:"Calendar request failed";}
finally{state.loading=false;render();}
}
function mount(){
const host=$("economic-news-centre");if(!host||host.dataset.ready)return;host.dataset.ready="1";
const pair=$("newsPairFilter"),impact=$("newsImpactFilter"),before=$("newsBefore"),after=$("newsAfter");
if(pair)pair.addEventListener("change",()=>{state.pair=pair.value;render();});
if(impact)impact.addEventListener("change",()=>{state.impact=impact.value;render();});
if(before)before.addEventListener("change",()=>{state.before=Math.max(0,Math.min(180,Number(before.value)||0));render();});
if(after)after.addEventListener("change",()=>{state.after=Math.max(0,Math.min(180,Number(after.value)||0));render();});
const btn=$("newsRefreshBtn");if(btn)btn.addEventListener("click",refresh);
refresh();setInterval(()=>{if(document.visibilityState!=="hidden")refresh();},REFRESH_MS);setInterval(render,15000);
}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",mount);else mount();
})();