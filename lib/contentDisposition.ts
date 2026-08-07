// El header Content-Disposition solo acepta bytes Latin-1 (ByteString). Los
// nombres de archivo con tildes a veces llegan en forma Unicode "descompuesta"
// (letra + acento como carácter combinante aparte, común en filesystems de
// macOS), cuyos puntos de código superan 255 y rompen el header. filename*
// (RFC 5987) evita el problema codificando el nombre completo en UTF-8/percent-encoding.
export function contentDisposition(nombreArchivo: string, disposicion: 'inline' | 'attachment' = 'inline'): string {
  const nombre = nombreArchivo.normalize('NFC');
  const fallbackAscii = nombre.replace(/[^\x20-\x7E]/g, '_');
  return `${disposicion}; filename="${fallbackAscii}"; filename*=UTF-8''${encodeURIComponent(nombre)}`;
}
