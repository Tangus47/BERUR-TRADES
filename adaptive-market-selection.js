/* BERUR TRADES adaptive market selector.
 * Ranks candidates only after existing contract-specific statistical gates.
 * It never creates signals or bypasses quote and risk checks.
 */
(()=>{"use strict";
 const state=new Map(); let previousKey="";
 const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));
 const keyOf=c=>String(c.symbol)+"|"+String(c.setup?.contract||"")+"|"+String(c.setup?.signal||"");
 function evaluate(c,now){
  const m=c.market||{},s=c.setup||{},age=Math.max(0,now-(Number(m.updated)||0));
  const direction=s.contract==="CALL"||s.contract==="PUT",minSample=direction?120:300;
  const sample=Number(s.sample||c.analysis?.n||0),sampleScore=clamp(sample/minSample,0,1)*100;
  const evidence=direction?clamp((Number(s.score||0)-60)/40*100,0,100):clamp((Number(s.strength||0)-2)/2.5*100,0,100);
  const freshness=clamp(1-age/20000,0,1)*100;
  const ticks=Array.isArray(m.ticks)?m.ticks.slice(-30).map(Number).filter(Number.isFinite):[];
  const distinct=new Set(ticks.map(v=>v.toPrecision(12))).size,liveChanges=Number(m.liveTickCount)||0;
  const mean=ticks.length?ticks.reduce((a,b)=>a+b,0)/ticks.length:0;
  const range=ticks.length>1?(Math.max(...ticks)-Math.min(...ticks))/(Math.abs(mean)||1)*10000:0;
  const volatilityScore=clamp(100-Math.max(0,range-18)*1.5,40,100);
  const key=keyOf(c),old=state.get(key),stableTicks=old?(liveChanges>old.lastTick?old.stableTicks+1:old.stableTicks):1;
  state.set(key,{lastTick:liveChanges,stableTicks,seen:now});
  const stability=clamp(stableTicks/5,0,1)*100;
  const adaptiveScore=Math.round(evidence*.42+sampleScore*.20+freshness*.18+stability*.12+volatilityScore*.08);
  const reasons=[];
  if(age>15000)reasons.push("feed ageing");
  if(sample<minSample)reasons.push("sample below minimum");
  if(distinct<10)reasons.push("limited distinct recent quotes");
  if(range>45)reasons.push("unusually wide recent range");
  reasons.push("evidence "+Math.round(evidence)+"/100","sample "+Math.round(sampleScore)+"/100","stability "+Math.round(stability)+"/100");
  return {...c,adaptiveScore,adaptiveMeta:{ageMs:age,distinctQuotes:distinct,stableTicks,volatilityScore,reason:reasons.join("; ")}};
 }
 function rank(candidates,now=Date.now()){
  const ranked=(Array.isArray(candidates)?candidates:[]).map(c=>evaluate(c,now))
   .filter(c=>c.adaptiveMeta.ageMs<=20000&&c.adaptiveMeta.distinctQuotes>=10)
   .sort((a,b)=>b.adaptiveScore-a.adaptiveScore||Number(b.setup?.strength||0)-Number(a.setup?.strength||0)||Number(b.setup?.sample||0)-Number(a.setup?.sample||0));
  if(ranked.length&&previousKey){
   const prior=ranked.find(c=>keyOf(c)===previousKey);
   if(prior&&ranked[0].adaptiveScore-prior.adaptiveScore<6){const i=ranked.indexOf(prior);ranked.splice(i,1);ranked.unshift(prior);}
  }
  previousKey=ranked.length?keyOf(ranked[0]):"";
  for(const [key,value] of state){if(now-value.seen>120000)state.delete(key);}
  return ranked;
 }
 window.BERURAdaptiveMarketSelector={rank};
})();