'use client';

import { useRef, useState, type FormEvent } from 'react';
import { trackMetaPixel } from '@/lib/metaPixel';
import { ESTILOS, EXT_AUDIO, EXT_FOTO, MAX_AUDIO, MAX_FOTO, MAX_FOTOS, extension } from './datos';
import s from './pagina.module.css';

export default function Formulario({ whatsapp }: { whatsapp: string }) {
  const [estado, setEstado] = useState<'llenando' | 'enviando' | 'listo'>('llenando');
  const [avance, setAvance] = useState(0);
  const [error, setError] = useState('');
  const [nombreAudio, setNombreAudio] = useState('');
  const [nombresFotos, setNombresFotos] = useState<string[]>([]);
  const form = useRef<HTMLFormElement>(null);

  function revisar(datos: FormData): string {
    const audio = datos.get('audio') as File;
    if (!audio?.size) return 'Falta el audio de tu canción.';
    if (!EXT_AUDIO.includes(extension(audio.name))) return 'El audio debe ser MP3, M4A, WAV, OGG u OPUS.';
    if (audio.size > MAX_AUDIO) return 'El audio pesa más de 25 MB.';
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
      <label className={s.campo}>Nombre de la canción<input name="cancion" required maxLength={150} /></label>
      <label className={s.campo}>¿De qué trata?<textarea name="historia" required maxLength={2000} rows={3} /></label>
      <label className={s.campo}>¿Quiénes salen en la historia? <span className={s.opcional}>opcional</span>
        <textarea name="protagonistas" maxLength={1000} rows={2} placeholder="Nombre, edad aproximada, cómo son" />
      </label>

      <label className={s.archivo}>
        <span className={s.archivoTitulo}>🎵 Sube tu canción</span>
        <span className={s.archivoNombre}>{nombreAudio || 'MP3, M4A, WAV u OPUS · hasta 25 MB'}</span>
        <input name="audio" type="file" accept="audio/*,.mp3,.m4a,.wav,.ogg,.opus,.aac,.flac,.mpeg,.mp4" required onChange={(e) => setNombreAudio(e.target.files?.[0]?.name ?? '')} />
      </label>
      <label className={s.archivo}>
        <span className={s.archivoTitulo}>📷 Fotos de los protagonistas <span className={s.opcional}>opcional</span></span>
        <span className={s.archivoNombre}>{nombresFotos.join(', ') || 'Hasta 3 fotos, de frente y con buena luz'}</span>
        <input name="fotos" type="file" accept="image/*,.heic,.heif" multiple onChange={(e) => setNombresFotos(Array.from(e.target.files ?? []).map((f) => f.name))} />
      </label>

      <label className={s.campo}>Estilo
        <select name="estilo" defaultValue={ESTILOS[0]}>{ESTILOS.map((x) => <option key={x}>{x}</option>)}</select>
      </label>
      <label className={s.campo}>¿Para cuándo lo necesitas? <span className={s.opcional}>opcional</span><input name="fecha" maxLength={80} /></label>

      {/* Campo trampa para robots: una persona no lo ve. */}
      <input name="sitio" tabIndex={-1} autoComplete="off" aria-hidden="true" className={s.trampa} />

      <label className={s.confirma}><input type="checkbox" name="derechos" value="si" required />Tengo derecho a usar esta canción en un video y a publicarlo.</label>
      <label className={s.confirma}><input type="checkbox" name="permisos" value="si" required />Las personas reales que aparecen me autorizaron a usar su nombre y su imagen.</label>

      {error && <p className={s.error} role="alert">{error}</p>}
      <button className={s.boton} disabled={estado === 'enviando'}>
        {estado === 'enviando' ? `Subiendo tu canción… ${avance}%` : 'Quiero mi muestra gratis'}
      </button>
      <a className={s.whatsapp} href={whatsapp}>Prefiero mandarlo por WhatsApp</a>
    </form>
  );
}
