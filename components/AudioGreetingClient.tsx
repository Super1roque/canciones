'use client';
import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

// Hermano de VideoGreetingClient.tsx, pero para audio — mismo círculo con
// botón de play sobre el tema mariachi/corrido, pensado para viralizar
// canciones generadas: se puede escuchar (no descargar) y al terminar
// manda a corridos.online para que quien la recibió pueda registrarse.
export default function AudioGreetingClient({ audioApiUrl, posterSrc, titulo }: { audioApiUrl: string; posterSrc: string; titulo: string }) {
  const router = useRouter();
  const [estado, setEstado] = useState<'inicial' | 'cargando' | 'reproduciendo' | 'pausado'>('inicial');
  const audioRef = useRef<HTMLAudioElement>(null);
  const blobUrlRef = useRef<string>('');

  // El audio no se sirve como un link directo descargable — se trae como
  // blob a través de la API (mismo patrón que AudioPlayer.tsx de
  // /escuchar), así nunca queda expuesta una URL de archivo real.
  async function alTocar() {
    const a = audioRef.current;
    if (!a) return;

    if (blobUrlRef.current) {
      if (a.paused) { a.play(); setEstado('reproduciendo'); }
      else { a.pause(); setEstado('pausado'); }
      return;
    }

    setEstado('cargando');
    try {
      const res = await fetch(audioApiUrl);
      if (!res.ok) { setEstado('inicial'); return; }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      blobUrlRef.current = url;
      a.src = url;
      await a.play();
      setEstado('reproduciendo');
    } catch {
      setEstado('inicial');
    }
  }

  // Si ya es tenant logueado, lo deja directo en su dashboard. Si no —el
  // caso más común acá, porque quien recibe el link compartido casi nunca
  // es tenant todavía— lo manda a la landing para que se registre. Así
  // cada canción compartida termina siendo, de paso, un anuncio del programa.
  async function alTerminar() {
    setEstado('inicial');
    try {
      const res = await fetch('/api/tenants/me');
      router.push(res.ok ? '/dashboard' : '/');
    } catch {
      router.push('/');
    }
  }

  const reproduciendo = estado === 'reproduciendo';

  return (
    <main style={{
      minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      background:
        'radial-gradient(ellipse 60% 55% at 14% 0%, rgba(242, 183, 5, 0.30), transparent 62%),' +
        'radial-gradient(ellipse 55% 50% at 100% 20%, rgba(31, 138, 76, 0.28), transparent 60%),' +
        'linear-gradient(160deg, #9a1f2b 0%, #5c0f18 55%, #2c0a10 100%)',
      color: '#fdf3e0', fontFamily: 'system-ui, sans-serif', textAlign: 'center', padding: '1.5rem', gap: '1.25rem',
    }}>
      <div style={{
        position: 'relative', width: 'min(90vw, 280px)', aspectRatio: '1 / 1',
        borderRadius: '50%', overflow: 'hidden',
        border: '6px solid #f2b705', boxShadow: '0 10px 0 rgba(0,0,0,0.35), 0 24px 48px rgba(0,0,0,0.4)',
        background: `url('${posterSrc}') center/cover`,
      }}>
        <button
          type="button"
          onClick={alTocar}
          disabled={estado === 'cargando'}
          style={{
            position: 'absolute', inset: 0, width: '100%', height: '100%', border: 'none', padding: 0,
            cursor: estado === 'cargando' ? 'wait' : 'pointer',
            background: 'rgba(20,6,8,0.18)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
          aria-label={reproduciendo ? 'Pausar' : 'Reproducir canción'}
        >
          <span style={{
            width: '32%', aspectRatio: '1 / 1', borderRadius: '50%',
            background: 'linear-gradient(180deg, rgba(255,255,255,0.94), rgba(255,255,255,0.88))',
            boxShadow: '0 6px 0 rgba(0,0,0,0.35), 0 12px 24px rgba(0,0,0,0.4)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
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
          </span>
        </button>
      </div>

      <h1 style={{ fontSize: '1.15rem', margin: 0, maxWidth: '90vw' }}>{titulo}</h1>

      <p style={{ margin: 0, color: '#e0b98f', fontSize: '0.9rem' }}>
        {estado === 'cargando' ? 'Cargando...' : reproduciendo ? 'Sonando 🎶' : estado === 'pausado' ? 'Pausado' : 'Tocá para escuchar'}
      </p>

      <audio ref={audioRef} onEnded={alTerminar} onPause={() => setEstado(e => (e === 'reproduciendo' ? 'pausado' : e))} />
    </main>
  );
}
