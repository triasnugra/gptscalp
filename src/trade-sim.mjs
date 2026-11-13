// Conservative 5m limit-order grader. If SL and TP are both touched in one bar, SL wins.
export function gradeTrade(signal,bars,now=Date.now()){
  const s=signal.side==='LONG'?1:-1,risk=Math.abs(signal.entry-signal.sl);
  if(!(risk>0))return {result:'INVALID',R:0,exitAt:signal.t};
  let filled=false;
  for(const b of bars){if(b.t<signal.t||b.t>signal.due)continue;
    const opened=s===1?b.o<=signal.entry:b.o>=signal.entry;
    const touched=s===1?b.l<=signal.entry:b.h>=signal.entry;
    if(!filled){if(!opened&&!touched)continue;filled=true;
      const stop=s===1?b.l<=signal.sl:b.h>=signal.sl;
      const target=s===1?b.h>=signal.tp:b.l<=signal.tp;
      if(stop)return {result:'SL',R:-1,exitAt:b.t};
      if(opened&&target)return {result:'TP',R:s*(signal.tp-signal.entry)/risk,exitAt:b.t};
      continue;
    }
    const stop=s===1?b.l<=signal.sl:b.h>=signal.sl;
    const target=s===1?b.h>=signal.tp:b.l<=signal.tp;
    if(stop)return {result:'SL',R:-1,exitAt:b.t};
    if(target)return {result:'TP',R:s*(signal.tp-signal.entry)/risk,exitAt:b.t};
  }
  if(now<signal.due)return null;
  if(!filled)return {result:'UNFILLED',R:0,exitAt:signal.due};
  const last=bars.filter(b=>b.t<=signal.due).at(-1);
  return {result:'EXPIRED',R:last?s*(last.c-signal.entry)/risk:0,exitAt:last?.t||signal.due};
}
