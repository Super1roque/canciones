'use client';
import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Cue } from '@/lib/deepgramService';

// Hermano de VideoGreetingClient.tsx, pero para audio — mismo círculo con
// botón de play sobre el tema mariachi/corrido, pensado para viralizar
// canciones generadas: se puede escuchar (no descargar) y al terminar
// manda a corridos.online para que quien la recibió pueda registrarse.
export default function AudioGreetingClient({ audioApiUrl, posterSrc, titulo, cues }: { audioApiUrl: string; posterSrc: string; titulo: string; cues?: Cue[] }) {
  const router = useRouter();
  const [estado, setEstado] = useState<'inicial' | 'cargando' | 'reproduciendo' | 'pausado'>('inicial');
  const [ventana, setVentana] = useState<{ antes: string; actual: string; despues: string; indice: number } | null>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const blobUrlRef = useRef<string>('');
  const cueIndexRef = useRef(0);

  // Ventana deslizante de palabras (unas antes, la actual, unas después) en
  // vez de auto-scroll con scrollIntoView — más simple y confiable en los
  // navegadores/WebViews de celular (WhatsApp in-app, Android WebView) donde
  // se va a abrir esto, que es justo donde el auto-scroll centrado suele
  // fallar. El puntero solo avanza hacia adelante porque este reproductor
  // no tiene barra de búsqueda nativa — el tiempo del audio nunca retrocede.
  function actualizarVentana() {
    if (!cues || cues.length === 0) return;
    const t = audioRef.current?.currentTime ?? 0;
    let i = cueIndexRef.current;
    while (i < cues.length - 1 && cues[i].end < t) i++;
    cueIndexRef.current = i;

    const desde = Math.max(0, i - 4);
    const hasta = Math.min(cues.length, i + 5);
    setVentana({
      antes: cues.slice(desde, i).map(c => c.text).join(' '),
      actual: cues[i]?.text ?? '',
      despues: cues.slice(i + 1, hasta).map(c => c.text).join(' '),
      indice: i,
    });
  }

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
  const hayLetra = reproduciendo && !!cues?.length && !!ventana;

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

      {hayLetra ? (
        <p style={{
          margin: 0, padding: '0.9rem 0', maxWidth: '92vw', fontSize: '1.05rem', lineHeight: 1.5,
          color: '#e0b98f', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {ventana!.antes ? ventana!.antes + ' ' : ''}
          <strong
            key={ventana!.indice}
            className="palabra-actual"
            style={{ color: '#ffd35c', fontSize: '1.85rem', display: 'inline-block' }}
          >
            {ventana!.actual}
          </strong>
          {ventana!.despues ? ' ' + ventana!.despues : ''}
        </p>
      ) : reproduciendo ? (
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

      <button
        type="button"
        onClick={compartirCancion}
        style={{
          marginTop: '0.5rem', padding: '0.85rem 1.8rem', border: 'none', borderRadius: 999,
          background: 'linear-gradient(180deg, #34c46f, #1f8a4c)', color: '#fdf3e0',
          fontSize: '1rem', fontWeight: 800, cursor: 'pointer',
          boxShadow: '0 4px 0 #0f5c32', display: 'inline-flex', alignItems: 'center', gap: '0.5rem',
        }}
      >
        📤 Compartir esta canción
      </button>

      <audio
        ref={audioRef}
        onEnded={alTerminar}
        onPause={() => setEstado(e => (e === 'reproduciendo' ? 'pausado' : e))}
        onTimeUpdate={actualizarVentana}
      />
      <style>{`
        @keyframes eqBar { 0%, 100% { height: 6px; } 50% { height: 28px; } }
        @keyframes pulsoPalabra {
          0% { transform: scale(0.55); opacity: 0.6; }
          50% { transform: scale(1.6); }
          100% { transform: scale(1); opacity: 1; }
        }
        .palabra-actual { animation: pulsoPalabra 0.32s cubic-bezier(.34,1.56,.64,1); }
        @media (prefers-reduced-motion: reduce) {
          .palabra-actual { animation: none; }
        }
      `}</style>
    </main>
  );
}
