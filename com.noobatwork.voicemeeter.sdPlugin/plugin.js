'use strict';
const {spawn}=require('node:child_process');
const {join}=require('node:path');
const model=require('./fader-model.js');
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
 const data=apps.get(id),saved=item.settings||{};
 const label=esc(String(saved.label||data?.name||id||'App auswählen').slice(0,22));
 const volume=typeof data?.volume==='number'?data.volume:0;
 const level=Math.max(0,Math.min(100,Math.round(volume*100)));
 const mute=!!data?.mute;
 const active=appReady&&!!data;
 const color=mute?'#fb7185':'#2dd4b6';
 const body=['<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 144 144">',
 '<rect width="144" height="144" fill="#101a2b"/>',
 '<text x="72" y="21" text-anchor="middle" font-family="Arial" font-weight="bold" font-size="13" fill="#f0f5fa">'+label+'</text>',
 '<rect x="12" y="31" width="120" height="75" rx="12" fill="#25384c"/>',
 '<text x="72" y="71" text-anchor="middle" font-family="Arial" font-weight="bold" font-size="30" fill="'+color+'">'+(active?(mute?'MUTE':level+'%'):'OFFLINE')+'</text>',
 '<text x="72" y="93" text-anchor="middle" font-family="Arial" font-size="10" fill="#b4cbd3">TAP +  |  HOLD −</text>',
 '<rect x="15" y="114" width="114" height="10" rx="4" fill="#3a5260"/>',
 '<rect x="15" y="114" width="'+(114*level/100)+'" height="10" rx="4" fill="'+color+'"/>',
 '<text x="72" y="139" text-anchor="middle" font-family="Arial" font-size="9" fill="#c7d5e5">2× TIP = MUTE</text></svg>'];
 const image='data:image/svg+xml,'+encodeURIComponent(body.join(''));
 if(lastImage.get(ctx)!==image){lastImage.set(ctx,image);send({event:'setImage',context:ctx,payload:{image,target:0}});}
}

const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
function send(obj){if(ws?.readyState===1)ws.send(JSON.stringify(obj));}
function bridge(obj){if(child?.stdin?.writable)child.stdin.write(JSON.stringify(obj)+'\n');}
function gainText(g){return Number.isFinite(g)?g.toFixed(1)+' dB':'-- dB';}
function makeImage(action,s,base){
 const title=esc(s.label||model.defaultLabel(s));
 const gotGain=cache.has(base+'.Gain');
 const gain=gotGain?cache.get(base+'.Gain'):-60;
 const mute=cache.get(base+'.Mute')===1;
 const mp=model.meterPercent(meters.get(base)||0);
 const gp=model.gainPercent(gain);
 const valid=online&&gotGain;
 const status=!online?'OFFLINE':!gotGain?'-- dB':mute?'MUTED':gainText(gain);
 const compact=action.endsWith('.compact');
 const muteAction=action.endsWith('.mute');
 const segment=action.endsWith('.segment');
 const activeSegment=valid&&gain>=model.segmentGain(s)-.1;
 const c=mute?'#fa7189':'#22c7a9';
 const parts=[
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 144 144">',
  '<rect width="144" height="144" fill="#101a2b"/>',
  '<text x="72" y="21" text-anchor="middle" font-size="13" font-family="Arial,sans-serif" font-weight="bold" fill="#f0f5fa">'+title+'</text>'
 ];
 if(compact){
   const db=valid?gainText(gain):'OFFLINE';
   const tint=mute?'#fb7185':'#eafbf7';
   parts.push('<rect x="10" y="29" width="124" height="68" rx="11" fill="#1f3540"/>');
   parts.push('<text x="72" y="61" text-anchor="middle" font-family="Arial" font-size="27" font-weight="bold" fill="'+tint+'">'+(mute?'MUTE':db)+'</text>');
   parts.push('<text x="72" y="80" text-anchor="middle" font-family="Arial" font-size="10" fill="#b5e9df">TAP +  |  HOLD −</text>');
   parts.push('<rect x="14" y="98" width="116" height="9" rx="3" fill="#38495b"/>');
   parts.push('<rect x="14" y="98" width="'+(116*gp/100)+'" height="9" rx="3" fill="'+c+'"/>');
   parts.push('<text x="72" y="117" text-anchor="middle" font-size="9" font-family="Arial" fill="#c7d5e5">FADER  ·  2× MUTE</text>');
 }else if(segment){
   const target=model.segmentGain(s);
   parts.push('<rect x="14" y="34" width="116" height="65" rx="12" stroke="'+(activeSegment?c:'#566476')+'" stroke-width="3" fill="'+(activeSegment?'#225b58':'#253044')+'"/>');
   parts.push('<text x="72" y="57" text-anchor="middle" font-size="12" fill="#dce6f3" font-family="Arial">'+s.segment+' / 5</text>');
   parts.push('<text x="72" y="82" text-anchor="middle" font-size="21" font-weight="bold" font-family="Arial" fill="'+(activeSegment?'#f6ffff':'#a6bacd')+'">'+target.toFixed(0)+' dB</text>');
 }else if(muteAction){
   parts.push('<rect x="18" y="34" width="108" height="65" rx="14" fill="'+(mute?'#9b2d50':'#235b56')+'"/>');
   parts.push('<text x="72" y="73" text-anchor="middle" font-family="Arial" font-size="19" font-weight="bold" fill="#fff">'+(mute?'MUTED':'MUTE')+'</text>');
 }else if(action.endsWith('.up')||action.endsWith('.down')){
   const up=action.endsWith('.up');
   parts.push('<text x="72" y="89" text-anchor="middle" font-family="Arial" font-size="65" font-weight="bold" fill="'+c+'">'+(up?'+':'−')+'</text>');
 }else{
   parts.push('<rect x="61" y="31" width="22" height="69" rx="4" fill="#465365"/>');
   parts.push('<rect x="61" y="'+(100-gp*.69)+'" width="22" height="'+(gp*.69)+'" rx="4" fill="'+c+'"/>');
   parts.push('<rect x="47" y="'+(100-gp*.69-4)+'" width="50" height="8" rx="3" fill="#e1f0f6"/>');
 }
 if(!compact)parts.push('<text x="72" y="116" text-anchor="middle" font-size="12" font-family="Arial" fill="#e5edf6">'+status+'</text>');
 // True signal meter (post-mute for strips, output for buses). It is NOT the gain indicator.
 parts.push('<rect x="14" y="123" width="116" height="9" rx="3" fill="#384456"/>');
 parts.push('<rect x="14" y="123" width="'+(116*mp/100)+'" height="9" rx="3" fill="'+(mp>90?'#fbbe55':'#39cbac')+'"/>');
 parts.push('</svg>');
 return 'data:image/svg+xml,'+encodeURIComponent(parts.join(''));
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
const compactGestures=createCompactGestures(compactGesture);
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
