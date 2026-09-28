const CACHE='panchnama-v1';
const FILES=['./','./index.html','./manifest.json','./icon-192.png','./icon-512.png',
             './icon-maskable-512.png','./apple-touch-icon.png'];
self.addEventListener('install', function(e){
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then(function(c){ return c.addAll(FILES); }));
});
self.addEventListener('activate', function(e){
  e.waitUntil(caches.keys().then(function(keys){
    return Promise.all(keys.filter(function(k){return k!==CACHE;}).map(function(k){return caches.delete(k);}));
  }).then(function(){ return self.clients.claim(); }));
});
self.addEventListener('fetch', function(e){
  if(e.request.method!=='GET') return;
  e.respondWith(
    caches.match(e.request).then(function(r){
      return r || fetch(e.request).then(function(res){
        var copy=res.clone();
        caches.open(CACHE).then(function(c){ try{ c.put(e.request, copy); }catch(err){} });
        return res;
      }).catch(function(){ return caches.match('./index.html'); });
    })
  );
});
