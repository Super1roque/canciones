// Subir la versión purga el caché viejo en `activate` — necesario acá porque
// ese caché viejo quedó con respuestas 404 guardadas para siempre (ver bug
// de abajo: antes se guardaba cualquier respuesta, incluidos los errores).
const CACHE_NAME = 'canciones-v2';

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

// Notificación de "tenant te escribió" — funciona aunque la app esté
// cerrada del todo, no solo en segundo plano, porque el navegador despierta
// el Service Worker nada más para esto. Sin `silent`, el navegador/sistema
// operativo reproduce su sonido de notificación por defecto (igual que
// hace WhatsApp Web), sin necesidad de un archivo de audio propio.
self.addEventListener('push', (event) => {
  let datos = {};
  try { datos = event.data ? event.data.json() : {}; } catch { /* payload no era JSON */ }

  const titulo = datos.titulo || 'Canciones';
  event.waitUntil(
    self.registration.showNotification(titulo, {
      body: datos.cuerpo || '',
      icon: '/pwa-icon-192',
      badge: '/pwa-icon-192',
      vibrate: [200, 100, 200],
      data: { url: datos.url || '/' },
      // tag agrupa avisos seguidos del mismo tipo en una sola notificación
      // en vez de apilarlos — pero sin renotify:true, un aviso nuevo con
      // el mismo tag REEMPLAZA en silencio al anterior (sin sonido ni
      // vibración) en vez de volver a alertar. Eso era justo el bug: el
      // segundo mensaje seguido no sonaba porque pisaba al primero callado.
      tag: datos.tag || 'canciones-general',
      renotify: true,
    }),
  );
});

// Si ya hay una pestaña de la app abierta, la enfoca en vez de abrir una
// nueva — el mismo criterio que usaría cualquier app de mensajería.
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url || '/';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((lista) => {
      const existente = lista.find((c) => new URL(c.url).origin === self.location.origin);
      if (existente) {
        existente.navigate(url);
        return existente.focus();
      }
      return self.clients.openWindow(url);
    }),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // Los assets con hash en el nombre (_next/static) nunca cambian de
  // contenido para la misma URL — cache-first es seguro y rápido, sin
  // riesgo de que quede pegada una versión vieja después de un deploy.
  //
  // Solo se guarda en caché si la respuesta fue exitosa (response.ok) — si
  // no, un 404 pasajero (por ejemplo, pedir un chunk justo durante la
  // ventana de un deploy) quedaba guardado para siempre y rompía la página
  // en cada visita futura, aunque el archivo real ya existiera.
  if (url.pathname.startsWith('/_next/static/')) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, copy).catch(() => {}));
          }
          return response;
        });
      }),
    );
    return;
  }

  // Todo lo demás (páginas, HTML) va primero a la red, para que con
  // internet siempre se vea la versión más nueva — el caché es solo el
  // respaldo para cuando no hay conexión.
  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response.ok) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy).catch(() => {}));
        }
        return response;
      })
      .catch(() =>
        caches.match(request).then((cached) => {
          if (cached) return cached;
          return caches.match('/').then((home) => home
            || new Response('Sin conexión a internet', { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } }));
        }),
      ),
  );
});
