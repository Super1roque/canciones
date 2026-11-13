// 35:04:09 — horas totales (no días), minutos y segundos. Para las cuentas regresivas de las canciones.
export function formatoRestante(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  const dos = (n: number) => String(n).padStart(2, '0');
  return `${Math.floor(s / 3600)}:${dos(Math.floor(s / 60) % 60)}:${dos(s % 60)}`;
}
