'use client';

import { useRef, useState } from 'react';
import s from './pagina.module.css';

// Al terminar el ejemplo, el video queda en negro: ahí aparece la flecha que lleva al formulario.
export default function VideoEjemplo() {
  const video = useRef<HTMLVideoElement>(null);
  const [terminado, setTerminado] = useState(false);

  return (
    <div className={s.marcoVideo}>
      {/* El video empieza con sonido apagado hasta que la persona lo toca: así lo exigen los navegadores. */}
      <video
        ref={video}
        className={s.video}
        src="/video-para-tu-cancion/muestra.mp4"
        poster="/video-para-tu-cancion/portada.jpg"
        controls={!terminado}
        playsInline
        preload="metadata"
        onEnded={() => setTerminado(true)}
        onPlay={() => setTerminado(false)}
      />
      {terminado && (
        <div className={s.finVideo}>
          <p className={s.finTitulo}>¿Quieres uno así con tu canción?</p>
          <a className={s.finEnlace} href="#formulario">
            <span>Llena el formulario y pide tu muestra gratis</span>
            {/* Dibujada, no con emoji: en el celular el emoji sale como un cuadrito azul. */}
            <svg className={s.flecha} aria-hidden="true" viewBox="0 0 24 24" width="58" height="58" fill="currentColor"><path d="M9 3h6v9h5l-8 9-8-9h5z" /></svg>
          </a>
          <button className={s.finOtraVez} onClick={() => video.current?.play()}>Ver otra vez</button>
        </div>
      )}
    </div>
  );
}
