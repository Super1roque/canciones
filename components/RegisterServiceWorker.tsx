'use client';
import { useEffect } from 'react';

export default function RegisterServiceWorker() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    // Nunca en localhost: un Service Worker queda pegado al origen
    // (localhost:3000), y si más adelante corre OTRO proyecto en ese mismo
    // puerto, este SW le secuestraría la navegación sin que tenga nada que
    // ver con "canciones" — ya pasó una vez con un SW viejo de otro proyecto.
    if (window.location.hostname === 'localhost') return;

    navigator.serviceWorker.register('/sw.js').then(registration => {
      // Sin este .update() explícito, Chrome puede tardar hasta 24h en
      // darse cuenta de que hay una versión nueva del sw.js en el servidor
      // — quedaría corriendo la versión vieja todo ese tiempo.
      registration.update().catch(() => {});
    }).catch(() => {});
  }, []);
  return null;
}
