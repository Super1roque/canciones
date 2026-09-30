'use client';
import { useRef, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

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
export default function AudioGreetingClient({ audioApiUrl, posterSrc, titulo, restringida, descargable, esDueño }: { audioApiUrl: string; posterSrc: string; titulo: string; restringida: boolean; descargable: boolean; esDueño: boolean }) {
  const router = useRouter();
  const [estado, setEstado] = useState<'inicial' | 'cargando' | 'reproduciendo' | 'pausado'>('inicial');
  const [bloqueado, setBloqueado] = useState(restringida);
  const audioRef = useRef<HTMLAudioElement>(null);
  const blobUrlRef = useRef<string>('');
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
  // Cada escucha (la primera Y cada replay después de que termina) debe
  // volver a pedirle autorización al server — así el contador de
  // reproducciones (y el límite de 2) se respeta de verdad. Solo se salta
  // el fetch para un simple pausa/resume DENTRO de la misma escucha.
  const necesitaFetchRef = useRef(true);

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
      const res = await fetch(audioApiUrl);
      if (res.status === 403) { setBloqueado(true); setEstado('inicial'); return; }
      if (!res.ok) { setEstado('inicial'); return; }
      const blob = await res.blob();
      if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current);
      const url = URL.createObjectURL(blob);
      blobUrlRef.current = url;
      blobRef.current = blob;
      a.src = url;
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
    const url = window.location.href;
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
  async function enviarPorWhatsapp() {
    try {
      let blob = blobRef.current;
      if (!blob) {
        const res = await fetch(audioApiUrl);
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

  const reproduciendo = estado === 'reproduciendo';

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
          🎤 Creá tu propia canción
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

      <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', justifyContent: 'center' }}>
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
      </div>

      <audio
        ref={audioRef}
        onEnded={alTerminar}
        onPause={() => setEstado(e => (e === 'reproduciendo' ? 'pausado' : e))}
      />
      <style>{`
        @keyframes eqBar { 0%, 100% { height: 6px; } 50% { height: 28px; } }
      `}</style>
    </main>
  );
}
