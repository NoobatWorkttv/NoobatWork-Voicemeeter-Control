'use strict';
const {spawn}=require('node:child_process');
const {join}=require('node:path');
const model=require('./fader-model.js');
const {renderTile}=require('./tile-renderer.js');
const {createCompactGestures}=require('./compact-gestures.js');
const args=process.argv.slice(2);
function arg(name){const i=args.indexOf(name);return i<0?null:args[i+1];}
const port=arg('-port'),uuid=arg('-pluginUUID'),registration=arg('-registerEvent');
if(!port||!uuid||!registration)process.exit(1);
let ws,child,buffer='',online=false,busy=false;
const active=new Map(),cache=new Map(),meters=new Map(),lastImage=new Map();
// Windows application audio is completely separate from the Voicemeeter bridge.
let appProcess=null,appBuffer='',appReady=false;
const apps=new Map();
function tellInspector(ctx){
  send({event:'sendToPropertyInspector',context:ctx,payload:{
    type:'app-list',apps:[...apps.values()].sort((a,b)=>a.name.localeCompare(b.name))
  }});
}
function startAppBridge(){
  if(appProcess)return;
  const exe=join(__dirname,'bin','NoobatWorkAudioSessions.exe');
  const proc=spawn(exe,[],{windowsHide:true,stdio:['pipe','pipe','pipe']});
  appProcess=proc;appBuffer='';appReady=false;
  proc.stdout.setEncoding('utf8');
  proc.stdout.on('data',part=>{
    appBuffer+=part;
    if(appBuffer.length>1000000)appBuffer='';
    let at;
    while((at=appBuffer.indexOf('\n'))>=0){
      const line=appBuffer.slice(0,at);appBuffer=appBuffer.slice(at+1);
      try{
        const msg=JSON.parse(line);
        if(msg.type==='apps'&&Array.isArray(msg.apps)){
          appReady=true;
          apps.clear();
          for(const a of msg.apps)if(typeof a.id==='string'&&a.id.endsWith('.exe'))apps.set(a.id,a);
          for(const [ctx,item] of active)if(item.action.endsWith('.app')){paint(ctx,item);tellInspector(ctx);}
        }
      }catch{}
    }
  });
  proc.on('error',()=>{if(appProcess===proc){appReady=false;appProcess=null;apps.clear();render();}});
  proc.on('exit',()=>{if(appProcess===proc){appReady=false;appProcess=null;apps.clear();render();}});
}
function appCommand(cmd){if(appProcess?.stdin?.writable)appProcess.stdin.write(JSON.stringify(cmd)+'\n');}
function pollAppBridge(){
  if(![...active.values()].some(x=>x.action.endsWith('.app')))return;
  if(!appProcess)startAppBridge();
  appCommand({op:'list'});
}
function renderApplication(ctx,item){
 const id=String(item.settings?.appId||'').toLowerCase();
 const a=apps.get(id),settings=item.settings||{};
 const image=renderTile({
   kind:'app',action:'app',label:settings.label||a?.name||id||'App wählen',
   settings,volume:a?.volume??0,meter:a?.peak??0,mute:!!a?.mute,
   online:appReady&&!!a,icon:a?.icon||null
 });
 if(lastImage.get(ctx)===image)return;
 lastImage.set(ctx,image);
 send({event:'setImage',context:ctx,payload:{image,target:0}});
}

