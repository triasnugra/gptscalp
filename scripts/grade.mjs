import fs from 'node:fs/promises';
const hosts=['https://data-api.binance.vision','https://api.binance.com'];
async function fetchBars(symbol,from,to){for(const h of hosts){try{const r=await fetch(`${h}/api/v3/klines?symbol=${symbol}&interval=5m&startTime=${from}&endTime=${to}&limit=1000`);if(!r.ok)throw Error(r.status);return (await r.json()).map(x=>({t:+x[0],o:+x[1],h:+x[2],l:+x[3],c:+x[4]}));}catch{}}throw Error('Binance unavailable');}
const file='data/journal.json';let rows=[];try{rows=JSON.parse(await fs.readFile(file,'utf8'));}catch{}
for(const r of rows.filter(x=>x.fwd&&!x.result&&Date.now()>=x.due)){try{const bars=await fetchBars(r.symbol,r.t,r.due);let filled=false,result='UNFILLED',R=0,exitAt=r.due;const s=r.side==='LONG'?1:-1,risk=Math.abs(r.entry-r.sl);
 for(const b of bars){const open=s===1?b.o<=r.entry:b.o>=r.entry,touch=s===1?b.l<=r.entry:b.h>=r.entry;if(!filled){if(!open&&!touch)continue;filled=true;if(s===1?b.l<=r.sl:b.h>=r.sl){result='SL';R=-1;exitAt=b.t;break;}if(open&&(s===1?b.h>=r.tp:b.l<=r.tp)){result='TP';R=s*(r.tp-r.entry)/risk;exitAt=b.t;break;}continue;}
 if(s===1?b.l<=r.sl:b.h>=r.sl){result='SL';R=-1;exitAt=b.t;break;}if(s===1?b.h>=r.tp:b.l<=r.tp){result='TP';R=s*(r.tp-r.entry)/risk;exitAt=b.t;break;}}
 if(result==='UNFILLED'&&filled){const last=bars.at(-1);result='EXPIRED';R=last?s*(last.c-r.entry)/risk:0;exitAt=last?.t||r.due;}
 Object.assign(r,{result,R,exitAt});console.log(r.id,result,R.toFixed(2));}catch(e){console.error(r.id,e.message);}}
await fs.writeFile(file,JSON.stringify(rows,null,2)+'\n');
