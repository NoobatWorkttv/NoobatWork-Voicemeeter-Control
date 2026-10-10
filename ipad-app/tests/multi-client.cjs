'use strict';
const assert=require('node:assert/strict');
const net=require('node:net');
const crypto=require('node:crypto');
const fs=require('node:fs');
const token=fs.readFileSync(process.env.APPDATA+'\\NoobatWork\\iPadMixer\\pair-token.txt','utf8').trim();

function client(name){
 return new Promise((resolve,reject)=>{
   const sock=net.createConnection({host:'127.0.0.1',port:8876});
   let upgraded=false,buffer=Buffer.alloc(0),settled=false;
   const timer=setTimeout(()=>done(new Error(name+': no authenticated stream after 8s')),8000);
   function done(error,value){
     if(settled)return;
     settled=true;clearTimeout(timer);sock.destroy();
     if(error)reject(error);else resolve(value);
   }
   sock.on('connect',()=>{
     const key=crypto.randomBytes(16).toString('base64');
     sock.write('GET /ws HTTP/1.1\r\nHost: 127.0.0.1:8876\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Key: '+key+'\r\nSec-WebSocket-Version: 13\r\nOrigin: http://127.0.0.1:8876\r\n\r\n');
   });
   sock.on('error',done);
   sock.on('data',part=>{
     if(settled)return;
     buffer=Buffer.concat([buffer,part]);
     if(!upgraded){
       const boundary=buffer.indexOf('\r\n\r\n');
       if(boundary<0)return;
       if(!buffer.subarray(0,boundary).toString('ascii').startsWith('HTTP/1.1 101'))
         return done(new Error('Upgrade failed'));
       buffer=buffer.subarray(boundary+4);
       upgraded=true;
       const body=Buffer.from(JSON.stringify({type:'auth',token}));
       const mask=crypto.randomBytes(4);
       const frame=Buffer.alloc(body.length+6);
       frame[0]=0x81;frame[1]=body.length|0x80;mask.copy(frame,2);
       body.forEach((b,i)=>{frame[6+i]=b^mask[i%4];});
       sock.write(frame);
     }
     if(buffer.length<2)return;
     const l=buffer[1]&0x7f;let size=l,offset=2;
     if(l===126){if(buffer.length<4)return;size=buffer.readUInt16BE(2);offset=4;}
     if(l===127){if(buffer.length<10)return;size=Number(buffer.readBigUInt64BE(2));offset=10;}
     if(buffer.length<offset+size)return;
     try{
       const msg=JSON.parse(buffer.subarray(offset,offset+size).toString('utf8'));
       if(msg.type==='state')done(null,msg);
       else done(new Error(name+' unexpected reply '+msg.type));
     }catch(e){done(e);}
   });
 });
}
(async()=>{
 const [ipad,android]=await Promise.all([client('iPad'),client('Android')]);
 assert.equal(ipad.type,'state');
 assert.equal(android.type,'state');
 assert.equal(ipad.channels.length,16);
 assert.equal(android.channels.length,16);
 console.log('PASS: two independently authenticated tablet WebSockets receive mixer state concurrently');
})().catch(error=>{console.error(error);process.exitCode=1;});
