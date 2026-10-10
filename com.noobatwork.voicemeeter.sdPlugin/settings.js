'use strict';
(() => {
  const channel = document.getElementById('channel');
  const channelWrapper = document.getElementById('channel-wrapper');
  const appWrapper = document.getElementById('app-wrapper');
  const appSelect = document.getElementById('app');
  const refreshApps = document.getElementById('refresh-apps');
  const label = document.getElementById('label');
  const step = document.getElementById('step');
  const stepWrapper = document.getElementById('step-wrapper');
  const segmentWrapper = document.getElementById('segment-wrapper');
  const compactWrapper = document.getElementById('compact-wrapper');
  const muteGestureWrapper = document.getElementById('mute-gesture-wrapper');
  const muteGesture = document.getElementById('muteGesture');
  const segment = document.getElementById('segment');
  const minGain = document.getElementById('minGain');
  const maxGain = document.getElementById('maxGain');
  const status = document.getElementById('status');
  const theme = document.getElementById('theme');
  const accent = document.getElementById('accent');
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
  let ws, context, action, pending=null, debounce, hasWritten=false;
  let settings={group:'Strip',index:0,label:'',step:2,appId:'',muteGesture:'doubleTap'};
  let discoveredApps=[];
  const normalize=s=>{
    s=s||{};
    const index=Number(s.index), n=Number(s.step);
    const seg=Number(s.segment), min=Number(s.minGain), max=Number(s.maxGain);
    const gainLow=s.minGain!==undefined&&Number.isFinite(min)?Math.max(-60,Math.min(11,min)):-40;
    const gainHigh=s.maxGain!==undefined&&Number.isFinite(max)?Math.max(gainLow+1,Math.min(12,max)):Math.max(0,gainLow+1);
    return {
      appId:typeof s.appId==='string'?s.appId.toLowerCase().slice(0,120):'',
      muteGesture:s.muteGesture==='tapHold'?'tapHold':'doubleTap',
      theme:['hybrid','neon','clean'].includes(s.theme)?s.theme:'hybrid',
      accent:['auto','cyan','blue','purple','red','orange','green'].includes(s.accent)?s.accent:'auto',
      group:s.group==='Bus'?'Bus':'Strip',
      index:Number.isFinite(index)?Math.max(0,Math.min(7,Math.trunc(index))):0,
      label:typeof s.label==='string'?s.label.slice(0,24):'',
      step:Number.isFinite(n)&&n>0?Math.max(.1,Math.min(12,n)):2,
      segment:Number.isFinite(seg)?Math.max(1,Math.min(5,Math.trunc(seg))):1,
      minGain:gainLow,
      maxGain:gainHigh
    };
  };
  const equals=(a,b)=>{
    a=normalize(a);b=normalize(b);
    return a.group===b.group&&a.index===b.index&&a.label===b.label&&a.step===b.step&&a.segment===b.segment&&a.minGain===b.minGain&&a.maxGain===b.maxGain&&a.appId===b.appId&&a.muteGesture===b.muteGesture&&a.theme===b.theme&&a.accent===b.accent;
  };
  function buildAppOptions(selected){
    appSelect.innerHTML='';
    const option=(value,title)=>{const el=document.createElement('option');el.value=value;el.textContent=title;appSelect.appendChild(el);};
    option('','Anwendung auswählen ...');
    if(selected&&!discoveredApps.some(a=>a.id===selected))option(selected,selected+' (derzeit offline)');
    for(const app of discoveredApps)option(app.id,app.name+' · '+app.device+' · '+Math.round(app.volume*100)+' %');
    appSelect.value=selected||'';
  }
  function applySettings(s) {
    settings=normalize(s);
    buildAppOptions(settings.appId);
    channel.value=settings.group+':'+settings.index;
    label.value=settings.label;
    step.value=String(settings.step);
    muteGesture.value=settings.muteGesture;
    theme.value=settings.theme;
    accent.value=settings.accent;
    segment.value=String(settings.segment);
    minGain.value=String(settings.minGain);
    maxGain.value=String(settings.maxGain);
  }
  function collect() {
    const selected=channel.value.split(':');
    const index=Number(selected[1]);
    return normalize({
      appId:appSelect.value||'',
      group:selected[0],index:Number.isFinite(index)?index:0,
      label:label.value.trim(),step:Number(step.value),
      muteGesture:muteGesture.value,theme:theme.value,accent:accent.value,
      segment:Number(segment.value),minGain:Number(minGain.value),maxGain:Number(maxGain.value)
    });
  }
  function save() {
    if(!ws||ws.readyState!==WebSocket.OPEN||!context||!action) {
      status.textContent='Nicht verbunden – bitte Taste erneut auswählen';
      return;
    }
    settings=collect();
    pending=settings;
    hasWritten=true;
    // 'uuid' from connectElgatoStreamDeckSocket is the UI context the
    // property inspector MUST use for setSettings/getSettings requests.
    ws.send(JSON.stringify({event:'setSettings',action,context,payload:settings}));
    status.textContent='Speichern …';
    const thisSave=pending;
    setTimeout(()=>{if(pending===thisSave)status.textContent='Speichern nicht bestätigt – Stream-Deck-Log prüfen';},5000);
  }
  channel.addEventListener('change',save);
  appSelect.addEventListener('change',save);
  muteGesture.addEventListener('change',save);
  theme.addEventListener('change',save);
  accent.addEventListener('change',save);
  refreshApps.addEventListener('click',()=>{
    if(ws?.readyState===WebSocket.OPEN&&action?.endsWith('.app')){
      ws.send(JSON.stringify({event:'sendToPlugin',action,context,payload:{op:'list-apps'}}));
      status.textContent='Windows-Audiositzungen werden gesucht ...';
    }
  });
  segment.addEventListener('change',save);
  minGain.addEventListener('change',save);
  maxGain.addEventListener('change',save);
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
      const isApp=action.endsWith('.app');
      appWrapper.hidden=!isApp;
      channelWrapper.hidden=isApp;
      const isCompact=action.endsWith('.compact');
      const keyIsStep=action.endsWith('.up')||action.endsWith('.down')||isCompact||isApp;
      stepWrapper.hidden=!keyIsStep;
      compactWrapper.hidden=!(isCompact||isApp);
      muteGestureWrapper.hidden=!(isCompact||isApp);
      segmentWrapper.hidden=!action.endsWith('.segment');
      applySettings(details.payload?.settings||{});
      ws=new WebSocket('ws://127.0.0.1:'+port);
      ws.onopen=()=>{
        ws.send(JSON.stringify({event,uuid}));
        ws.send(JSON.stringify({event:'getSettings',action,context}));
        if(isApp)ws.send(JSON.stringify({event:'sendToPlugin',action,context,payload:{op:'list-apps'}}));
        status.textContent='Verbunden · Einstellungen geladen';
      };
      ws.onmessage=e=>{
        try {
          const msg=JSON.parse(e.data);
          if(msg.event==='sendToPropertyInspector'&&msg.payload?.type==='app-list'&&action.endsWith('.app')){
            discoveredApps=Array.isArray(msg.payload.apps)?msg.payload.apps:[];
            const selected=appSelect.value||settings.appId;
            buildAppOptions(selected);
            if(!pending)status.textContent=discoveredApps.length?'Anwendungen erkannt: '+discoveredApps.length:'Noch keine Audioanwendungen erkannt';
          }
          if(msg.event==='didReceiveSettings'&&msg.action===action) {
            // Never overwrite a newer local change with a delayed getSettings response.
            if(!pending&&!hasWritten) applySettings(msg.payload?.settings||{});
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
