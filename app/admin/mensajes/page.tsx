'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { conLinksClickeables } from '@/lib/linkify';

type EstadoPush = 'cargando' | 'sin-soporte' | 'denegado' | 'inactivo' | 'activando' | 'activo';

// El navegador solo acepta la clave pública del push como Uint8Array, no
// como el string base64url que da VAPID — es la conversión estándar para
// esto (no hay forma más corta con las APIs nativas).
function claveComoUint8Array(base64: string): Uint8Array {
  const base64Normal = (base64 + '='.repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/');
  const binario = atob(base64Normal);
  return Uint8Array.from([...binario].map(c => c.charCodeAt(0)));
}

// Permite que el admin reciba un aviso (con el sonido de notificación del
// sistema) cuando un tenant escribe, aunque no tenga la app abierta — ver
// public/sw.js (evento "push") y lib/pushService.ts (quién lo dispara).
// Pedir permiso requiere un gesto real del usuario (este botón), no se
// puede activar solo ni con el load de la página.
function NotificacionesPush() {
  const [estado, setEstado] = useState<EstadoPush>('cargando');

  useEffect(() => {
    (async () => {
      if (!('serviceWorker' in navigator) || !('PushManager' in window)) { setEstado('sin-soporte'); return; }
      if (Notification.permission === 'denied') { setEstado('denegado'); return; }
      try {
        const registro = await navigator.serviceWorker.ready;
        const suscripcion = await registro.pushManager.getSubscription();
        setEstado(suscripcion ? 'activo' : 'inactivo');
      } catch {
        setEstado('inactivo');
      }
    })();
  }, []);

  async function activar() {
    setEstado('activando');
    try {
      const permiso = await Notification.requestPermission();
      if (permiso !== 'granted') { setEstado('denegado'); return; }

      const registro = await navigator.serviceWorker.ready;
      const suscripcion = await registro.pushManager.subscribe({
        userVisibleOnly: true,
        // El cast es solo por una sobre-especificidad de los tipos de TS
        // (Uint8Array<ArrayBufferLike> vs. BufferSource) — en runtime es un
        // Uint8Array normal, que el navegador acepta sin problema.
        applicationServerKey: claveComoUint8Array(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!) as BufferSource,
      });
      await fetch('/api/admin/push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(suscripcion),
      });
      setEstado('activo');
    } catch (error) {
      console.error('activar notificaciones:', error);
      setEstado('inactivo');
    }
  }

  async function desactivar() {
    try {
      const registro = await navigator.serviceWorker.ready;
      const suscripcion = await registro.pushManager.getSubscription();
      if (suscripcion) {
        await fetch('/api/admin/push', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ endpoint: suscripcion.endpoint }),
        });
        await suscripcion.unsubscribe();
      }
    } finally {
      setEstado('inactivo');
    }
  }

  if (estado === 'cargando' || estado === 'sin-soporte') return null;

  if (estado === 'denegado') {
    return (
      <p style={{ fontSize: '0.76rem', color: 'var(--error)', margin: 0 }}>
        🔕 Bloqueaste las notificaciones — para activarlas, habilitalas desde el candado/ícono de la barra de direcciones.
      </p>
    );
  }

  if (estado === 'activo') {
    return (
      <button type="button" className="btn-secondary" style={{ fontSize: '0.78rem', alignSelf: 'flex-start' }} onClick={desactivar}>
        🔔 Notificaciones activas — desactivar
      </button>
    );
  }

  return (
    <button type="button" className="btn-primary" style={{ fontSize: '0.78rem', alignSelf: 'flex-start' }} disabled={estado === 'activando'} onClick={activar}>
      {estado === 'activando' ? 'Activando…' : '🔔 Activar notificaciones de mensajes nuevos'}
    </button>
  );
}

type Autor = 'tenant' | 'admin';

type Conversacion = {
  telefono: string;
  ultimoTexto?: string;
  ultimaImagen: boolean;
  ultimoAutor: Autor;
  fecha: string;
  noLeidosAdmin: number;
  noLeidosTenant: number;
};

