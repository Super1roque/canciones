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
