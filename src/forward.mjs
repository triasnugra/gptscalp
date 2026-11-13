import {createHash} from 'node:crypto';
const sha=s=>createHash('sha256').update(s).digest('hex');
const SEALED=['id','t','due','symbol','side','entry','sl','tp','trigger','engine'];
const canon=r=>JSON.stringify(SEALED.map(k=>r[k]??null));
const link=(prev,seq,r)=>sha(`${prev}|${seq}|${canon(r)}`).slice(0,24);
export function sealSignal(signal,previous){
  const row={...signal,fwd:1,seq:(previous?.seq||0)+1,prev:previous?.h||'GENESIS'};
  row.h=link(row.prev,row.seq,row);return row;
}
export function verifyJournal(rows){
  const f=rows.filter(x=>x.fwd).sort((a,b)=>a.seq-b.seq),errors=[];let prev='GENESIS';
  f.forEach((r,i)=>{if(r.seq!==i+1)errors.push(`sequence gap at ${r.seq}`);if(r.prev!==prev)errors.push(`broken previous hash at ${r.id}`);if(r.h!==link(r.prev,r.seq,r))errors.push(`sealed fields changed at ${r.id}`);prev=r.h;});
  return {ok:errors.length===0,count:f.length,head:f.at(-1)?.h||null,errors};
}
