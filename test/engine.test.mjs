import test from 'node:test';
import assert from 'node:assert/strict';
import {ema,rsi,atr,analyzeSymbol,selectSignals,CFG} from '../src/engine.mjs';
const bars=(n,fn)=>Array.from({length:n},(_,i)=>{const c=fn(i);return {t:i*60000,o:c-.1,h:c+.3,l:c-.3,c,v:100+i};});
test('EMA returns a stable series',()=>{assert.equal(ema([1,2,3],2).length,3);assert.ok(ema([1,2,3],2).at(-1)>2);});
test('RSI bounded',()=>{const x=rsi(Array.from({length:30},(_,i)=>i+1));assert.equal(x,100);});
test('ATR positive',()=>{assert.ok(atr(bars(30,i=>100+i))>0);});
test('invalid symbol fails closed',()=>{assert.equal(analyzeSymbol({symbol:'../BTC',h1:[],m15:[],m5:[]}).status,'NO_TRADE');});
test('selector caps daily signal count',()=>{const a=Array.from({length:10},(_,i)=>({status:'SETUP',score:8-i,quoteVolume:1,side:i%2?'SHORT':'LONG'}));assert.equal(selectSignals(a).length,CFG.maxSignals);});
import {sealSignal,verifyJournal} from '../src/forward.mjs';
import {gradeTrade} from '../src/trade-sim.mjs';
test('forward journal detects edits to sealed setup fields',()=>{const a=sealSignal({id:'x',t:1,due:2,symbol:'BTCUSDT',side:'LONG',entry:100,sl:99,tp:102,trigger:'sweep',engine:'v1'},null);assert.equal(verifyJournal([a]).ok,true);a.entry=101;assert.equal(verifyJournal([a]).ok,false);});
test('trade grader resolves ambiguous stop and target conservatively',()=>{
 const signal={side:'LONG',entry:100,sl:99,tp:102,t:0,due:999999};
 const g=gradeTrade(signal,[{t:1,o:100,h:103,l:98,c:101}],100);
 assert.equal(g.result,'SL'); assert.equal(g.R,-1);
});
test('trade grader records unfilled order after expiry',()=>{
 const g=gradeTrade({side:'LONG',entry:100,sl:99,tp:102,t:0,due:999999},[],1000000);
 assert.equal(g.result,'UNFILLED');
});
