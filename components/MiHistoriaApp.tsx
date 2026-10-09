'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import BotonResponderHablando from './BotonResponderHablando';
import { ETAPAS, claveResp } from '@/lib/etapasHistoria';
import { PROMPT_MAESTRO, PROMPT_BORROSCOSO, PROMPT_MIMESIS } from '@/lib/prompts';
// MemoriaApp.tsx importa ETAPAS y claveResp desde acá en vez de directo de
// lib/etapasHistoria — se re-exportan para no tener que tocar ese archivo.
export { ETAPAS, claveResp };

// Google Fonts por <link> normal, no next/font/google — ese loader exige
// que cada llamada tenga un único call site fijo en el árbol de módulos, y
// se rompe (Turbopack: "next/font/google queries have exactly one entry")
// cuando el mismo componente lo importan dos páginas distintas, que es
// justo el caso acá (app/admin/mi-historia y app/historia/[clave]).
const GOOGLE_FONTS_URL = 'https://fonts.googleapis.com/css2?family=Fraunces:wght@400;500;600;700&family=Karla:wght@400;500;600;700;800&display=swap';

// =============================================================================
// MI HISTORIA — Constructor de Biografías
// Migrado desde un Artifact standalone: mismo diseño y lógica, pero persiste
// en Firestore/Storage (vía /api/historia/[clave]/*) en vez de localStorage,
// así sincroniza entre cualquier dispositivo. Un mismo componente sirve
// tanto al admin (app/admin/mi-historia, clave fija 'principal') como a
// cualquier tenant al que se le dé un link (app/historia/[clave], clave =
// token random de ese link) — ver lib/historiaLinksService.ts.
// =============================================================================

type EstadoPregunta = 'sin_responder' | 'respondida' | 'necesita_profundizacion' | 'completada' | 'no_responder' | 'no_recuerdo';
type Respuesta = { texto: string; estado: EstadoPregunta; volverDespues: boolean; profundizaciones: { pregunta: string; respuesta: string }[]; tieneAudio?: boolean };
type Persona = {
  id: string; nombre: string; apodo: string; relacion: string; nacimiento: string; fallecimiento: string;
  comoConoci: string; significado: string; aprendi: string; recuerdos: string; diria: string;
};
type Foto = {
  id: string; descripcion: string; año: string; lugar: string; personas: string;
  queOcurria: string; porQueImportante: string; etapaRelacionada: string;
};
type Evento = {
  id: string; fecha: string; edad: string; acontecimiento: string; lugar: string; personas: string;
  descripcion: string; importancia: string;
};
type Contradiccion = { id: string; nota: string };
type Pantalla = 'home' | 'interview' | 'stageEnd' | 'people' | 'photos' | 'timeline' | 'review' | 'final' | 'prompt' | 'promptBorroscoso' | 'promptMimesis';

type HistoriaData = {
  meta: { creado: string; actualizado: string };
  respuestas: Record<string, Respuesta>;
  notasLibres: { id: string; etapaIdx: number; texto: string; fecha: string }[];
  personas: Persona[];
  fotografias: Foto[];
  lineaDeTiempo: Evento[];
  contradicciones: Contradiccion[];
  progreso?: { etapaActual: number; preguntaActual: number };
};

function historiaVacia(): HistoriaData {
  const ahora = new Date().toISOString();
  return { meta: { creado: ahora, actualizado: ahora }, respuestas: {}, notasLibres: [], personas: [], fotografias: [], lineaDeTiempo: [], contradicciones: [] };
}

function totalPreguntas() { return ETAPAS.reduce((acc, e) => acc + e.preguntas.length, 0); }

