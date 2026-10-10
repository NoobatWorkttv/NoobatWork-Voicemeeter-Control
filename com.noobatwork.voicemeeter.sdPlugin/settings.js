'use strict';
(() => {
  const channel = document.getElementById('channel');
  const label = document.getElementById('label');
  const step = document.getElementById('step');
  const stepWrapper = document.getElementById('step-wrapper');
  const status = document.getElementById('status');
  const channels = [
    {group:'Eingänge · Hardware', options:Array.from({length:5},(_,i)=>({value:'Strip:'+i,text:'Hardware Input '+(i+1)}))},
    {group:'Eingänge · Virtuell', options:Array.from({length:3},(_,i)=>({value:'Strip:'+(i+5),text:'Virtual Input '+(i+1)}))},
    {group:'Ausgänge · Physisch', options:Array.from({length:5},(_,i)=>({value:'Bus:'+i,text:'A'+(i+1)+' (Hardware Out)'}))},
    {group:'Ausgänge · Virtuell', options:Array.from({length:3},(_,i)=>({value:'Bus:'+(i+5),text:'B'+(i+1)+' (Virtual Out)'}))}
  ];
  for (const group of channels) {
    const parent=document.createElement('optgroup');
    parent.label=group.group;
    for(const item of group.options) {
      const el=document.createElement('option');
      el.value=item.value;el.textContent=item.text;parent.appendChild(el);
    }
    channel.appendChild(parent);
  }
  let ws,context,action;
  let settings={group:'Strip',index:0,label:'',step:2};
  function applySettings(s) {
    if (!s||typeof s!=='object') return;
    const group=s.group==='Bus'?'Bus':'Strip';
    const index=Math.min(7,Math.max(0,Number(s.index)||0));
    const n=Number(s.step);
    settings={group,index,label:typeof s.label==='string'?s.label:'',step:Number.isFinite(n)&&n>0?Math.min(12,n):2};
    channel.value=group+':'+index;
    label.value=settings.label;
    step.value=String(settings.step);
  }
  function save() {
    if(!ws||ws.readyState!==WebSocket.OPEN||!context||!action) return;
    const selected=channel.value.split(':');
    const n=Number(step.value);
    settings={
      group:selected[0]==='Bus'?'Bus':'Strip',
      index:Math.max(0,Math.min(7,Number(selected[1])||0)),
      label:label.value.trim().slice(0,24),
      step:Number.isFinite(n)?Math.min(12,Math.max(.1,n)):2
    };
    ws.send(JSON.stringify({event:'setSettings',action,context,payload:settings}));
    status.textContent='Gespeichert';
  }
  [channel,label,step].forEach(el=>el.addEventListener('change',save));
  window.connectElgatoStreamDeckSocket=(port,uuid,event,info,actionInfo)=>{
    const details=JSON.parse(actionInfo);
    context=details.context||uuid;
    action=details.action;
    const keyIsStep=action?.endsWith('.up')||action?.endsWith('.down');
    stepWrapper.hidden=!keyIsStep;
    applySettings(details.payload?.settings||{});
    ws=new WebSocket('ws://127.0.0.1:'+port);
    ws.onopen=()=>{
      ws.send(JSON.stringify({event,uuid}));
      ws.send(JSON.stringify({event:'getSettings',action,context}));
      status.textContent='Verbunden · Einstellungen werden gespeichert';
    };
    ws.onmessage=e=>{
      try {
        const msg=JSON.parse(e.data);
        if(msg.event==='didReceiveSettings'&&msg.context===context){
          applySettings(msg.payload?.settings||{});
        }
      } catch {status.textContent='Einstellungen konnten nicht gelesen werden';}
    };
    ws.onclose=()=>{status.textContent='Nicht verbunden';};
    ws.onerror=()=>{status.textContent='Verbindungsfehler';};
  };
})();
