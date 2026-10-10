'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {readFileSync}=require('node:fs');
const {join}=require('node:path');
const vm=require('node:vm');

function launchInspector(action='com.noobatwork.voicemeeter.fader') {
  const elements={};
  function element() {
    return {
      value:'',textContent:'',hidden:false,children:[],listeners:{},
      appendChild(child){this.children.push(child);},
      addEventListener(kind,cb){(this.listeners[kind]??=[]).push(cb);},
      emit(kind){for(const cb of this.listeners[kind]||[])cb();}
    };
  }
  const document={
    getElementById(id){return elements[id]??(elements[id]=element());},
    createElement(){return element();}
  };
  const connections=[];
  class MockSocket {
    static OPEN=1;
    constructor(url) {this.url=url;this.readyState=1;this.sent=[];connections.push(this);}
    send(json){this.sent.push(JSON.parse(json));}
    recv(msg){this.onmessage({data:JSON.stringify(msg)});}
  }
  const window={};
  const source=readFileSync(join(__dirname,'../com.noobatwork.voicemeeter.sdPlugin/settings.js'),'utf8');
  vm.runInNewContext(source,{window,document,WebSocket:MockSocket,setTimeout:()=>1,clearTimeout:()=>{}});
  const init={action,context:'incorrect-action-context',payload:{settings:{group:'Strip',index:0,label:'',step:2}}};
  window.connectElgatoStreamDeckSocket('12345','inspector-uuid','registerPropertyInspector','{}',JSON.stringify(init));
  const socket=connections[0];
  socket.onopen();
  return {socket,elements,action};
}

test('PI uses registration UUID (not actionInfo.context) to request and persist settings',()=>{
  const {socket,elements,action}=launchInspector();
  assert.equal(socket.sent[0].event,'registerPropertyInspector');
  assert.equal(socket.sent[1].event,'getSettings');
  assert.equal(socket.sent[1].context,'inspector-uuid');
  elements.channel.value='Bus:0';
  elements.channel.emit('change');
  const save=socket.sent.at(-1);
  assert.equal(save.event,'setSettings');
  assert.equal(save.action,action);
  assert.equal(save.context,'inspector-uuid');
  assert.equal(save.payload.group,'Bus');
  assert.equal(save.payload.index,0);
  assert.equal(elements.status.textContent,'Speichern …');
});

test('delayed stale settings cannot overwrite unsaved selection; confirmation is real',()=>{
  const {socket,elements,action}=launchInspector();
  elements.channel.value='Strip:6';
  elements.channel.emit('change');
  socket.recv({event:'didReceiveSettings',action,context:'inspector-uuid',payload:{settings:{group:'Strip',index:0,label:'',step:2}}});
  assert.equal(elements.channel.value,'Strip:6');
  assert.equal(elements.status.textContent,'Speichern …');
  socket.recv({event:'sendToPropertyInspector',action,context:'action-uuid',
    payload:{type:'settings-confirmed',settings:{group:'Strip',index:6,label:'',step:2}}});
  assert.equal(elements.status.textContent,'✓ Gespeichert');
  assert.equal(elements.channel.value,'Strip:6');
});

test('per-key label and dB step are persisted together with channel',()=>{
  const {socket,elements}=launchInspector('com.noobatwork.voicemeeter.up');
  assert.equal(elements['step-wrapper'].hidden,false);
  elements.channel.value='Bus:7';
  elements.label.value='Discord';
  elements.step.value='0.5';
  elements.channel.emit('change');
  const s=socket.sent.at(-1).payload;
  assert.equal(s.group,'Bus');
  assert.equal(s.index,7);
  assert.equal(s.label,'Discord');
  assert.equal(s.step,0.5);
});


test('touch fader inspector persists segment index and range per key',()=>{
  const {socket,elements,action}=launchInspector('com.noobatwork.voicemeeter.segment');
  assert.equal(elements['segment-wrapper'].hidden,false);
  assert.equal(elements['step-wrapper'].hidden,true);
  elements.channel.value='Strip:5';
  elements.segment.value='4';
  elements.minGain.value='-40';
  elements.maxGain.value='0';
  elements.label.value='Game';
  elements.channel.emit('change');
  const saved=socket.sent.at(-1);
  assert.equal(saved.event,'setSettings');
  assert.equal(saved.action,action);
  assert.equal(saved.context,'inspector-uuid');
  assert.equal(saved.payload.group,'Strip');
  assert.equal(saved.payload.index,5);
  assert.equal(saved.payload.segment,4);
  assert.equal(saved.payload.minGain,-40);
  assert.equal(saved.payload.maxGain,0);
  assert.equal(saved.payload.label,'Game');
  socket.recv({event:'sendToPropertyInspector',action,context:'action-instance',payload:{
    type:'settings-confirmed',settings:saved.payload
  }});
  assert.equal(elements.status.textContent,'✓ Gespeichert');
  assert.equal(elements.segment.value,'4');
});

