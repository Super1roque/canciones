'use client';
import { useRef, useState } from 'react';

// Botón reusable de dictado por voz — graba con el micrófono del
// navegador, lo manda a transcribir (/api/historia/transcribir, sin
// relación con ninguna "clave": no guarda nada, solo convierte audio a
// texto) y agrega el resultado a lo que ya hubiera escrito. Se usa tanto
// en Mi Historia (components/MiHistoriaApp.tsx) como en el campo de
// historia de Crear Parodia.
export default function BotonResponderHablando({ valorActual, onTexto, className, classNameActivo, spinnerClassName }: {
  valorActual: string;
  onTexto: (nuevoValor: string) => void;
  className?: string;
  classNameActivo?: string;
  spinnerClassName?: string;
}) {
  const [grabando, setGrabando] = useState(false);
  const [transcribiendo, setTranscribiendo] = useState(false);
  const [error, setError] = useState('');
  const grabadorRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const valorRef = useRef(valorActual);
  valorRef.current = valorActual;

  async function alternarGrabacion() {
    if (grabando) { grabadorRef.current?.stop(); return; }
    setError('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const grabador = new MediaRecorder(stream);
      chunksRef.current = [];
      grabador.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      grabador.onstop = async () => {
        stream.getTracks().forEach(t => t.stop());
        setGrabando(false);
        setTranscribiendo(true);
        try {
          const blob = new Blob(chunksRef.current, { type: grabador.mimeType || 'audio/webm' });
          const fd = new FormData();
          fd.append('audio', blob, 'grabacion.webm');
          const res = await fetch('/api/historia/transcribir', { method: 'POST', body: fd });
          const data = await res.json();
          if (!res.ok) { setError(data.error || 'No se pudo transcribir la grabación.'); return; }
          const previo = valorRef.current.trim();
          onTexto(previo ? previo + ' ' + data.texto : data.texto);
        } catch {
          setError('Error de conexión al transcribir.');
        } finally {
          setTranscribiendo(false);
        }
      };
      grabadorRef.current = grabador;
      grabador.start();
      setGrabando(true);
    } catch {
      setError('No se pudo acceder al micrófono — revisá los permisos del navegador.');
    }
  }

  const activo = grabando || transcribiendo;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginTop: '0.5rem', flexWrap: 'wrap' }}>
      <button
        type="button"
        className={className + (activo && classNameActivo ? ' ' + classNameActivo : '')}
        disabled={transcribiendo}
        onClick={alternarGrabacion}
      >
        {transcribiendo
          ? <>{spinnerClassName && <span className={spinnerClassName} />} Transcribiendo...</>
          : grabando ? '⏹ Detener grabación' : '🎤 Responder hablando'}
      </button>
      {error && <span style={{ fontSize: '0.78rem', color: '#c0392b' }}>{error}</span>}
    </div>
  );
}
