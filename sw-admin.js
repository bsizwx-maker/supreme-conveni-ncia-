// Service Worker do PAINEL ADMINISTRATIVO — independente do Service Worker da loja.
// Para publicar uma atualização do painel, troque CACHE_VERSION; o SW antigo
// e seu cache são descartados automaticamente na ativação do novo.
const CACHE_VERSION = "v1";
const CACHE_NAME = "supreme-admin-" + CACHE_VERSION;

const PRECACHE_ASSETS = [
  "admin.html",
  "manifest-admin.json",
  "icon-admin-192.png",
  "icon-admin-512.png"
];

self.addEventListener("install", function (event) {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(function (cache) {
      return cache.addAll(PRECACHE_ASSETS);
    })
  );
});

self.addEventListener("activate", function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(
        keys
          .filter(function (k) { return k !== CACHE_NAME; })
          .map(function (k) { return caches.delete(k); })
      );
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener("fetch", function (event) {
  var req = event.request;

  // Só cuida de pedidos GET deste mesmo site (nunca intercepta chamadas do
  // Firebase/Firestore, que precisam sempre ir direto para a rede).
  if (req.method !== "GET" || new URL(req.url).origin !== self.location.origin) {
    return;
  }

  var isHTML = req.mode === "navigate" || req.destination === "document";

  if (isHTML) {
    // Network-first: sempre tenta buscar a versão mais nova do admin.html
    // quando online; usa o cache só se estiver offline.
    event.respondWith(
      fetch(req)
        .then(function (res) {
          var copy = res.clone();
          caches.open(CACHE_NAME).then(function (cache) { cache.put(req, copy); });
          return res;
        })
        .catch(function () { return caches.match(req); })
    );
    return;
  }

  // Demais arquivos estáticos: cache-first, atualizando o cache em segundo plano.
  event.respondWith(
    caches.match(req).then(function (cached) {
      var fetchPromise = fetch(req).then(function (res) {
        var copy = res.clone();
        caches.open(CACHE_NAME).then(function (cache) { cache.put(req, copy); });
        return res;
      });
      return cached || fetchPromise;
    })
  );
});
