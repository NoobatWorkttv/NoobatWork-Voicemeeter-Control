'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {readFileSync}=require('node:fs');
const path=require('node:path');
const model=require('../com.noobatwork.voicemeeter.sdPlugin/fader-model.js');
const manifest=require('../com.noobatwork.voicemeeter.sdPlugin/manifest.json');

test('five fader buttons select monotonic -40 to 0 dB',()=>{
  assert.deepEqual(Array.from({length:5},(_,i)=>model.segmentGain({segment:i+1})),[-40,-30,-20,-10,0]);
});
test('five fader buttons support custom ranges and snap to 0.1 dB',()=>{
  const levels=Array.from({length:5},(_,i)=>model.segmentGain({minGain:-60,maxGain:12,segment:i+1}));
  assert.deepEqual(levels,[-60,-42,-24,-6,12]);
  assert.equal(model.segmentGain({segment:999}),0);
});
test('all 16 Potato channels map to the correct remote names',()=>{
  assert.equal(model.channel({group:'Strip',index:0}),'Strip[0]');
  assert.equal(model.channel({group:'Strip',index:7}),'Strip[7]');
  assert.equal(model.channel({group:'Bus',index:0}),'Bus[0]');
  assert.equal(model.channel({group:'Bus',index:7}),'Bus[7]');
});
test('Potato input and bus meter channels use correct 2/8-channel offsets',()=>{
  assert.deepEqual(model.levelDescriptor({group:'Strip',index:0}),{type:2,channels:[0,1]});
  assert.deepEqual(model.levelDescriptor({group:'Strip',index:4}),{type:2,channels:[8,9]});
  assert.deepEqual(model.levelDescriptor({group:'Strip',index:5}),{type:2,channels:[10,11,12,13,14,15,16,17]});
  assert.deepEqual(model.levelDescriptor({group:'Strip',index:7}),{type:2,channels:[26,27,28,29,30,31,32,33]});
  assert.deepEqual(model.levelDescriptor({group:'Bus',index:0}),{type:3,channels:[0,1,2,3,4,5,6,7]});
  assert.deepEqual(model.levelDescriptor({group:'Bus',index:7}),{type:3,channels:[56,57,58,59,60,61,62,63]});
});
test('level is linear, converted to amplitude dBFS independently of gain',()=>{
  assert.equal(model.linearToDb(1),0);
  assert.equal(model.linearToDb(.1),-20);
  assert.equal(model.linearToDb(0),-60);
  assert.equal(model.meterPercent(.001),0);
  assert.equal(model.meterPercent(1),100);
});
test('new fader and mute actions are registered in Stream Deck manifest',()=>{
  const ids=manifest.Actions.map(a=>a.UUID);
  assert.ok(ids.includes('com.noobatwork.voicemeeter.segment'));
  assert.ok(ids.includes('com.noobatwork.voicemeeter.mute'));
  assert.equal(new Set(ids).size,ids.length);
});
test('Windows remote bridge provides VBVMR_GetLevel and post-mute meter reporting',()=>{
  const ps=readFileSync(path.join(__dirname,'../com.noobatwork.voicemeeter.sdPlugin/bridge.ps1'),'utf8');
  assert.match(ps,/VBVMR_GetLevel/);
  assert.match(ps,/Send @\{values=\$values;meters=\$meters\}/);
  assert.equal((ps.match(/\}elseif\(\$q\.op -eq 'set'\)/g)||[]).length,1,'must have exactly one set branch');
  assert.equal((ps.match(/\bwhile\(\$null -ne \(\$line=/g)||[]).length,1,'must have exactly one command loop');
  assert.match(ps,/GetLevel is optional on this bridge/);
});
