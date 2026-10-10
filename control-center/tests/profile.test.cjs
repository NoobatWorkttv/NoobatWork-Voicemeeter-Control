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
