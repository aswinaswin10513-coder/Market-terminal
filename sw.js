var C='xv-cache-v4';
var ASSETS=['./','index.html','data.js','app.js','manifest.json','icon.svg'];
self.addEventListener('install',function(e){
 self.skipWaiting();
 e.waitUntil(caches.open(C).then(function(c){return c.addAll(ASSETS)}));
});
self.addEventListener('activate',function(e){
 e.waitUntil(caches.keys().then(function(ks){
  return Promise.all(ks.filter(function(k){return k!==C}).map(function(k){return caches.delete(k)}));
 }).then(function(){return self.clients.claim()}));
});
self.addEventListener('fetch',function(e){
 var u=new URL(e.request.url);
 if(u.origin!==self.location.origin){return}
 e.respondWith(
  caches.match(e.request,{ignoreSearch:true}).then(function(hit){
   var net=fetch(e.request).then(function(res){
    if(res&&res.ok){var cl=res.clone();caches.open(C).then(function(c){c.put(e.request,cl)})}
    return res;
   }).catch(function(){return hit});
   return hit||net;
  })
 );
});
/* END sw.js v4 */
