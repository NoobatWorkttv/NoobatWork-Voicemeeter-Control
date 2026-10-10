'use strict';
(() => {
  const $=id=>document.getElementById(id);
  const channels=$('channels'),empty=$('empty'),overlay=$('pair-overlay'),pairForm=$('pair-form');
  const tabButtons=[...document.querySelectorAll('[data-tab]')];
  const client={token:localStorage.getItem('naw-ipad-token')||'',socket:null,connected:false,
    tab:'all',state:{apps:[],channels:[],vmOnline:false,appOnline:false},cards:new Map(),
    reconnect:null,reconnectMs:750,master:null};
  const clamp=(n,min,max)=>Math.min(max,Math.max(min,n));
  const pct=n=>clamp(Number(n)||0,0,100);
  const iconPath='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9v6h4l5 4V5L8 9H4Zm13-1 3 3m0-3-3 3m-1 2 4 4"/></svg>';
  const accentFor=item=>{
    const name=(item.name||'').toLowerCase(),id=item.id||'';
    if(/discord/.test(name+id))return '#8792ff';
    if(/opera/.test(name+id))return '#fc4e7b';
    if(/firefox/.test(name+id))return '#ffa454';
    if(/spotify/.test(name+id))return '#35ddaa';
    if(/browser|chrome|edge|brave/.test(name+id))return '#53baff';
    if(/steam|game|tarkov/.test(name+id))return '#b587ff';
    if(item.kind==='bus')return '#38d8f3';
    if(/micro|input [12]/.test(name))return '#42deaa';
    return item.type==='app'?'#668fff':'#37cce5';
  };
  const db=value=>{const n=Math.abs(value)<.05?0:value;return (Number(n)||0).toFixed(1)};
  const targetKey=item=>item.type+':'+item.id;
  const appSort={discord:0,opera:1,firefox:2,spotify:3};
  const sortedApps=apps=>apps.slice().sort((a,b)=>{
    const rank=x=>Object.entries(appSort).find(([name])=>(x.name||x.id||'').toLowerCase().includes(name))?.[1]??50;
    return rank(a)-rank(b)||(a.name||'').localeCompare(b.name||'');
  });
  function updateConnection(ok,message){
    client.connected=ok;
    $('connection-dot').className='dot '+(ok?'online':'offline');
    $('connection').textContent=message|| (ok?'Verbunden':'Offline');
    $('system-status').textContent=ok?'LIVE · NUR LAN':'VERBINDUNG GETRENNT';
  }
  let toastTimer;
  function toast(message){
    const el=$('toast');el.textContent=message;el.classList.add('visible');
    clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove('visible'),3300);
  }
  function send(message){
    if(client.connected&&client.socket?.readyState===WebSocket.OPEN)client.socket.send(JSON.stringify(message));
  }
  function command(item,op,value){
    if(!client.connected)return;
    send({type:'command',command:{target:item.type==='app'?'app':'channel',id:item.id,op,value}});
  }
  function requestConnection(){
    clearTimeout(client.reconnect);
    if(!client.token)return;
    if(client.socket?.readyState===WebSocket.OPEN||client.socket?.readyState===WebSocket.CONNECTING)return;
    updateConnection(false,'Verbinde ...');
    const address='ws'+(location.protocol==='https:'?'s':'')+'://'+location.host+'/ws';
    const socket=new WebSocket(address);
    client.socket=socket;
    socket.onopen=()=>socket.send(JSON.stringify({type:'auth',token:client.token}));
    socket.onmessage=e=>{
      let msg;try{msg=JSON.parse(e.data);}catch{return;}
      if(msg.type==='unauthorized'){
        localStorage.removeItem('naw-ipad-token');client.token='';
        overlay.hidden=false;toast('Kopplung abgelaufen. Code erneut eingeben.');
        socket.close();return;
      }
      if(msg.type==='error'){toast(msg.message||'Befehl nicht unterstützt');return;}
      if(msg.type!=='state')return;
      if(!client.connected){
        updateConnection(true,'Verbunden');
        overlay.hidden=true;client.reconnectMs=750;toast('Mixer verbunden');
      }
      client.state=msg;
      paint();
    };
    socket.onclose=()=>{
      if(client.socket!==socket)return;
      updateConnection(false,'Getrennt');
      if(!client.token)return;
      client.reconnect=setTimeout(requestConnection,client.reconnectMs);
      client.reconnectMs=Math.min(client.reconnectMs*1.7,8000);
    };
    socket.onerror=()=>socket.close();
  }
  pairForm.addEventListener('submit',async event=>{
    event.preventDefault();
    const code=$('code').value.trim();
    if(!/^\d{6}$/.test(code))return;
    const btn=pairForm.querySelector('button[type=submit]');
    btn.disabled=true;
    $('pair-error').textContent='';
    try{
      const response=await fetch('/api/pair',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({code})});
      if(!response.ok){$('pair-error').textContent=response.status===429?'Zu viele Versuche. Bitte später erneut probieren.':'Code falsch oder abgelaufen.';return;}
      const data=await response.json();
      if(!/^[a-f0-9]{64}$/.test(data.token||''))throw new Error('Ungültige Server-Antwort');
      client.token=data.token;localStorage.setItem('naw-ipad-token',data.token);
      $('code').value='';
      requestConnection();
    }catch{
      $('pair-error').textContent='Verbindung nicht möglich. Ist das Windows-Programm geöffnet?';
    }finally{btn.disabled=false;}
  });
  $('disconnect').addEventListener('click',()=>{
    if(!confirm('Dieses iPad vom Windows-Mixer entkoppeln?'))return;
    const previous=client.socket;client.token='';client.socket=null;client.connected=false;
    localStorage.removeItem('naw-ipad-token');clearTimeout(client.reconnect);
    if(previous)previous.close();
    overlay.hidden=false;updateConnection(false,'Entkoppelt');
  });
  function setTab(tab){
    client.tab=tab;
    for(const btn of tabButtons){
      const selected=btn.dataset.tab===tab;
      btn.classList.toggle('selected',selected);btn.setAttribute('aria-pressed',String(selected));
    }
    $('heading').textContent=tab==='apps'?'Anwendungen':tab==='channels'?'Voicemeeter':'Dein Live-Mixer';
    paint();
  }
  for(const btn of tabButtons)btn.addEventListener('click',()=>setTab(btn.dataset.tab));

  function currentItems(){
    const state=client.state||{};
    const apps=sortedApps((state.apps||[]).filter(a=>a?.id&&a.id.endsWith('.exe'))).map(a=>({
      type:'app',kind:'app',id:a.id,name:a.name||a.id,subtitle:a.device||'Windows Audio',
      volume:pct((a.volume||0)*100),peak:pct((a.peak||0)*100),muted:!!a.mute,icon:a.icon,
      online:true,min:0,max:100,unit:'%',step:1
    }));
    const channelItems=(state.channels||[]).map(ch=>({
      type:'channel',kind:ch.kind,id:ch.id,name:ch.name,
      subtitle:ch.kind==='bus'?'Hardware / Bus':'Voicemeeter Potato',
      volume:Number(ch.gain)||0,peak:pct((ch.peak||0)*100),
      muted:!!ch.mute,online:!!ch.online,icon:null,min:-60,max:12,unit:'dB',step:.1
    }));
    channelItems.sort((a,b)=>{
      const priority=x=>{
        if(x.id.startsWith('Strip[')){
          const n=Number(x.id.match(/\d+/)?.[0]);return n>=5?n-5:n+20;
        }
        return 5+Number(x.id.match(/\d+/)?.[0]);
      };
      return priority(a)-priority(b);
    });
    if(client.tab==='apps')return apps;
    if(client.tab==='channels')return channelItems;
    return [...apps,...channelItems];
  }

  function createCard(item){
    const root=document.createElement('article');root.className='channel';
    root.style.setProperty('--accent',accentFor(item));
    const top=document.createElement('div');top.className='channel-top';
    const logo=document.createElement('div');logo.className='channel-icon';
    const title=document.createElement('div');title.className='channel-title';
    const subtitle=document.createElement('div');subtitle.className='channel-subtitle';
    top.append(logo,title,subtitle);
    const reading=document.createElement('div');reading.className='channel-reading';
    const value=document.createElement('strong');value.className='value';
    const detail=document.createElement('em');detail.textContent='VOLUME';
    reading.append(value,detail);
    const area=document.createElement('div');area.className='fader-area';
    const meter=document.createElement('div');meter.className='meter';
    const levels=Array.from({length:24},()=>{const el=document.createElement('span');el.className='meter-segment';meter.append(el);return el;});
    const slider=document.createElement('div');
    slider.className='fader-hit';slider.tabIndex=0;slider.setAttribute('role','slider');
    slider.setAttribute('aria-label',item.name+' Lautstärke');
    slider.setAttribute('aria-orientation','vertical');
    const rail=document.createElement('div');rail.className='fader-rail';
    const fill=document.createElement('div');fill.className='fader-fill';
    const knob=document.createElement('div');knob.className='fader-knob';
    rail.append(fill,knob);slider.append(rail);
    const scale=document.createElement('div');scale.className='fader-scale';
    area.append(meter,slider,scale);
    const controls=document.createElement('div');controls.className='channel-controls';
    const mute=document.createElement('button');mute.type='button';mute.className='mute-btn';
    mute.innerHTML=iconPath+'<span>MUTE</span>';
    mute.addEventListener('click',()=>{
      if(!client.connected)return;
      const latest=root._item;
      const next=!latest.muted;
      command(latest,'mute',next);
      latest.muted=next;updateCard(root,latest);
    });
    controls.append(mute);
    const meta=document.createElement('div');meta.className='channel-meta';
    root.append(top,reading,area,controls,meta);
    root._ui={logo,title,subtitle,value,detail,fill,knob,levels,slider,scale,mute,meta};
    root._dragging=false;root._lastWrite=0;
    slider.addEventListener('pointerdown',e=>{
      if(!client.connected||!root._item?.online)return;
      e.preventDefault();root._dragging=true;slider.setPointerCapture(e.pointerId);
      dragTo(e,true);
    });
    slider.addEventListener('pointermove',e=>{if(root._dragging)dragTo(e,false);});
    function stopDrag(e){if(!root._dragging)return;dragTo(e,true);root._dragging=false;}
    slider.addEventListener('pointerup',stopDrag);
    slider.addEventListener('pointercancel',()=>root._dragging=false);
    slider.addEventListener('lostpointercapture',()=>root._dragging=false);
    function dragTo(e,force){
      const item=root._item,rect=slider.getBoundingClientRect();
      const frac=clamp((rect.bottom-e.clientY)/Math.max(rect.height,1),0,1);
      let val=item.min+frac*(item.max-item.min);
      val=item.type==='app'?Math.round(val):Math.round(val*10)/10;
      item.volume=val;updateCard(root,item);
      const now=performance.now();
      if(force||now-root._lastWrite>=75){
        root._lastWrite=now;command(item,'set',val);
      }
    }
    slider.addEventListener('keydown',e=>{
      const latest=root._item;if(!client.connected||!latest.online)return;
      let change=0;
      if(e.key==='ArrowUp'||e.key==='ArrowRight')change=latest.type==='app'?2:1;
      else if(e.key==='ArrowDown'||e.key==='ArrowLeft')change=latest.type==='app'?-2:-1;
      else if(e.key==='Home')change=-9999;
      else if(e.key==='End')change=9999;
      else return;
      e.preventDefault();
      const next=clamp(latest.volume+change,latest.min,latest.max);
      command(latest,'set',next);latest.volume=next;updateCard(root,latest);
    });
    return root;
  }

  function updateCard(root,item){
    root._item=item;root.style.setProperty('--accent',accentFor(item));
    root.classList.toggle('is-muted',item.muted);
    const u=root._ui;
    if(root.dataset.appIcon!==item.icon){
      root.dataset.appIcon=item.icon||'';
      u.logo.replaceChildren();
      if(item.type==='app'&&typeof item.icon==='string'&&/^data:image\/png;base64,iVBORw0KGgo[A-Za-z0-9+/=]+$/.test(item.icon)){
        const img=new Image();img.alt='';img.src=item.icon;u.logo.append(img);
      }else{
        const initials=item.type==='app'?((item.name||'App').slice(0,2).toUpperCase()):item.kind==='bus'?item.name:'◉';
        u.logo.textContent=initials;
      }
    }
    u.title.textContent=item.name;
    u.subtitle.textContent=item.subtitle;
    u.value.textContent=item.online?(item.muted?'MUTED':item.type==='app'?Math.round(item.volume)+'%':db(item.volume)+' dB'):'OFFLINE';
    u.detail.textContent=item.type==='app'?'APP VOLUME':item.kind==='bus'?'BUS GAIN':'CHANNEL GAIN';
    const frac=clamp((item.volume-item.min)/(item.max-item.min),0,1);
    u.fill.style.height=(frac*100).toFixed(2)+'%';
    u.knob.style.bottom=(frac*100).toFixed(2)+'%';
    u.slider.setAttribute('aria-valuemin',item.min);
    u.slider.setAttribute('aria-valuemax',item.max);
    u.slider.setAttribute('aria-valuenow',Math.round(item.volume*10)/10);
    u.slider.setAttribute('aria-valuetext',item.type==='app'?Math.round(item.volume)+' Prozent':db(item.volume)+' Dezibel');
    u.slider.setAttribute('aria-label',item.name+' Lautstärke');
    const ticks=item.type==='app'?['100','80','60','40','20','0']:['+12','0','-12','-24','-36','-60'];
    if(u.scale.dataset.mode!==item.type){
      u.scale.replaceChildren();
      for(const txt of ticks){const span=document.createElement('span');span.textContent=txt;u.scale.append(span);}
      u.scale.dataset.mode=item.type;
    }
    const lit=Math.round(pct(item.peak)/100*u.levels.length);
    u.levels.forEach((level,i)=>{
      level.classList.toggle('lit',i<lit);
      level.classList.toggle('warning',i>20);
    });
    u.mute.setAttribute('aria-pressed',String(item.muted));
    u.mute.querySelector('span').textContent=item.muted?'UNMUTE':'MUTE';
    u.meta.textContent=item.type==='app'?item.id.toUpperCase():item.id.toUpperCase();
  }

  function paint(){
    const items=currentItems();
    $('empty').hidden=items.length>0;
    const seen=new Set();
    for(const item of items){
      const key=targetKey(item);seen.add(key);
      let card=client.cards.get(key);
      if(!card){card=createCard(item);client.cards.set(key,card);}
      if(card.parentNode!==channels)channels.append(card);
      if(card._dragging){
        // Keep finger position stable while asynchronous status updates arrive.
        const local=card._item;item.volume=local.volume;
      }
      updateCard(card,item);
    }
    for(const [key,card] of client.cards)
      if(!seen.has(key)&&card.parentNode===channels)card.remove();
    // Preserve expected visual order without recreating the card being dragged.
    for(const item of items)channels.append(client.cards.get(targetKey(item)));
    const master=(client.state.channels||[]).find(ch=>ch.id==='Bus[0]');
    client.master=master||null;
    $('master-db').textContent=master?.online?db(master.gain)+' dB':'-- dB';
    $('master-meter-fill').style.width=(master?pct((master.peak||0)*100):0)+'%';
    const mute=$('master-mute');
    mute.disabled=!master?.online||!client.connected;
    mute.classList.toggle('muted',!!master?.mute);
    mute.textContent=master?.mute?'Master Unmute':'Master Mute';
  }
  $('master-mute').addEventListener('click',()=>{
    if(!client.master?.online)return;
    command({type:'channel',id:'Bus[0]'},'mute',!client.master.mute);
  });
  if(client.token){overlay.hidden=true;requestConnection();}
  else{overlay.hidden=false;updateConnection(false,'Kopplung nötig');}
})();
