'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {createCompactGestures}=require('../com.noobatwork.voicemeeter.sdPlugin/compact-gestures.js');
const manifest=require('../com.noobatwork.voicemeeter.sdPlugin/manifest.json');

function clock(){
 let now=0,id=0;
 const jobs=new Map();
 const setTimeout=(fn,delay)=>{const n=++id;jobs.set(n,{due:now+delay,fn});return n;};
 const clearTimeout=which=>jobs.delete(which);
 const tick=duration=>{
  const end=now+duration;
  while(true){
   let next=null;
   for(const [id,task] of jobs){
    if(task.due<=end&&(!next||task.due<next.task.due))next={id,task};
   }
   if(!next)break;
   now=next.task.due;jobs.delete(next.id);next.task.fn();
  }
  now=end;
 };
 return {setTimeout,clearTimeout,tick};
}
function controller(){
 const events=[],c=clock();
 const gestures=createCompactGestures((ctx,action)=>events.push([ctx,action]),{setTimeout:c.setTimeout,clearTimeout:c.clearTimeout,holdMs:520,doubleMs:280,repeatMs:280});
 return {events,gestures,...c};
}

test('compact action registered without replacing working actions',()=>{
 const ids=manifest.Actions.map(x=>x.UUID);
 for(const ending of ['fader','up','down','mute','segment','compact'])
  assert.ok(ids.includes('com.noobatwork.voicemeeter.'+ending));
 assert.equal(new Set(ids).size,ids.length);
});
test('one short tap increases only once after double-tap window',()=>{
 const {events,gestures,tick}=controller();
 gestures.down('game');gestures.up('game');
 tick(279);assert.deepEqual(events,[]);
 tick(1);assert.deepEqual(events,[['game','increase']]);
 tick(2000);assert.equal(events.length,1);
});
test('double tap toggles mute without an intermediate gain change',()=>{
 const {events,gestures,tick}=controller();
 gestures.down('discord');gestures.up('discord');tick(140);
 gestures.down('discord');gestures.up('discord');
 assert.deepEqual(events,[['discord','mute']]);
 tick(600);assert.equal(events.length,1);
});
test('holding decreases repeatedly and keyUp stops repeating',()=>{
 const {events,gestures,tick}=controller();
 gestures.down('game');tick(519);assert.deepEqual(events,[]);
 tick(1);assert.deepEqual(events,[['game','decrease']]);
 tick(560);assert.equal(events.length,3);
 gestures.up('game');tick(3000);assert.equal(events.length,3);
});
test('disappearing key cancels pending single tap and held repeat',()=>{
 const {events,gestures,tick}=controller();
 gestures.down('a');gestures.up('a');gestures.clear('a');tick(1000);
 gestures.down('b');tick(520);gestures.clear('b');tick(1000);
 assert.deepEqual(events,[['b','decrease']]);
});
test('independent keys cannot coalesce double clicks across channels',()=>{
 const {events,gestures,tick}=controller();
 gestures.down('game');gestures.up('game');
 gestures.down('discord');gestures.up('discord');
 tick(300);
 assert.deepEqual(events,[['game','increase'],['discord','increase']]);
});
test('lost keyUp stops after bounded repeat count',()=>{
 const {events,gestures,tick}=controller();
 gestures.down('game');tick(10000);
 assert.equal(events.length,12);
 assert.ok(events.every(x=>x[1]==='decrease'));
 gestures.clearAll();
});
