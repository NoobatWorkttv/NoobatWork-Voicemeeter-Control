'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const net=require('node:net');
const crypto=require('node:crypto');
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
 assert.ok(html.includes('id="layout-mode"'),'missing layout selector');
 assert.ok(html.includes('data-tab="favorites"'),'missing favorites view');
 assert.ok(html.includes('id="edit-favorites"'),'missing favorite edit mode');
 for(const asset of ['/style.css','/app.js','/favorites.js']){
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
 const payload=await new Promise((resolve,reject)=>{
   const socket=net.createConnection({host:'127.0.0.1',port:8876});
   let bytes=Buffer.alloc(0),upgraded=false;
   const timeout=setTimeout(()=>{socket.destroy();reject(new Error('Timed out waiting for authenticated WebSocket state'));},10000);
   function fail(err){clearTimeout(timeout);socket.destroy();reject(err);}
   function textFrame(message){
     const buf=Buffer.from(message,'utf8');
     const mask=crypto.randomBytes(4);
     if(buf.length>=126)throw new Error('Smoke payload unexpectedly large');
     const out=Buffer.alloc(6+buf.length);
     out[0]=0x81;out[1]=0x80|buf.length;mask.copy(out,2);
     for(let i=0;i<buf.length;i++)out[6+i]=buf[i]^mask[i%4];
     return out;
   }
   socket.on('connect',()=>{
     const key=crypto.randomBytes(16).toString('base64');
     socket.write('GET /ws HTTP/1.1\r\nHost: 127.0.0.1:8876\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Key: '+key+'\r\nSec-WebSocket-Version: 13\r\nOrigin: '+origin+'\r\n\r\n');
   });
   socket.on('error',fail);
   socket.on('data',chunk=>{
     bytes=Buffer.concat([bytes,chunk]);
     if(!upgraded){
       const pos=bytes.indexOf('\r\n\r\n');if(pos<0)return;
       const headers=bytes.subarray(0,pos).toString('ascii');
       if(!headers.startsWith('HTTP/1.1 101'))return fail(new Error('WebSocket upgrade rejected: '+headers));
       bytes=bytes.subarray(pos+4);upgraded=true;
       socket.write(textFrame(JSON.stringify({type:'auth',token})));
     }
     if(bytes.length<2)return;
     const lengthTag=bytes[1]&127;
     let length=lengthTag,offset=2;
     if(lengthTag===126){if(bytes.length<4)return;length=bytes.readUInt16BE(2);offset=4;}
     if(lengthTag===127){if(bytes.length<10)return;length=Number(bytes.readBigUInt64BE(2));offset=10;}
     if(bytes.length<offset+length)return;
     const message=JSON.parse(bytes.subarray(offset,offset+length).toString('utf8'));
     if(message.type==='state'){clearTimeout(timeout);socket.destroy();resolve(message);}
     if(message.type==='unauthorized')fail(new Error('Token unexpectedly rejected'));
   });
 });
 assert.equal(payload.type,'state');
 console.log('PASS: static iPad UI, 401 without auth, private pairing, 16 Voicemeeter channels, authenticated live WebSocket');
})().catch(error=>{console.error(error);process.exitCode=1;});
