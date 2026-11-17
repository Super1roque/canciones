'use client';
import { useRef, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ADMIN_WHATSAPP } from '@/lib/config';
import { trackMetaPixel } from '@/lib/metaPixel';
import { formatoRestante } from '@/lib/tiempo';
import { CANAL_WHATSAPP, SEGUNDOS_EN_CANAL } from '@/lib/pagoDescarga';

// La descarga es gratis: se desbloquea uniéndose al canal de WhatsApp (ver lib/pagoDescarga.ts)
// o el admin la habilita desde /admin/pedidos (ver calcularAcceso).

// Video del mariachi (mismo asset que la landing) de fondo en las 3
// pantallas de esta página. El <main> que lo contiene necesita
// position:relative + z-index:0 EXPLÍCITO (no alcanza con position solo)
// para que el z-index negativo quede contenido ahí y no se escape detrás
// del fondo de un ancestro — ya nos pasó una vez en la landing.
function HeroVideoFondo({ overlay }: { overlay: string }) {
  return (
    <>
      <video
        autoPlay muted loop playsInline poster="/hero/mariachi-poster.jpg"
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', zIndex: -2 }}
      >
        <source src="/hero/mariachi.mp4" type="video/mp4" />
      </video>
      <div style={{ position: 'absolute', inset: 0, background: overlay, zIndex: -1 }} />
    </>
  );
}

// El canal de WhatsApp con su foto y nombre, para que se vea que es algo real (foto guardada en public/canal/).
function TarjetaCanal({ texto }: { texto: string }) {
  return (
    <span style={{
      display: 'flex', alignItems: 'center', gap: '0.65rem', width: '100%', boxSizing: 'border-box',
      padding: '0.5rem 0.75rem', borderRadius: 16, background: '#0b3a1e', color: '#fff', textAlign: 'left',
    }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/canal/corridos-hondurenos.jpg" alt="" width={48} height={48} style={{ borderRadius: '50%', flexShrink: 0, border: '2px solid #25d366' }} />
      <span style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.25 }}>
        <span style={{ fontSize: '1rem', fontWeight: 900 }}>Corridos Hondureños</span>
        <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#9be3b4' }}>{texto}</span>
      </span>
    </span>
  );
}

// Dibujo de cómo se ve el canal en WhatsApp, con una flecha al botón «Seguir»: mucha gente abre el canal y cree
// que con eso ya está.
function MuestraSeguir() {
  return (
    <span style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.45rem', padding: '0.8rem 0.75rem 0.9rem',
      borderRadius: 16, background: '#111b21', border: '1px solid #2a3942', color: '#e9edef',
    }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/canal/corridos-hondurenos.jpg" alt="" width={56} height={56} style={{ borderRadius: '50%' }} />
      <span style={{ fontSize: '1rem', fontWeight: 800 }}>Corridos Hondureños</span>
      <span style={{ fontSize: '0.78rem', color: '#8696a0' }}>Canal</span>
      <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <span style={{ background: '#21c063', color: '#0b141a', fontWeight: 800, fontSize: '0.95rem', padding: '0.4rem 1.4rem', borderRadius: 999, boxShadow: '0 0 0 3px rgba(255,211,92,0.9)' }}>
          + Seguir
        </span>
        <span style={{ color: '#ffd35c', fontWeight: 900, fontSize: '0.95rem' }}>👈 tocá aquí</span>
      </span>
    </span>
  );
}

