const MIN_FREQ = 70;  // Hz — graves de voz humana
const MAX_FREQ = 500;  // Hz — agudos de voz humana

function rms(frame: Float32Array): number {
  let sum = 0;
  for (let i = 0; i < frame.length; i++) sum += frame[i] * frame[i];
  return Math.sqrt(sum / frame.length);
}

// Autocorrelación con interpolación parabólica para estimar F0 de un frame.
function detectarFrecuencia(frame: Float32Array, sampleRate: number): number | null {
  if (rms(frame) < 0.008) return null; // silencio o ruido de piso

  const minLag = Math.floor(sampleRate / MAX_FREQ);
  const maxLag = Math.min(Math.floor(sampleRate / MIN_FREQ), frame.length - 1);

  let mejorLag = -1;
  let mejorCorr = 0;
  const ac0 = frame.reduce((s, v) => s + v * v, 0);
  if (ac0 <= 0) return null;

  for (let lag = minLag; lag <= maxLag; lag++) {
    let corr = 0;
    for (let i = 0; i < frame.length - lag; i++) corr += frame[i] * frame[i + lag];
    corr /= ac0;
    if (corr > mejorCorr) {
      mejorCorr = corr;
      mejorLag = lag;
    }
  }

  if (mejorLag <= 0 || mejorCorr < 0.35) return null;

  // Interpolación parabólica alrededor del pico para precisión sub-muestra
  let lagAfinado = mejorLag;
  if (mejorLag > minLag && mejorLag < maxLag) {
    const corrEn = (lag: number) => {
      let c = 0;
      for (let i = 0; i < frame.length - lag; i++) c += frame[i] * frame[i + lag];
      return c / ac0;
    };
    const cM = corrEn(mejorLag - 1), c0 = mejorCorr, cP = corrEn(mejorLag + 1);
    const denom = cM - 2 * c0 + cP;
    if (Math.abs(denom) > 1e-9) {
      const delta = 0.5 * (cM - cP) / denom;
      lagAfinado = mejorLag + Math.max(-1, Math.min(1, delta));
    }
  }

  return sampleRate / lagAfinado;
}

/**
 * Estima el tono fundamental promedio (Hz) de un clip de voz corto y limpio
 * (p. ej. un clip de TTS), analizando frames por autocorrelación y devolviendo
 * la mediana de las estimaciones válidas. Devuelve null si no hay voz detectable.
 */
export function pitchPromedio(pcm: Float32Array, sampleRate: number): number | null {
  const frameSize = Math.round(sampleRate * 0.04); // 40ms
  const hop = Math.round(sampleRate * 0.02); // 20ms

  const estimaciones: number[] = [];
  for (let start = 0; start + frameSize <= pcm.length; start += hop) {
    const frame = pcm.subarray(start, start + frameSize);
    const f0 = detectarFrecuencia(frame, sampleRate);
    if (f0 !== null) estimaciones.push(f0);
  }

  if (estimaciones.length === 0) return null;

  estimaciones.sort((a, b) => a - b);
  const mid = Math.floor(estimaciones.length / 2);
  return estimaciones.length % 2 === 0
    ? (estimaciones[mid - 1] + estimaciones[mid]) / 2
    : estimaciones[mid];
}

export interface FramePitch {
  time: number;
  freq: number | null;
}

/**
 * Analiza un clip de audio completo y devuelve su tono fundamental (Hz) cada
 * 20ms, a diferencia de pitchPromedio que colapsa el clip a un solo valor.
 * Sirve para reconstruir la curva de subida/bajada de entonación en el tiempo.
 */
export function pitchContorno(pcm: Float32Array, sampleRate: number): FramePitch[] {
  const frameSize = Math.round(sampleRate * 0.04);
  const hop = Math.round(sampleRate * 0.02);

  const contorno: FramePitch[] = [];
  for (let start = 0; start + frameSize <= pcm.length; start += hop) {
    const frame = pcm.subarray(start, start + frameSize);
    contorno.push({ time: start / sampleRate, freq: detectarFrecuencia(frame, sampleRate) });
  }
  return contorno;
}

// Busca en el contorno el tono más cercano a un instante t; si el punto
// sonoro más próximo queda a más de ventanaMax, se considera zona sin tono
// confiable (silencio o consonante sin voz) y devuelve null.
export function frecuenciaCercana(contorno: FramePitch[], t: number, ventanaMax = 0.15): number | null {
  let mejor: FramePitch | null = null;
  let mejorDist = Infinity;
  for (const p of contorno) {
    if (p.freq === null) continue;
    const dist = Math.abs(p.time - t);
    if (dist < mejorDist) { mejorDist = dist; mejor = p; }
  }
  return mejor && mejorDist <= ventanaMax ? mejor.freq : null;
}

export function midiToFreq(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

export function freqToSemitones(freqA: number, freqB: number): number {
  return 12 * Math.log2(freqA / freqB);
}
