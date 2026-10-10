'use strict';
// Stored exclusively on the iPad; independent of the Windows companion.
(function(factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(typeof window!=='undefined')window.NAWFavorites=api;
})(function(){
  const STORAGE_KEY='naw-ipad-favorites-v1';
  const validKey=key=>typeof key==='string'&&(
    /^app:[a-z0-9_.-]{1,116}\.exe$/.test(key) ||
    /^channel:(Strip|Bus)\[[0-7]\]$/.test(key)
  );
  const sanitize=items=>{
    if(!Array.isArray(items))return [];
    return [...new Set(items.filter(validKey))].slice(0,32);
  };
  function load(storage){
    try{return sanitize(JSON.parse(storage.getItem(STORAGE_KEY)||'[]'));}
    catch{return [];}
  }
  function save(storage,items){
    const normalized=sanitize(items);
    try{storage.setItem(STORAGE_KEY,JSON.stringify(normalized));}
    catch{/* Private browsing/no storage: still works for this session. */}
    return normalized;
  }
  function toggle(items,key){
    const arr=sanitize(items);
    if(!validKey(key))return arr;
    return arr.includes(key)?arr.filter(x=>x!==key):sanitize([...arr,key]);
  }
  function move(items,key,direction){
    const arr=sanitize(items),from=arr.indexOf(key),to=from+Math.sign(direction);
    if(from<0||to<0||to>=arr.length)return arr;
    [arr[from],arr[to]]=[arr[to],arr[from]];
    return arr;
  }
  function arrange(items,favorites,tab='all'){
    const lookup=new Map(favorites.map((key,index)=>[key,index]));
    const selected=tab==='favorites'?items.filter(item=>lookup.has(item.type+':'+item.id)):items.slice();
    if(tab==='favorites'||tab==='all'){
      selected.sort((a,b)=>{
        const ia=lookup.get(a.type+':'+a.id),ib=lookup.get(b.type+':'+b.id);
        if(ia!==undefined&&ib!==undefined)return ia-ib;
        if(ia!==undefined)return -1;
        if(ib!==undefined)return 1;
        return 0;
      });
    }
    return selected;
  }
  return {STORAGE_KEY,validKey,sanitize,load,save,toggle,move,arrange};
});
