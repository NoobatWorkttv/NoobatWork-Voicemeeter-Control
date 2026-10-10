'use strict';

/**
 * Single-button mixer controls based only on Stream Deck keypad keyDown/keyUp.
 * Legacy (default): tap increases, hold decreases, double tap mutes.
 * Optional tapHold: each quick tap increases immediately; tap and hold a
 * second press (within 280ms) for 350ms to mute. Ordinary hold decreases.
 *
 * Timers are injected for deterministic tests. No API calls or audio handling here.
 */
function createCompactGestures(emit,opts={}) {
  const later=opts.setTimeout||setTimeout;
  const cancel=opts.clearTimeout||clearTimeout;
  const holdMs=opts.holdMs||520;
  const doubleMs=opts.doubleMs||280;
  const repeatMs=opts.repeatMs||280;
  const maxRepeats=opts.maxRepeats||12;
  const tapHoldMs=opts.tapHoldMs||350;
  const getMode=opts.getMode||(()=> 'doubleTap');
  const keys=new Map();
  function state(ctx) {
    let s=keys.get(ctx);
    if(!s){
      s={pressed:false,holding:false,second:false,holdTimer:null,repeatTimer:null,tapTimer:null,repeatCount:0};
      keys.set(ctx,s);
    }
    return s;
  }
  function clearTimer(s,field){
    if(s[field]!==null){cancel(s[field]);s[field]=null;}
  }
  function down(ctx){
    const s=state(ctx);
    if(s.pressed)return; // ignore duplicate keyDown events
    s.mode=getMode(ctx)==='tapHold'?'tapHold':'doubleTap';
    if(s.mode==='tapHold'){
      s.second=s.tapTimer!==null;
      clearTimer(s,'tapTimer');
      s.pressed=true;s.holding=false;s.repeatCount=0;
      s.holdTimer=later(function beginTapHold(){
        s.holdTimer=null;
        if(!s.pressed)return;
        s.holding=true;
        if(s.second){
          s.second=false;
          emit(ctx,'mute');
          return; // no gain change or decrease on mute gesture
        }
        function repeat(){
          if(!s.pressed||s.repeatCount>=maxRepeats)return;
          s.repeatCount++;
          emit(ctx,'decrease');
          if(s.repeatCount<maxRepeats)s.repeatTimer=later(repeat,repeatMs);
        }
        repeat();
      },s.second?tapHoldMs:holdMs);
      return;
    }
    s.second=s.tapTimer!==null;
    if(s.second)clearTimer(s,'tapTimer');
    s.pressed=true;s.holding=false;s.repeatCount=0;
    s.holdTimer=later(function beginHold(){
      s.holdTimer=null;
      if(!s.pressed)return;
      s.holding=true;
      if(s.second){ // if second press becomes a hold, keep first quick tap.
        emit(ctx,'increase');
        s.second=false;
      }
      function repeat(){
        if(!s.pressed||s.repeatCount>=maxRepeats)return;
        s.repeatCount++;
        emit(ctx,'decrease');
        if(s.repeatCount<maxRepeats)s.repeatTimer=later(repeat,repeatMs);
      }
      repeat();
    },holdMs);
  }
  function up(ctx){
    const s=keys.get(ctx);
    if(!s||!s.pressed)return;
    s.pressed=false;
    clearTimer(s,'holdTimer');
    clearTimer(s,'repeatTimer');
    if(s.holding){s.holding=false;s.second=false;return;}
    if(s.mode==='tapHold'){
      // Every short tap is +1 step. A second short tap cannot mute.
      s.second=false;
      emit(ctx,'increase');
      clearTimer(s,'tapTimer');
      s.tapTimer=later(()=>{s.tapTimer=null;},doubleMs);
      return;
    }
    if(s.second){
      s.second=false;
      emit(ctx,'mute');
    }else{
      s.tapTimer=later(()=>{
        s.tapTimer=null;
        emit(ctx,'increase');
      },doubleMs);
    }
  }
  function clear(ctx){
    const s=keys.get(ctx);
    if(!s)return;
    clearTimer(s,'tapTimer');
    clearTimer(s,'holdTimer');
    clearTimer(s,'repeatTimer');
    keys.delete(ctx);
  }
  function clearAll(){for(const ctx of keys.keys())clear(ctx);}
  return {down,up,clear,clearAll};
}
module.exports={createCompactGestures};
