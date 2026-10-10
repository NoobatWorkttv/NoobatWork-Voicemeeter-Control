'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {renderTile,accentFor,safeIcon}=require('../com.noobatwork.voicemeeter.sdPlugin/tile-renderer.js');

const decoded=props=>decodeURIComponent(renderTile(props).slice('data:image/svg+xml,'.length));
test('every channel and app renders valid SVG tile with a current level',()=>{
 const app=decoded({kind:'app',action:'app',label:'Discord',volume:.83,meter:.64,settings:{theme:'hybrid'}});
 assert.match(app,/xmlns="http:\/\/www\.w3\.org\/2000\/svg"/);
 assert.match(app,/83%/);
 assert.match(app,/Discord/);
 assert.match(app,/#8494ff/);
 const channel=decoded({kind:'channel',action:'compact',label:'Mikrofon',gain:-3.5,meter:32,settings:{group:'Strip',theme:'hybrid'}});
 assert.match(channel,/-3\.5 dB/);
 assert.match(channel,/Mikrofon/);
 assert.match(channel,/TAP/);
});
test('named apps auto-color independently (discord / opera / firefox)',()=>{
 assert.notEqual(accentFor('app','Discord'),accentFor('app','Opera GX'));
 assert.notEqual(accentFor('app','Opera GX'),accentFor('app','Firefox'));
 assert.equal(accentFor('app','Discord',{accent:'red'}),'#ff5b76');
});
test('mute makes the tile red without hiding application identity',()=>{
 const svg=decoded({kind:'app',action:'app',label:'Discord',volume:.48,meter:.9,mute:true});
 assert.match(svg,/MUTED/);
 assert.match(svg,/Discord/);
 assert.match(svg,/#ff5a77/);
});
test('online / offline statuses do not invent a live volume',()=>{
 const svg=decoded({kind:'app',action:'app',label:'Firefox',online:false,volume:.99});
 assert.match(svg,/OFFLINE/);
 assert.doesNotMatch(svg,/>99%<\/text>/);
});
test('levels and meters are clamped and finite, even if Windows returns malformed data',()=>{
 const svg=decoded({kind:'app',label:'Browser',volume:5,meter:20});
 assert.match(svg,/>100%<\/text>/);
 assert.doesNotMatch(svg,/NaN|Infinity/);
 const also=decoded({kind:'channel',label:'Game',gain:-900,meter:-20});
 assert.doesNotMatch(also,/NaN|Infinity/);
});
test('app and channel renderers preserve per-key hybrid / neon / clean themes',()=>{
 const a=decoded({kind:'app',label:'Discord',settings:{theme:'neon'}});
 const b=decoded({kind:'app',label:'Discord',settings:{theme:'clean'}});
 const c=decoded({kind:'app',label:'Discord',settings:{theme:'hybrid'}});
 assert.notEqual(a,b);assert.notEqual(b,c);
});
test('all legacy action types remain renderable',()=>{
 for(const action of ['up','down','mute','segment','fader','compact','app']){
   const svg=decoded({action,label:'Master',gain:-12,segment:-10});
   assert.match(svg,/<svg/);
   assert.match(svg,/<\/svg>/);
 }
});
test('unsafe application labels cannot inject SVG markup',()=>{
 const svg=decoded({kind:'app',label:'<script>alert("&")</script>'});
 assert.doesNotMatch(svg,/<script>/);
 assert.match(svg,/&lt;script&gt;/);
});
test('icon data URI is strictly constrained to embedded PNG and never arbitrary URLs',()=>{
 assert.equal(safeIcon('https://example.com/spy.png'),null);
 assert.equal(safeIcon('data:image/svg+xml,evil'),null);
 const icon='data:image/png;base64,'+'iVBORw0KGgo'+'A'.repeat(100);
 assert.equal(safeIcon(icon),icon);
 const svg=decoded({kind:'app',label:'Discord',icon});
 assert.match(svg,/<image/);
 assert.match(svg,/data:image\/png;base64/);
});
test('tap-hold and legacy mode show correct gesture hint',()=>{
 const legacy=decoded({kind:'app',label:'Discord',settings:{muteGesture:'doubleTap'}});
 const custom=decoded({kind:'app',label:'Discord',settings:{muteGesture:'tapHold'}});
 assert.match(legacy,/2× TAP/);
 assert.match(custom,/TAP \+ HOLD/);
});
