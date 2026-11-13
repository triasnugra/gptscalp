// MetaScalp v1 — deterministic, auditable, no AI-generated prices.
export const CFG = Object.freeze({
  version: 1,
  contextInterval: '1h',
  structureInterval: '15m',
  triggerInterval: '5m',
  rangeLookback: 24,
  sweepLookback: 12,
  atrPeriod: 14,
  maxStopPct: 0.80,
  minStopPct: 0.12,
  minRR: 1.60,
  targetR: 2.0,
  maxEntryDistancePct: 0.18,
  minQuoteVolume: 5_000_000,
  minScore: 6,
  maxSignals: 5,
  maxSameSide: 4,
  feePctPerSide: 0.05,
  slippagePctPerSide: 0.03,
  maxSpreadPct: 0.12,
  btcGate: true
});

const finite = n => Number.isFinite(Number(n));
const mean = a => a.length ? a.reduce((s,x)=>s+x,0)/a.length : NaN;
export const ema = (a,n) => {
  if (!a.length) return [];
  const k=2/(n+1), out=[a[0]];
  for(let i=1;i<a.length;i++) out.push(a[i]*k+out[i-1]*(1-k));
  return out;
};
export function rsi(values, period=14) {
  if(values.length<period+1) return NaN;
  let gains=0, losses=0;
  for(let i=1;i<=period;i++){const d=values[i]-values[i-1];gains+=Math.max(0,d);losses+=Math.max(0,-d);}
  let ag=gains/period, al=losses/period;
  for(let i=period+1;i<values.length;i++){const d=values[i]-values[i-1];ag=(ag*(period-1)+Math.max(0,d))/period;al=(al*(period-1)+Math.max(0,-d))/period;}
  return al===0?100:100-100/(1+ag/al);
}
export function atr(bars, period=14) {
  if(bars.length<period+1) return NaN;
  const tr=bars.slice(1).map((b,i)=>Math.max(b.h-b.l,Math.abs(b.h-bars[i].c),Math.abs(b.l-bars[i].c)));
  return mean(tr.slice(-period));
}
const last = a => a[a.length-1];
const pct = (a,b) => b ? Math.abs(a-b)/b*100 : Infinity;
const clean = b => b.filter(x=>[x.o,x.h,x.l,x.c,x.v].every(finite)&&x.h>=x.l&&x.l>0);
function trend(bars) {
  const c=bars.map(x=>x.c), e20=last(ema(c,20)),e50=last(ema(c,50));
  if(!finite(e50)) return 0;
  return e20>e50&&last(c)>e20?1:e20<e50&&last(c)<e20?-1:0;
}
function marketContext(hourly) {
  const t=trend(hourly);
  const c=hourly.map(x=>x.c), a=atr(hourly);
  const vol=last(hourly)?.v||0;
  return {trend:t,atr:a,close:last(c),rsi:rsi(c),volume:vol};
}
function rangeOf(bars, lookback) {
  const a=bars.slice(-(lookback+1),-1);
  if(a.length<Math.min(lookback,12)) return null;
  return {high:Math.max(...a.map(x=>x.h)),low:Math.min(...a.map(x=>x.l))};
}
function findSweep(trigger, level, side, lookback) {
  const a=trigger.slice(-lookback-1,-1);
  for(let i=a.length-1;i>=0;i--){
    const b=a[i];
    if(side===1 && b.l<level && b.c>level) return {index:i,extreme:b.l,bar:b};
    if(side===-1 && b.h>level && b.c<level) return {index:i,extreme:b.h,bar:b};
  }
  return null;
}
function bodyStrength(b,side) {
  const range=Math.max(b.h-b.l,1e-12), body=Math.abs(b.c-b.o)/range;
  return side===1 ? b.c>b.o&&body>=0.45 : b.c<b.o&&body>=0.45;
}
function reject(code, reasons, extra={}) {
  return {status:'NO_TRADE',side:0,score:0,reasons:[code,...reasons],...extra};
}

/**
 * Analyze one symbol. Inputs must be chronologically ascending OHLCV candles.
 * Uses only closed candles; caller must remove the currently-forming candle.
 */
