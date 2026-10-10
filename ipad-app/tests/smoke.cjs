'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const http='http://127.0.0.1:8876';
const token=fs.readFileSync(process.env.APPDATA+'\\NoobatWork\\iPadMixer\\pair-token.txt','utf8').trim();
const origin=http;
async function request(path,opts={}){
 return fetch(http+path,opts);
}
(async()=>{
 const page=await request('/');
 assert.equal(page.status,200,'the full iPad UI must be served');
 const html=await page.text();
 assert.ok(html.includes('Audio Mixer'));
 for(const asset of ['/style.css','/app.js']){
  const res=await request(asset);assert.equal(res.status,200,'missing '+asset);
 }
 const forbidden=await request('/api/state');
 assert.equal(forbidden.status,401,'live audio must never be exposed to unauthenticated browser requests');
 const good=await request('/api/state',{headers:{Authorization:'Bearer '+token}});
 assert.equal(good.status,200);
 const state=await good.json();
 assert.equal(state.type,'state');
 assert.ok(Array.isArray(state.channels)&&state.channels.length===16);
 const bad=await request('/api/pair',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify({code:'000000'})});
 assert.equal(bad.status,401);
 const output=fs.readFileSync(process.env.NAW_SERVER_LOG,'utf8');
 const pairing=output.match(/Pairing-Code:\s*(\d{6})/);
 assert.ok(pairing,'server must visibly print six digit pairing code');
 const linked=await request('/api/pair',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify({code:pairing[1]})});
 assert.equal(linked.status,200,'iPad pairing endpoint must accept the displayed code');
 const pairData=await linked.json();assert.equal(pairData.token,token);
 assert.ok(typeof WebSocket==='function','Node 22 WebSocket expected');
 const ws=new WebSocket('ws://127.0.0.1:8876/ws',{headers:{Origin:origin}});
 // Node built-in WebSocket does not allow overriding Origin. It normally
 // supplies a valid automatic Origin; the secure endpoint will reject if absent.
 const payload=await new Promise((resolve,reject)=>{
  const timer=setTimeout(()=>reject(new Error('Timed out waiting for authenticated state')),10000);
  ws.addEventListener('open',()=>ws.send(JSON.stringify({type:'auth',token})));
  ws.addEventListener('message',event=>{
   let msg;try{msg=JSON.parse(event.data);}catch{return;}
   if(msg.type==='state'){clearTimeout(timer);resolve(msg);}
   if(msg.type==='unauthorized'){clearTimeout(timer);reject(new Error('WebSocket Origin/authentication rejected'));}
  });
  ws.addEventListener('error',()=>{clearTimeout(timer);reject(new Error('WebSocket error'));});
 });
 assert.equal(payload.type,'state');
 ws.close();
 console.log('PASS: static iPad UI, 401 without auth, private pairing, 16 Voicemeeter channels, authenticated live WebSocket');
})().catch(error=>{console.error(error);process.exitCode=1;});