// clave identifica DE QUIÉN es esta historia en Firestore/Storage — 'principal'
// para el admin (ver app/admin/mi-historia/page.tsx), o el token del link
// cuando la abre un tenant (ver app/historia/[clave]/page.tsx). El resto del
// componente es idéntico para ambos casos — la única diferencia es esPrincipal,
// que oculta las pestañas de prompts (herramientas internas) para los tenants.
export default function MiHistoriaApp({ clave }: { clave: string }) {
  // Los prompts (Maestro, Borroscoso, Mímesis) son herramientas internas —
  // solo deben verse en la clave "principal" (la del dueño), nunca en los
  // links que se le generan a un tenant puntual (clave = token random).
  const esPrincipal = clave === 'principal';
  const [historiaState, setHistoria] = useState<HistoriaData | null>(null);
  const [nombre, setNombre] = useState('');
  const [cargando, setCargando] = useState(true);
  const [pantalla, setPantalla] = useState<Pantalla>('home');
  const [etapaActual, setEtapaActual] = useState(0);
  const [preguntaActual, setPreguntaActual] = useState(0);
  const [toast, setToast] = useState('');
  const [pidiendoProfundizacion, setPidiendoProfundizacion] = useState(false);
  const guardarTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const toastTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    fetch('/api/historia/' + clave).then(r => r.json()).then(data => {
      const { nombre: nombreRecibido, ...resto } = data;
      const h: HistoriaData = Object.assign(historiaVacia(), resto);
      setHistoria(h);
      setNombre(nombreRecibido || '');
      if (h.progreso) { setEtapaActual(h.progreso.etapaActual); setPreguntaActual(h.progreso.preguntaActual); }
      setCargando(false);
    }).catch(() => { setHistoria(historiaVacia()); setCargando(false); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function mostrarToast(msg: string) {
    setToast(msg);
    if (toastTimeout.current) clearTimeout(toastTimeout.current);
    toastTimeout.current = setTimeout(() => setToast(''), 2200);
  }

  const guardar = useCallback((data: HistoriaData, inmediato?: boolean) => {
    const hacer = () => {
      fetch('/api/historia/' + clave, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data),
      }).catch(() => mostrarToast('No se pudo guardar — revisá tu conexión.'));
    };
    if (guardarTimeout.current) clearTimeout(guardarTimeout.current);
    if (inmediato) { hacer(); return; }
    guardarTimeout.current = setTimeout(hacer, 500);
  }, [clave]);

  function actualizar(mutar: (h: HistoriaData) => void, inmediato?: boolean) {
    setHistoria(prev => {
      if (!prev) return prev;
      const next: HistoriaData = JSON.parse(JSON.stringify(prev));
      mutar(next);
      next.progreso = { etapaActual, preguntaActual };
      guardar(next, inmediato);
      return next;
    });
  }

  function getResp(h: HistoriaData, e: number, p: number): Respuesta {
    const k = claveResp(e, p);
    return h.respuestas[k] || { texto: '', estado: 'sin_responder', volverDespues: false, profundizaciones: [] };
  }

  if (cargando || !historiaState) {
    return <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#faf4e9', color: '#6b5d4a', fontFamily: 'sans-serif' }}>Cargando tu historia...</div>;
  }
  // Narrowing explícito — TS no propaga el chequeo de arriba dentro de los
  // closures definidos más abajo si siguen leyendo `historiaState`.
  const historia: HistoriaData = historiaState;

  function contarRespondidas(h: HistoriaData) {
    let n = 0;
    for (const k in h.respuestas) if (h.respuestas[k].estado !== 'sin_responder') n++;
    return n;
  }
  function etapaCompleta(h: HistoriaData, idx: number) {
    for (let p = 0; p < ETAPAS[idx].preguntas.length; p++) if (getResp(h, idx, p).estado === 'sin_responder') return false;
    return true;
  }

  function irA(p: Pantalla, extra?: { etapaActual?: number; preguntaActual?: number }) {
    if (extra?.etapaActual !== undefined) setEtapaActual(extra.etapaActual);
    if (extra?.preguntaActual !== undefined) setPreguntaActual(extra.preguntaActual);
    setPantalla(p);
    window.scrollTo({ top: 0 });
  }

  function empezar() { setEtapaActual(0); setPreguntaActual(0); irA('interview'); }

  // -------- Entrevista --------
  function ActualizarRespuestaTexto(texto: string) {
    actualizar(h => {
      const k = claveResp(etapaActual, preguntaActual);
      const r = h.respuestas[k] || { texto: '', estado: 'sin_responder', volverDespues: false, profundizaciones: [] };
      r.texto = texto;
      if (r.estado !== 'no_responder' && r.estado !== 'no_recuerdo') {
        r.estado = texto.trim() ? (r.estado === 'necesita_profundizacion' ? 'necesita_profundizacion' : 'respondida') : 'sin_responder';
      }
      h.respuestas[k] = r;
    });
  }
  // Sube la grabación cruda de la respuesta actual (además de la
  // transcripción, que ya se agregó al texto por separado) para que la
  // página de Memoria pueda reproducir la voz real — no bloquea ni
  // reintenta si falla, es un plus, no algo de lo que dependa guardar la
  // respuesta en sí.
  async function subirAudioDeRespuestaActual(blob: Blob) {
    const k = claveResp(etapaActual, preguntaActual);
    try {
      const fd = new FormData();
      fd.append('audio', blob, 'grabacion.webm');
      const res = await fetch('/api/historia/' + clave + '/audio/' + k, { method: 'POST', body: fd });
      if (!res.ok) return;
      actualizar(h => {
        const r = h.respuestas[k];
        if (r) r.tieneAudio = true;
      }, true);
    } catch { /* la transcripción ya se guardó; perder el audio no es crítico */ }
  }
  function marcarEstadoEspecial(tipo: EstadoPregunta) {
    actualizar(h => {
      const k = claveResp(etapaActual, preguntaActual);
      const r = h.respuestas[k] || { texto: '', estado: 'sin_responder', volverDespues: false, profundizaciones: [] };
      r.estado = r.estado === tipo ? (r.texto.trim() ? 'respondida' : 'sin_responder') : tipo;
      h.respuestas[k] = r;
    }, true);
  }
  function toggleVolverDespues() {
    actualizar(h => {
      const k = claveResp(etapaActual, preguntaActual);
      const r = h.respuestas[k] || { texto: '', estado: 'sin_responder', volverDespues: false, profundizaciones: [] };
      r.volverDespues = !r.volverDespues;
      h.respuestas[k] = r;
    }, true);
  }
  function actualizarFollowup(fi: number, texto: string) {
    actualizar(h => {
      const k = claveResp(etapaActual, preguntaActual);
      const r = h.respuestas[k];
      if (r && r.profundizaciones[fi]) r.profundizaciones[fi].respuesta = texto;
    });
  }
  async function pedirProfundizacion() {
    const resp = getResp(historia, etapaActual, preguntaActual);
    const pregunta = ETAPAS[etapaActual].preguntas[preguntaActual];
    setPidiendoProfundizacion(true);
    try {
      const res = await fetch('/api/historia/profundizar', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pregunta, respuesta: resp.texto }),
      });
      const data = await res.json();
      if (!res.ok) { mostrarToast(data.error || 'No se pudieron generar preguntas'); return; }
      actualizar(h => {
        const k = claveResp(etapaActual, preguntaActual);
        const r = h.respuestas[k];
        r.profundizaciones = data.preguntas.map((p: string) => ({ pregunta: p, respuesta: '' }));
        r.estado = 'necesita_profundizacion';
      }, true);
    } catch {
      mostrarToast('No se pudo pedir más preguntas ahora.');
    } finally {
      setPidiendoProfundizacion(false);
    }
  }
  function irAnterior() {
    if (preguntaActual > 0) setPreguntaActual(preguntaActual - 1);
    else if (etapaActual > 0) { setEtapaActual(etapaActual - 1); setPreguntaActual(ETAPAS[etapaActual - 1].preguntas.length - 1); }
  }
  function irSiguiente() {
    const etapa = ETAPAS[etapaActual];
    if (preguntaActual < etapa.preguntas.length - 1) setPreguntaActual(preguntaActual + 1);
    else irA('stageEnd');
  }
  function siguienteEtapa() { setEtapaActual(etapaActual + 1); setPreguntaActual(0); irA('interview'); }

  function guardarNotaLibre(texto: string) {
    if (!texto.trim()) return;
    actualizar(h => { h.notasLibres.push({ id: 'n' + Date.now(), etapaIdx: etapaActual, texto: texto.trim(), fecha: new Date().toISOString() }); }, true);
    mostrarToast('Recuerdo guardado ✓');
  }

  // -------- Personas --------
  function agregarPersona(p: Omit<Persona, 'id'>) {
    if (!p.nombre.trim()) { mostrarToast('Ponele al menos un nombre'); return; }
    actualizar(h => { h.personas.push({ ...p, id: 'per' + Date.now() }); }, true);
    mostrarToast('Persona agregada ✓');
  }
  function borrarPersona(i: number) {
    if (!confirm('¿Quitar a esta persona de tu historia?')) return;
    actualizar(h => { h.personas.splice(i, 1); }, true);
  }

  // -------- Fotos --------
  async function agregarFoto(file: File, meta: Omit<Foto, 'id'>) {
    const img = new Image();
    const dataUrl: string = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
    await new Promise<void>(resolve => { img.onload = () => resolve(); img.src = dataUrl; });
    const maxW = 1100;
    const scale = Math.min(1, maxW / img.width);
    const canvas = document.createElement('canvas');
    canvas.width = img.width * scale; canvas.height = img.height * scale;
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    const blob: Blob = await new Promise(resolve => canvas.toBlob(b => resolve(b!), 'image/jpeg', 0.78));

    const fd = new FormData();
    fd.append('file', blob, 'foto.jpg');
    const res = await fetch('/api/historia/' + clave + '/foto', { method: 'POST', body: fd });
    const data = await res.json();
    if (!res.ok) { mostrarToast(data.error || 'No se pudo subir la foto'); return; }
    actualizar(h => { h.fotografias.push({ ...meta, id: data.id }); }, true);
    mostrarToast('Foto agregada ✓');
  }
  async function borrarFoto(i: number) {
    if (!confirm('¿Quitar esta foto?')) return;
    const id = historia.fotografias[i].id;
    await fetch('/api/historia/' + clave + '/foto/' + id, { method: 'DELETE' }).catch(() => {});
    actualizar(h => { h.fotografias.splice(i, 1); }, true);
  }
  function editarFoto(i: number, meta: Omit<Foto, 'id'>) {
    actualizar(h => { h.fotografias[i] = { ...h.fotografias[i], ...meta }; }, true);
    mostrarToast('Foto actualizada ✓');
  }

  // -------- Línea de tiempo --------
  function agregarEvento(ev: Omit<Evento, 'id'>) {
    if (!ev.acontecimiento.trim()) { mostrarToast('Describí al menos el acontecimiento'); return; }
    actualizar(h => { h.lineaDeTiempo.push({ ...ev, id: 'ev' + Date.now() }); }, true);
    mostrarToast('Acontecimiento agregado ✓');
  }
  function borrarEvento(i: number) {
    if (!confirm('¿Quitar este acontecimiento?')) return;
    actualizar(h => { h.lineaDeTiempo.splice(i, 1); }, true);
  }

  function agregarContradiccion() {
    const nota = prompt('Describí brevemente la posible contradicción:');
    if (nota && nota.trim()) actualizar(h => { h.contradicciones.push({ id: 'c' + Date.now(), nota: nota.trim() }); }, true);
  }
  function borrarContradiccion(i: number) {
    actualizar(h => { h.contradicciones.splice(i, 1); }, true);
  }

  // -------- Exportación (descarga real de archivo — página normal, sin sandbox) --------
  function datosPersona(p: Persona) {
    return 'Nombre: ' + p.nombre + (p.apodo ? ' ("' + p.apodo + '")' : '') + '\n' + 'Relación: ' + (p.relacion || '-') + '\n' +
      (p.nacimiento ? 'Nacimiento: ' + p.nacimiento + '\n' : '') + (p.fallecimiento ? 'Fallecimiento: ' + p.fallecimiento + '\n' : '') +
      (p.comoConoci ? 'Cómo se conocieron: ' + p.comoConoci + '\n' : '') + (p.significado ? 'Qué significó: ' + p.significado + '\n' : '') +
      (p.aprendi ? 'Qué aprendió de ella: ' + p.aprendi + '\n' : '') + (p.recuerdos ? 'Recuerdos / historias: ' + p.recuerdos + '\n' : '') +
      (p.diria ? 'Qué le diría hoy: ' + p.diria + '\n' : '');
  }
  function construirTexto(paraIA: boolean) {
    let out = '';
    if (paraIA) {
      out += PROMPT_MAESTRO + '\n\n';
      out += '================================================\n';
      out += 'A PARTIR DE ACÁ: EL MATERIAL AUTOBIOGRÁFICO REAL\n';
      out += '(fuente primaria — todo lo de arriba son solo las reglas)\n';
      out += '================================================\n\n';
    }
    out += 'BIOGRAFÍA\n=========\n\nDATOS DEL PROTAGONISTA\n-----------------------\n';
    out += 'Generado: ' + new Date(historia.meta.creado).toLocaleString('es') + '\nÚltima actualización: ' + new Date(historia.meta.actualizado).toLocaleString('es') + '\n\n';
    ETAPAS.forEach((etapa, ei) => {
      out += 'ETAPA ' + (ei + 1) + ' — ' + etapa.titulo.toUpperCase() + '\n' + '-'.repeat(20) + '\n';
      etapa.preguntas.forEach((preg, pi) => {
        const r = getResp(historia, ei, pi);
        out += 'Pregunta: ' + preg + '\n';
        if (r.estado === 'no_responder') out += 'Respuesta: [Prefirió no responder]\n';
        else if (r.estado === 'no_recuerdo') out += 'Respuesta: [No recuerda]\n';
        else out += 'Respuesta: ' + (r.texto || '[sin responder]') + '\n';
        r.profundizaciones.forEach(f => { if (f.respuesta.trim()) out += '  · ' + f.pregunta + ' → ' + f.respuesta + '\n'; });
        out += '\n';
      });
    });
    out += 'NOTAS LIBRES / RECUERDOS ESPONTÁNEOS\n-------------------------------------\n';
    out += historia.notasLibres.length ? historia.notasLibres.map(n => '(Etapa ' + (n.etapaIdx + 1) + ') ' + n.texto).join('\n\n') + '\n\n' : '(ninguna)\n\n';
    out += 'PERSONAS DE LA HISTORIA\n-----------------------\n';
    out += historia.personas.length ? historia.personas.map(datosPersona).join('\n') : '(ninguna registrada)\n\n';
    out += 'FOTOGRAFÍAS\n-----------\n';
    out += historia.fotografias.length
      ? historia.fotografias.map((f, i) => '[Foto ' + (i + 1) + '] ' + (f.descripcion || 'sin descripción') + ' — ' + (f.año || 'año no indicado') + ', ' + (f.lugar || 'lugar no indicado') +
        '\n  Personas: ' + (f.personas || '-') + '\n  Qué ocurría: ' + (f.queOcurria || '-') + '\n  Por qué es importante: ' + (f.porQueImportante || '-') + '\n').join('\n')
      : '(ninguna)\n\n';
    out += 'LÍNEA DE TIEMPO\n---------------\n';
    out += historia.lineaDeTiempo.length
      ? historia.lineaDeTiempo.slice().sort((a, b) => (a.fecha || '').localeCompare(b.fecha || '')).map(ev =>
          ev.fecha + (ev.edad ? ' (' + ev.edad + ' años)' : '') + ' — ' + ev.acontecimiento + '\n  Lugar: ' + (ev.lugar || '-') + ' | Personas: ' + (ev.personas || '-') + '\n' +
          (ev.descripcion ? '  ' + ev.descripcion + '\n' : '') + (ev.importancia ? '  Importancia: ' + ev.importancia + '\n' : '')).join('\n')
      : '(ninguno)\n\n';
    out += '\nPOSIBLES CONTRADICCIONES A REVISAR\n-----------------------------------\n';
    out += historia.contradicciones.length ? historia.contradicciones.map(c => '- ' + c.nota).join('\n') + '\n' : '(ninguna marcada)\n';
    return out;
  }
  function construirMarkdown() {
    let out = '# Biografía — material recopilado\n\n*Generado: ' + new Date(historia.meta.creado).toLocaleString('es') + '*\n\n';
    ETAPAS.forEach((etapa, ei) => {
      out += '## Etapa ' + (ei + 1) + ' — ' + etapa.titulo + '\n\n';
      etapa.preguntas.forEach((preg, pi) => {
        const r = getResp(historia, ei, pi);
        out += '**' + preg + '**\n\n';
        const txt = r.estado === 'no_responder' ? '_Prefirió no responder._' : r.estado === 'no_recuerdo' ? '_No recuerda._' : (r.texto || '_sin responder_');
        out += txt + '\n\n';
        r.profundizaciones.forEach(f => { if (f.respuesta.trim()) out += '- *' + f.pregunta + '* → ' + f.respuesta + '\n'; });
        out += '\n';
      });
    });
    out += '## Notas libres\n\n' + (historia.notasLibres.map(n => '- (Etapa ' + (n.etapaIdx + 1) + ') ' + n.texto).join('\n') || '_ninguna_') + '\n\n';
    out += '## Personas\n\n' + (historia.personas.map(p => '- **' + p.nombre + '** — ' + (p.relacion || '')).join('\n') || '_ninguna_') + '\n\n';
    out += '## Línea de tiempo\n\n' + (historia.lineaDeTiempo.map(e => '- ' + e.fecha + ' — ' + e.acontecimiento).join('\n') || '_ninguna_') + '\n';
    return out;
  }
  function descargar(filename: string, contenido: string, tipo: string) {
    const blob = new Blob([contenido], { type: tipo });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }
  function exportar(formato: 'txt' | 'md' | 'json' | 'ia') {
    const stamp = new Date().toISOString().slice(0, 10);
    if (formato === 'txt') descargar('mi-historia-' + stamp + '.txt', construirTexto(false), 'text/plain');
    else if (formato === 'ia') descargar('mi-historia-para-ia-' + stamp + '.txt', construirTexto(true), 'text/plain');
    else if (formato === 'md') descargar('mi-historia-' + stamp + '.md', construirMarkdown(), 'text/markdown');
    else descargar('mi-historia-' + stamp + '.json', JSON.stringify(historia, null, 2), 'application/json');
    mostrarToast('Archivo descargado ✓');
  }

  // ===================== RENDER =====================
  const hayProgreso = contarRespondidas(historia) > 0 || historia.personas.length > 0 || historia.fotografias.length > 0;

  return (
    <div className="mh-root">
      <link rel="stylesheet" href={GOOGLE_FONTS_URL} />
      <style>{ESTILOS}</style>
      {pantalla !== 'home' && (
        <div className="mh-topbar">
          <div className="mh-topbar-inner">
            <div className="mh-brand" onClick={() => irA('home')}>📖 <span>Mi Historia</span></div>
            <div className="mh-tabs">
              {([
                ['interview', '📖', 'Entrevista'], ['people', '👥', 'Personas'], ['photos', '📷', 'Fotos'],
                ['timeline', '🕐', 'Línea de vida'], ['review', '📋', 'Revisar'], ['final', '⬇️', 'Exportar'],
                ...(esPrincipal ? [
                  ['prompt', '📜', 'Prompt maestro'], ['promptBorroscoso', '🌬️', 'Prompt Borroscoso'], ['promptMimesis', '🎭', 'Prompt Mímesis'],
                ] as [Pantalla, string, string][] : []),
              ] as [Pantalla, string, string][]).map(([id, icon, label]) => (
                <button key={id} className={'mh-tab' + (pantalla === id ? ' active' : '')} onClick={() => irA(id)}>{icon} <span>{label}</span></button>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="mh-wrap">
        {pantalla === 'home' && (
          <HomeScreen hayProgreso={hayProgreso} nombre={nombre} onContinuar={() => irA('interview')} onEmpezar={empezar} />
        )}

        {pantalla === 'interview' && (
          <InterviewScreen
            clave={clave}
            etapaActual={etapaActual} preguntaActual={preguntaActual}
            resp={getResp(historia, etapaActual, preguntaActual)}
            pidiendoProfundizacion={pidiendoProfundizacion}
            onTexto={ActualizarRespuestaTexto}
            onAudioGrabado={subirAudioDeRespuestaActual}
            onEspecial={marcarEstadoEspecial}
            onVolverDespues={toggleVolverDespues}
            onFollowup={actualizarFollowup}
            onProfundizar={pedirProfundizacion}
            onAnterior={irAnterior}
            onGuardarYSalir={() => mostrarToast('Progreso guardado ✓')}
            onSiguiente={irSiguiente}
            getRespDe={(e, p) => getResp(historia, e, p)}
          />
        )}

        {pantalla === 'stageEnd' && (
          <StageEndScreen
            etapaActual={etapaActual}
            onVolver={() => irA('interview')}
            onGuardarNota={guardarNotaLibre}
            onSiguienteEtapa={etapaActual === ETAPAS.length - 1 ? () => irA('final') : siguienteEtapa}
            esUltima={etapaActual === ETAPAS.length - 1}
          />
        )}

        {pantalla === 'people' && <PeopleScreen personas={historia.personas} onAgregar={agregarPersona} onBorrar={borrarPersona} />}
        {pantalla === 'photos' && <PhotosScreen clave={clave} fotos={historia.fotografias} onAgregar={agregarFoto} onBorrar={borrarFoto} onEditar={editarFoto} />}
        {pantalla === 'timeline' && <TimelineScreen eventos={historia.lineaDeTiempo} onAgregar={agregarEvento} onBorrar={borrarEvento} />}
        {pantalla === 'prompt' && esPrincipal && (
          <PromptScreen
            titulo="📜 Prompt maestro" texto={PROMPT_MAESTRO}
            hint="Guardado acá para más adelante — cuando tengas la entrevista completa, pegás esto al inicio de una conversación de IA junto con el material exportado, y le pedís que escriba el libro siguiendo estas reglas."
          />
        )}
        {pantalla === 'promptBorroscoso' && esPrincipal && (
          <PromptScreen
            titulo="🌬️ Prompt Borroscoso" texto={PROMPT_BORROSCOSO}
            hint="Para escribir ficción con la voz de Emily Brontë (Cumbres Borrascosas) — no tiene que ver con tu historia real, es una herramienta de redacción aparte. Pegalo en una conversación de IA, completá la premisa y la perspectiva, y pedí la escena."
          />
        )}
        {pantalla === 'promptMimesis' && esPrincipal && (
          <PromptScreen
            titulo="🎭 Prompt Mímesis" texto={PROMPT_MIMESIS}
            hint="Punto intermedio entre el Prompt Maestro y el Prompt Borroscoso: dramatiza tu historia real como escena —clima, gesto, silencio— sin inventar hechos, hábitos ni diálogo de personas reales que no dijeron eso. Pegalo junto con el material exportado ('Exportar para IA') al inicio de una conversación de IA."
          />
        )}
        {pantalla === 'review' && (
          <ReviewScreen
            getRespDe={(e, p) => getResp(historia, e, p)} notasLibres={historia.notasLibres}
            contradicciones={historia.contradicciones}
            onIr={(e, p) => irA('interview', { etapaActual: e, preguntaActual: p })}
            onAgregarContradiccion={agregarContradiccion} onBorrarContradiccion={borrarContradiccion}
          />
        )}
        {pantalla === 'final' && (
          <FinalScreen
            clave={clave} historia={historia} etapaCompleta={i => etapaCompleta(historia, i)} contarRespondidas={() => contarRespondidas(historia)}
            onExportar={exportar} onIrEntrevista={() => irA('interview')} onIrRevisar={() => irA('review')}
          />
        )}
      </div>

      {toast && <div className="mh-toast show">{toast}</div>}
    </div>
  );
}

// ===================== SUBCOMPONENTES =====================

function AutoTextarea({ value, onChange, onAudioGrabado, placeholder, className, disabled, minHeight }: {
  value: string; onChange: (v: string) => void;
  // Solo lo usa la respuesta principal de la entrevista — guarda la
  // grabación cruda para que Memoria pueda reproducir la voz real (ver
  // InterviewScreen). El resto de los usos de AutoTextarea no lo pasan.
  onAudioGrabado?: (blob: Blob) => void;
  placeholder?: string; className?: string; disabled?: boolean; minHeight?: number;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (el) { el.style.height = 'auto'; el.style.height = el.scrollHeight + 2 + 'px'; }
  }, [value]);

  return (
    <div>
      <textarea
        ref={ref} className={'mh-answer ' + (className || '')} placeholder={placeholder} disabled={disabled}
        value={value} onChange={e => onChange(e.target.value)}
        style={{ minHeight: minHeight || 140 }}
      />
      {!disabled && (
        <BotonResponderHablando
          valorActual={value} onTexto={onChange} onAudioBlob={onAudioGrabado}
          className="mh-chip" classNameActivo="selected" spinnerClassName="mh-spinner"
        />
      )}
    </div>
  );
}

function HomeScreen({ hayProgreso, nombre, onContinuar, onEmpezar }: { hayProgreso: boolean; nombre: string; onContinuar: () => void; onEmpezar: () => void }) {
  return (
    <>
      <div className="mh-hero">
        <div className="mh-eyebrow" style={{ textAlign: 'center' }}>Mi Historia</div>
        {nombre && (
          <p style={{ textAlign: 'center', fontWeight: 600, fontSize: '1.05rem', margin: '0 0 0.75rem' }}>
            Hola, {nombre} 👋 — esta es tu página, solo tuya.
          </p>
        )}
        <h1>Cuenta tu vida.<br />Nosotros la convertimos en historia.</h1>
        <p>Este proyecto te va a llevar, poco a poco, por los momentos, personas, decisiones, alegrías, dificultades y recuerdos que han formado tu vida. No hace falta escribir perfecto — contalo como lo recordés. Podés parar cuando quieras y seguir otro día.</p>
        <div className="mh-row" style={{ justifyContent: 'center' }}>
          {hayProgreso
            ? <button className="mh-btn mh-btn-primary" onClick={onContinuar}>▶ Continuar mi historia</button>
            : <button className="mh-btn mh-btn-primary" onClick={onEmpezar}>✨ Comenzar mi historia</button>}
        </div>
      </div>
      {[
        ['🗂️', '20 etapas', 'De tu nacimiento hasta el legado que querés dejar.'],
        ['💾', 'Se guarda solo, en cualquier dispositivo', 'Entrá desde el celular, la compu de tu casa o del trabajo — vas a ver el mismo progreso.'],
        ['🔒', 'Tus respuestas son tuyas', 'Nada se comparte hasta que vos decidas exportarlo.'],
      ].map(([icon, title, desc]) => (
        <div className="mh-card" key={title}>
          <div className="mh-row mh-between">
            <div><strong>{title}</strong><div className="mh-hint" style={{ marginTop: '0.1rem' }}>{desc}</div></div>
            <div style={{ fontSize: '1.6rem' }}>{icon}</div>
          </div>
        </div>
      ))}
    </>
  );
}

function InterviewScreen({ clave, etapaActual, preguntaActual, resp, pidiendoProfundizacion, onTexto, onAudioGrabado, onEspecial, onVolverDespues, onFollowup, onProfundizar, onAnterior, onGuardarYSalir, onSiguiente, getRespDe }: {
  clave: string; etapaActual: number; preguntaActual: number; resp: Respuesta; pidiendoProfundizacion: boolean;
  onTexto: (t: string) => void; onAudioGrabado: (blob: Blob) => void; onEspecial: (t: EstadoPregunta) => void; onVolverDespues: () => void;
  onFollowup: (i: number, t: string) => void; onProfundizar: () => void; onAnterior: () => void;
  onGuardarYSalir: () => void; onSiguiente: () => void; getRespDe: (e: number, p: number) => Respuesta;
}) {
  const etapa = ETAPAS[etapaActual];
  const pregunta = etapa.preguntas[preguntaActual];
  const pctGlobal = Math.round(((etapaActual + (preguntaActual + 1) / etapa.preguntas.length) / ETAPAS.length) * 100);
  const esUltima = preguntaActual === etapa.preguntas.length - 1;
  const disabledEdit = resp.estado === 'no_responder' || resp.estado === 'no_recuerdo';

  return (
    <>
      <div className="mh-progress-shell">
        <div className="mh-progress-label"><span>Etapa {etapaActual + 1} de {ETAPAS.length} — {etapa.titulo}</span><span>{pctGlobal}% completado</span></div>
        <div className="mh-progress-track"><div className="mh-progress-fill" style={{ width: pctGlobal + '%' }} /></div>
        <div className="mh-subprogress">
          {etapa.preguntas.map((_, i) => {
            const st = getRespDe(etapaActual, i).estado;
            const cls = i === preguntaActual ? 'current' : st !== 'sin_responder' ? 'done' : '';
            return <div key={i} className={'mh-subprogress-dot ' + cls} />;
          })}
        </div>
      </div>

      <VistaPreviaHistoria clave={clave} />

      <div className="mh-card">
        <div className="mh-row mh-between" style={{ marginBottom: '0.5rem' }}>
          <div className="mh-eyebrow">Pregunta {preguntaActual + 1} de {etapa.preguntas.length}</div>
          {resp.estado === 'no_responder' && <span className="mh-badge mh-badge-skip">Prefiere no responder</span>}
          {resp.estado === 'no_recuerdo' && <span className="mh-badge mh-badge-skip">No recuerda</span>}
          {resp.estado !== 'sin_responder' && resp.estado !== 'no_responder' && resp.estado !== 'no_recuerdo' && <span className="mh-badge mh-badge-done">✓ Respondida</span>}
        </div>
        {etapa.intro && preguntaActual === 0 && <p className="mh-hint" style={{ marginBottom: '1rem' }}>{etapa.intro}</p>}
        <div className="mh-question-text">{pregunta}</div>

        <AutoTextarea value={resp.texto} onChange={onTexto} onAudioGrabado={onAudioGrabado} disabled={disabledEdit} minHeight={etapa.grandes ? 200 : 140}
          placeholder="Escribí lo que recuerdes — una frase, un párrafo, o varias páginas si hace falta." />
        {resp.tieneAudio && <div className="mh-hint">🎙️ Esta respuesta tiene tu voz real guardada — se va a poder escuchar en Memoria.</div>}
        <div className="mh-hint">No necesitás escribir perfecto. Contalo como lo recordés — nosotros nos encargamos de convertirlo después en una historia.</div>

        <div className="mh-row" style={{ marginTop: '0.75rem' }}>
          <button className={'mh-chip' + (resp.estado === 'no_responder' ? ' selected' : '')} onClick={() => onEspecial('no_responder')}>Prefiero no responder</button>
          <button className={'mh-chip' + (resp.estado === 'no_recuerdo' ? ' selected' : '')} onClick={() => onEspecial('no_recuerdo')}>No recuerdo</button>
          <button className={'mh-chip' + (resp.volverDespues ? ' selected' : '')} onClick={onVolverDespues}>🔖 Volver a esto después</button>
        </div>

        {resp.texto.trim() && !disabledEdit && (
          <div className="mh-row" style={{ marginTop: '1rem' }}>
            <button className="mh-btn mh-btn-gold mh-btn-sm" disabled={pidiendoProfundizacion} onClick={onProfundizar}>
              {pidiendoProfundizacion ? <><span className="mh-spinner" /> Pensando preguntas...</> : '💬 Quiero contar más sobre esto'}
            </button>
          </div>
        )}

        {resp.profundizaciones.length > 0 && (
          <div className="mh-followup-block">
            {resp.profundizaciones.map((f, fi) => (
              <div key={fi}>
                <div className="mh-followup-q">{f.pregunta}</div>
                <AutoTextarea value={f.respuesta} onChange={t => onFollowup(fi, t)} minHeight={70} placeholder="Escribí lo que recuerdes..." />
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="mh-row mh-between" style={{ marginTop: '1.25rem' }}>
        <button className="mh-btn mh-btn-secondary" disabled={etapaActual === 0 && preguntaActual === 0} onClick={onAnterior}>← Anterior</button>
        <button className="mh-btn mh-btn-ghost" onClick={onGuardarYSalir}>💾 Guardar y continuar después</button>
        <button className="mh-btn mh-btn-primary" onClick={onSiguiente}>{esUltima ? 'Terminar etapa →' : 'Siguiente →'}</button>
      </div>
    </>
  );
}

// Parsea la respuesta de /vista-previa: primera línea = título corto,
// resto = la escena. Si Claude no sigue ese formato (no debería pasar, pero
// por las dudas) se muestra todo como cuerpo, sin título.
function VistaPreviaHistoria({ clave }: { clave: string }) {
  const [estado, setEstado] = useState<'inicial' | 'cargando' | 'lista' | 'insuficiente' | 'error'>('inicial');
  const [titulo, setTitulo] = useState('');
  const [texto, setTexto] = useState('');
  const [mensaje, setMensaje] = useState('');

  async function generar() {
    setEstado('cargando'); setMensaje('');
    try {
      const res = await fetch('/api/historia/' + clave + '/vista-previa', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) { setMensaje(data.error || 'No se pudo generar el adelanto'); setEstado('error'); return; }
      if (data.insuficiente) { setMensaje(data.mensaje); setEstado('insuficiente'); return; }
      const lineas = (data.texto as string).trim().split('\n');
      const primera = lineas[0]?.replace(/^#+\s*/, '').replace(/^\*\*(.*)\*\*$/, '$1').trim() || '';
      setTitulo(primera);
      setTexto(lineas.slice(1).join('\n').trim());
      setEstado('lista');
    } catch {
      setMensaje('Error de conexión al generar el adelanto');
      setEstado('error');
    }
  }

  return (
    <div className="mh-card">
      <div className="mh-eyebrow">✨ Adelanto</div>
      <h3 style={{ marginTop: 0 }}>Ver un adelanto de tu historia</h3>
      {estado !== 'lista' && (
        <>
          <p className="mh-hint" style={{ marginTop: 0 }}>Con lo que ya contaste, podemos mostrarte una pequeña muestra de cómo se va a leer tu historia.</p>
          <button className="mh-btn mh-btn-primary mh-btn-sm" onClick={generar} disabled={estado === 'cargando'}>
            {estado === 'cargando' ? '⏳ Escribiendo tu adelanto...' : '✨ Ver un adelanto de tu historia'}
          </button>
          {estado === 'insuficiente' && <p className="mh-hint" style={{ marginTop: '0.6rem' }}>✍️ {mensaje}</p>}
          {estado === 'error' && <p style={{ color: '#a13a2f', fontSize: '0.85rem', marginTop: '0.6rem' }}>{mensaje}</p>}
        </>
      )}
      {estado === 'lista' && (
        <>
          {titulo && <div style={{ fontWeight: 700, marginBottom: '0.5rem' }}>{titulo}</div>}
          <p className="mh-body-text">{texto}</p>
          <button className="mh-btn mh-btn-secondary mh-btn-sm" style={{ marginTop: '0.5rem' }} onClick={generar}>🔄 Generar otro adelanto</button>
        </>
      )}
    </div>
  );
}

function StageEndScreen({ etapaActual, onVolver, onGuardarNota, onSiguienteEtapa, esUltima }: {
  etapaActual: number; onVolver: () => void; onGuardarNota: (t: string) => void; onSiguienteEtapa: () => void; esUltima: boolean;
}) {
  const [nota, setNota] = useState('');
  return (
    <>
      <div className="mh-card" style={{ textAlign: 'center' }}>
        <div style={{ fontSize: '2.2rem' }}>✅</div>
        <h2 style={{ margin: '0.5rem 0' }}>¡Etapa completada!</h2>
        <p className="mh-hint">Terminaste &quot;{ETAPAS[etapaActual].titulo}&quot; — etapa {etapaActual + 1} de {ETAPAS.length}.</p>
      </div>
      <div className="mh-card">
        <div className="mh-eyebrow">¿Recordaste algo más?</div>
        <p className="mh-hint" style={{ marginTop: 0 }}>A veces una pregunta despierta un recuerdo completamente diferente. Escribilo acá aunque no sepas en qué parte de tu historia encaja.</p>
        <AutoTextarea value={nota} onChange={setNota} placeholder="Un recuerdo suelto, algo que se te vino a la mente..." />
        <div className="mh-row mh-end" style={{ marginTop: '0.75rem' }}>
          <button className="mh-btn mh-btn-secondary mh-btn-sm" onClick={() => { onGuardarNota(nota); setNota(''); }}>Guardar este recuerdo</button>
        </div>
      </div>
      <div className="mh-row mh-between" style={{ marginTop: '1.25rem' }}>
        <button className="mh-btn mh-btn-secondary" onClick={onVolver}>← Volver a revisar esta etapa</button>
        <button className="mh-btn mh-btn-primary" onClick={onSiguienteEtapa}>{esUltima ? '🎉 Ver mi historia completa' : 'Continuar con la siguiente etapa →'}</button>
      </div>
    </>
  );
}

function PeopleScreen({ personas, onAgregar, onBorrar }: { personas: Persona[]; onAgregar: (p: Omit<Persona, 'id'>) => void; onBorrar: (i: number) => void }) {
  const [f, setF] = useState({ nombre: '', apodo: '', relacion: '', nacimiento: '', fallecimiento: '', comoConoci: '', significado: '', aprendi: '', recuerdos: '', diria: '' });
  function campo(k: keyof typeof f) { return f[k]; }
  function set(k: keyof typeof f) { return (v: string) => setF(prev => ({ ...prev, [k]: v })); }
  return (
    <>
      <div className="mh-eyebrow">Módulo</div>
      <h2 style={{ marginTop: 0 }}>Personas de mi historia</h2>
      <p className="mh-hint" style={{ marginTop: 0 }}>Agregá tantas personas como sea necesario — familia, amigos, mentores, amores.</p>
      <div className="mh-card">
        <h3 style={{ marginTop: 0 }}>Agregar persona</h3>
        <div className="mh-field"><label className="mh-field-label">Nombre</label><input className="mh-text-input" value={campo('nombre')} onChange={e => set('nombre')(e.target.value)} /></div>
        <div className="mh-field"><label className="mh-field-label">Apodo</label><input className="mh-text-input" value={campo('apodo')} onChange={e => set('apodo')(e.target.value)} /></div>
        <div className="mh-field"><label className="mh-field-label">Relación contigo</label><input className="mh-text-input" placeholder="Madre, mejor amigo, mentor..." value={campo('relacion')} onChange={e => set('relacion')(e.target.value)} /></div>
        <div className="mh-row" style={{ gap: '0.75rem' }}>
          <div className="mh-field" style={{ flex: 1 }}><label className="mh-field-label">Fecha de nacimiento (si la sabés)</label><input className="mh-text-input" value={campo('nacimiento')} onChange={e => set('nacimiento')(e.target.value)} /></div>
          <div className="mh-field" style={{ flex: 1 }}><label className="mh-field-label">Fecha de fallecimiento (si corresponde)</label><input className="mh-text-input" value={campo('fallecimiento')} onChange={e => set('fallecimiento')(e.target.value)} /></div>
        </div>
        <div className="mh-field"><label className="mh-field-label">¿Cómo la conociste?</label><AutoTextarea value={campo('comoConoci')} onChange={set('comoConoci')} minHeight={70} /></div>
        <div className="mh-field"><label className="mh-field-label">¿Qué significó para vos?</label><AutoTextarea value={campo('significado')} onChange={set('significado')} minHeight={70} /></div>
        <div className="mh-field"><label className="mh-field-label">¿Qué aprendiste de esta persona?</label><AutoTextarea value={campo('aprendi')} onChange={set('aprendi')} minHeight={70} /></div>
        <div className="mh-field"><label className="mh-field-label">Recuerdo más importante / historias relacionadas</label><AutoTextarea value={campo('recuerdos')} onChange={set('recuerdos')} /></div>
        <div className="mh-field"><label className="mh-field-label">¿Qué le dirías hoy si pudieras hablar con ella?</label><AutoTextarea value={campo('diria')} onChange={set('diria')} minHeight={70} /></div>
        <button className="mh-btn mh-btn-primary" onClick={() => { onAgregar(f); setF({ nombre: '', apodo: '', relacion: '', nacimiento: '', fallecimiento: '', comoConoci: '', significado: '', aprendi: '', recuerdos: '', diria: '' }); }}>+ Agregar a mi historia</button>
      </div>
      <h3>Ya agregadas ({personas.length})</h3>
      {personas.length === 0 && <div className="mh-empty">Todavía no agregaste a nadie. Las personas importantes de tu vida ayudan mucho a construir los capítulos después.</div>}
      {personas.map((p, i) => (
        <div className="mh-list-item" key={p.id}>
          <div className="mh-row mh-between">
            <h3>{p.nombre || 'Sin nombre'} {p.apodo ? '"' + p.apodo + '"' : ''}</h3>
            <button className="mh-btn-ghost mh-btn-sm" onClick={() => onBorrar(i)}>🗑️</button>
          </div>
          <div className="mh-meta">{p.relacion || 'Relación no indicada'}</div>
          {p.recuerdos && <div className="mh-body-text">{p.recuerdos}</div>}
        </div>
      ))}
    </>
  );
}

type FotoMeta = Omit<Foto, 'id'>;
const FOTO_META_VACIA: FotoMeta = { descripcion: '', año: '', lugar: '', personas: '', queOcurria: '', porQueImportante: '', etapaRelacionada: '' };

function FotoCampos({ f, set }: { f: FotoMeta; set: (k: keyof FotoMeta) => (v: string) => void }) {
  return (
    <>
      <div className="mh-field" style={{ marginTop: '0.75rem' }}><label className="mh-field-label">Descripción</label><AutoTextarea value={f.descripcion} onChange={set('descripcion')} minHeight={70} /></div>
      <div className="mh-row" style={{ gap: '0.75rem' }}>
        <div className="mh-field" style={{ flex: 1 }}><label className="mh-field-label">Año aproximado</label><input className="mh-text-input" value={f.año} onChange={e => set('año')(e.target.value)} /></div>
        <div className="mh-field" style={{ flex: 1 }}><label className="mh-field-label">Lugar</label><input className="mh-text-input" value={f.lugar} onChange={e => set('lugar')(e.target.value)} /></div>
      </div>
      <div className="mh-field"><label className="mh-field-label">Personas que aparecen</label><input className="mh-text-input" value={f.personas} onChange={e => set('personas')(e.target.value)} /></div>
      <div className="mh-field"><label className="mh-field-label">¿Qué estaba ocurriendo?</label><AutoTextarea value={f.queOcurria} onChange={set('queOcurria')} minHeight={70} /></div>
      <div className="mh-field"><label className="mh-field-label">¿Por qué es importante?</label><AutoTextarea value={f.porQueImportante} onChange={set('porQueImportante')} minHeight={70} /></div>
      <div className="mh-field">
        <label className="mh-field-label">Etapa relacionada</label>
        <select className="mh-text-input" value={f.etapaRelacionada} onChange={e => set('etapaRelacionada')(e.target.value)}>
          <option value="">— sin especificar —</option>
          {ETAPAS.map((e, i) => <option key={i} value={i}>{e.titulo}</option>)}
        </select>
      </div>
    </>
  );
}

function PhotosScreen({ clave, fotos, onAgregar, onBorrar, onEditar }: { clave: string; fotos: Foto[]; onAgregar: (f: File, meta: FotoMeta) => void; onBorrar: (i: number) => void; onEditar: (i: number, meta: FotoMeta) => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [f, setF] = useState<FotoMeta>(FOTO_META_VACIA);
  function set(k: keyof FotoMeta) { return (v: string) => setF(prev => ({ ...prev, [k]: v })); }
  const [editandoIdx, setEditandoIdx] = useState<number | null>(null);
  const [editF, setEditF] = useState<FotoMeta>(FOTO_META_VACIA);
  function setEdit(k: keyof FotoMeta) { return (v: string) => setEditF(prev => ({ ...prev, [k]: v })); }
  function empezarEdicion(i: number, foto: Foto) {
    const { id, ...meta } = foto;
    setEditF(meta); setEditandoIdx(i);
  }
  return (
    <>
      <div className="mh-eyebrow">Módulo</div>
      <h2 style={{ marginTop: 0 }}>Mis fotografías</h2>
      <p className="mh-hint" style={{ marginTop: 0 }}>Las fotos quedan guardadas en el mismo lugar que el resto de tu historia — disponibles desde cualquier dispositivo donde entres a este panel.</p>
      <div className="mh-card">
        <h3 style={{ marginTop: 0 }}>Agregar fotografía</h3>
        <input type="file" accept="image/*" onChange={e => setFile(e.target.files?.[0] || null)} />
        <FotoCampos f={f} set={set} />
        <button className="mh-btn mh-btn-primary" onClick={() => {
          if (!file) return;
          onAgregar(file, f);
          setFile(null); setF(FOTO_META_VACIA);
        }}>+ Agregar a la galería</button>
      </div>
      <div className="mh-row mh-between" style={{ alignItems: 'center' }}>
        <h3 style={{ margin: 0 }}>Galería ({fotos.length})</h3>
        {fotos.length > 0 && (
          <a className="mh-btn mh-btn-secondary mh-btn-sm" style={{ textDecoration: 'none' }} href={'/api/historia/' + clave + '/fotos-zip'} download>
            📥 Descargar todas (ZIP)
          </a>
        )}
      </div>
      <div className="mh-photo-grid">
        {fotos.map((f2, i) => (
          <div className="mh-photo-card" key={f2.id}>
            <img src={'/api/historia/' + clave + '/foto/' + f2.id} alt="" />
            {editandoIdx === i ? (
              <div className="mh-cap">
                <FotoCampos f={editF} set={setEdit} />
                <div style={{ marginTop: '0.3rem', display: 'flex', gap: '0.5rem' }}>
                  <button className="mh-btn mh-btn-primary mh-btn-sm" onClick={() => { onEditar(i, editF); setEditandoIdx(null); }}>Guardar</button>
                  <button className="mh-btn-ghost mh-btn-sm" onClick={() => setEditandoIdx(null)}>Cancelar</button>
                </div>
              </div>
            ) : (
              <div className="mh-cap">{f2.descripcion || 'Sin descripción'}<br />{f2.año}
                <div style={{ marginTop: '0.3rem', display: 'flex', gap: '0.5rem' }}>
                  <button className="mh-btn-ghost mh-btn-sm" onClick={() => empezarEdicion(i, f2)}>✏️ editar</button>
                  <button className="mh-btn-ghost mh-btn-sm" onClick={() => onBorrar(i)}>🗑️ quitar</button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
      {fotos.length === 0 && <div className="mh-empty">Todavía no subiste fotos.</div>}
    </>
  );
}

function TimelineScreen({ eventos, onAgregar, onBorrar }: { eventos: Evento[]; onAgregar: (e: Omit<Evento, 'id'>) => void; onBorrar: (i: number) => void }) {
  const [f, setF] = useState({ fecha: '', edad: '', acontecimiento: '', lugar: '', personas: '', descripcion: '', importancia: '' });
  function set(k: keyof typeof f) { return (v: string) => setF(prev => ({ ...prev, [k]: v })); }
  const ordenado = eventos.map((e, i) => ({ e, i })).sort((a, b) => (a.e.fecha || '').localeCompare(b.e.fecha || ''));
  return (
    <>
      <div className="mh-eyebrow">Módulo</div>
      <h2 style={{ marginTop: 0 }}>Mi línea de vida</h2>
      <p className="mh-hint" style={{ marginTop: 0 }}>Los acontecimientos se muestran ordenados cronológicamente — esto ayuda después a detectar si dos fechas no coinciden.</p>
      <div className="mh-card">
        <h3 style={{ marginTop: 0 }}>Agregar acontecimiento</h3>
        <div className="mh-row" style={{ gap: '0.75rem' }}>
          <div className="mh-field" style={{ flex: 1 }}><label className="mh-field-label">Año o fecha</label><input className="mh-text-input" placeholder="1998 o 1998-04" value={f.fecha} onChange={e => set('fecha')(e.target.value)} /></div>
          <div className="mh-field" style={{ flex: 1 }}><label className="mh-field-label">Edad</label><input className="mh-text-input" value={f.edad} onChange={e => set('edad')(e.target.value)} /></div>
        </div>
        <div className="mh-field"><label className="mh-field-label">Acontecimiento</label><input className="mh-text-input" value={f.acontecimiento} onChange={e => set('acontecimiento')(e.target.value)} /></div>
        <div className="mh-field"><label className="mh-field-label">Lugar</label><input className="mh-text-input" value={f.lugar} onChange={e => set('lugar')(e.target.value)} /></div>
        <div className="mh-field"><label className="mh-field-label">Personas involucradas</label><input className="mh-text-input" value={f.personas} onChange={e => set('personas')(e.target.value)} /></div>
        <div className="mh-field"><label className="mh-field-label">Descripción</label><AutoTextarea value={f.descripcion} onChange={set('descripcion')} minHeight={70} /></div>
        <div className="mh-field"><label className="mh-field-label">Importancia</label><AutoTextarea value={f.importancia} onChange={set('importancia')} minHeight={70} /></div>
        <button className="mh-btn mh-btn-primary" onClick={() => { onAgregar(f); setF({ fecha: '', edad: '', acontecimiento: '', lugar: '', personas: '', descripcion: '', importancia: '' }); }}>+ Agregar a la línea de vida</button>
      </div>
      <h3>Acontecimientos ({eventos.length})</h3>
      {ordenado.length === 0 && <div className="mh-empty">Todavía no agregaste acontecimientos.</div>}
      {ordenado.map(({ e, i }) => (
        <div className="mh-list-item" key={e.id}>
          <div className="mh-row mh-between">
            <h3>{e.fecha || 'Sin fecha'} {e.edad ? '· ' + e.edad + ' años' : ''}</h3>
            <button className="mh-btn-ghost mh-btn-sm" onClick={() => onBorrar(i)}>🗑️</button>
          </div>
          <div className="mh-meta">{e.lugar}</div>
          <div className="mh-body-text">{e.acontecimiento}</div>
          {e.descripcion && <div className="mh-body-text" style={{ marginTop: '0.4rem', color: 'var(--mh-ink-soft)' }}>{e.descripcion}</div>}
        </div>
      ))}
    </>
  );
}

function ReviewScreen({ getRespDe, notasLibres, contradicciones, onIr, onAgregarContradiccion, onBorrarContradiccion }: {
  getRespDe: (e: number, p: number) => Respuesta; notasLibres: HistoriaData['notasLibres']; contradicciones: Contradiccion[];
  onIr: (e: number, p: number) => void; onAgregarContradiccion: () => void; onBorrarContradiccion: (i: number) => void;
}) {
  return (
    <>
      <div className="mh-eyebrow">Revisión</div>
      <h2 style={{ marginTop: 0 }}>Revisar mis respuestas</h2>
      <p className="mh-hint" style={{ marginTop: 0 }}>Tocá cualquier pregunta para volver a editarla.</p>
      {ETAPAS.map((etapa, ei) => {
        const hechas = etapa.preguntas.filter((_, pi) => getRespDe(ei, pi).estado !== 'sin_responder').length;
        return (
          <div className="mh-card mh-tight" key={ei}>
            <div className="mh-row mh-between"><h3 style={{ margin: 0 }}>{ei + 1}. {etapa.titulo}</h3><span className="mh-hint" style={{ margin: 0 }}>{hechas}/{etapa.preguntas.length}</span></div>
            <div style={{ marginTop: '0.5rem' }}>
              {etapa.preguntas.map((preg, pi) => {
                const r = getRespDe(ei, pi);
                return (
                  <div key={pi} className="mh-kv" onClick={() => onIr(ei, pi)}>
                    <div className="mh-k">{preg}</div>
                    <div>
                      {r.estado === 'sin_responder' && <span className="mh-badge mh-badge-pending">Sin responder</span>}
                      {r.estado === 'no_responder' && <span className="mh-badge mh-badge-skip">Prefiere no responder</span>}
                      {r.estado === 'no_recuerdo' && <span className="mh-badge mh-badge-skip">No recuerda</span>}
                      {!['sin_responder', 'no_responder', 'no_recuerdo'].includes(r.estado) && <span className="mh-badge mh-badge-done">✓</span>}
                      {r.volverDespues && <span className="mh-badge mh-badge-review" style={{ marginLeft: '0.3rem' }}>🔖 volver</span>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
      <h3>Notas libres / recuerdos espontáneos</h3>
      {notasLibres.length === 0 && <div className="mh-empty">Sin recuerdos espontáneos todavía.</div>}
      {notasLibres.map(n => (
        <div className="mh-list-item" key={n.id}><div className="mh-meta">Recuerdo espontáneo — etapa {n.etapaIdx + 1}</div><div className="mh-body-text">{n.texto}</div></div>
      ))}
      <div style={{ marginTop: '1.5rem' }}><button className="mh-btn mh-btn-secondary mh-btn-sm" onClick={onAgregarContradiccion}>⚠️ Marcar una posible contradicción</button></div>
      {contradicciones.length > 0 && (
        <>
          <h3>Contradicciones marcadas</h3>
          {contradicciones.map((c, i) => (
            <div className="mh-list-item" key={c.id}><div className="mh-body-text">{c.nota}</div><button className="mh-btn-ghost mh-btn-sm" onClick={() => onBorrarContradiccion(i)}>quitar</button></div>
          ))}
        </>
      )}
    </>
  );
}

function PromptScreen({ titulo, hint, texto }: { titulo: string; hint: string; texto: string }) {
  const [copiado, setCopiado] = useState(false);

  async function copiar() {
    try {
      await navigator.clipboard.writeText(texto);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      // Si el navegador bloquea el clipboard, el texto sigue ahí abajo
      // para seleccionar y copiar a mano.
    }
  }

  return (
    <>
      <div className="mh-card">
        <h1 style={{ marginTop: 0 }}>{titulo}</h1>
        <p className="mh-hint" style={{ marginTop: 0 }}>{hint}</p>
        <button className="mh-btn mh-btn-gold" onClick={copiar}>{copiado ? '✓ Copiado' : '📋 Copiar prompt completo'}</button>
      </div>
      <div className="mh-card">
        <pre style={{
          whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontFamily: 'var(--font-mh-sans), system-ui, sans-serif',
          fontSize: '0.92rem', lineHeight: 1.6, margin: 0, maxHeight: '65vh', overflowY: 'auto',
        }}>{texto}</pre>
      </div>
    </>
  );
}

function FinalScreen({ clave, historia, etapaCompleta, contarRespondidas, onExportar, onIrEntrevista, onIrRevisar }: {
  clave: string; historia: HistoriaData; etapaCompleta: (i: number) => boolean; contarRespondidas: () => number;
  onExportar: (f: 'txt' | 'md' | 'json' | 'ia') => void; onIrEntrevista: () => void; onIrRevisar: () => void;
}) {
  const etapasCompletas = ETAPAS.filter((_, i) => etapaCompleta(i)).length;
  return (
    <>
      <div className="mh-card" style={{ textAlign: 'center' }}>
        <div style={{ fontSize: '2.4rem' }}>📖</div>
        <h1 style={{ margin: '0.5rem 0' }}>¡Tu historia está acá!</h1>
        <p className="mh-hint">Reuniste los recuerdos, personas y momentos que forman tu historia.</p>
      </div>
      <div className="mh-stat-grid">
        {[
          [etapasCompletas + '/' + ETAPAS.length, 'Etapas completas'],
          [contarRespondidas() + '/' + totalPreguntas(), 'Preguntas respondidas'],
          [String(historia.notasLibres.length), 'Recuerdos extra'],
          [String(historia.personas.length), 'Personas'],
          [String(historia.fotografias.length), 'Fotografías'],
          [String(historia.lineaDeTiempo.length), 'Acontecimientos'],
        ].map(([num, label]) => (
          <div className="mh-stat" key={label}><div className="mh-stat-num">{num}</div><div className="mh-stat-label">{label}</div></div>
        ))}
      </div>
      <div className="mh-card">
        <h3 style={{ marginTop: 0 }}>🏛️ Página de Memoria</h3>
        <p className="mh-hint" style={{ marginTop: 0 }}>Una página de lectura, sin edición, para compartir con la familia — navegan por capítulos, ven las fotos, y escuchan tu voz real en las respuestas que grabaste (o una lectura generada en las que no).</p>
        <a className="mh-btn mh-btn-gold" style={{ textDecoration: 'none' }} href={'/historia/' + clave + '/memoria'} target="_blank" rel="noopener noreferrer">
          🏛️ Abrir página de Memoria
        </a>
      </div>
      <div className="mh-card">
        <h3 style={{ marginTop: 0 }}>Exportar mi historia</h3>
        <p className="mh-hint" style={{ marginTop: 0 }}>Esta app todavía NO escribe tu biografía — solo recopila el material. La redacción literaria viene en un paso aparte, con estos archivos como base.</p>
        <div className="mh-row" style={{ marginTop: '0.75rem' }}>
          <button className="mh-btn mh-btn-primary" onClick={() => onExportar('txt')}>⬇ Exportar TXT</button>
          <button className="mh-btn mh-btn-secondary" onClick={() => onExportar('md')}>⬇ Exportar Markdown</button>
          <button className="mh-btn mh-btn-secondary" onClick={() => onExportar('json')}>⬇ Exportar JSON</button>
        </div>
        <hr className="mh-divider" />
        <h3 style={{ marginTop: 0 }}>Exportar para IA</h3>
        <p className="mh-hint" style={{ marginTop: 0 }}>Un documento especialmente preparado para pegarle a otra conversación de IA y pedirle que escriba el eBook.</p>
        <button className="mh-btn mh-btn-gold" onClick={() => onExportar('ia')}>🤖 Exportar para IA</button>
      </div>
      <div className="mh-row" style={{ justifyContent: 'center', marginTop: '1rem' }}>
        <button className="mh-btn mh-btn-ghost" onClick={onIrEntrevista}>✍️ Agregar más recuerdos</button>
        <button className="mh-btn mh-btn-ghost" onClick={onIrRevisar}>📋 Revisar mis respuestas</button>
      </div>
    </>
  );
}

const ESTILOS = `
.mh-root {
  --font-mh-serif: 'Fraunces'; --font-mh-sans: 'Karla';
  --mh-paper: #faf4e9; --mh-paper-deep: #f0e6d2; --mh-paper-deep-2: #e9dcc0; --mh-ink: #2b2118; --mh-ink-soft: #6b5d4a;
  --mh-wine: #7a2036; --mh-wine-soft: #a44759; --mh-wine-wash: rgba(122,32,54,0.08); --mh-gold: #a5761f; --mh-gold-soft: #d9ae5e;
  --mh-border: #e2d3b0; --mh-success: #3f6b49; --mh-success-wash: rgba(63,107,73,0.1); --mh-danger: #a13a2f;
  --mh-shadow: 0 10px 30px rgba(43,33,24,0.12); --mh-radius: 18px;
  background: radial-gradient(ellipse 800px 500px at 15% -10%, var(--mh-wine-wash), transparent 60%), var(--mh-paper);
  color: var(--mh-ink); font-family: var(--font-mh-sans), system-ui, sans-serif; min-height: 100vh;
}
.mh-root h1, .mh-root h2, .mh-root h3 { font-family: var(--font-mh-serif), Georgia, serif; }
.mh-root textarea, .mh-root input, .mh-root button, .mh-root select { font-family: inherit; }
.mh-root button { cursor: pointer; }
.mh-wrap { max-width: 720px; margin: 0 auto; padding: 1.5rem 1.25rem 5rem; }
.mh-topbar { position: sticky; top: 0; z-index: 20; background: rgba(250,244,233,0.92); backdrop-filter: blur(8px); border-bottom: 1px solid var(--mh-border); }
.mh-topbar-inner { max-width: 720px; margin: 0 auto; padding: 0.85rem 1.25rem; display: flex; align-items: center; justify-content: space-between; gap: 1rem; flex-wrap: wrap; }
.mh-brand { display: flex; align-items: center; gap: 0.5rem; font-family: var(--font-mh-serif), serif; font-weight: 600; font-size: 1.15rem; color: var(--mh-wine); cursor: pointer; }
.mh-tabs { display: flex; gap: 0.3rem; flex-wrap: wrap; }
.mh-tab { border: none; background: transparent; color: var(--mh-ink-soft); padding: 0.4rem 0.65rem; border-radius: 999px; font-size: 0.8rem; font-weight: 600; display: flex; align-items: center; gap: 0.35rem; white-space: nowrap; }
.mh-tab.active { background: var(--mh-wine); color: #fff8ee; }
.mh-progress-shell { margin: 1.25rem 0 0.35rem; }
.mh-progress-label { display: flex; justify-content: space-between; font-size: 0.78rem; color: var(--mh-ink-soft); margin-bottom: 0.4rem; font-weight: 600; letter-spacing: 0.02em; text-transform: uppercase; }
.mh-progress-track { height: 8px; border-radius: 999px; background: var(--mh-paper-deep-2); overflow: hidden; }
.mh-progress-fill { height: 100%; background: linear-gradient(90deg, var(--mh-gold-soft), var(--mh-wine)); border-radius: 999px; transition: width 0.4s ease; }
.mh-subprogress { display: flex; gap: 0.3rem; margin-top: 0.6rem; }
.mh-subprogress-dot { flex: 1; height: 4px; border-radius: 999px; background: var(--mh-paper-deep-2); }
.mh-subprogress-dot.done { background: var(--mh-success); }
.mh-subprogress-dot.current { background: var(--mh-wine); }
.mh-card { background: var(--mh-paper-deep); border: 1px solid var(--mh-border); border-radius: var(--mh-radius); padding: 1.75rem 1.5rem; box-shadow: var(--mh-shadow); margin-top: 1.25rem; }
.mh-card.mh-tight { padding: 1.25rem; }
.mh-eyebrow { font-size: 0.75rem; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; color: var(--mh-gold); margin-bottom: 0.5rem; }
.mh-question-text { font-size: 1.5rem; line-height: 1.35; font-weight: 500; margin: 0 0 1.25rem; }
.mh-answer { width: 100%; resize: vertical; border: 1px solid var(--mh-border); border-radius: 12px; padding: 0.9rem 1rem; font-size: 1rem; line-height: 1.6; background: var(--mh-paper); color: var(--mh-ink); overflow: hidden; box-sizing: border-box; }
.mh-answer:focus { outline: none; border-color: var(--mh-wine-soft); box-shadow: 0 0 0 3px var(--mh-wine-wash); }
.mh-hint { font-size: 0.8rem; color: var(--mh-ink-soft); margin-top: 0.6rem; line-height: 1.5; font-style: italic; }
.mh-row { display: flex; gap: 0.6rem; flex-wrap: wrap; align-items: center; }
.mh-row.mh-between { justify-content: space-between; }
.mh-row.mh-end { justify-content: flex-end; }
.mh-btn { border: none; border-radius: 999px; padding: 0.75rem 1.3rem; font-weight: 700; font-size: 0.92rem; display: inline-flex; align-items: center; gap: 0.45rem; white-space: nowrap; }
.mh-btn-primary { background: var(--mh-wine); color: #fff8ee; box-shadow: 0 3px 0 #4a1120; }
.mh-btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }
.mh-btn-secondary { background: var(--mh-paper-deep-2); color: var(--mh-ink); }
.mh-btn-ghost { background: transparent; color: var(--mh-ink-soft); padding: 0.6rem 0.8rem; }
.mh-btn-ghost:hover { color: var(--mh-ink); text-decoration: underline; }
.mh-btn-gold { background: var(--mh-gold-soft); color: #2b2118; }
.mh-btn-sm { padding: 0.5rem 0.9rem; font-size: 0.82rem; }
.mh-chip { border: 1px solid var(--mh-border); background: var(--mh-paper); color: var(--mh-ink-soft); border-radius: 999px; padding: 0.45rem 0.85rem; font-size: 0.82rem; font-weight: 600; }
.mh-chip.selected { background: var(--mh-wine); color: #fff8ee; border-color: var(--mh-wine); }
.mh-badge { font-size: 0.7rem; font-weight: 700; padding: 0.2rem 0.55rem; border-radius: 999px; letter-spacing: 0.02em; }
.mh-badge-pending { background: var(--mh-paper-deep-2); color: var(--mh-ink-soft); }
.mh-badge-done { background: var(--mh-success-wash); color: var(--mh-success); }
.mh-badge-skip { background: var(--mh-paper-deep-2); color: var(--mh-ink-soft); font-style: italic; }
.mh-badge-review { background: rgba(165,118,31,0.15); color: var(--mh-gold); }
.mh-followup-block { margin-top: 1.25rem; padding-top: 1.1rem; border-top: 1px dashed var(--mh-border); display: flex; flex-direction: column; gap: 0.9rem; }
.mh-followup-q { font-size: 0.95rem; font-weight: 600; margin-bottom: 0.4rem; }
.mh-hero { text-align: center; padding: 3rem 1rem 1.5rem; }
.mh-hero h1 { font-size: clamp(2rem, 6vw, 2.8rem); margin: 0 0 0.75rem; line-height: 1.15; }
.mh-hero p { color: var(--mh-ink-soft); font-size: 1.05rem; max-width: 480px; margin: 0 auto 1.75rem; line-height: 1.6; }
.mh-stat-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 0.75rem; margin: 1.5rem 0; }
@media (min-width: 480px) { .mh-stat-grid { grid-template-columns: repeat(3, 1fr); } }
.mh-stat { background: var(--mh-paper); border: 1px solid var(--mh-border); border-radius: 14px; padding: 1rem; text-align: center; }
.mh-stat-num { font-family: var(--font-mh-serif), serif; font-size: 1.8rem; color: var(--mh-wine); font-weight: 600; }
.mh-stat-label { font-size: 0.75rem; color: var(--mh-ink-soft); text-transform: uppercase; letter-spacing: 0.03em; margin-top: 0.2rem; }
.mh-field-label { font-size: 0.82rem; font-weight: 700; color: var(--mh-ink-soft); margin-bottom: 0.35rem; display: block; }
.mh-field { margin-bottom: 0.9rem; }
.mh-text-input { width: 100%; border: 1px solid var(--mh-border); border-radius: 10px; padding: 0.65rem 0.85rem; background: var(--mh-paper); color: var(--mh-ink); font-size: 0.95rem; box-sizing: border-box; }
.mh-text-input:focus { outline: none; border-color: var(--mh-wine-soft); }
.mh-list-item { background: var(--mh-paper); border: 1px solid var(--mh-border); border-radius: 14px; padding: 1rem 1.1rem; margin-bottom: 0.75rem; }
.mh-list-item h3 { margin: 0 0 0.3rem; font-size: 1.05rem; }
.mh-meta { font-size: 0.78rem; color: var(--mh-ink-soft); margin-bottom: 0.5rem; }
.mh-body-text { font-size: 0.9rem; line-height: 1.5; white-space: pre-wrap; }
.mh-photo-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(130px, 1fr)); gap: 0.75rem; margin-top: 1rem; }
.mh-photo-card { border-radius: 12px; overflow: hidden; border: 1px solid var(--mh-border); background: var(--mh-paper); }
.mh-photo-card img { width: 100%; height: 120px; object-fit: cover; display: block; }
.mh-cap { padding: 0.5rem 0.6rem; font-size: 0.75rem; color: var(--mh-ink-soft); }
.mh-empty { text-align: center; color: var(--mh-ink-soft); padding: 2rem 1rem; font-style: italic; }
.mh-toast { position: fixed; bottom: 1.25rem; left: 50%; transform: translateX(-50%); background: var(--mh-ink); color: var(--mh-paper); padding: 0.7rem 1.2rem; border-radius: 999px; font-size: 0.85rem; font-weight: 600; box-shadow: var(--mh-shadow); z-index: 50; }
.mh-spinner { width: 14px; height: 14px; border-radius: 50%; border: 2px solid rgba(255,255,255,0.4); border-top-color: #fff; display: inline-block; animation: mh-spin 0.7s linear infinite; }
@keyframes mh-spin { to { transform: rotate(360deg); } }
.mh-divider { height: 1px; background: var(--mh-border); margin: 1.5rem 0; border: none; }
.mh-kv { display: flex; justify-content: space-between; gap: 1rem; font-size: 0.85rem; padding: 0.55rem 0; cursor: pointer; border-bottom: 1px solid var(--mh-border); }
.mh-kv .mh-k { flex: 1; }
`;