type Mensaje = {
  id: string;
  telefono: string;
  autor: Autor;
  texto?: string;
  imagenPath?: string;
  fecha: string;
};

function formatFecha(iso: string) {
  return new Date(iso).toLocaleDateString('es', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

// Mismo criterio de formato que /admin/tenants — sin +504 ni guion, tal
// cual lo reconocería el admin de un vistazo.
// Nunca debería faltar, pero un registro corrupto en "conversaciones" no
// puede tumbar toda la lista — mejor una fila rara que una página en blanco.
function formatTelefono(digits: string | undefined) {
  if (!digits) return '(sin número)';
  if (digits.startsWith('504') && digits.length === 11) return digits.slice(3);
  return digits;
}

// Mismo criterio que normalizarTelefono/conCodigoPais en lib/tenantService
// (no se importa ese archivo acá porque usa firebase-admin, que rompe el
// bundle del navegador en un Client Component) — así "9999-8888" y
// "+504 9999 8888" abren el mismo chat que ya tenga ese tenant en vez de
// uno nuevo con otro formato.
function telefonoNormalizado(raw: string): string {
  const limpio = raw.trim();
  const conCodigo = limpio.startsWith('+') || limpio.replace(/\D/g, '').length > 8
    ? limpio
    : '504' + limpio;
  return conCodigo.replace(/\D/g, '');
}

function PreviaConversacion({ c }: { c: Conversacion }) {
  if (c.ultimoTexto) return <>{c.ultimoAutor === 'admin' ? 'Vos: ' : ''}{c.ultimoTexto}</>;
  if (c.ultimaImagen) return <>{c.ultimoAutor === 'admin' ? 'Vos: ' : ''}📷 Foto</>;
  return <>—</>;
}

function Hilo({ telefono, onLeido, onVolver }: { telefono: string; onLeido: (telefono: string) => void; onVolver: () => void }) {
  const [mensajes, setMensajes] = useState<Mensaje[]>([]);
  const [cargando, setCargando] = useState(true);
  const [texto, setTexto] = useState('');
  const [archivo, setArchivo] = useState<File | null>(null);
  const [enviando, setEnviando] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const listaRef = useRef<HTMLDivElement>(null);

  const cargar = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/chat/${telefono}`);
      if (res.ok) setMensajes(await res.json());
      onLeido(telefono);
    } finally {
      setCargando(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [telefono]);

  // Al cambiar de conversación, vuelve a cargar y arranca su propio
  // polling — mismo intervalo que usa el dashboard del tenant, para que
  // una respuesta nueva aparezca sin tener que cerrar y reabrir el hilo.
  useEffect(() => {
    setCargando(true);
    cargar();
    const intervalo = setInterval(cargar, 15000);
    return () => clearInterval(intervalo);
  }, [cargar]);

  useEffect(() => {
    listaRef.current?.scrollTo({ top: listaRef.current.scrollHeight });
  }, [mensajes]);

  async function enviar() {
    const textoLimpio = texto.trim();
    if (!textoLimpio && !archivo) return;
    setEnviando(true);
    try {
      const formData = new FormData();
      if (textoLimpio) formData.append('texto', textoLimpio);
      if (archivo) formData.append('imagen', archivo);

      const res = await fetch(`/api/admin/chat/${telefono}`, { method: 'POST', body: formData });
      if (res.ok) {
        const nuevo = await res.json();
        setMensajes(prev => [...prev, nuevo]);
        setTexto('');
        setArchivo(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    } finally {
      setEnviando(false);
    }
  }

  return (
    <section className="panel msj-hilo" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.85rem', flex: 1, minWidth: 0 }}>
      <h2 style={{ margin: 0 }}>💬 {formatTelefono(telefono)}</h2>

      <div
        ref={listaRef}
        style={{
          display: 'flex', flexDirection: 'column', gap: '0.5rem', flex: 1, minHeight: 320, maxHeight: 480, overflowY: 'auto',
          background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '0.75rem',
        }}
      >
        {cargando ? (
          <p className="loading-msg">Cargando…</p>
        ) : mensajes.length === 0 ? (
          <p className="empty-msg">Todavía no hay mensajes con este tenant.</p>
        ) : (
          mensajes.map(m => (
            <div key={m.id} style={{ display: 'flex', justifyContent: m.autor === 'admin' ? 'flex-end' : 'flex-start' }}>
              <div style={{
                maxWidth: '72%', borderRadius: 10, padding: '0.5rem 0.75rem',
                background: m.autor === 'admin' ? 'var(--accent)' : 'var(--surface)',
                color: m.autor === 'admin' ? '#fff' : 'var(--text)',
                border: m.autor === 'admin' ? 'none' : '1px solid var(--border)',
              }}>
                {m.imagenPath && (
                  <a href={`/api/admin/chat/imagen/${m.id}`} target="_blank" rel="noopener noreferrer">
                    <img
                      src={`/api/admin/chat/imagen/${m.id}`}
                      alt="Foto enviada"
                      style={{ maxWidth: '100%', maxHeight: 220, borderRadius: 6, display: 'block', marginBottom: m.texto ? '0.4rem' : 0 }}
                    />
                  </a>
                )}
                {m.texto && <div style={{ fontSize: '0.88rem', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{conLinksClickeables(m.texto)}</div>}
                <div style={{ fontSize: '0.68rem', opacity: 0.75, marginTop: '0.2rem', textAlign: 'right' }}>{formatFecha(m.fecha)}</div>
              </div>
            </div>
          ))
        )}
      </div>

      {archivo && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span className="badge">📷 {archivo.name}</span>
          <button type="button" className="btn-secondary" style={{ fontSize: '0.75rem', padding: '0.25rem 0.6rem' }} onClick={() => { setArchivo(null); if (fileInputRef.current) fileInputRef.current.value = ''; }}>
            ✕ Quitar
          </button>
        </div>
      )}

      <input
        type="text"
        value={texto}
        onChange={e => setTexto(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter' && !enviando) enviar(); }}
        placeholder="Escribí una respuesta…"
        className="input"
        style={{ width: '100%', boxSizing: 'border-box' }}
        disabled={enviando}
      />
      <input ref={fileInputRef} type="file" accept="image/*" onChange={e => setArchivo(e.target.files?.[0] ?? null)} style={{ display: 'none' }} />
      <div style={{ display: 'flex', gap: '0.5rem' }}>
        <button type="button" className="btn-secondary msj-volver" style={{ flex: 1, minWidth: 0 }} onClick={onVolver}>
          ← Volver
        </button>
        <button type="button" className="btn-secondary" style={{ flex: 1, minWidth: 0 }} disabled={enviando} onClick={() => fileInputRef.current?.click()}>
          Foto
        </button>
        <button type="button" className="btn-primary" style={{ flex: 1, minWidth: 0 }} disabled={enviando || (!texto.trim() && !archivo)} onClick={enviar}>
          {enviando ? '...' : 'Enviar'}
        </button>
      </div>
    </section>
  );
}

export default function MensajesPage() {
  // Llega desde el botón "💬 Mensaje" de /admin/tenants (?telefono=X) —
  // abre esa conversación directo, sin tener que buscarla en la lista.
  const searchParams = useSearchParams();
  const [conversaciones, setConversaciones] = useState<Conversacion[]>([]);
  const [cargando, setCargando] = useState(true);
  const [seleccionado, setSeleccionado] = useState<string | null>(() => searchParams.get('telefono'));
  const [telefonoNuevo, setTelefonoNuevo] = useState('');

  // Abre el hilo aunque todavía no exista ninguna conversación con ese
  // número — no hace falta "crear" nada acá, el primer mensaje que se
  // mande crea el documento en conversaciones solo (ver enviarMensaje en
  // lib/chatService.ts). Sirve tanto para arrancarle una conversación a un
  // tenant que nunca escribió, como para abrir uno que sí tiene historial
  // sin tener que buscarlo en la lista.
  function abrirChat() {
    const telefono = telefonoNormalizado(telefonoNuevo);
    if (telefono.length < 8) return;
    setSeleccionado(telefono);
    setTelefonoNuevo('');
  }

  const cargar = useCallback(() => {
    return fetch('/api/admin/chat')
      .then(res => res.json())
      .then(data => setConversaciones(Array.isArray(data) ? data : []));
  }, []);

  useEffect(() => {
    cargar().finally(() => setCargando(false));
    const intervalo = setInterval(cargar, 15000);
    return () => clearInterval(intervalo);
  }, [cargar]);

  // El hilo abierto ya marcó "leído" del lado del servidor al cargar —
  // esto solo refleja eso en la lista de inmediato, sin esperar al
  // próximo poll de 15s.
  const marcarLeidoLocal = useCallback((telefono: string) => {
    setConversaciones(prev => prev.map(c => c.telefono === telefono ? { ...c, noLeidosAdmin: 0 } : c));
  }, []);

  const totalNoLeidos = conversaciones.reduce((acc, c) => acc + (c.noLeidosAdmin || 0), 0);

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', color: 'var(--text)', fontFamily: 'Inter, sans-serif' }}>
      <header className="header">
        <div className="header-inner">
          <div className="logo"><span className="logo-icon">🎵</span><span className="logo-text">Canciones</span></div>
          <a href="/admin" className="nav-btn">← Volver</a>
        </div>
      </header>

      {/* Media query acá (no en globals.css) porque solo esta página tiene
          el layout de dos columnas lado a lado — en celular se apilaba
          todo en una franja angosta en vez de mostrar una cosa a la vez. */}
      <style>{`
        .msj-volver { display: none; }
        @media (max-width: 760px) {
          .msj-main { flex-direction: column !important; padding: 1rem !important; }
          .msj-lista { width: 100% !important; }
          .msj-lista[data-oculto="true"], .msj-hilo[data-oculto="true"] { display: none !important; }
          .msj-volver { display: inline-flex !important; }
        }
      `}</style>

      <main className="main msj-main" style={{ display: 'flex', gap: '1.25rem', maxWidth: 1100, margin: '0 auto', padding: '1.5rem', alignItems: 'flex-start' }}>
        <section className="panel msj-lista" data-oculto={!!seleccionado} style={{ padding: '1.25rem', width: 320, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <h2 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            Conversaciones
            {!cargando && totalNoLeidos > 0 && <span className="badge">{totalNoLeidos}</span>}
          </h2>

          <NotificacionesPush />

          <div style={{ display: 'flex', gap: '0.4rem' }}>
            <input
              type="tel"
              placeholder="Número de teléfono…"
              value={telefonoNuevo}
              onChange={e => setTelefonoNuevo(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') abrirChat(); }}
              className="input"
              style={{ flex: 1, minWidth: 0 }}
            />
            <button className="btn-secondary" disabled={!telefonoNuevo.trim()} onClick={abrirChat}>
              Abrir
            </button>
          </div>

          {cargando ? (
            <p className="loading-msg">Cargando…</p>
          ) : conversaciones.length === 0 ? (
            <p className="empty-msg">Todavía no hay mensajes de ningún tenant.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              {conversaciones.map(c => (
                <button
                  key={c.telefono}
                  onClick={() => setSeleccionado(c.telefono)}
                  style={{
                    textAlign: 'left', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '0.6rem 0.75rem',
                    background: seleccionado === c.telefono ? 'var(--surface2)' : 'transparent', cursor: 'pointer', color: 'var(--text)',
                    display: 'flex', flexDirection: 'column', gap: '0.2rem',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{ fontWeight: 600 }}>{formatTelefono(c.telefono)}</span>
                    {c.noLeidosAdmin > 0 && <span className="badge">{c.noLeidosAdmin}</span>}
                  </div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    <PreviaConversacion c={c} />
                  </div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{formatFecha(c.fecha)}</div>
                </button>
              ))}
            </div>
          )}
        </section>

        {seleccionado ? (
          <Hilo key={seleccionado} telefono={seleccionado} onLeido={marcarLeidoLocal} onVolver={() => setSeleccionado(null)} />
        ) : (
          <section className="panel msj-hilo" data-oculto={!seleccionado} style={{ padding: '1.25rem', flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', minHeight: 320 }}>
            Elegí una conversación para ver los mensajes.
          </section>
        )}
      </main>
    </div>
  );
}
