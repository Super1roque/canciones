'use client';

import { useRef, useState, type FormEvent } from 'react';
import { trackMetaPixel } from '@/lib/metaPixel';
import { ESTILOS, EXT_AUDIO, EXT_FOTO, MAX_AUDIO, MAX_FOTO, MAX_FOTOS, extension } from './datos';
import s from './pagina.module.css';

// `cancion` llega cuando se entra desde «Haz el video de tu canción» en /cancion/[id]: el audio ya está en el sitio.
export default function Formulario({ whatsapp, cancion: cancionDelEnlace }: { whatsapp: string; cancion?: { id: string; titulo: string } }) {
  // Quien llega desde la canción de otra persona (se la compartieron) puede querer el video de SU
  // canción: con «¿Es otra canción?» se descarta la cargada y se sube el audio propio.
  const [otraCancion, setOtraCancion] = useState(false);
  const cancion = otraCancion ? undefined : cancionDelEnlace;
  const [estado, setEstado] = useState<'llenando' | 'enviando' | 'listo'>('llenando');
  const [avance, setAvance] = useState(0);
  const [error, setError] = useState('');
  const [nombreAudio, setNombreAudio] = useState('');
  // Las fotos se juntan aquí: en el celular, elegir de nuevo reemplaza la selección anterior del input
  // y no deja cambiar de carpeta, así que cada vez que se elige se suman a la lista.
  const [fotos, setFotos] = useState<File[]>([]);
  const form = useRef<HTMLFormElement>(null);

  function revisar(datos: FormData): string {
    if (!cancion) {
      const audio = datos.get('audio') as File;
      if (!audio?.size) return 'Falta el audio de tu canción.';
      if (!EXT_AUDIO.includes(extension(audio.name))) return 'El audio debe ser MP3, M4A, WAV, OGG u OPUS.';
      if (audio.size > MAX_AUDIO) return 'El audio pesa más de 25 MB.';
    }
    const fotos = (datos.getAll('fotos') as File[]).filter((f) => f.size);
    if (fotos.length > MAX_FOTOS) return `Puedes enviar hasta ${MAX_FOTOS} fotos.`;
    if (fotos.some((f) => !EXT_FOTO.includes(extension(f.name)))) return 'Las fotos deben ser JPG, PNG, WEBP o HEIC.';
    if (fotos.some((f) => f.size > MAX_FOTO)) return 'Cada foto debe pesar menos de 8 MB.';
    return '';
  }

  // Con XMLHttpRequest se puede mostrar el avance: en el celular, subir la canción puede tardar.
  function enviar(e: FormEvent) {
    e.preventDefault();
    const datos = new FormData(form.current!);
    for (const f of fotos) datos.append('fotos', f);
    const problema = revisar(datos);
    setError(problema);
    if (problema) return;
    setEstado('enviando'); setAvance(0);
    const xhr = new XMLHttpRequest();
    xhr.open('POST', '/api/video-para-tu-cancion');
    xhr.upload.onprogress = (ev) => { if (ev.lengthComputable) setAvance(Math.round((ev.loaded / ev.total) * 100)); };
    xhr.onload = () => {
      if (xhr.status === 200) {
        trackMetaPixel('Lead', { content_name: 'Video para tu canción' });
        setEstado('listo');
        return;
      }
      let mensaje = 'No pudimos enviar tu solicitud. Intenta de nuevo.';
      try { mensaje = JSON.parse(xhr.responseText).error || mensaje; } catch {}
      setError(mensaje); setEstado('llenando');
    };
    xhr.onerror = () => { setError('Se cortó la conexión. Intenta de nuevo.'); setEstado('llenando'); };
    xhr.send(datos);
  }

  if (estado === 'listo') {
    return (
      <section className={s.listo} id="formulario">
        <p className={s.listoIcono}>🎬</p>
        <h2 className={s.formTitulo}>¡Recibí tu canción!</h2>
        <p className={s.texto}>Te escribo por WhatsApp para mandarte tu muestra gratis.</p>
      </section>
    );
  }

  return (
    <form ref={form} className={s.formulario} onSubmit={enviar} id="formulario">
      <h2 className={s.formTitulo}>Pide tu muestra gratis</h2>

      <label className={s.campo}>Tu nombre<input name="nombre" required maxLength={100} autoComplete="name" /></label>
      <label className={s.campo}>Tu WhatsApp<input name="whatsapp" type="tel" required maxLength={30} autoComplete="tel" placeholder="9999-9999" /></label>
      <label className={s.campo}>Nombre de la canción<input key={cancion ? 'cargada' : 'propia'} name="cancion" required maxLength={150} defaultValue={cancion?.titulo} /></label>
      <label className={s.campo}>¿De qué trata?<textarea name="historia" required maxLength={2000} rows={3} /></label>
      <label className={s.campo}>¿Quiénes salen en la historia? <span className={s.opcional}>opcional</span>
        <textarea name="protagonistas" maxLength={1000} rows={2} placeholder="Nombre, edad aproximada, cómo son" />
      </label>

      {cancion ? (
        <div className={s.archivo}>
          <span className={s.archivoTitulo}>🎵 Canción: «{cancion.titulo}» ✅</span>
          <span className={s.archivoNombre}>Ya la tenemos, no hace falta subirla.</span>
          <input type="hidden" name="cancionCompartidaId" value={cancion.id} />
          <button
            type="button"
            onClick={() => { setOtraCancion(true); setError(''); }}
            style={{ marginTop: 10, padding: '8px 14px', borderRadius: 999, border: '1px solid #f0be5a', background: 'transparent', color: '#f0be5a', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}
          >
            ¿Es otra canción? Subí tu propio audio
          </button>
        </div>
      ) : (
        <label className={s.archivo}>
          <span className={s.archivoTitulo}>🎵 Sube tu canción</span>
          <span className={s.archivoNombre}>{nombreAudio || 'MP3, M4A, WAV u OPUS · hasta 25 MB'}</span>
          <input name="audio" type="file" accept="audio/*,.mp3,.m4a,.wav,.ogg,.opus,.aac,.flac,.mpeg,.mp4" required onChange={(e) => setNombreAudio(e.target.files?.[0]?.name ?? '')} />
        </label>
      )}
      <div className={s.fotosLista}>
        {fotos.map((f, i) => (
          <div key={`${f.name}-${i}`} className={s.fotoFila}>
            <span>📷 {f.name}</span>
            <button type="button" className={s.fotoQuitar} aria-label={`Quitar ${f.name}`} onClick={() => setFotos(fotos.filter((_, j) => j !== i))}>✕</button>
          </div>
        ))}
      </div>
      {fotos.length < MAX_FOTOS && (
        <label className={s.archivo}>
          <span className={s.archivoTitulo}>📷 {fotos.length ? 'Agregar otra foto' : 'Fotos de los protagonistas'} <span className={s.opcional}>opcional</span></span>
          <span className={s.archivoNombre}>{fotos.length ? `${fotos.length} de ${MAX_FOTOS} · puedes agregar ${MAX_FOTOS - fotos.length} más` : `Hasta ${MAX_FOTOS} fotos, de frente y con buena luz`}</span>
          <input
            type="file"
            accept="image/*,.heic,.heif"
            multiple
            onChange={(e) => {
              const nuevas = Array.from(e.target.files ?? []);
              setFotos((antes) => [...antes, ...nuevas].slice(0, MAX_FOTOS));
              e.target.value = '';   // así se puede volver a abrir el selector y elegir de otra carpeta
            }}
          />
        </label>
      )}

      <label className={s.campo}>Estilo
        <select name="estilo" defaultValue={ESTILOS[0]}>{ESTILOS.map((x) => <option key={x}>{x}</option>)}</select>
      </label>
      <label className={s.campo}>¿Para cuándo lo necesitas? <span className={s.opcional}>opcional</span><input name="fecha" maxLength={80} /></label>

      {/* Campo trampa para robots: una persona no lo ve. */}
      <input name="sitio" tabIndex={-1} autoComplete="off" aria-hidden="true" className={s.trampa} />

      {/* Sin casillas que marcar (pedido de Armando): basta con el aviso, para no frenar a nadie. */}
      <p className={s.nota}>Al enviar, confirmas que puedes usar esta canción y las fotos que mandas.</p>

      {error && <p className={s.error} role="alert">{error}</p>}
      <button className={s.boton} disabled={estado === 'enviando'}>
        {estado === 'enviando' ? `Subiendo tu canción… ${avance}%` : 'Quiero mi muestra gratis'}
      </button>
      <a className={s.whatsapp} href={whatsapp}>Prefiero mandarlo por WhatsApp</a>
    </form>
  );
}