test('standalone mute key hides step and touch fader configuration',()=>{
  const {elements}=launchInspector('com.noobatwork.voicemeeter.mute');
  assert.equal(elements['step-wrapper'].hidden,true);
  assert.equal(elements['segment-wrapper'].hidden,true);
});

test('compact mixer inspector exposes step but hides five-key segment controls',()=>{
  const {socket,elements,action}=launchInspector('com.noobatwork.voicemeeter.compact');
  assert.equal(elements['step-wrapper'].hidden,false);
  assert.equal(elements['compact-wrapper'].hidden,false);
  assert.equal(elements['segment-wrapper'].hidden,true);
  elements.channel.value='Bus:3';
  elements.step.value='1.5';
  elements.label.value='Stream';
  elements.channel.emit('change');
  const saved=socket.sent.at(-1);
  assert.equal(saved.event,'setSettings');
  assert.equal(saved.action,action);
  assert.equal(saved.context,'inspector-uuid');
  assert.equal(saved.payload.group,'Bus');
  assert.equal(saved.payload.index,3);
  assert.equal(saved.payload.step,1.5);
  assert.equal(saved.payload.label,'Stream');
});

test('application inspector discovers sessions and persists selected executable',()=>{
  const {socket,elements,action}=launchInspector('com.noobatwork.voicemeeter.app');
  assert.equal(elements['app-wrapper'].hidden,false);
  assert.equal(elements['channel-wrapper'].hidden,true);
  assert.equal(elements['step-wrapper'].hidden,false);
  assert.equal(socket.sent.at(-1).event,'sendToPlugin');
  assert.equal(socket.sent.at(-1).payload.op,'list-apps');
  socket.recv({event:'sendToPropertyInspector',action,context:'inspector-uuid',
    payload:{type:'app-list',apps:[
      {id:'discord.exe',name:'Discord',device:'Voicemeeter VAIO3',volume:0.4,mute:false},
      {id:'opera.exe',name:'Opera GX',device:'Voicemeeter VAIO3',volume:0.8,mute:false}
    ]}});
  elements.app.value='opera.exe';
  elements.step.value='5';
  elements.app.emit('change');
  const msg=socket.sent.at(-1);
  assert.equal(msg.event,'setSettings');
  assert.equal(msg.context,'inspector-uuid');
  assert.equal(msg.payload.appId,'opera.exe');
  assert.equal(msg.payload.step,5);
  socket.recv({event:'sendToPropertyInspector',action,context:'action',
    payload:{type:'settings-confirmed',settings:msg.payload}});
  assert.equal(elements.status.textContent,'✓ Gespeichert');
});

test('existing mixer keys use classical double tap until explicitly changed',()=>{
  const {socket,elements}=launchInspector('com.noobatwork.voicemeeter.compact');
  assert.equal(elements['mute-gesture-wrapper'].hidden,false);
  assert.equal(elements.muteGesture.value,'doubleTap');
  elements.channel.value='Strip:7';
  elements.channel.emit('change');
  assert.equal(socket.sent.at(-1).payload.muteGesture,'doubleTap');
});

test('compact mixer can select tap then hold mode; settings persist and confirm',()=>{
  const {socket,elements,action}=launchInspector('com.noobatwork.voicemeeter.compact');
  elements.muteGesture.value='tapHold';
  elements.muteGesture.emit('change');
  const saved=socket.sent.at(-1);
  assert.equal(saved.event,'setSettings');
  assert.equal(saved.context,'inspector-uuid');
  assert.equal(saved.payload.muteGesture,'tapHold');
  socket.recv({event:'sendToPropertyInspector',action,context:'instance',payload:{
    type:'settings-confirmed',settings:saved.payload
  }});
  assert.equal(elements.muteGesture.value,'tapHold');
  assert.equal(elements.status.textContent,'✓ Gespeichert');
});

test('app mixer exposes gesture selector; mute action does not',()=>{
  const app=launchInspector('com.noobatwork.voicemeeter.app');
  assert.equal(app.elements['mute-gesture-wrapper'].hidden,false);
  app.elements.muteGesture.value='tapHold';
  app.elements.muteGesture.emit('change');
  assert.equal(app.socket.sent.at(-1).payload.muteGesture,'tapHold');
  const mute=launchInspector('com.noobatwork.voicemeeter.mute');
  assert.equal(mute.elements['mute-gesture-wrapper'].hidden,true);
});
