const {test}=require('node:test');
const assert=require('node:assert/strict');
const {apply}=require('../wwwroot/profile.js');
test('profile ordering, names, visibility, color and new channels',()=>{
 const input=[{type:'channel',id:'Strip[0]',name:'Mic'},{type:'app',id:'game.exe',name:'Game'},{type:'channel',id:'Bus[0]',name:'A1'}];
 const profile={Items:[{Key:'channel:Bus[0]',Name:'Speakers',Visible:true,Color:'#ff8800'},{Key:'channel:Strip[0]',Name:'',Visible:false,Color:'#000000'}]};
 const result=apply(input,profile);
 assert.deepEqual(result.map(x=>x.id),['Bus[0]','game.exe']);
 assert.equal(result[0].name,'Speakers');assert.equal(result[0].color,'#ff8800');
 assert.equal(input[2].name,'A1');
});
test('invalid colors cannot become CSS and no profile preserves order',()=>{
 const input=[{type:'app',id:'x.exe',name:'X'}];
 assert.deepEqual(apply(input,null),input);
 assert.equal(apply(input,{Items:[{Key:'app:x.exe',Name:'',Visible:true,Color:'url(bad)'}]})[0].color,undefined);
});

test('late EFT discovery remains reachable and respects saved hidden apps',()=>{
 const {unconfiguredApps}=require('../wwwroot/profile.js');
 const profile={Items:[{Key:'app:discord.exe',Visible:false}]};
 const old=[{id:'discord.exe'}],eft={id:'escapefromtarkov.exe',name:'EscapeFromTarkov'};
 assert.deepEqual(unconfiguredApps(old,profile),[]);
 assert.deepEqual(unconfiguredApps([...old,eft],profile),[eft]);
 assert.deepEqual(apply([...old,eft].map(x=>({...x,type:'app'})),profile).map(x=>x.id),[eft.id]);
 assert.deepEqual(unconfiguredApps([],profile),[]);
 assert.deepEqual(unconfiguredApps([eft],{Items:[{Key:'app:'+eft.id,Visible:true}]}),[]);
});
