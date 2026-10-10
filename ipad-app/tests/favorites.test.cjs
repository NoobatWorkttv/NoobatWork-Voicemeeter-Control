'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const favorites=require('../wwwroot/favorites.js');
function mockStorage(){
 const values=new Map();
 return {getItem:key=>values.get(key)||null,setItem:(key,val)=>values.set(key,val),values};
}
const discord={type:'app',id:'discord.exe'};
const opera={type:'app',id:'opera.exe'};
const firefox={type:'app',id:'firefox.exe'};
const vm={type:'channel',id:'Strip[5]'};

test('only valid application/Voicemeeter favorite IDs are persisted',()=>{
 const s=favorites.sanitize(['app:discord.exe','app:discord.exe','channel:Strip[5]','channel:Bus[0]','../etc/passwd','app:<script>.exe','channel:Strip[9]']);
 assert.deepEqual(s,['app:discord.exe','channel:Strip[5]','channel:Bus[0]']);
});
test('each tablet/browser may store its own completely different favorite order',()=>{
 const ipad=mockStorage(),android=mockStorage();
 favorites.save(ipad,['app:discord.exe','channel:Strip[5]']);
 favorites.save(android,['app:opera.exe','app:firefox.exe']);
 assert.deepEqual(favorites.load(ipad),['app:discord.exe','channel:Strip[5]']);
 assert.deepEqual(favorites.load(android),['app:opera.exe','app:firefox.exe']);
});
test('adding and removing favorites is idempotent; ordering is stable',()=>{
 let items=favorites.toggle([],'app:opera.exe');
 items=favorites.toggle(items,'channel:Strip[5]');
 assert.deepEqual(favorites.move(items,'channel:Strip[5]',-1),['channel:Strip[5]','app:opera.exe']);
 assert.deepEqual(favorites.move(items,'channel:Strip[5]',1),items);
 assert.deepEqual(favorites.toggle(items,'app:opera.exe'),['channel:Strip[5]']);
});
test('display ordering preserves unpinned channels after pinned channels',()=>{
 const source=[discord,opera,firefox,vm];
 const pinned=['channel:Strip[5]','app:firefox.exe'];
 assert.deepEqual(favorites.arrange(source,pinned).map(x=>x.id),['Strip[5]','firefox.exe','discord.exe','opera.exe']);
 assert.deepEqual(favorites.arrange(source,pinned,'favorites').map(x=>x.id),['Strip[5]','firefox.exe']);
});
test('bad storage cannot prevent the mixer from starting',()=>{
 const store={getItem(){throw new Error('permission denied');},setItem(){throw new Error('quota');}};
 assert.deepEqual(favorites.load(store),[]);
 assert.deepEqual(favorites.save(store,['app:discord.exe']),['app:discord.exe']);
});
test('store rejects malicious and oversized arbitrary input',()=>{
 const store=mockStorage();const all=Array.from({length:80},(_,i)=>'app:test'+i+'.exe');
 const saved=favorites.save(store,all);
 assert.equal(saved.length,32);
 assert.equal(favorites.load(store).length,32);
 store.setItem(favorites.STORAGE_KEY,'{invalid');
 assert.deepEqual(favorites.load(store),[]);
});
