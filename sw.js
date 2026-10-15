// Service worker mínimo: só existe para o navegador oferecer "Instalar aplicativo".
// NÃO guarda nada em cache — o sistema sempre abre a versão mais nova do GitHub Pages.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch', () => {});
