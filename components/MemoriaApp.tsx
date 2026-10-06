'use client';
import { useEffect, useRef, useState } from 'react';
import { ETAPAS, claveResp } from './MiHistoriaApp';

const GOOGLE_FONTS_URL = 'https://fonts.googleapis.com/css2?family=Fraunces:wght@400;500;600;700&family=Karla:wght@400;500;600;700;800&display=swap';

interface Respuesta {
  texto: string; estado: string; tieneAudio?: boolean;
  profundizaciones: { pregunta: string; respuesta: string }[];
}
interface Foto {
  id: string; descripcion: string; año: string; lugar: string; personas: string;
  queOcurria: string; porQueImportante: string; etapaRelacionada: string;
}
interface HistoriaData {
  respuestas: Record<string, Respuesta>;
  fotografias: Foto[];
  nombre?: string;
}

// Reproductor de una respuesta puntual: si hay voz real grabada, la sirve
// directo desde Storage; si no, genera lectura sintética bajo demanda
// (no se pre-genera nada — costaría una llamada a TTS por cada respuesta
// de toda la historia aunque nadie la escuche nunca).
function BotonEscuchar({ clave, claveResp: k, texto, tieneAudio }: { clave: string; claveResp: string; texto: string; tieneAudio?: boolean }) {
  const [cargando, setCargando] = useState(false);
  const [urlSintetica, setUrlSintetica] = useState<string | null>(null);
  const [error, setError] = useState('');

  if (tieneAudio) {
    return (
      <div className="mm-audio">
        <span className="mm-audio-tag">🎙️ Su propia voz</span>
        <audio controls preload="none" src={'/api/historia/' + clave + '/audio/' + k} />
      </div>
    );
  }

  async function generar() {
    if (urlSintetica) return;
    setCargando(true); setError('');
    try {
      const res = await fetch('/api/historia/narrar', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ texto }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'No se pudo generar el audio'); return; }
      const bin = atob(data.audio);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      const blob = new Blob([bytes], { type: data.contentType || 'audio/mpeg' });
      setUrlSintetica(URL.createObjectURL(blob));
    } catch {
      setError('Error de conexión al generar el audio');
    } finally {
      setCargando(false);
    }
  }

  return (
    <div className="mm-audio">
      {urlSintetica ? (
        <audio controls autoPlay src={urlSintetica} />
      ) : (
        <button className="mm-btn-escuchar" onClick={generar} disabled={cargando}>
          {cargando ? '⏳ Generando voz...' : '🔊 Escuchar (voz sintética)'}
        </button>
      )}
      {error && <span className="mm-audio-error">{error}</span>}
    </div>
  );
}

export default function MemoriaApp({ clave }: { clave: string }) {
  const [data, setData] = useState<HistoriaData | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/api/historia/' + clave)
      .then(r => r.json())
      .then(d => setData(d))
      .catch(() => setError('No se pudo cargar esta historia.'))
      .finally(() => setCargando(false));
  }, [clave]);

  if (cargando) {
    return <div className="mm-root mm-loading"><style>{ESTILOS}</style>Cargando…</div>;
  }
  if (error || !data) {
    return <div className="mm-root mm-loading"><style>{ESTILOS}</style>{error || 'No se encontró esta historia.'}</div>;
  }

  const capitulos = ETAPAS
    .map((etapa, ei) => {
      const preguntas = etapa.preguntas
        .map((preg, pi) => ({ preg, pi, r: data.respuestas[claveResp(ei, pi)] }))
        .filter(({ r }) => r && r.texto.trim());
      const fotos = data.fotografias.filter(f => f.etapaRelacionada === String(ei));
      return { ei, etapa, preguntas, fotos };
    })
    .filter(c => c.preguntas.length > 0 || c.fotos.length > 0);

  const fotosSinEtapa = data.fotografias.filter(f => !f.etapaRelacionada);

  return (
    <div className="mm-root">
      <link rel="stylesheet" href={GOOGLE_FONTS_URL} />
      <style>{ESTILOS}</style>

      <header className="mm-hero">
        <div className="mm-eyebrow">Mi Historia · Memoria</div>
        <h1>{data.nombre ? `La historia de ${data.nombre}` : 'Esta historia'}</h1>
        <p className="mm-hint">Contada en sus propias palabras — y, donde se grabó, en su propia voz.</p>
      </header>

      {capitulos.length === 0 ? (
        <div className="mm-card mm-empty">Todavía no hay respuestas para mostrar acá.</div>
      ) : (
        <nav className="mm-toc">
          {capitulos.map(c => (
            <a key={c.ei} href={'#cap' + c.ei}>{c.etapa.titulo}</a>
          ))}
        </nav>
      )}

      {capitulos.map(c => (
        <section className="mm-chapter" id={'cap' + c.ei} key={c.ei}>
          <h2>{c.etapa.titulo}</h2>

          {c.fotos.length > 0 && (
            <div className="mm-photo-grid">
              {c.fotos.map(f => (
                <figure className="mm-photo" key={f.id}>
                  <img src={'/api/historia/' + clave + '/foto/' + f.id} alt={f.descripcion} />
                  <figcaption>{f.descripcion}{f.año ? ' — ' + f.año : ''}</figcaption>
                </figure>
              ))}
            </div>
          )}

          {c.preguntas.map(({ preg, pi, r }) => (
            <div className="mm-qa" key={pi}>
              <div className="mm-q">{preg}</div>
              <div className="mm-a">{r.texto}</div>
              <BotonEscuchar clave={clave} claveResp={claveResp(c.ei, pi)} texto={r.texto} tieneAudio={r.tieneAudio} />
              {r.profundizaciones.filter(f => f.respuesta.trim()).map((f, fi) => (
                <div className="mm-followup" key={fi}>
                  <div className="mm-q mm-q-sub">{f.pregunta}</div>
                  <div className="mm-a">{f.respuesta}</div>
                </div>
              ))}
            </div>
          ))}
        </section>
      ))}

      {fotosSinEtapa.length > 0 && (
        <section className="mm-chapter">
          <h2>Más fotografías</h2>
          <div className="mm-photo-grid">
            {fotosSinEtapa.map(f => (
              <figure className="mm-photo" key={f.id}>
                <img src={'/api/historia/' + clave + '/foto/' + f.id} alt={f.descripcion} />
                <figcaption>{f.descripcion}{f.año ? ' — ' + f.año : ''}</figcaption>
              </figure>
            ))}
          </div>
        </section>
      )}

      <footer className="mm-footer">Página privada de Mi Historia — se actualiza sola a medida que se agregan más respuestas.</footer>
    </div>
  );
}

