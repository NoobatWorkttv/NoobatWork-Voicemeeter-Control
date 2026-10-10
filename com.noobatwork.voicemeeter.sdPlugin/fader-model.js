'use strict';

/**
 * Pure channel, five-key touch fader, and Potato meter calculations.
 * These are independent of the Stream Deck websocket and the Windows DLL.
 */
const clamp=(n,lo,hi)=>Math.min(hi,Math.max(lo,n));
const safeNumber=(x,fallback)=>x===null||x===undefined||x===''?fallback:(Number.isFinite(Number(x))?Number(x):fallback);
function normalize(s={}) {
  const index=clamp(Math.trunc(safeNumber(s.index,0)),0,7);
  const step=clamp(safeNumber(s.step,2),.1,12);
  const minGain=clamp(safeNumber(s.minGain,-40),-60,11);
  const maxGain=clamp(safeNumber(s.maxGain,0),minGain+1,12);
  return {
    group:s.group==='Bus'?'Bus':'Strip',
    index,
    label:typeof s.label==='string'?s.label.slice(0,24):'',
    step,
    muteGesture:s.muteGesture==='tapHold'?'tapHold':'doubleTap',
    theme:['hybrid','neon','clean'].includes(s.theme)?s.theme:'hybrid',
    accent:['auto','cyan','blue','purple','red','orange','green'].includes(s.accent)?s.accent:'auto',
    segment:clamp(Math.trunc(safeNumber(s.segment,1)),1,5),
    minGain,maxGain
  };
}
function channel(settings) {
  const s=normalize(settings);
  return s.group+'['+s.index+']';
}
function segmentGain(settings) {
  const s=normalize(settings);
  return Math.round((s.minGain+(s.maxGain-s.minGain)*(s.segment-1)/4)*10)/10;
}
function defaultLabel(settings){
  const s=normalize(settings),i=s.index;
  return s.group==='Bus'?(i<5?'A'+(i+1):'B'+(i-4)):(i<5?'Input '+(i+1):'Virtual '+(i-4));
}
// Voicemeeter Potato assigns two input level channels per hardware strip,
// eight per virtual strip, and eight per output bus. Official SDK header.
function levelDescriptor(settings) {
  const s=normalize(settings),i=s.index;
  if(s.group==='Bus')return {type:3,channels:Array.from({length:8},(_,c)=>i*8+c)};
  if(i<5)return {type:2,channels:[i*2,i*2+1]};
  return {type:2,channels:Array.from({length:8},(_,c)=>10+(i-5)*8+c)};
}
function linearToDb(amp){
  if(!Number.isFinite(amp)||amp<=0)return -60;
  return clamp(20*Math.log10(amp),-60,0);
}
function meterPercent(amp){return Math.round((linearToDb(amp)+60)*100/60);}
function gainPercent(gain){return clamp((gain+60)*100/72,0,100);}
module.exports={clamp,normalize,channel,segmentGain,defaultLabel,levelDescriptor,linearToDb,meterPercent,gainPercent};
