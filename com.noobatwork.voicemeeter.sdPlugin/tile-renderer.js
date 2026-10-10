'use strict';
// Pure 144x144 Stream Deck SVG renderer. Only visual changes: no audio commands.
const clamp=(value,lo,hi)=>Math.min(hi,Math.max(lo,Number.isFinite(value)?value:lo));
const escapeXml=value=>String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[ch]));
const short=(value,max=15)=>{
 const chars=Array.from(String(value??''));
 return chars.length>max?chars.slice(0,max-1).join('')+'…':chars.join('');
};
const appColors=[
 [/discord/i,'#8494ff'],[/opera|gx\.exe/i,'#ff486c'],[/firefox/i,'#ff9a48'],
 [/chrome|edge|brave|browser/i,'#38c5e6'],[/spotify/i,'#38d989'],
 [/steam|game|epic|riot|tarkov/i,'#ae80ff'],[/obs/i,'#ae91ff'],
 [/teams|zoom/i,'#828cff'],[/music|vlc/i,'#f3aa51']
];
function accentFor(kind,label,settings={}){
 const manual=settings.accent;
 const allowed={auto:null,cyan:'#28d5f1',blue:'#55a4ff',purple:'#a786ff',red:'#ff5b76',orange:'#ffaa57',green:'#3cdbad'};
 if(manual&&Object.hasOwn(allowed,manual)&&allowed[manual])return allowed[manual];
 if(kind==='app'){
  for(const [pattern,color] of appColors)if(pattern.test(label))return color;
  return '#51a9ff';
 }
 if(settings.group==='Bus')return '#28d5f1';
 if(/mic|mikro|voice/i.test(label))return '#3cdbad';
 if(/game/i.test(label))return '#a786ff';
 return '#42cdb4';
}
function safeIcon(icon){
 return typeof icon==='string'&&/^data:image\/png;base64,[A-Za-z0-9+/=]{80,38000}$/.test(icon)?icon:null;
}
function percentRect(p,y,height,color){
 const w=Math.round(clamp(p,0,100)*114/100);
 return '<rect x="15" y="'+y+'" width="114" height="'+height+'" rx="'+Math.min(5,height/2)+'" fill="#263749"/>'+
 (w>0?'<rect x="15" y="'+y+'" width="'+w+'" height="'+height+'" rx="'+Math.min(5,height/2)+'" fill="'+color+'"/>':'');
}
function meterBars(level,color,y=121){
 const p=clamp(level,0,100);
 return Array.from({length:19},(_,i)=>{
   const x=15+i*6;
   const on=p>(i*100/19);
   return '<rect x="'+x+'" y="'+y+'" width="4" height="7" rx="1" fill="'+(on?color:'#253345')+'" opacity="'+(on?'.94':'.9')+'"/>';
 }).join('');
}
function iconSvg(kind,icon,label,accent){
 const img=safeIcon(icon);
 const monogram=short(label.trim().replace(/\.exe$/i,'').split(' ').filter(Boolean).map(s=>s[0]).join('').toUpperCase()||'♫',3);
 return '<rect x="12" y="15" width="29" height="29" rx="9" fill="'+accent+'" opacity=".19"/>'+
 (img?'<image x="15" y="18" width="23" height="23" href="'+img+'"/>':
 '<text x="26.5" y="34.5" text-anchor="middle" font-family="Segoe UI,Arial" font-size="'+(monogram.length>2?'10':'13')+'" font-weight="700" fill="'+accent+'">'+escapeXml(monogram)+'</text>');
}
function renderTile({kind='channel',action='compact',label='',settings={},volume=0,gain=0,meter=0,mute=false,online=true,icon=null,segment=null}={}){
 const theme=['hybrid','neon','clean'].includes(settings.theme)?settings.theme:'hybrid';
 const accent=accentFor(kind,String(label),settings);
 const tone=mute?'#ff5a77':accent;
 const bg=theme==='clean'?'#111923':'#0c1524';
 const panel=theme==='clean'?'#1b2733':'#162638';
 const border=theme==='neon'?tone:'#31465b';
 const value=kind==='app'?Math.round(clamp(volume,0,1)*100):Number(gain)||0;
 const prog=kind==='app'?Math.round(clamp(volume,0,1)*100):clamp((value+60)/72*100,0,100);
 const meterPct=kind==='app'?clamp(meter,0,1)*100:clamp(meter,0,100);
 const unit=kind==='app'?'%':' dB';
 const number=kind==='app'?String(value):value.toFixed(1);
 const title=short(label||'Audio',kind==='app'?14:15);
 const status=!online?'OFFLINE':mute?'MUTED':number+unit;
 const mode=settings.muteGesture==='tapHold'?'TAP + HOLD · MUTE':'2× TAP · MUTE';
 const valid=online&&!mute;
 const labelTxt=kind==='app'?'APP':settings.group==='Bus'?'BUS':'STRIP';
 let parts=[
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 144 144">',
  '<defs><linearGradient id="surface" x2="1" y2="1"><stop stop-color="'+bg+'"/><stop offset="1" stop-color="'+panel+'"/></linearGradient>',
  '<linearGradient id="accent" x2="1"><stop stop-color="'+tone+'" stop-opacity=".65"/><stop offset="1" stop-color="'+tone+'"/></linearGradient></defs>',
  '<rect width="144" height="144" rx="15" fill="url(#surface)"/>',
  '<rect x=".75" y=".75" width="142.5" height="142.5" rx="14" fill="none" stroke="'+border+'" stroke-opacity="'+(theme==='neon'?'.8':'.65')+'" stroke-width="1.5"/>',
  '<rect x="11" y="7" width="122" height="3" rx="1.5" fill="url(#accent)"/>',
  '<text x="132" y="25" text-anchor="end" font-family="Segoe UI,Arial" font-size="8" font-weight="bold" fill="#879bb0">'+labelTxt+'</text>'
 ];
 if(theme==='neon')parts.push('<rect x="13" y="11" width="118" height="2" rx="1" opacity=".4" fill="'+tone+'"/>');
 parts.push(iconSvg(kind,icon,String(label)||'Audio',tone));
 parts.push('<text x="46" y="35" font-family="Segoe UI,Arial" font-size="'+(title.length>12?'11.5':'13')+'" font-weight="700" fill="#f0f6fe">'+escapeXml(title)+'</text>');
 if(action==='mute'){
   parts.push('<rect x="13" y="55" width="118" height="55" rx="11" fill="'+(mute?'#552236':'#233d45')+'"/>');
   parts.push('<text x="72" y="89" text-anchor="middle" font-family="Segoe UI,Arial" font-size="22" font-weight="800" fill="'+(mute?'#ff8298':tone)+'">'+(!online?'OFFLINE':mute?'MUTED':'MUTE')+'</text>');
 }else if(action==='up'||action==='down'){
   parts.push('<text x="72" y="99" text-anchor="middle" font-family="Segoe UI,Arial" font-size="56" font-weight="700" fill="'+tone+'">'+(action==='up'?'+':'−')+'</text>');
 }else if(action==='segment'){
   const t=Number.isFinite(segment)?segment:gain;
   parts.push('<text x="72" y="69" text-anchor="middle" font-family="Segoe UI,Arial" font-size="11" fill="#b2c5d5">PRESET · '+escapeXml(settings.segment||1)+'/5</text>');
   parts.push('<text x="72" y="98" text-anchor="middle" font-family="Segoe UI,Arial" font-size="28" font-weight="700" fill="'+tone+'">'+Number(t).toFixed(0)+'<tspan font-size="12"> dB</tspan></text>');
 }else{
   if(mute)parts.push('<rect x="12" y="51" width="120" height="54" rx="11" fill="#482233" stroke="#9d435b" stroke-width=".5"/>');
   else parts.push('<rect x="12" y="51" width="120" height="54" rx="11" fill="#1a293b"/>');
   parts.push('<text x="72" y="89" text-anchor="middle" font-family="Segoe UI,Arial" font-size="'+(status.length>8?'23':'31')+'" font-weight="750" fill="'+(mute?'#ff8299':online?'#f1f8ff':'#75889c')+'">'+escapeXml(status)+'</text>');
 }
 if(action!=='mute'){
   parts.push(percentRect(prog,111,6,tone));
 }
 parts.push(meterBars(meterPct,tone,124));
 const foot=action==='compact'||action==='app'?mode:action==='mute'?'TIP = MUTE':action==='segment'?'TAP = SET':action==='up'?'TAP = +':action==='down'?'TAP = −':'TIP = MUTE';
 parts.push('<text x="72" y="141" text-anchor="middle" font-family="Segoe UI,Arial" font-size="7.7" font-weight="600" letter-spacing=".2" fill="#9fb3c9">'+escapeXml(foot)+'</text>');
 parts.push('</svg>');
 return 'data:image/svg+xml,'+encodeURIComponent(parts.join(''));
}
module.exports={renderTile,accentFor,safeIcon};