// Hermano de VideoGreetingClient.tsx, pero para audio — mismo círculo con
// botón de play sobre el tema mariachi/corrido, pensado para viralizar
// canciones generadas: se puede escuchar (no descargar) y, si se agotan
// las reproducciones gratis, se arma la pantalla de recarga.
//
// El límite es por CANTIDAD DE REPRODUCCIONES del link (no por tiempo) —
// `restringida` refleja el estado al cargar la página (calculado en el
// server, ver app/cancion/[id]/page.tsx y lib/cancionCompartidaService.ts),
// pero el corte real pasa en el servidor: /api/canciones-compartidas/[id]
// devuelve 403 a partir de la reproducción límite+1, así que igual se
// bloquea si alguien intenta escuchar de nuevo sin recargar la página.
// `esDueño` solo decide QUÉ mensaje se muestra: el dueño ve la invitación
// a recargar, cualquier otra persona (a quien le reenviaron el link) ve
// un aviso genérico que no expone que el dueño es freemium.
export default function AudioGreetingClient({ audioApiUrl, posterSrc, titulo, restringida, descargable: descargableInicial, esDueño, yaEscuchada: yaEscuchadaInicial = false, vence, desbloqueada = false }: { audioApiUrl: string; posterSrc: string; titulo: string; restringida: boolean; descargable: boolean; esDueño: boolean; yaEscuchada?: boolean; vence: number; desbloqueada?: boolean }) {
  const cancionId = audioApiUrl.split('/').pop() ?? '';
  // Hoja de la descarga gratis: el botón para unirse al canal de WhatsApp.
  const [hojaPago, setHojaPago] = useState(false);
  // Cartel «¡Tu canción ya es tuya!»: al desbloquearse mientras la página está abierta, y cada vez que vuelve a entrar
  // a una canción que ya tiene la descarga habilitada (si no, el botón de descarga aparecía sin que nadie lo notara).
  const [celebrar, setCelebrar] = useState(desbloqueada);
  const [descargable, setDescargable] = useState(descargableInicial);
  // Cuenta regresiva hasta que la canción se retira (36 h desde que se subió, ver venceEn). Arranca en
  // null y se llena al montar: la hora del servidor y la del teléfono no coinciden al segundo.
  const [ahora, setAhora] = useState<number | null>(null);
  useEffect(() => {
    if (descargable) return;
    setAhora(Date.now());
    const reloj = setInterval(() => setAhora(Date.now()), 1000);
    return () => clearInterval(reloj);
  }, [descargable]);
  const [vencidaServidor, setVencidaServidor] = useState(false);
  const vencida = !descargable && (vencidaServidor || (ahora !== null && ahora >= vence));
  useEffect(() => {
    if (vencida) audioRef.current?.pause();
  }, [vencida]);
  const router = useRouter();
  const [estado, setEstado] = useState<'inicial' | 'cargando' | 'reproduciendo' | 'pausado'>('inicial');
  // Se muestra solo cuando la pausa la hizo la página (ver alAvanzar), no cuando la persona pausa.
  const [avisoPausa, setAvisoPausa] = useState(false);
  const [bloqueado, setBloqueado] = useState(restringida);
  const audioRef = useRef<HTMLAudioElement>(null);
  const blobUrlRef = useRef<string>('');
  // El archivo ORIGINAL para descargar o enviar; para escuchar se baja la copia liviana, que no se reusa aquí.
  const blobRef = useRef<Blob | null>(null);
  const [puedeCompartirArchivo, setPuedeCompartirArchivo] = useState(false);

  // Detecta la capacidad de compartir ARCHIVOS (Web Share API nivel 2) con
  // un blob de prueba, sin descargar el audio real — así el botón de
  // WhatsApp puede decidir si mostrarse sin forzar ninguna carga apenas
  // entra a la página. El audio de verdad se trae recién al tocarlo (ver
  // enviarPorWhatsapp).
  useEffect(() => {
    if (!descargable) return;
    try {
      const prueba = new File([new Blob([], { type: 'audio/mpeg' })], 'prueba.mp3', { type: 'audio/mpeg' });
      setPuedeCompartirArchivo(!!(navigator.canShare && navigator.canShare({ files: [prueba] })));
    } catch {
      setPuedeCompartirArchivo(false);
    }
  }, [descargable]);
  // Mientras la descarga no esté habilitada, se vuelve a preguntar al volver a la página y cada 20 s: si el
  // admin ya la habilitó, aparece el botón de descarga sin que la persona tenga que recargar.
  useEffect(() => {
    if (descargable) return;
    let cancelado = false;
    async function revisar() {
      if (document.visibilityState !== 'visible') return;
      try {
        const res = await fetch(`${audioApiUrl}/acceso`, { cache: 'no-store' });
        if (!res.ok || cancelado) return;
        const datos = await res.json();
        if (datos.descargable) { setDescargable(true); setHojaPago(false); setCelebrar(true); }
      } catch {
        // Silencioso — se reintenta en el próximo ciclo.
      }
    }
    const intervalo = setInterval(revisar, 20000);
    document.addEventListener('visibilitychange', revisar);
    window.addEventListener('focus', revisar);
    return () => {
      cancelado = true;
      clearInterval(intervalo);
      document.removeEventListener('visibilitychange', revisar);
      window.removeEventListener('focus', revisar);
    };
  }, [descargable, audioApiUrl]);

  // Cada escucha (la primera Y cada replay después de que termina) debe
  // volver a pedirle autorización al server — así el contador de
  // reproducciones (y el límite de 2) se respeta de verdad. Solo se salta
  // el fetch para un simple pausa/resume DENTRO de la misma escucha.
  const necesitaFetchRef = useRef(true);

  // La primera escucha completa de la canción (la del dueño) es limpia. Después, cualquiera que la
  // escuche —en cualquier aparato— sin haber pagado la descarga la oye con PAUSAS_REPETIDAS pausas
  // al azar, como si la hubiera pausado, para que no la graben con otro teléfono. La marca vive en
  // la canción (escuchadaCompleta en el servidor), no en el teléfono.
  const PAUSAS_REPETIDAS = 5;
  // Ref y no estado: se lee al planear las pausas, justo después de actualizarla en alTocar.
  const yaEscuchadaRef = useRef(yaEscuchadaInicial);
  // El contador de 36 h no se muestra en la primera escucha (la limpia): aparece cuando la canción
  // ya venía escuchada o cuando termina esa primera escucha (pedido de Armando, 15 nov 2026).
  const [conContador, setConContador] = useState(yaEscuchadaInicial);
  const pausasRef = useRef<number[] | null>(null);
  const pausaAvisadaRef = useRef(false);
  // Registro de cada escucha (una fila por escucha en el servidor) para poder revisar después si
  // salió con pausas, cuántas hizo y hasta dónde llegó. Las del admin no se registran.
  const registroRef = useRef<{ id: string; conPausas: boolean; pausasPlaneadas: number; pausasHechas: number; duracion: number; avance: number } | null>(null);
  function enviarRegistro() {
    const r = registroRef.current;
    if (!r || esAdmin()) return;
    const cuerpo = JSON.stringify({ ...r, avance: Math.round(r.avance * 100) });
    try {
      if (navigator.sendBeacon?.(`${audioApiUrl}/escucha`, new Blob([cuerpo], { type: 'application/json' }))) return;
    } catch {
      // Sin sendBeacon: va por fetch.
    }
    fetch(`${audioApiUrl}/escucha`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: cuerpo, keepalive: true }).catch(() => {});
  }
  // Al salir de la página (atrás, swipe, cambiar de app) se manda hasta dónde llegó.
  useEffect(() => {
    function alOcultar() { if (document.visibilityState === 'hidden') enviarRegistro(); }
    document.addEventListener('visibilitychange', alOcultar);
    window.addEventListener('pagehide', enviarRegistro);
    return () => {
      document.removeEventListener('visibilitychange', alOcultar);
      window.removeEventListener('pagehide', enviarRegistro);
    };
  });
  function yaLaEscucho() { return yaEscuchadaRef.current; }
  function esAdmin() {
    try { return localStorage.getItem('corridos-admin') === '1'; } catch { return false; }
  }
  // Momentos al azar entre el 10 % y el 92 % de la canción, separados al menos un 8 % entre sí.
  function planearPausas(dur: number): number[] {
    if (descargable || !yaLaEscucho() || dur < 30) return [];
    const puntos: number[] = [];
    for (let intento = 0; puntos.length < PAUSAS_REPETIDAS && intento < 200; intento++) {
      const t = dur * (0.1 + Math.random() * 0.82);
      if (puntos.every(p => Math.abs(p - t) > dur * 0.08)) puntos.push(t);
    }
    return puntos.sort((x, y) => x - y);
  }
  // Mucha gente no llega al final (se sale o la deja abierta): pasado el 10 % ya cuenta como
  // escuchada. Las pausas de ESTA escucha ya se planearon al arrancar, así que sigue limpia hasta el final.
  const MARCA_ESCUCHADA = 0.10;
  function marcarEscuchada() {
    // La escucha del admin revisando la canción no cuenta como la primera del cliente.
    if (yaEscuchadaRef.current || esAdmin()) return;
    yaEscuchadaRef.current = true;
    fetch(`${audioApiUrl}/escuchada`, { method: 'POST' }).catch(() => {});
  }
  function alAvanzar() {
    const a = audioRef.current;
    if (!a) return;
    // En algunos teléfonos la duración todavía no se conoce al empezar a sonar: se espera a tenerla
    // para decidir las pausas, en vez de dejar toda la escucha sin pausas.
    if (!isFinite(a.duration) || a.duration <= 0) return;
    if (pausasRef.current === null) {
      pausasRef.current = planearPausas(a.duration);
      registroRef.current = {
        id: crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        conPausas: pausasRef.current.length > 0,
        pausasPlaneadas: pausasRef.current.length,
        pausasHechas: 0,
        duracion: Math.round(a.duration),
        avance: 0,
      };
      enviarRegistro();
      // Ya está sonando: recién aquí cuenta como reproducción (el ▶️ del panel y el límite de gratis).
      if (!esAdmin()) fetch(`${audioApiUrl}/reproduccion`, { method: 'POST' }).catch(() => {});
    }
    if (registroRef.current) registroRef.current.avance = Math.max(registroRef.current.avance, a.currentTime / a.duration);
    if (a.currentTime >= a.duration * MARCA_ESCUCHADA) marcarEscuchada();
    const siguiente = pausasRef.current[0];
    if (siguiente !== undefined && a.currentTime >= siguiente) {
      pausasRef.current.shift();
      if (registroRef.current) registroRef.current.pausasHechas++;
      a.pause();   // onPause deja el botón en «Pausado», igual que si la persona lo hubiera pausado
      setAvisoPausa(true);
      // Para el panel: cuenta la escucha como «con pausas» una sola vez.
      if (!pausaAvisadaRef.current && !esAdmin()) {
        pausaAvisadaRef.current = true;
        fetch(`${audioApiUrl}/pausa`, { method: 'POST' }).catch(() => {});
      }
    }
  }

  // El audio no se sirve como un link directo descargable — se trae como
  // blob a través de la API (mismo patrón que AudioPlayer.tsx de
  // /escuchar), así nunca queda expuesta una URL de archivo real. La
  // descarga (cuando `descargable` es true) reusa el último blob traído.
  //
  // Si `necesitaFetchRef` es false, es un simple pausa/resume dentro de la
  // MISMA escucha (no cuenta de nuevo). Si es true (primera vez, o un
  // replay después de que la canción terminó), se vuelve a pedir el audio
  // — el servidor cuenta esa reproducción y puede rechazarla con 403 si ya
  // se agotaron las gratis.
  async function alTocar() {
    const a = audioRef.current;
    if (!a) return;

    if (!necesitaFetchRef.current) {
      if (a.paused) { a.play(); setEstado('reproduciendo'); }
      else { a.pause(); setEstado('pausado'); }
      return;
    }

    setEstado('cargando');
    try {
      // Antes de cada escucha nueva pregunta si alguien ya la escuchó completa: WhatsApp a veces
      // devuelve la página guardada de antes, que no se enteró. Va antes de pedir el audio (y no en
      // paralelo) porque ese pedido suma una reproducción, y en las canciones viejas eso solo ya la
      // haría contar como escuchada. Si falla, se queda con lo que sabía la página.
      try {
        const acceso = await fetch(`${audioApiUrl}/acceso`, { cache: 'no-store' });
        if (acceso.ok) {
          const datos = await acceso.json();
          if (datos.escuchada === true) { yaEscuchadaRef.current = true; setConContador(true); }
          if (datos.descargable === true) setDescargable(true);
        }
      } catch {
        // Sin conexión con /acceso: sigue igual.
      }
      const res = await fetch(audioApiUrl);
      if (res.status === 403) { setBloqueado(true); setEstado('inicial'); return; }
      if (res.status === 410) { setVencidaServidor(true); setEstado('inicial'); return; }
      if (!res.ok) { setEstado('inicial'); return; }
      const blob = await res.blob();
      if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current);
      const url = URL.createObjectURL(blob);
      blobUrlRef.current = url;
      a.src = url;
      enviarRegistro();   // cierra la escucha anterior con su avance final
      registroRef.current = null;
      pausasRef.current = null;   // escucha nueva: se planean pausas nuevas cuando se conozca la duración
      pausaAvisadaRef.current = false;
      await a.play();
      necesitaFetchRef.current = false;
      setEstado('reproduciendo');
    } catch {
      setEstado('inicial');
    }
  }

  // Comparte solo la URL, sin texto aparte — la tarjeta minimalista de la
  // página (imagen + título, sin descripción) es la que habla. Agregar un
  // "text" acá hace que WhatsApp lo muestre como un mensaje de más arriba
  // del link en vez de dejar que la tarjeta sea lo único que se vea.
  async function compartirCancion() {
    const url = `https://corridos.online/cancion/${cancionId}`;
    if (navigator.share) {
      try {
        await navigator.share({ url });
      } catch {
        // El usuario canceló el selector — no hace falta avisar nada.
      }
      return;
    }
    window.open(`https://wa.me/?text=${encodeURIComponent(url)}`, '_blank');
  }

  // Si ya es tenant logueado, lo deja directo en su dashboard. Si no —el
  // caso más común acá, porque quien recibe el link compartido casi nunca
  // es tenant todavía— lo manda a la landing para que se registre. Así
  // cada canción compartida termina siendo, de paso, un anuncio del programa.
  async function irASesionOLanding() {
    try {
      const res = await fetch('/api/tenants/me');
      router.push(res.ok ? '/dashboard' : '/');
    } catch {
      router.push('/');
    }
  }

  // Ya no redirige automáticamente al terminar — se deja volver a tocar
  // play (eso es lo que permite llegar a un 3er intento y ahí mostrar la
  // invitación a premium, en vez de sacar a la persona apenas termina de
  // escuchar la primera vez).
  function alTerminar() {
    setEstado('inicial');
    necesitaFetchRef.current = true;
    marcarEscuchada();
    if (yaEscuchadaRef.current) setConContador(true);
    if (registroRef.current) { registroRef.current.avance = 1; enviarRegistro(); }
  }

  // Al bloquearse, si es el dueño y ya está logueado lo manda directo a su
  // dashboard para que recargue — no tiene sentido dejarlo en esta
  // pantalla si ya puede resolverlo ahí mismo. Un pequeño respiro para que
  // alcance a leer el mensaje antes de que lo redirija solo. Para
  // cualquier otra persona no aplica — no tiene nada que resolver en su
  // propio dashboard sobre la canción de otro tenant.
  useEffect(() => {
    if (!bloqueado || !esDueño) return;
    const id = setTimeout(() => {
      fetch('/api/tenants/me').then(res => { if (res.ok) router.push('/dashboard'); }).catch(() => {});
    }, 4000);
    return () => clearTimeout(id);
  }, [bloqueado, esDueño, router]);

  // Comparte el ARCHIVO de audio (no el link) vía el selector nativo, para
  // que WhatsApp lo reciba como nota de voz/audio real. Distinto de
  // compartirCancion(), que solo manda la URL. El audio se trae recién acá
  // (lazy) si todavía no se había tocado play — nada se descarga de más
  // hasta que el usuario realmente pide enviarlo.
  // Descarga directa del archivo — funciona en computadora y en cualquier celular, aunque no permita
  // compartir archivos. Baja el original (no la copia liviana con que se escucha) una sola vez.
  async function descargarArchivo() {
    try {
      let blob = blobRef.current;
      if (!blob) {
        const res = await fetch(`${audioApiUrl}?original=1`);
        if (!res.ok) return;
        blob = await res.blob();
        blobRef.current = blob;
      }
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = `${titulo || 'cancion'}.mp3`;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10000);
    } catch {
      // Sin conexión — puede volver a tocar el botón.
    }
  }

  async function enviarPorWhatsapp() {
    try {
      let blob = blobRef.current;
      if (!blob) {
        const res = await fetch(`${audioApiUrl}?original=1`);
        if (!res.ok) return;
        blob = await res.blob();
        blobRef.current = blob;
      }
      const archivo = new File([blob], `${titulo || 'cancion'}.mp3`, { type: blob.type || 'audio/mpeg' });
      await navigator.share({ files: [archivo], title: titulo });
    } catch {
      // El usuario canceló el selector — no hace falta avisar nada.
    }
  }

  // La descarga es gratis con un solo requisito: unirse al canal de WhatsApp (Armando, 17 nov 2026). Un solo toque:
  // abre el canal directo (antes había una hoja intermedia y se perdía gente) y deja abierta la hoja de «volvé aquí»
  // con el botón de respaldo. Cuenta el toque para el panel (campo clicsPagar, ahora «abrió la descarga»).
  function abrirDescarga(origen: string) {
    trackMetaPixel('Lead', { content_name: `Abrió descarga gratis (${origen})` });
    fetch(`${audioApiUrl}/clic-pagar`, { method: 'POST' }).catch(() => {});
    unirseAlCanal();
    setHojaPago(true);
  }
  // WhatsApp no le dice a una web quién sigue un canal: se confía. Se guarda la hora del toque y, cuando la persona
  // vuelve a la página después de SEGUNDOS_EN_CANAL, se habilita la descarga. Si vuelve antes, se le pide que se una.
  const claveCanal = `corridos-canal-${cancionId}`;
  const [avisoCanal, setAvisoCanal] = useState('');
  function unirseAlCanal() {
    try { localStorage.setItem(claveCanal, String(Date.now())); } catch { /* sin almacenamiento: vale la de esta visita */ }
    tocoCanalEnRef.current = Date.now();
    setAvisoCanal(''); setConfirmarCanal(false);
    fetch(`${audioApiUrl}/canal`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ paso: 'clic' }) }).catch(() => {});
    trackMetaPixel('Lead', { content_name: 'Unirse al canal de WhatsApp' });
    window.open(CANAL_WHATSAPP, '_blank');
  }
  const tocoCanalEnRef = useRef(0);
  // 17 nov 2026: 13 desbloqueos pero el canal solo ganó 5 seguidores — muchos abren el canal y salen sin tocar
  // «Seguir». Al volver ya no se desbloquea solo: se le pregunta si tocó el botón verde (manual = respondió que sí).
  const [confirmarCanal, setConfirmarCanal] = useState(false);
  async function revisarCanal(manual = false) {
    let desde = tocoCanalEnRef.current;
    try { desde = desde || Number(localStorage.getItem(claveCanal) || 0); } catch { /* sin almacenamiento */ }
    if (!desde || descargable) return;
    if (Date.now() - desde < SEGUNDOS_EN_CANAL * 1000) {
      if (manual) setAvisoCanal('Primero tocá el botón verde «Seguir» en el canal y volvé aquí. 👆');
      return;
    }
    if (!manual) { setConfirmarCanal(true); setHojaPago(true); return; }
    try {
      const res = await fetch(`${audioApiUrl}/canal`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ paso: 'unido' }) });
      if (!res.ok) { if (manual) setAvisoCanal('No se pudo habilitar, intentá de nuevo.'); return; }
      try { localStorage.removeItem(claveCanal); } catch { /* nada */ }
      setDescargable(true); setHojaPago(false); setCelebrar(true);
    } catch {
      if (manual) setAvisoCanal('Sin conexión, intentá de nuevo.');
    }
  }
  // Al volver de WhatsApp (o al recargar la página después de haber tocado «Unirme»).
  useEffect(() => {
    if (descargable) return;
    const alVolver = () => { if (document.visibilityState === 'visible') revisarCanal(); };
    alVolver();
    document.addEventListener('visibilitychange', alVolver);
    window.addEventListener('focus', alVolver);
    return () => {
      document.removeEventListener('visibilitychange', alVolver);
      window.removeEventListener('focus', alVolver);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [descargable, claveCanal]);

  const reproduciendo = estado === 'reproduciendo';
  const enPausaAuto = avisoPausa && estado === 'pausado' && !descargable;

  const enlaceDescarga = `https://wa.me/${ADMIN_WHATSAPP}?text=${encodeURIComponent(`Hola, tengo una consulta sobre mi canción "${titulo}". https://corridos.online/cancion/${audioApiUrl.split('/').pop()}`)}`;

  if (vencida) {
    return (
      <main style={{
        position: 'relative', zIndex: 0, overflow: 'hidden',
        minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        background: 'linear-gradient(160deg, #9a1f2b 0%, #5c0f18 55%, #2c0a10 100%)',
        color: '#fdf3e0', fontFamily: 'system-ui, sans-serif', textAlign: 'center', padding: '2rem 1.5rem', gap: '1.1rem',
      }}>
        <HeroVideoFondo overlay="radial-gradient(ellipse 70% 55% at 50% 30%, rgba(44,10,16,0.6) 0%, rgba(44,10,16,0.88) 100%)" />
        <div style={{ fontSize: '2.2rem' }}>⌛</div>
        <h1 style={{ fontSize: '1.25rem', margin: 0, maxWidth: '26rem', lineHeight: 1.4 }}>
          «{titulo}» fue retirada de nuestro servidor por falta de espacio.
        </h1>
        <p style={{ maxWidth: '26rem', fontSize: '0.95rem', lineHeight: 1.55, color: '#e0b98f', margin: 0 }}>
          Todavía la podemos recuperar para vos. Escribinos y te la volvemos a dejar disponible.
        </p>
        <a
          href={enlaceDescarga}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => trackMetaPixel('Contact', { content_name: 'Recuperar canción retirada' })}
          style={{
            marginTop: '0.5rem', padding: '1rem 1.6rem', borderRadius: 999, textDecoration: 'none',
            background: 'linear-gradient(135deg, #25d366, #128c7e)', color: '#fff',
            fontSize: '1rem', fontWeight: 800, boxShadow: '0 8px 24px rgba(0,0,0,0.35)',
          }}
        >
          💬 Recuperar mi canción
        </a>
        <button
          type="button"
          onClick={() => router.push('/')}
          style={{ marginTop: '0.25rem', background: 'none', border: 'none', color: '#ffd35c', fontSize: '0.95rem', fontWeight: 700, cursor: 'pointer' }}
        >
          🎤 Haz otra con Corridos.online
        </button>
      </main>
    );
  }

  if (bloqueado && !esDueño) {
    return (
      <main style={{
        position: 'relative', zIndex: 0, overflow: 'hidden',
        minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        background:
          'radial-gradient(ellipse 55% 45% at 12% 0%, rgba(255,138,61,0.28), transparent 60%),' +
          'radial-gradient(ellipse 60% 50% at 100% 15%, rgba(217,70,239,0.28), transparent 62%),' +
          'linear-gradient(165deg, #2a1152 0%, #1a0b3d 55%, #10082b 100%)',
        color: '#f3ecff', fontFamily: 'system-ui, sans-serif', textAlign: 'center', padding: '2rem 1.5rem', gap: '1.1rem',
      }}>
        <HeroVideoFondo overlay="radial-gradient(ellipse 70% 55% at 50% 30%, rgba(16,8,43,0.55) 0%, rgba(16,8,43,0.82) 100%)" />
        <div style={{ fontSize: '2.2rem' }}>🎵</div>
        <h1 style={{ fontSize: '1.25rem', margin: 0, maxWidth: '26rem', lineHeight: 1.4 }}>
          Esta canción ya alcanzó su límite de reproducciones gratis.
        </h1>
        <p style={{ maxWidth: '26rem', fontSize: '0.92rem', lineHeight: 1.6, color: '#d9cdf5', margin: 0 }}>
          Pedile a quien te la compartió que recargue para que vuelva a estar disponible.
        </p>
        <button
          type="button"
          onClick={() => router.push('/')}
          style={{
            marginTop: '0.75rem', padding: '0.9rem 1.6rem', border: 'none', borderRadius: 999,
            background: 'linear-gradient(135deg, #ff5f6d, #ff8a3d)', color: '#fff',
            fontSize: '0.95rem', fontWeight: 800, cursor: 'pointer',
            boxShadow: '0 6px 0 #b8391f, 0 16px 32px rgba(255,95,109,0.35)',
          }}
        >
          🎤 Haz la tuya con Corridos.online
        </button>
      </main>
    );
  }

  if (bloqueado) {
    return (
      <main style={{
        position: 'relative', zIndex: 0, overflow: 'hidden',
        minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        background:
          'radial-gradient(ellipse 55% 45% at 12% 0%, rgba(255,138,61,0.28), transparent 60%),' +
          'radial-gradient(ellipse 60% 50% at 100% 15%, rgba(217,70,239,0.28), transparent 62%),' +
          'linear-gradient(165deg, #2a1152 0%, #1a0b3d 55%, #10082b 100%)',
        color: '#f3ecff', fontFamily: 'system-ui, sans-serif', textAlign: 'center', padding: '2rem 1.5rem', gap: '1.1rem',
      }}>
        <HeroVideoFondo overlay="radial-gradient(ellipse 70% 55% at 50% 25%, rgba(16,8,43,0.6) 0%, rgba(16,8,43,0.88) 100%)" />
        <div style={{ fontSize: '2.2rem' }}>❤️</div>
        <h1 style={{ fontSize: '1.3rem', margin: 0, maxWidth: '30rem', lineHeight: 1.35 }}>
          Tu canción ya es tuya.<br />Ahora queremos ayudarte a conservarla.
        </h1>

        <p style={{ maxWidth: '30rem', fontSize: '0.9rem', lineHeight: 1.55, color: '#d9cdf5', margin: 0 }}>
          🎉 ¡Ya la escuchaste 2 veces! Se nota que te gustó — por eso te dejamos escucharla gratis esas 2 primeras veces, para que sintieras cómo tu historia se convirtió en canción.
        </p>
        <p style={{ maxWidth: '30rem', fontSize: '0.9rem', lineHeight: 1.55, color: '#d9cdf5', margin: 0 }}>
          Pero mantener cada canción almacenada y disponible para reproducirse en nuestra nube genera costos de almacenamiento, servidores y servicio.
          Y queremos poder seguir creando y ofreciendo muchas más canciones como la tuya.
        </p>
        <p style={{ maxWidth: '30rem', fontSize: '0.92rem', fontWeight: 700, color: '#fff', margin: 0 }}>
          ❤️ Por eso, después de esas 2 escuchas gratis, el acceso completo requiere una recarga.
        </p>

        <div style={{
          marginTop: '0.5rem', maxWidth: '28rem', width: '100%', textAlign: 'left',
          border: '2px solid #ff8a3d', borderRadius: 18, padding: '1.25rem 1.4rem',
          background: 'rgba(255,138,61,0.08)',
        }}>
          <p style={{ margin: '0 0 0.75rem', fontSize: '1.05rem', fontWeight: 800, color: '#ffb26b' }}>
            🔥 Recargá L.300 una sola vez y obtenés:
          </p>
          <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
            {[
              ['🌟', 'Quedás como usuario PREMIUM para siempre — no es solo esta canción.'],
              ['🎵', 'Descargá esta canción ahora mismo y conservála en tu teléfono.'],
              ['🎶', 'El saldo también te alcanza para crear 3 canciones más con nuestra aplicación.'],
              ['📱', 'Y esas también las vas a poder descargar y compartir con quien quieras, sin volver a bloquearse.'],
            ].map(([icono, texto]) => (
              <li key={texto} style={{ display: 'flex', gap: '0.6rem', fontSize: '0.9rem', lineHeight: 1.4 }}>
                <span>{icono}</span><span>{texto}</span>
              </li>
            ))}
          </ul>
        </div>

        <p style={{ maxWidth: '28rem', fontSize: '0.82rem', lineHeight: 1.5, color: '#c9baed', margin: '0.25rem 0 0' }}>
          💡 Tu recarga nos ayuda a cubrir el costo de mantener nuestro servicio y, al mismo tiempo, nos permite seguir creando nuevas canciones para vos y para más personas.
        </p>

        <p style={{ margin: '0.5rem 0 0', fontSize: '0.92rem', lineHeight: 1.6 }}>
          No es una mensualidad.<br />No es una suscripción.<br />
          <strong>Es una sola recarga para desbloquear tu canción y seguir creando. ❤️</strong>
        </p>

        <button
          type="button"
          onClick={irASesionOLanding}
          style={{
            marginTop: '0.75rem', padding: '1rem 1.8rem', border: 'none', borderRadius: 999,
            background: 'linear-gradient(135deg, #ff5f6d, #ff8a3d)', color: '#fff',
            fontSize: '1rem', fontWeight: 800, cursor: 'pointer',
            boxShadow: '0 6px 0 #b8391f, 0 16px 32px rgba(255,95,109,0.35)',
          }}
        >
          👉 Recargá L.300 y llevate tu canción para siempre
        </button>

        <p style={{ marginTop: '0.75rem', fontSize: '0.85rem', color: '#d9cdf5' }}>
          🎵 Tu historia merece seguir sonando.
        </p>
      </main>
    );
  }

  return (
    <main style={{
      position: 'relative', zIndex: 0, overflow: 'hidden',
      minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      background:
        'radial-gradient(ellipse 60% 55% at 14% 0%, rgba(242, 183, 5, 0.30), transparent 62%),' +
        'radial-gradient(ellipse 55% 50% at 100% 20%, rgba(31, 138, 76, 0.28), transparent 60%),' +
        'linear-gradient(160deg, #9a1f2b 0%, #5c0f18 55%, #2c0a10 100%)',
      color: '#fdf3e0', fontFamily: 'system-ui, sans-serif', textAlign: 'center', padding: '1.5rem', gap: '1.25rem',
    }}>
      <HeroVideoFondo overlay="radial-gradient(ellipse 70% 55% at 50% 30%, rgba(44,10,16,0.35) 0%, rgba(44,10,16,0.75) 100%)" />
      <button
        type="button"
        onClick={alTocar}
        disabled={estado === 'cargando'}
        aria-label={reproduciendo ? 'Pausar' : 'Reproducir canción'}
        style={{
          // Sin backdrop-filter a propósito — sobre un <video> de fondo,
          // Safari/iOS tiene un bug donde el blur se escapa y difumina TODO
          // el video en vez de solo este círculo (en Chrome se ve bien).
          // Se compensa con más opacidad sólida en vez de blur.
          width: 'min(32vw, 130px)', aspectRatio: '1 / 1', borderRadius: '50%',
          border: '1px solid rgba(255,255,255,0.45)', padding: 0,
          cursor: estado === 'cargando' ? 'wait' : 'pointer',
          background: 'rgba(255,255,255,0.4)',
          boxShadow: '0 6px 0 rgba(0,0,0,0.35), 0 12px 24px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.3)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          animation: enPausaAuto ? 'latidoDescarga 1.1s ease-in-out infinite' : undefined,
        }}
      >
        {estado === 'cargando' ? (
          <span style={{ fontSize: '1.6rem' }}>⏳</span>
        ) : reproduciendo ? (
          <span style={{ fontSize: '1.8rem', color: '#c0161f' }}>⏸</span>
        ) : (
          <span style={{
            width: 0, height: 0, marginLeft: '12%',
            borderTop: '18px solid transparent', borderBottom: '18px solid transparent',
            borderLeft: '28px solid #c0161f',
          }} />
        )}
      </button>

      {/* Muchos creían que la canción había terminado en la pausa automática: una flecha señala el play
          y se va sola al reanudar (onPlay apaga avisoPausa). */}
      {enPausaAuto && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginTop: '-0.6rem' }}>
          <span aria-hidden style={{ fontSize: '2.6rem', lineHeight: 1, color: '#ffd35c', animation: 'flechaPlay 0.9s ease-in-out infinite' }}>⬆</span>
          <span style={{
            padding: '0.5rem 1rem', borderRadius: 14, background: 'rgba(0,0,0,0.6)', border: '2px solid #ffd35c',
            color: '#fdf3e0', fontSize: '1.05rem', fontWeight: 800, lineHeight: 1.3, maxWidth: '20rem',
          }}>
            La canción está en pausa.<br />
            <span style={{ color: '#ffd35c' }}>Presioná aquí para seguir escuchando</span>
          </span>
        </div>
      )}

      <h1 style={{ fontSize: '1.15rem', margin: 0, maxWidth: '90vw' }}>{titulo}</h1>

      {reproduciendo ? (
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: '4px', height: '28px' }}>
          {[0, 1, 2, 3, 4].map(i => (
            <span
              key={i}
              style={{
                width: '5px', borderRadius: '3px',
                background: 'linear-gradient(180deg, #ffd35c, #f2b705)',
                animation: `eqBar ${0.7 + (i % 3) * 0.15}s ease-in-out infinite`,
                animationDelay: `${i * 0.08}s`,
              }}
            />
          ))}
        </div>
      ) : (
        <p style={{ margin: 0, color: '#e0b98f', fontSize: '0.9rem' }}>
          {estado === 'cargando' ? 'Cargando...' : estado === 'pausado' ? 'Pausado' : 'Tocá para escuchar'}
        </p>
      )}

      {!descargable && conContador && ahora !== null && (
        <div style={{
          maxWidth: '22rem', padding: '0.75rem 1rem', borderRadius: 14,
          background: 'rgba(0,0,0,0.45)', border: '1px solid rgba(255,211,92,0.55)', lineHeight: 1.4,
        }}>
          <div style={{ fontSize: '0.85rem', color: '#fdf3e0' }}>
            ⏳ Por falta de espacio en nuestro servidor, esta canción será borrada en
          </div>
          <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#ffd35c', fontVariantNumeric: 'tabular-nums', margin: '0.15rem 0' }}>
            {formatoRestante(vence - ahora)}
          </div>
          <div style={{ fontSize: '0.8rem', color: '#e0b98f' }}>Descárgala antes para no perderla.</div>
        </div>
      )}

      {/* En la pausa automática solo queda la invitación a descargar, bien grande; los demás botones
          vuelven al reanudar (onPlay apaga avisoPausa). */}
      {enPausaAuto && (
        <button
          type="button"
          onClick={() => abrirDescarga('aviso de pausa')}
          style={{
            cursor: 'pointer', font: 'inherit',
            width: 'min(92vw, 24rem)', padding: '1.3rem 1.2rem', borderRadius: 22, textDecoration: 'none',
            background: 'linear-gradient(180deg, #ffe27a, #f2b705)', border: '3px solid #fff4c2',
            color: '#2c0a10', lineHeight: 1.25, boxShadow: '0 6px 0 #a87d00, 0 0 36px rgba(255,211,92,0.7)',
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.35rem',
            animation: 'latidoDescarga 1.1s ease-in-out infinite',
          }}
        >
          <span style={{ fontSize: '1.5rem', fontWeight: 900 }}>¿Te gusta? 🎶</span>
          <span style={{ fontSize: '1.2rem', fontWeight: 800 }}>Descárgala GRATIS sin interrupciones</span>
          <TarjetaCanal texto="Tocá aquí, seguí el canal y volvé 👉" />
        </button>
      )}

      {hojaPago && (
        <div
          onClick={() => setHojaPago(false)}
          style={{
            position: 'fixed', inset: 0, zIndex: 50, background: 'rgba(0,0,0,0.72)',
            display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              width: 'min(100vw, 28rem)', maxHeight: '92vh', overflowY: 'auto', boxSizing: 'border-box',
              background: '#2c0a10', color: '#fdf3e0', borderRadius: '22px 22px 0 0', border: '2px solid #ffd35c',
              padding: '1.3rem 1.2rem 1.6rem', textAlign: 'left', display: 'flex', flexDirection: 'column', gap: '0.9rem',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <strong style={{ fontSize: '1.2rem' }}>📢 Seguí el canal y volvé</strong>
              <button type="button" onClick={() => setHojaPago(false)} aria-label="Cerrar"
                style={{ background: 'none', border: 'none', color: '#e0b98f', fontSize: '1.4rem', cursor: 'pointer' }}>✕</button>
            </div>

            <MuestraSeguir />
            {confirmarCanal ? (
              <div style={{ fontSize: '1.1rem', fontWeight: 900, textAlign: 'center', color: '#ffd35c' }}>
                ¿Le diste al botón verde «Seguir»?
              </div>
            ) : (
              <div style={{ fontSize: '0.98rem', lineHeight: 1.5 }}>
                <strong>1.</strong> En el canal tocá el botón verde <strong style={{ color: '#9be3b4' }}>«Seguir»</strong> (abrir el canal no es suficiente).<br />
                <strong>2.</strong> Volvé a esta página y bajá tu canción <strong style={{ color: '#ffd35c' }}>gratis y sin pausas</strong>.
              </div>
            )}
            <button type="button" onClick={() => revisarCanal(true)}
              style={{
                padding: '0.95rem', borderRadius: 999, border: 'none', cursor: 'pointer',
                background: 'linear-gradient(180deg, #ffe27a, #f2b705)', color: '#2c0a10', fontSize: '1.05rem', fontWeight: 900,
                boxShadow: '0 4px 0 #a87d00',
              }}>
              {confirmarCanal ? '✅ Sí, ya lo seguí — descargar' : '✅ Ya lo seguí — descargar'}
            </button>
            <button type="button" onClick={unirseAlCanal}
              style={{ background: 'none', border: 'none', color: '#9be3b4', fontSize: '0.9rem', fontWeight: 700, cursor: 'pointer', textDecoration: 'underline' }}>
              {confirmarCanal ? '📢 No, volver al canal' : '📢 Abrir el canal otra vez'}
            </button>
            {avisoCanal && <div style={{ color: '#ffd35c', fontSize: '0.9rem', fontWeight: 700, textAlign: 'center' }}>{avisoCanal}</div>}

            <a href={enlaceDescarga} target="_blank" rel="noopener noreferrer"
              style={{ fontSize: '0.85rem', color: '#9be3b4', textAlign: 'center' }}>
              💬 ¿Dudas? Escribinos por WhatsApp
            </a>
          </div>
        </div>
      )}

      {!enPausaAuto && (<>
      {descargable && celebrar && (
        <div style={{
          width: 'min(92vw, 24rem)', padding: '1.1rem 1.1rem 1.2rem', borderRadius: 22, boxSizing: 'border-box',
          background: 'linear-gradient(180deg, #2f7d4a, #1f5c35)', border: '3px solid #ffd35c', color: '#fdf3e0',
          boxShadow: '0 0 30px rgba(255,211,92,0.45)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.6rem',
        }}>
          <span style={{ fontSize: '1.45rem', fontWeight: 900 }}>🎉 ¡Tu canción ya es tuya!</span>
          <span style={{ fontSize: '0.98rem', lineHeight: 1.35 }}>Descárgala sin pausas y guárdala en tu teléfono.</span>
          <button type="button" onClick={descargarArchivo}
            style={{
              padding: '0.9rem 1.8rem', border: 'none', borderRadius: 999, cursor: 'pointer',
              background: 'linear-gradient(180deg, #ffe27a, #f2b705)', color: '#2c0a10', fontSize: '1.1rem', fontWeight: 900,
              boxShadow: '0 4px 0 #a87d00', animation: 'latidoDescarga 1.1s ease-in-out infinite',
            }}>
            📥 Descargar mi canción
          </button>
        </div>
      )}

      <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', justifyContent: 'center' }}>
        {/* Mientras está bloqueada, compartir ya es el botón amarillo de la descarga gratis: este solo vuelve después. */}
        {descargable && (
        <button
          type="button"
          onClick={compartirCancion}
          style={{
            padding: '0.85rem 1.8rem', border: 'none', borderRadius: 999,
            background: 'linear-gradient(180deg, #34c46f, #1f8a4c)', color: '#fdf3e0',
            fontSize: '1rem', fontWeight: 800, cursor: 'pointer',
            boxShadow: '0 4px 0 #0f5c32', display: 'inline-flex', alignItems: 'center', gap: '0.5rem',
          }}
        >
          📤 Compartir esta canción
        </button>
        )}

        {descargable && !celebrar && (
          <button
            type="button"
            onClick={descargarArchivo}
            style={{
              padding: '0.85rem 1.8rem', border: 'none', borderRadius: 999,
              background: 'linear-gradient(180deg, #ffd35c, #f2b705)', color: '#2c0a10',
              fontSize: '1rem', fontWeight: 800, cursor: 'pointer',
              boxShadow: '0 4px 0 #a87d00', display: 'inline-flex', alignItems: 'center', gap: '0.5rem',
            }}
          >
            📥 Descargar canción
          </button>
        )}

        {descargable && puedeCompartirArchivo && (
          <button
            type="button"
            onClick={enviarPorWhatsapp}
            style={{
              padding: '0.85rem 1.8rem', border: 'none', borderRadius: 999,
              background: 'linear-gradient(180deg, #34d17a, #1fa855)', color: '#0b3a1e',
              fontSize: '1rem', fontWeight: 800, cursor: 'pointer',
              boxShadow: '0 4px 0 #0f7a3d', display: 'inline-flex', alignItems: 'center', gap: '0.5rem',
            }}
          >
            💬 Enviar a WhatsApp
          </button>
        )}

        {!descargable && (
          // Visible desde que entra (no solo en la pausa): la invitación al canal con su foto, de un solo toque.
          <button
            type="button"
            onClick={() => abrirDescarga('botón')}
            style={{
              font: 'inherit', cursor: 'pointer',
              width: 'min(92vw, 24rem)', padding: '0.85rem 1rem', borderRadius: 20, boxSizing: 'border-box',
              background: 'linear-gradient(180deg, #ffe27a, #f2b705)', border: '2px solid #fff4c2', color: '#2c0a10',
              boxShadow: '0 4px 0 #a87d00', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.45rem',
            }}
          >
            <span style={{ fontSize: '1.08rem', fontWeight: 900 }}>📥 Descárgala GRATIS y sin pausas</span>
            <TarjetaCanal texto="Tocá aquí, seguí el canal y volvé 👉" />
          </button>
        )}
      </div>

      {/* Quien recibe el link es el próximo cliente: lo invita a hacer la suya. */}
      <a
        href="/"
        style={{
          marginTop: '0.5rem', padding: '0.9rem 1.4rem', borderRadius: 18, textDecoration: 'none',
          border: '2px dashed #ffd35c', background: 'rgba(44,10,16,0.65)', color: '#fdf3e0',
          fontSize: '1.05rem', fontWeight: 800, lineHeight: 1.35, maxWidth: '22rem',
          boxShadow: '0 8px 24px rgba(0,0,0,0.35)',
        }}
      >
        🎤 Haz la tuya con <span style={{ color: '#ffd35c' }}>Corridos.online</span> 👉
      </a>
      </>)}

      <audio
        ref={audioRef}
        onEnded={alTerminar}
        onTimeUpdate={alAvanzar}
        onPlay={() => setAvisoPausa(false)}
        onPause={() => setEstado(e => (e === 'reproduciendo' ? 'pausado' : e))}
      />
      <style>{`
        @keyframes eqBar { 0%, 100% { height: 6px; } 50% { height: 28px; } }
        @keyframes latidoDescarga { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.05); } }
        @keyframes flechaPlay { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-10px); } }
      `}</style>
    </main>
  );
}
