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
