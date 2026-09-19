'use client';
import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

// Página de "saludo compartible" genérica — mismo diseño para /saludofinde,
// /yavioquefaciles y cualquier otra que use este mismo formato: foto en
// círculo con botón de play, y al tocar pasa a un reproductor vertical.
export default function VideoGreetingClient({ videoSrc, posterSrc }: { videoSrc: string; posterSrc: string }) {
  const router = useRouter();
  const [reproduciendo, setReproduciendo] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  // El <video> está SIEMPRE montado (nunca se crea recién al hacer click) —
  // así el .play() se llama de forma síncrona, dentro del mismo gesto del
  // click. Si se monta condicionalmente y el .play() queda diferido a un
  // requestAnimationFrame, el navegador a veces ya no lo cuenta como parte
  // del gesto del usuario y bloquea la reproducción en silencio (se queda
  // trabado en 0:00).
  function reproducir() {
    videoRef.current?.play();
    setReproduciendo(true);
  }

  // Si ya es tenant logueado (tiene la cookie de sesión), apenas termina
  // el video lo dejamos directo en su dashboard en vez de quedarse mirando
  // la pantalla — para alguien sin sesión, no pasa nada, se queda acá.
  async function alTerminar() {
    try {
      const res = await fetch('/api/tenants/me');
      if (res.ok) router.push('/dashboard');
    } catch {
      // Silencioso — se queda en esta pantalla si no se pudo confirmar la sesión.
    }
  }

  return (
    <main style={{
      minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      background:
        'radial-gradient(ellipse 60% 55% at 14% 0%, rgba(242, 183, 5, 0.30), transparent 62%),' +
        'radial-gradient(ellipse 55% 50% at 100% 20%, rgba(31, 138, 76, 0.28), transparent 60%),' +
        'linear-gradient(160deg, #9a1f2b 0%, #5c0f18 55%, #2c0a10 100%)',
      color: '#fdf3e0', fontFamily: 'system-ui, sans-serif', textAlign: 'center', padding: '1.5rem', gap: '1.25rem',
    }}>
      <div style={reproduciendo ? {
        // El video es vertical (celular) — nada de aspect-ratio cuadrado ni
        // object-fit: cover acá, porque recortaría cabeza o pies. Se deja
        // que crezca con su proporción real, con un máximo de alto/ancho.
        position: 'relative', width: 'min(90vw, 340px)', maxHeight: '75vh',
        borderRadius: 20, overflow: 'hidden',
        border: '6px solid #f2b705', boxShadow: '0 10px 0 rgba(0,0,0,0.35), 0 24px 48px rgba(0,0,0,0.4)',
        background: '#000',
      } : {
        position: 'relative', width: 'min(90vw, 420px)', aspectRatio: '1 / 1',
        borderRadius: '50%', overflow: 'hidden',
        border: '6px solid #f2b705', boxShadow: '0 10px 0 rgba(0,0,0,0.35), 0 24px 48px rgba(0,0,0,0.4)',
        background: '#fdf3e0',
      }}>
        <video
          ref={videoRef}
          src={videoSrc}
          poster={posterSrc}
          controls={reproduciendo}
          playsInline
          onEnded={alTerminar}
          style={reproduciendo
            ? { width: '100%', maxHeight: '75vh', display: 'block' }
            : { width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
        />

        {!reproduciendo && (
          <button
            type="button"
            onClick={reproducir}
            style={{
              position: 'absolute', inset: 0, width: '100%', height: '100%', border: 'none', padding: 0, cursor: 'pointer',
              background: 'rgba(20,6,8,0.18)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
            aria-label="Reproducir video"
          >
            <span style={{
              width: '28%', aspectRatio: '1 / 1', borderRadius: '50%',
              background: 'linear-gradient(180deg, rgba(255,255,255,0.94), rgba(255,255,255,0.88))',
              boxShadow: '0 6px 0 rgba(0,0,0,0.35), 0 12px 24px rgba(0,0,0,0.4)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <span style={{
                width: 0, height: 0, marginLeft: '12%',
                borderTop: '18px solid transparent', borderBottom: '18px solid transparent',
                borderLeft: '28px solid #c0161f',
              }} />
            </span>
          </button>
        )}
      </div>

      {!reproduciendo && (
        <p style={{ margin: 0, color: '#e0b98f', fontSize: '0.95rem' }}>Tocá para ver el video</p>
      )}
    </main>
  );
}
