// Serves the real Control Center web client with deterministic audio sessions.
const http=require('node:http'),fs=require('node:fs'),path=require('node:path');
const {WebSocketServer}=require('ws');
const root=path.resolve(__dirname,'../../control-center/wwwroot');
const token='a'.repeat(64);
const server=http.createServer((req,res)=>{
 if(req.url==='/api/pair') { let body='';req.on('data',x=>body+=x);req.on('end',()=>{res.writeHead(JSON.parse(body).code==='123456'?200:401,{'Content-Type':'application/json'});res.end(JSON.stringify({token}));});return; }
 const file=path.join(root,req.url==='/'?'index.html':req.url.slice(1));
 if(!file.startsWith(root+path.sep)||!fs.existsSync(file)){res.writeHead(404);res.end();return;}
 res.setHeader('Content-Type',file.endsWith('.js')?'application/javascript':file.endsWith('.css')?'text/css':'text/html');res.end(fs.readFileSync(file));
});
const wss=new WebSocketServer({server,path:'/ws'});
let sawCommand=false;
wss.on('connection',socket=>{
 let authorized=false,game=false,mute=false;
 const snapshot=()=>({type:'state',vmOnline:true,appOnline:true,apps:game?[{id:'escapefromtarkov.exe',name:'EscapeFromTarkov',device:'Voicemeeter VAIO3',volume:.5,peak:.1,mute}]:[],channels:Array.from({length:16},(_,i)=>({id:i<8?`Strip[${i}]`:`Bus[${i-8}]`,name:'Channel '+i,kind:i<8?'strip':'bus',gain:0,peak:0,mute:false,online:true}))});
 const send=()=>{if(authorized&&socket.readyState===1)socket.send(JSON.stringify(snapshot()));};
 socket.on('message',data=>{
  const msg=JSON.parse(data);
  if(msg.type==='auth'&&msg.token===token){authorized=true;socket.send(JSON.stringify({type:'profile',profile:{Name:'Tablet',Layout:'split',Items:[]}}));send();setTimeout(()=>{game=true;send();},800);}
  if(authorized&&msg.type==='command'&&msg.command.id==='escapefromtarkov.exe'&&msg.command.op==='mute'){mute=msg.command.value;sawCommand=true;fs.writeFileSync(process.env.FIXTURE_PROOF||'/tmp/mixer-command-proof.json',JSON.stringify({received:true,command:msg.command}));send();}
 });
 const timer=setInterval(send,300);socket.on('close',()=>clearInterval(timer));
});
server.listen(18879,'127.0.0.1',()=>console.log('Mixer fixture ready'));
