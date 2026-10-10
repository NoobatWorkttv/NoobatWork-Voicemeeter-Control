'use strict';
// Explicit REST checks: an exited CLI process alone is not release evidence.
const fs=require('node:fs/promises');
const crypto=require('node:crypto');
const base='https://api.github.com/repos/NoobatWorkttv/NoobatWork-Voicemeeter-Control';
const tag='v0.2.0-control-center';
const names=['NoobatWork-Mixer-Control-Center-v0.2.0-Setup.exe','SHA256SUMS.txt'];
const headers={Authorization:'Bearer '+process.env.GH_TOKEN,'User-Agent':'NoobatWork-Control-Center-Release','Accept':'application/vnd.github+json'};
async function request(url,method='GET',body){
 const response=await fetch(url,{method,headers:{...headers,'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});
 if(!response.ok)throw Error(method+' '+url+': '+response.status+' '+await response.text());
 return response.json();
}
(async()=>{
 if(!process.env.GH_TOKEN||!process.env.GITHUB_SHA)throw Error('GitHub Actions context required');
 const releases=await request(base+'/releases?per_page=100');
 let release=releases.find(x=>x.tag_name===tag);
 if(release&&!release.draft){
   if(!names.every(n=>release.assets.some(a=>a.name===n&&a.size>0)))throw Error('Existing release incomplete; refusing overwrite');
   console.log('Published release preserved: '+release.html_url);return;
 }
 if(release&&release.target_commitish!==process.env.GITHUB_SHA)throw Error('Draft belongs to another commit; refusing overwrite');
 if(!release)release=await request(base+'/releases','POST',{
   tag_name:tag,target_commitish:process.env.GITHUB_SHA,name:'NoobatWork Mixer Control Center v0.2.0',
   body:await fs.readFile('control-center/RELEASE.md','utf8'),draft:true,prerelease:true,make_latest:'false'
 });
 for(const name of names){
   const data=await fs.readFile('control-center/dist/'+name);
   const hash='sha256:'+crypto.createHash('sha256').update(data).digest('hex');
   const previous=release.assets.find(a=>a.name===name);
   if(previous){if(previous.size!==data.length||previous.digest!==hash)throw Error('Draft asset mismatch: '+name);continue;}
   const upload=release.upload_url.replace(/\{.*$/,'')+'?name='+encodeURIComponent(name);
   const response=await fetch(upload,{method:'POST',headers:{...headers,'Content-Type':'application/octet-stream'},body:data});
   if(!response.ok)throw Error('Upload '+name+': '+response.status+' '+await response.text());
   console.log('Uploaded '+name+' ('+data.length+' bytes)');
 }
 release=await request(base+'/releases/'+release.id);
 if(!names.every(n=>release.assets.some(a=>a.name===n&&a.size>0)))throw Error('Release assets incomplete');
 await request(base+'/releases/'+release.id,'PATCH',{draft:false,prerelease:true,make_latest:'false'});
 const published=await request(base+'/releases/tags/'+tag);
 if(published.draft||published.tag_name!==tag||!names.every(n=>published.assets.some(a=>a.name===n)))throw Error('Published release verification failed');
 console.log(JSON.stringify({url:published.html_url,tag:published.tag_name,assets:published.assets.map(a=>({name:a.name,size:a.size,digest:a.digest}))},null,2));
})().catch(e=>{console.error(e.message);process.exitCode=1;});