export function analyzeSymbol({symbol,h1,m15,m5,quoteVolume=0,spreadPct=0,btcTrend=0,now=Date.now()}) {
  h1=clean(h1||[]);m15=clean(m15||[]);m5=clean(m5||[]);
  const reasons=[];
  if(!/^[A-Z0-9]{2,20}$/.test(symbol||'')) return reject('INVALID_SYMBOL',[]);
  if(h1.length<60||m15.length<40||m5.length<40) return reject('INSUFFICIENT_DATA',[]);
  if(quoteVolume<CFG.minQuoteVolume) return reject('LOW_LIQUIDITY',[],{quoteVolume});
  if(spreadPct>CFG.maxSpreadPct) return reject('SPREAD_TOO_WIDE',[],{spreadPct});
  const ctx=marketContext(h1), structure=rangeOf(m15,CFG.rangeLookback);
  if(!structure||!finite(ctx.atr)) return reject('INSUFFICIENT_STRUCTURE',[]);
  const current=last(m5), price=current.c, atr5=atr(m5);
  const rangePos=(price-structure.low)/(structure.high-structure.low||1);
  const mid=rangePos>0.30&&rangePos<0.70;
  const bias=ctx.trend;
  if(bias===0) reasons.push('TREND_NEUTRAL');
  const lowSweep=findSweep(m5,structure.low,1,CFG.sweepLookback);
  const highSweep=findSweep(m5,structure.high,-1,CFG.sweepLookback);
  const candidates=[];
  if(lowSweep && bodyStrength(current,1)) candidates.push({side:1,sweep:lowSweep,level:structure.low,trigger:'SWEEP_RECLAIM_LOW'});
  if(highSweep && bodyStrength(current,-1)) candidates.push({side:-1,sweep:highSweep,level:structure.high,trigger:'SWEEP_RECLAIM_HIGH'});
  // Breakout is not chased: require a closed 15m close beyond range and a 5m retest/rejection.
  const last15=last(m15), prev15=m15[m15.length-2];
  if(last15.c>structure.high && current.l<=structure.high*1.001 && current.c>structure.high && bodyStrength(current,1))
    candidates.push({side:1,sweep:{extreme:Math.min(current.l,prev15.l)},level:structure.high,trigger:'BREAKOUT_RETEST'});
  if(last15.c<structure.low && current.h>=structure.low*0.999 && current.c<structure.low && bodyStrength(current,-1))
    candidates.push({side:-1,sweep:{extreme:Math.max(current.h,prev15.h)},level:structure.low,trigger:'BREAKDOWN_RETEST'});
  if(!candidates.length) return reject(mid?'MID_RANGE_NO_EDGE':'NO_CONFIRMED_TRIGGER',reasons,{price,range:structure,rangePos,bias,btcTrend});
  // Prefer the candidate aligned with the hourly trend; do not resolve ambiguous opposite triggers.
  const aligned=candidates.filter(x=>x.side===bias);
  const pool=aligned.length?aligned:candidates;
  if(pool.length!==1) return reject('AMBIGUOUS_TRIGGER',reasons,{price,range:structure,bias});
  const setup=pool[0], side=setup.side;
  if(mid && setup.trigger.startsWith('BREAK')) return reject('MID_RANGE_NO_EDGE',reasons,{price,range:structure,bias});
  if(bias!==side) return reject('COUNTER_TREND',reasons,{price,bias,trigger:setup.trigger});
  if(CFG.btcGate && symbol!=='BTCUSDT' && btcTrend!==0 && btcTrend!==side)
    return reject('BTC_REGIME_BLOCK',reasons,{price,bias,btcTrend});
  if(CFG.btcGate && symbol!=='BTCUSDT' && btcTrend===0)
    return reject('BTC_REGIME_UNCLEAR',reasons,{price,bias,btcTrend});
  const entry=setup.level;
  if(pct(price,entry)>CFG.maxEntryDistancePct) return reject('ENTRY_TOO_FAR',reasons,{price,entry});
  const pad=Math.max(atr5*0.12,price*0.0005);
  let sl=side===1?Math.min(setup.sweep.extreme-pad,entry-atr5*0.25):Math.max(setup.sweep.extreme+pad,entry+atr5*0.25);
  let stopPct=pct(entry,sl);
  if(stopPct<CFG.minStopPct){sl=entry*(1-side*CFG.minStopPct/100);stopPct=CFG.minStopPct;}
  if(stopPct>CFG.maxStopPct) return reject('STOP_TOO_WIDE',reasons,{price,entry,sl,stopPct});
  const risk=Math.abs(entry-sl), tp=entry+side*CFG.targetR*risk, rr=Math.abs(tp-entry)/risk;
  if(rr<CFG.minRR) return reject('RR_TOO_LOW',reasons,{price,entry,sl,tp,rr});
  let score=4;
  reasons.push(setup.trigger,'H1_TREND_ALIGNED','5M_CLOSED_CANDLE_CONFIRMATION');
  if(ctx.rsi>50&&side===1||ctx.rsi<50&&side===-1){score++;reasons.push('RSI_MOMENTUM_ALIGNED');}
  if(current.v>mean(m5.slice(-21,-1).map(x=>x.v))*1.3){score++;reasons.push('VOLUME_EXPANSION');}
  if(rangePos<0.25&&side===1||rangePos>0.75&&side===-1){score++;reasons.push('RANGE_EXTREME');}
  if(score<CFG.minScore) return reject('SCORE_BELOW_THRESHOLD',reasons,{score,price,entry,sl,tp,rr});
  const costsPct=2*CFG.feePctPerSide+2*CFG.slippagePctPerSide;
  const costR=(entry*costsPct/100)/risk;
  return {
    status:'SETUP',symbol,side:side===1?'LONG':'SHORT',sideCode:side,score,
    price,entry,sl,tp,rr,stopPct,distPct:pct(price,entry),trigger:setup.trigger,
    range:structure,rangePos,bias,btcTrend,quoteVolume,spreadPct,
    estimatedCostR:costR,netTargetR:CFG.targetR-costR,
    reasons,createdAt:new Date(now).toISOString(),
    invalidation:side===1?'5m close below sweep low / stop':'5m close above sweep high / stop',
    note:'Limit/retest idea only. Wait for price to reach entry; do not chase.'
  };
}

export function selectSignals(rows) {
  const setups=rows.filter(x=>x.status==='SETUP').sort((a,b)=>b.score-a.score||b.quoteVolume-a.quoteVolume);
  const selected=[], sides={LONG:0,SHORT:0};
  for(const s of setups){
    if(selected.length>=CFG.maxSignals)break;
    if(sides[s.side]>=CFG.maxSameSide)continue;
    selected.push(s);sides[s.side]++;
  }
  return selected;
}
