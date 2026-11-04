'use client';

import { useState } from 'react';

// Formulario para que un miembro de /apoya abra lo que es para miembros (todas las radionovelas, las de ahora y las
// que vengan) escribiendo el correo con que paga en Hotmart. Se usa en el candado de cada capítulo y en /radionovelas.
export default function AccesoMiembro({ etiqueta, clases }: { etiqueta: string; clases: { form: string; error: string } }) {
  const [email, setEmail] = useState('');
  const [estado, setEstado] = useState<'' | 'enviando' | 'no'>('');
  const [mensaje, setMensaje] = useState('');
  const abrir = async (e: React.FormEvent) => {
    e.preventDefault();
    setEstado('enviando');
    const r = await fetch('/api/apoya/desbloquear', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email }) })
      .then((x) => x.json())
      .catch(() => ({ ok: false, error: 'No se pudo comprobar. Intenta de nuevo.' }));
    if (r.ok) return window.location.reload();
    setEstado('no');
    setMensaje(r.error || 'No encontramos una membresía activa con ese correo. Usa el mismo con el que pagaste en Hotmart.');
  };
  return (
    <form onSubmit={abrir} className={clases.form}>
      <label htmlFor="correo-miembro">{etiqueta}</label>
      <div>
        <input id="correo-miembro" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="tu@correo.com" />
        <button type="submit" disabled={estado === 'enviando'}>
          {estado === 'enviando' ? 'Revisando…' : 'Abrir'}
        </button>
      </div>
      {estado === 'no' ? <p className={clases.error}>{mensaje}</p> : null}
    </form>
  );
}
