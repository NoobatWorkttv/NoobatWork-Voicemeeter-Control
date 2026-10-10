'use strict';
const { spawn } = require('node:child_process');
const { join } = require('node:path');
const args=process.argv.slice(2);
function arg(name){let n=args.indexOf(name);return n===-1?null:args[n+1];}
const port=arg('-port'),uuid=arg('-pluginUUID'),reg=arg('-registerEvent');
if(!port||!uuid||!reg)process.exit(1);
let ws,child,buffer='',online=false;
const active=new Map(),cache=new Map();
function send(x){if(ws?.readyState===1)ws.send(JSON.stringify(x));}
function bridge(x){if(child?.stdin?.writable)child.stdin.write(JSON.stringify(x)+'\n');}
function channel(s){return (s?.group==='Bus'?'Bus':'Strip')+'['+Math.max(0,Math.min(7,Number(s?.index)||0))+']';}
function paint(ctx,a){
 const base=channel(a),gain=cache.get(base+'.Gain')??-60,mute=cache.get(base+'.Mute')===1;
 const pct=Math.max(0,Math.min(100,(gain+60)/72*100));
 const title=String(a.label||base).slice(0,18).replace(/[<&>"']/g,'');
 const v=online?(mute?'MUTED':gain.toFixed(1)+' dB'):'OFFLINE';
 const svg='<svg xmlns="http://www.w3.org/2000/svg" width="144" height="144"><rect width="144" height="144" fill="#101927"/><text x="72" y="24" text-anchor="middle" font-size="15" fill="white">'+title+'</text><rect x="62" y="37" width="20" height="80" fill="#3c4b58"/><rect x="62" y="'+(117-pct*.8)+'" width="20" height="'+(pct*.8)+'" fill="'+(mute?'#fb7185':'#21bfa5')+'"/><text x="72" y="138" text-anchor="middle" font-size="14" fill="white">'+v+'</text></svg>';
 send({event:'setImage',context:ctx,payload:{image:'data:image/svg+xml,'+encodeURIComponent(svg),target:0}});
}
function render(){for(const [ctx,a] of active)paint(ctx,a);}
function startBridge(){
 if(child)return;
 const exe=join(process.env.WINDIR||'C:\\Windows','System32','WindowsPowerShell','v1.0','powershell.exe');
 child=spawn(exe,['-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',join(__dirname,'bridge.ps1')],{windowsHide:true,stdio:['pipe','pipe','pipe']});
 child.stdout.setEncoding('utf8');
 child.stdout.on('data',chunk=>{buffer+=chunk;let n;while((n=buffer.indexOf('\n'))!==-1){const line=buffer.slice(0,n);buffer=buffer.slice(n+1);try{const msg=JSON.parse(line);if(msg.values){online=true;for(const [k,v] of Object.entries(msg.values))cache.set(k,v);render();}}catch{}}});
 child.on('exit',()=>{child=null;online=false;cache.clear();render();});
 child.on('error',()=>{child=null;online=false;render();});
}
function poll(){if(!active.size)return;if(!child){startBridge();return;}const paths=[...new Set([...active.values()].flatMap(a=>[channel(a)+'.Gain',channel(a)+'.Mute']))];bridge({op:'get',paths});}
function press(ev){
 const a=active.get(ev.context);if(!a)return;
 const c=channel(a),gain=cache.get(c+'.Gain'),mute=cache.get(c+'.Mute')||0;
 if(ev.action.endsWith('.fader'))bridge({op:'set',path:c+'.Mute',value:mute?0:1});
 else if(Number.isFinite(gain))bridge({op:'set',path:c+'.Gain',value:Math.max(-60,Math.min(12,gain+(ev.action.endsWith('.up')?2:-2)))});
 setTimeout(poll,130);
}
ws=new WebSocket('ws://127.0.0.1:'+port);
ws.onopen=()=>{send({event:reg,uuid});startBridge();};
ws.onmessage=e=>{let m;try{m=JSON.parse(e.data);}catch{return;}
 if(m.event==='willAppear'){active.set(m.context,m.payload?.settings||{});paint(m.context,active.get(m.context));poll();}
 if(m.event==='willDisappear')active.delete(m.context);
 if(m.event==='didReceiveSettings'){active.set(m.context,m.payload?.settings||{});render();poll();}
 if(m.event==='keyDown')press(m);
};
ws.onclose=()=>{child?.kill();process.exit(0);};
setInterval(poll,500);
