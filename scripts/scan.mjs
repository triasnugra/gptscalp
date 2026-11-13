import fs from 'node:fs/promises';
import { analyzeSymbol, selectSignals, CFG, ema } from '../src/engine.mjs';
import { sealSignal } from '../src/forward.mjs';

const HOSTS=['https://data-api.binance.vision','https://api.binance.com','https://api1.binance.com'];
let host=0;
async function binance(path){
  let error;
  for(let i=0;i<HOSTS.length;i++){
    try{const r=await fetch(HOSTS[(host+i)%HOSTS.length]+path,{signal:AbortSignal.timeout(12000)});
      if(!r.ok)throw new Error(`HTTP ${r.status}`);host=(host+i)%HOSTS.length;return await r.json();
    }catch(e){error=e;}
  }
  throw error;
}
const parseK=rows=>rows.slice(0,-1).map(x=>({t:+x[0],o:+x[1],h:+x[2],l:+x[3],c:+x[4],v:+x[5]}));
async function klines(symbol,interval,limit=120){
  return parseK(await binance(`/api/v3/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`));
}
const excluded=/^(USDC|FDUSD|TUSD|USDP|DAI|BUSD|EUR|AEUR|USD1|XUSD|PAXG|USDE|PYUSD|USDS|USDD|RLUSD|BFUSD|USDG)$/;
async function main(){
  console.log('MetaScalp scan started',new Date().toISOString());
  const [tickers,btcH1]=await Promise.all([binance('/api/v3/ticker/24hr'),klines('BTCUSDT','1h',120)]);
  const btcTrend=(()=>{const c=btcH1.map(x=>x.c),e20=ema(c,20).at(-1),e50=ema(c,50).at(-1);return e20>e50&&c.at(-1)>e20?1:e20<e50&&c.at(-1)<e20?-1:0;})();
  const universe=tickers.filter(t=>t.symbol.endsWith('USDT')&&!excluded.test(t.symbol.slice(0,-4))&&+t.quoteVolume>=CFG.minQuoteVolume)
    .sort((a,b)=>+b.quoteVolume-+a.quoteVolume).slice(0,50);
  const results=[];
  for(let i=0;i<universe.length;i+=5){
    const batch=universe.slice(i,i+5);
    const part=await Promise.all(batch.map(async t=>{
      try{
        const [h1,m15,m5,book]=await Promise.all([
          klines(t.symbol,'1h',120),klines(t.symbol,'15m',100),klines(t.symbol,'5m',100),
          binance(`/api/v3/ticker/bookTicker?symbol=${t.symbol}`)
        ]);
        const bid=+book.bidPrice,ask=+book.askPrice,mid=(bid+ask)/2,spreadPct=mid?(ask-bid)/mid*100:999;
        return analyzeSymbol({symbol:t.symbol,h1,m15,m5,quoteVolume:+t.quoteVolume,spreadPct,btcTrend});
      }catch(e){return {status:'ERROR',symbol:t.symbol,reasons:[String(e.message||e)]};}
    }));
    results.push(...part);
    console.log(`Scanned ${Math.min(i+5,universe.length)}/${universe.length}`);
  }
  const signals=selectSignals(results);
  // Seal each newly observed candidate before its outcome is known. Keep one open candidate per pair.
  const journalFile='data/journal.json';let journal=[];
  try{journal=JSON.parse(await fs.readFile(journalFile,'utf8'));}catch{}
  const open=new Set(journal.filter(x=>x.fwd&&!x.result).map(x=>x.symbol));
  for(const s of signals){if(open.has(s.symbol))continue;const t=Date.now();const id=`${s.symbol}-${t}`;
    const row=sealSignal({id,t,due:t+4*60*60*1000,symbol:s.symbol,side:s.side,entry:s.entry,sl:s.sl,tp:s.tp,trigger:s.trigger,engine:`MetaScalp-${CFG.version}`,result:null,R:null,exitAt:null},journal.filter(x=>x.fwd).sort((a,b)=>a.seq-b.seq).at(-1));
    journal.push(row);open.add(s.symbol);}
  await fs.writeFile(journalFile,JSON.stringify(journal,null,2)+'\n');
  const output={generatedAt:new Date().toISOString(),engine:'MetaScalp',version:CFG.version,btcTrend,
    market:btcTrend===1?'BULLISH':btcTrend===-1?'BEARISH':'NEUTRAL',
    scanned:results.length,signals,summary:{setups:results.filter(x=>x.status==='SETUP').length,noTrade:results.filter(x=>x.status==='NO_TRADE').length,errors:results.filter(x=>x.status==='ERROR').length},
    rejected:results.filter(x=>x.status==='NO_TRADE').map(x=>({symbol:x.symbol,reasons:x.reasons})).slice(0,100)};
  await fs.mkdir('data',{recursive:true});await fs.writeFile('data/latest.json',JSON.stringify(output,null,2)+'\n');
  console.log(JSON.stringify({market:output.market,summary:output.summary,signals:signals.map(s=>({symbol:s.symbol,side:s.side,entry:s.entry,sl:s.sl,tp:s.tp,score:s.score}))},null,2));
}
main().catch(e=>{console.error(e);process.exit(1);});
