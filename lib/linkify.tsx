import { Fragment, type ReactNode } from 'react';

const URL_REGEX = /(https?:\/\/[^\s]+)/g;

// Separa un texto en fragmentos planos + links clickeables — usado en los
// mensajes del chat (tenant y admin) para que una URL pegada en un mensaje
// se pueda abrir con un toque en vez de copiarla a mano. Sin lib externa:
// es un caso simple (solo http/https) que no justifica una dependencia.
export function conLinksClickeables(texto: string): ReactNode[] {
  // split() con UN grupo de captura siempre alterna [texto, match, texto,
  // match, ...] — los índices impares son justo lo que capturó el regex
  // (la URL), sin necesidad de volver a probarla (evitar .test() con
  // regex /g, que arrastra estado entre llamadas vía lastIndex).
  return texto.split(URL_REGEX).map((parte, i) => {
    if (i % 2 === 0) return <Fragment key={i}>{parte}</Fragment>;

    // Puntuación de cierre pegada al final ("...el link: https://x.com." o
    // "(https://x.com)") casi nunca es parte de la URL real — se separa y
    // se muestra después del link, no dentro de él.
    const match = parte.match(/^([\s\S]*?)([.,;:!?)\]'"]*)$/);
    const url = match ? match[1] : parte;
    const cola = match ? match[2] : '';
    return (
      <Fragment key={i}>
        <a href={url} target="_blank" rel="noopener noreferrer" style={{ color: 'inherit', textDecoration: 'underline', wordBreak: 'break-all' }}>
          {url}
        </a>
        {cola}
      </Fragment>
    );
  });
}
