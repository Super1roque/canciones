'use client';
import { useState } from 'react';

export default function AudioPlayer({ id, fileName }: { id: string; fileName: string }) {
  const [ended,  setEnded]  = useState(false);
  const [errored, setErrored] = useState(false);

  return (
    <div style={{ minHeight: '100vh', background: '#0c0c18', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontFamily: 'Inter, sans-serif', padding: '1.5rem' }}>
      <div style={{ maxWidth: 480, width: '100%', textAlign: 'center' }}>
        <div style={{ fontSize: '3.5rem', marginBottom: '1rem' }}>🎵</div>
        <h1 style={{ fontSize: '1.4rem', fontWeight: 700, marginBottom: '0.35rem' }}>Audio compartido</h1>
        <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: '0.88rem', marginBottom: '2rem' }}>{fileName}</p>

        {!ended && !errored && (
          <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 16, padding: '2rem', border: '1px solid rgba(255,255,255,0.08)' }}>
            <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.82rem', marginBottom: '1.25rem' }}>
              ⚠️ Este audio solo puede escucharse <strong style={{ color: '#f97316' }}>una vez</strong>
            </p>
            <audio
              src={`/api/audio/${id}`}
              controls
              controlsList="nodownload"
              preload="none"
              onEnded={() => setEnded(true)}
              onError={() => setErrored(true)}
              style={{ width: '100%', borderRadius: 8 }}
            />
          </div>
        )}

        {ended && (
          <div style={{ background: 'rgba(78,201,160,0.06)', borderRadius: 16, padding: '2.5rem', border: '1px solid rgba(78,201,160,0.25)' }}>
            <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>✓</div>
            <p style={{ color: 'rgba(78,201,160,0.9)', fontWeight: 600 }}>Audio escuchado</p>
            <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: '0.82rem', marginTop: '0.5rem' }}>Este enlace ya no es válido.</p>
          </div>
        )}

        {errored && (
          <div style={{ background: 'rgba(239,68,68,0.06)', borderRadius: 16, padding: '2.5rem', border: '1px solid rgba(239,68,68,0.25)' }}>
            <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>🔒</div>
            <p style={{ color: 'rgba(239,68,68,0.9)', fontWeight: 600 }}>Este audio ya fue escuchado</p>
            <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: '0.82rem', marginTop: '0.5rem' }}>El enlace ya no es válido.</p>
          </div>
        )}
      </div>
    </div>
  );
}