const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
function send(obj){if(ws?.readyState===1)ws.send(JSON.stringify(obj));}
function bridge(obj){if(child?.stdin?.writable)child.stdin.write(JSON.stringify(obj)+'\n');}
function gainText(g){return Number.isFinite(g)?g.toFixed(1)+' dB':'-- dB';}
function makeImage(action,s,base){
 const gain=cache.get(base+'.Gain');
 const image=renderTile({
   kind:'channel',action:action.split('.').at(-1),
   label:s.label||model.defaultLabel(s),settings:s,
   gain:Number.isFinite(gain)?gain:0,
   mute:cache.get(base+'.Mute')===1,
   meter:model.meterPercent(meters.get(base)||0),
   online:online&&Number.isFinite(gain),
   segment:model.segmentGain(s)
 });
 return image;
}
function paint(ctx,item){
 if(item.action.endsWith('.app')){renderApplication(ctx,item);return;}
 const s=model.normalize(item.settings),base=model.channel(s);
 const url=makeImage(item.action,s,base);
 if(lastImage.get(ctx)===url)return;
 lastImage.set(ctx,url);
 send({event:'setImage',context:ctx,payload:{image:url,target:0}});
}
function render(){for(const [ctx,a] of active)paint(ctx,a);}
function startBridge(){
 if(child)return;
 const exe=join(process.env.WINDIR||'C:\\Windows','System32','WindowsPowerShell','v1.0','powershell.exe');
 const proc=spawn(exe,['-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',join(__dirname,'bridge.ps1')],{windowsHide:true,stdio:['pipe','pipe','pipe']});
 child=proc;buffer='';online=false;busy=false;
 proc.stdout.setEncoding('utf8');
 proc.stdout.on('data',chunk=>{
  buffer+=chunk;
  if(buffer.length>250000)buffer='';
  let pos;
  while((pos=buffer.indexOf('\n'))>=0){
    const line=buffer.slice(0,pos);buffer=buffer.slice(pos+1);
    try{
     const msg=JSON.parse(line);
     if(msg.error){busy=false;online=false;meters.clear();render();continue;}
     if(msg.values){
       busy=false;online=true;
       for(const [k,v] of Object.entries(msg.values))if(Number.isFinite(v))cache.set(k,v);
       for(const [k,v] of Object.entries(msg.meters||{}))if(Number.isFinite(v))meters.set(k,v);
       render();
     }
    }catch{}
  }
 });
 proc.on('error',()=>{if(child===proc){child=null;busy=false;online=false;meters.clear();render();}});
 proc.on('exit',()=>{if(child===proc){child=null;busy=false;online=false;meters.clear();render();}});
}
function poll(){
 if(!active.size||busy)return;
 if(!child){startBridge();return;}
 const unique=new Map();
 for(const item of active.values()){
   if(item.action.endsWith('.app'))continue;
   const s=model.normalize(item.settings);
   unique.set(model.channel(s),s);
 }
 if(!unique.size)return;
 const paths=[],channels=[];
 for(const [key,s] of unique){
   paths.push(key+'.Gain',key+'.Mute');
   const d=model.levelDescriptor(s);
   channels.push({key,type:d.type,channels:d.channels});
 }
 busy=true;bridge({op:'get',paths,meters:channels});
}
function setParam(path,value){
 cache.set(path,value);
 bridge({op:'set',path,value});
 render();
 setTimeout(poll,90);
}
function compactGesture(ctx,gesture){
 const entry=active.get(ctx);
 if(!entry)return;
 if(entry.action.endsWith('.app')){
   const id=String(entry.settings?.appId||'').toLowerCase(),current=apps.get(id);
   if(!current)return;
   if(gesture==='mute')appCommand({op:'mute',app:id,value:!current.mute});
   else{
     const step=model.normalize(entry.settings).step/100;
     appCommand({op:'adjust',app:id,delta:gesture==='increase'?step:-step});
   }
   return;
 }
 if(!online)return;
 const s=model.normalize(entry.settings),base=model.channel(s);
 if(gesture==='mute'){
   const previous=cache.get(base+'.Mute')||0;
   setParam(base+'.Mute',previous?0:1);
   return;
 }
 const gain=cache.get(base+'.Gain');
 if(!Number.isFinite(gain))return;
 const delta=gesture==='increase'?s.step:-s.step;
 const next=Math.round(model.clamp(gain+delta,-60,12)*10)/10;
 setParam(base+'.Gain',next);
}
const compactGestures=createCompactGestures(compactGesture,{getMode:ctx=>active.get(ctx)?.settings?.muteGesture==='tapHold'?'tapHold':'doubleTap'});
function keyDown(message){
 const entry=active.get(message.context);
 if(!entry)return;
 if(message.action.endsWith('.app')){compactGestures.down(message.context);return;}
 if(!online)return;
 if(message.action.endsWith('.compact')){compactGestures.down(message.context);return;}
 const s=model.normalize(entry.settings),base=model.channel(s);
 const gain=cache.get(base+'.Gain'),mute=cache.get(base+'.Mute')||0;
 if(message.action.endsWith('.fader')||message.action.endsWith('.mute')){
   setParam(base+'.Mute',mute?0:1);
 }else if(message.action.endsWith('.segment')){
   setParam(base+'.Gain',model.segmentGain(s));
 }else if(Number.isFinite(gain)&&(message.action.endsWith('.up')||message.action.endsWith('.down'))){
   const delta=message.action.endsWith('.up')?s.step:-s.step;
   const next=Math.round(model.clamp(gain+delta,-60,12)*10)/10;
   setParam(base+'.Gain',next);
 }
}
ws=new WebSocket('ws://127.0.0.1:'+port);
ws.onopen=()=>{send({event:registration,uuid});startBridge();};
ws.onmessage=e=>{
 let m;try{m=JSON.parse(e.data);}catch{return;}
 if(m.event==='willAppear'){
   active.set(m.context,{action:m.action,settings:m.payload?.settings||{}});
   paint(m.context,active.get(m.context));
   if(m.action.endsWith('.app'))pollAppBridge();
   else poll();
 }else if(m.event==='willDisappear'){
   compactGestures.clear(m.context);
   active.delete(m.context);lastImage.delete(m.context);
 }else if(m.event==='didReceiveSettings'){
   const updated=m.payload?.settings||{};
   if(active.has(m.context)){
     compactGestures.clear(m.context);
     active.set(m.context,{action:m.action,settings:updated});
     lastImage.delete(m.context);render();poll();
     send({event:'sendToPropertyInspector',context:m.context,payload:{type:'settings-confirmed',settings:updated}});
   }
 }else if(m.event==='sendToPlugin'&&m.payload?.op==='list-apps'){
   pollAppBridge();tellInspector(m.context);
 }else if(m.event==='keyDown')keyDown(m);
 else if(m.event==='keyUp'&&(m.action.endsWith('.compact')||m.action.endsWith('.app')))compactGestures.up(m.context);
};
ws.onclose=()=>{compactGestures.clearAll();child?.kill();appProcess?.kill();process.exit(0);};
setInterval(poll,350);
setInterval(pollAppBridge,1500);
