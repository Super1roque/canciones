'use client';
import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';

// Las solicitudes de /video-para-tu-cancion. Los enlaces al audio y las fotos duran 2 horas: al recargar se renuevan.
type Solicitud = {
  id: string; nombre: string; whatsapp: string; cancion: string; historia: string; protagonistas: string;
  estilo: string; fecha: string; estado: string; creado: string; audioUrl: string; fotosUrl: string[];
};
const ESTADOS = ['nuevo', 'contactado', 'muestra enviada', 'pagado', 'entregado', 'descartado'];

export default function Pagina() {
  const { user } = useAuth();
  const [lista, setLista] = useState<Solicitud[] | null>(null);
  const [error, setError] = useState('');

  const pedir = useCallback(async (init?: RequestInit) => {
    const token = await user!.getIdToken();
    return fetch('/api/admin/videos-cancion', { ...init, headers: { ...init?.headers, Authorization: `Bearer ${token}` } });
  }, [user]);

  useEffect(() => {
    if (!user) return;
    pedir().then(async (r) => (r.ok ? setLista(await r.json()) : setError('No se pudieron cargar las solicitudes.'))).catch(() => setError('No se pudieron cargar las solicitudes.'));
  }, [user, pedir]);

  async function cambiar(id: string, estado: string) {
    const r = await pedir({ method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, estado }) });
    if (r.ok) setLista((l) => l!.map((s) => (s.id === id ? { ...s, estado } : s)));
    else setError('No se pudo cambiar el estado.');
  }

  return (
    <div style={{ maxWidth: 760, margin: '0 auto', padding: 16 }}>
      <a href="/admin">← Admin</a>
      <h1 style={{ fontSize: 26, fontWeight: 800, margin: '10px 0' }}>🎬 Videos de canciones</h1>
      {error && <p style={{ color: '#d33' }}>{error}</p>}
      {!lista && !error && <p>Cargando…</p>}
      {lista?.length === 0 && <p>Todavía no hay solicitudes.</p>}
      {lista?.map((s) => (
        <article key={s.id} style={{ border: '1px solid rgba(128,128,128,.4)', borderRadius: 12, padding: 14, marginTop: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
            <strong style={{ fontSize: 18 }}>{s.nombre} · «{s.cancion}»</strong>
            <select value={s.estado} onChange={(e) => cambiar(s.id, e.target.value)}>{ESTADOS.map((x) => <option key={x}>{x}</option>)}</select>
          </div>
          <p style={{ fontSize: 13, opacity: 0.7 }}>{new Date(s.creado).toLocaleString('es')} · {s.estilo}{s.fecha ? ` · para ${s.fecha}` : ''}</p>
          <p style={{ marginTop: 8 }}>{s.historia}</p>
          {s.protagonistas && <p style={{ marginTop: 6 }}><strong>Protagonistas:</strong> {s.protagonistas}</p>}
          <p style={{ marginTop: 8, display: 'flex', gap: 14, flexWrap: 'wrap' }}>
            <a href={`https://wa.me/${s.whatsapp}`} target="_blank" rel="noreferrer">💬 WhatsApp +{s.whatsapp}</a>
            <a href={s.audioUrl}>🎵 Audio</a>
            {s.fotosUrl.map((f, i) => <a key={f} href={f}>📷 Foto {i + 1}</a>)}
          </p>
        </article>
      ))}
    </div>
  );
}
