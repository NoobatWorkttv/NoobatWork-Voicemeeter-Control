(function(root){
  'use strict';
  function apply(items,profile){
    const rows=Array.isArray(profile?.Items)?profile.Items:[];
    const settings=new Map(rows.map((x,i)=>[x.Key,{...x,rank:i}]));
    return items.filter(x=>settings.get(x.type+':'+x.id)?.Visible!==false)
      .map(x=>{const p=settings.get(x.type+':'+x.id);return p?{...x,name:p.Name||x.name,color:/^#[0-9a-f]{6}$/i.test(p.Color)?p.Color:undefined}:x;})
      .sort((a,b)=>(settings.get(a.type+':'+a.id)?.rank??1e6)-(settings.get(b.type+':'+b.id)?.rank??1e6));
  }
  if(typeof module!=='undefined')module.exports={apply};else root.NAWProfile={apply};
})(typeof window==='undefined'?globalThis:window);
