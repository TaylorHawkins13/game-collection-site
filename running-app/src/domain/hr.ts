/** Bluetooth Heart Rate Service (0x180D) helpers. */
export const HR_SERVICE = '0000180d-0000-1000-8000-00805f9b34fb';
export const HR_MEASUREMENT = '00002a37-0000-1000-8000-00805f9b34fb';

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

export function base64ToBytes(b64: string): Uint8Array {
  const clean = b64.replace(/[^A-Za-z0-9+/]/g, '');
  const out: number[] = [];
  let buf = 0;
  let bits = 0;
  for (const ch of clean) {
    buf = (buf << 6) | B64.indexOf(ch);
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      out.push((buf >> bits) & 0xff);
    }
  }
  return Uint8Array.from(out);
}

/** Parse a Heart Rate Measurement characteristic (flags bit 0: 0 = uint8, 1 = uint16 LE). */
export function parseHeartRate(bytes: Uint8Array): number | null {
  if (bytes.length < 2) return null;
  const sixteen = (bytes[0] & 0x01) === 1;
  const bpm = sixteen ? (bytes.length >= 3 ? bytes[1] | (bytes[2] << 8) : NaN) : bytes[1];
  return Number.isFinite(bpm) && bpm >= 25 && bpm <= 250 ? bpm : null;
}

export interface HrSample {
  t: number;
  bpm: number;
}

/** Time-weighted average (so a dropout doesn't skew it) and max. */
export function summarizeSamples(samples: HrSample[]): { avg: number; max: number } | null {
  if (!samples.length) return null;
  if (samples.length === 1) return { avg: samples[0].bpm, max: samples[0].bpm };
  let weighted = 0;
  let total = 0;
  for (let i = 1; i < samples.length; i++) {
    const dt = Math.min(10_000, samples[i].t - samples[i - 1].t); // cap gaps at 10 s
    weighted += samples[i - 1].bpm * dt;
    total += dt;
  }
  return { avg: Math.round(total ? weighted / total : samples[0].bpm), max: Math.max(...samples.map((s) => s.bpm)) };
}
