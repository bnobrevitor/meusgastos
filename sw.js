// Service worker do Saldo — objetivo único: o app abrir sem internet.
// Todos os dados já moram no localStorage; só faltava a página em si estar disponível offline.
//
// Estratégia deliberada: REDE PRIMEIRO para o próprio app (index.html). Cache primeiro seria
// mais rápido, mas prenderia o usuário numa versão antiga depois de cada publicação — e esse
// app é atualizado com frequência. Assim, com internet você sempre recebe a versão nova; sem
// internet, cai na última que funcionou.
const CACHE = 'saldo-v1';
const APP_SHELL = ['./', './index.html', './manifest.json', './icon-192.png', './icon-512.png'];

self.addEventListener('install', e => {
  // addAll falha inteiro se um único item falhar — por isso cada um vai individualmente
  e.waitUntil(
    caches.open(CACHE)
      .then(c => Promise.all(APP_SHELL.map(u => c.add(u).catch(() => {}))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  // Nunca interceptar chamadas de dados (GitHub Gist, Worker, cotações, notícias): servir uma
  // resposta velha de API seria pior que falhar — o app já trata erro de rede em cada uma.
  if (url.origin !== self.location.origin && !/fonts\.(googleapis|gstatic)\.com$/.test(url.hostname)) return;

  const isPage = req.mode === 'navigate' || (url.origin === self.location.origin && url.pathname.endsWith('.html'));

  if (isPage) {
    e.respondWith(
      fetch(req)
        .then(r => {
          const copy = r.clone();
          caches.open(CACHE).then(c => c.put(req, copy)).catch(() => {});
          return r;
        })
        .catch(() => caches.match(req).then(r => r || caches.match('./index.html')))
    );
    return;
  }

  // Estáticos (ícones, fontes): cache primeiro, atualizando em segundo plano.
  e.respondWith(
    caches.match(req).then(cached => {
      const net = fetch(req).then(r => {
        if (r && (r.ok || r.type === 'opaque')) {
          const copy = r.clone();
          caches.open(CACHE).then(c => c.put(req, copy)).catch(() => {});
        }
        return r;
      }).catch(() => cached);
      return cached || net;
    })
  );
});