const ESTILOS = `
.mm-root {
  --mh-paper: #faf4e9; --mh-paper-deep: #f0e6d2; --mh-ink: #2b2118; --mh-ink-soft: #6b5d4a;
  --mh-wine: #7a2036; --mh-wine-soft: #a44759; --mh-gold: #a5761f; --mh-gold-soft: #d9ae5e;
  --mh-border: #e2d3b0; --mh-shadow: 0 10px 30px rgba(43,33,24,0.12);
  background: var(--mh-paper); color: var(--mh-ink); min-height: 100vh;
  font-family: 'Karla', system-ui, sans-serif; line-height: 1.65;
}
.mm-root h1, .mm-root h2 { font-family: 'Fraunces', Georgia, serif; }
.mm-loading { display: flex; align-items: center; justify-content: center; min-height: 100vh; color: var(--mh-ink-soft); }
.mm-hero { max-width: 720px; margin: 0 auto; padding: 3.5rem 1.25rem 1.5rem; text-align: center; }
.mm-eyebrow { font-size: 0.75rem; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: var(--mh-gold); margin-bottom: 0.6rem; }
.mm-hero h1 { font-size: clamp(1.8rem, 5vw, 2.6rem); margin: 0 0 0.6rem; color: var(--mh-wine); }
.mm-hint { color: var(--mh-ink-soft); font-style: italic; margin: 0; }
.mm-toc { max-width: 720px; margin: 0 auto 2rem; padding: 1rem 1.25rem; background: var(--mh-paper-deep); border: 1px solid var(--mh-border); border-radius: 14px; display: flex; flex-wrap: wrap; gap: 0.5rem 1rem; }
.mm-toc a { font-size: 0.85rem; font-weight: 600; color: var(--mh-wine-soft); text-decoration: none; }
.mm-toc a:hover { text-decoration: underline; }
.mm-chapter { max-width: 720px; margin: 0 auto 3rem; padding: 0 1.25rem; scroll-margin-top: 1.5rem; }
.mm-chapter h2 { font-size: 1.5rem; color: var(--mh-wine); border-bottom: 1px solid var(--mh-border); padding-bottom: 0.6rem; margin-bottom: 1.25rem; }
.mm-qa { background: var(--mh-paper-deep); border: 1px solid var(--mh-border); border-radius: 14px; padding: 1.25rem 1.4rem; margin-bottom: 1rem; box-shadow: var(--mh-shadow); }
.mm-q { font-weight: 700; margin-bottom: 0.5rem; }
.mm-q-sub { font-size: 0.88rem; font-style: italic; font-weight: 600; color: var(--mh-ink-soft); }
.mm-a { white-space: pre-wrap; margin-bottom: 0.4rem; }
.mm-followup { margin-top: 1rem; padding-top: 0.9rem; border-top: 1px dashed var(--mh-border); }
.mm-audio { display: flex; align-items: center; gap: 0.6rem; margin-top: 0.6rem; flex-wrap: wrap; }
.mm-audio audio { height: 34px; max-width: 280px; }
.mm-audio-tag { font-size: 0.78rem; font-weight: 700; color: var(--mh-gold); }
.mm-audio-error { font-size: 0.78rem; color: #a13a2f; }
.mm-btn-escuchar { border: 1px solid var(--mh-border); background: var(--mh-paper); color: var(--mh-ink-soft); border-radius: 999px; padding: 0.4rem 0.85rem; font-size: 0.82rem; font-weight: 600; cursor: pointer; }
.mm-btn-escuchar:hover { border-color: var(--mh-wine-soft); color: var(--mh-wine); }
.mm-photo-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); gap: 1rem; margin-bottom: 1.5rem; }
.mm-photo { margin: 0; }
.mm-photo img { width: 100%; border-radius: 10px; display: block; box-shadow: var(--mh-shadow); }
.mm-photo figcaption { font-size: 0.76rem; color: var(--mh-ink-soft); margin-top: 0.4rem; }
.mm-empty { max-width: 720px; margin: 0 auto; text-align: center; padding: 2rem; color: var(--mh-ink-soft); }
.mm-footer { text-align: center; font-size: 0.78rem; color: var(--mh-ink-soft); padding: 2rem 1rem 3rem; }
`;
