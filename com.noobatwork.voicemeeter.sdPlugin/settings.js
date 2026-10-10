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
      el.value=item.value; el.textContent=item.text; parent.appendChild(el);
    }
    channel.appendChild(parent);
  }
  let ws, context, action, pending=null, debounce;
  let settings={group:'Strip',index:0,label:'',step:2};
  const normalize=s=>{
    s=s||{};
    const index=Number(s.index), n=Number(s.step);
    return {
      group:s.group==='Bus'?'Bus':'Strip',
      index:Number.isFinite(index)?Math.max(0,Math.min(7,Math.trunc(index))):0,
      label:typeof s.label==='string'?s.label.slice(0,24):'',
      step:Number.isFinite(n)&&n>0?Math.max(.1,Math.min(12,n)):2
    };
  };
  const equals=(a,b)=>{
    a=normalize(a);b=normalize(b);
    return a.group===b.group&&a.index===b.index&&a.label===b.label&&a.step===b.step;
  };
  function applySettings(s) {
    settings=normalize(s);
    channel.value=settings.group+':'+settings.index;
    label.value=settings.label;
    step.value=String(settings.step);
  }
  function collect() {
    const selected=channel.value.split(':');
    const index=Number(selected[1]);
    return normalize({
      group:selected[0],index:Number.isFinite(index)?index:0,
      label:label.value.trim(),step:Number(step.value)
    });
  }
  function save() {
    if(!ws||ws.readyState!==WebSocket.OPEN||!context||!action) {
      status.textContent='Nicht verbunden – bitte Taste erneut auswählen';
      return;
    }
    settings=collect();
    pending=settings;
    // 'uuid' from connectElgatoStreamDeckSocket is the UI context the
    // property inspector MUST use for setSettings/getSettings requests.
    ws.send(JSON.stringify({event:'setSettings',action,context,payload:settings}));
    status.textContent='Speichern …';
  }
  channel.addEventListener('change',save);
  step.addEventListener('change',save);
  label.addEventListener('change',()=>{clearTimeout(debounce);save();});
  label.addEventListener('input',()=>{
    clearTimeout(debounce);
    status.textContent='Änderung noch nicht bestätigt';
    debounce=setTimeout(save,350);
  });
  step.addEventListener('input',()=>{
    clearTimeout(debounce);
    status.textContent='Änderung noch nicht bestätigt';
    debounce=setTimeout(save,350);
  });

  window.connectElgatoStreamDeckSocket=(port,uuid,event,info,actionInfo)=>{
    try {
      const details=JSON.parse(actionInfo);
      // IMPORTANT: details.context is NOT guaranteed to be the UI context;
      // the 2nd callback argument is explicitly the inspector's context.
      context=uuid;
      action=details.action;
      if(!action) throw new Error('Aktions-ID fehlt');
      const keyIsStep=action.endsWith('.up')||action.endsWith('.down');
      stepWrapper.hidden=!keyIsStep;
      applySettings(details.payload?.settings||{});
      ws=new WebSocket('ws://127.0.0.1:'+port);
      ws.onopen=()=>{
        ws.send(JSON.stringify({event,uuid}));
        ws.send(JSON.stringify({event:'getSettings',action,context}));
        status.textContent='Verbunden · Einstellungen geladen';
      };
      ws.onmessage=e=>{
        try {
          const msg=JSON.parse(e.data);
          if(msg.event==='didReceiveSettings'&&msg.action===action) {
            // Never overwrite a newer local change with a delayed getSettings response.
            if(!pending) applySettings(msg.payload?.settings||{});
          }
          if(msg.event==='sendToPropertyInspector'&&msg.action===action&&msg.payload?.type==='settings-confirmed') {
            const confirmed=msg.payload.settings||{};
            if(pending&&equals(pending,confirmed)){
              pending=null;
              applySettings(confirmed);
              status.textContent='✓ Gespeichert';
            } else if(!pending) {
              applySettings(confirmed);
            }
          }
        }catch(err){status.textContent='Antwort konnte nicht verarbeitet werden';}
      };
      ws.onclose=()=>{status.textContent='Nicht verbunden';};
      ws.onerror=()=>{status.textContent='Verbindungsfehler';};
    } catch(err) {
      status.textContent='Einstellungen konnten nicht gestartet werden: '+err.message;
    }
  };
})();
