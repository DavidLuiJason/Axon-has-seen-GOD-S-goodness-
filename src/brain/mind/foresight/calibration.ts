// J2 CALIBRATION (pure). Keeps what was predicted and what happened, so "70 percent" can be checked against reality and widened when it drifts.
export type Prediction = { readonly id: string; readonly chance: number; readonly cameTrue: boolean };
export type Bucket = { readonly bucket: number; readonly called: number; readonly cameTrue: number; readonly rate: number; readonly drifted: boolean };
export const DRIFT_POINTS = 15;
export const DRIFT_MIN_CALLS = 10;

export function calibrationReport(predictions: readonly Prediction[]): Bucket[] | null {
  if (!Array.isArray(predictions) || predictions.length > 5000) return null;
  const called: Record<number, number> = {};
  const hit: Record<number, number> = {};
  for (const p of predictions) {
    if (typeof p !== 'object' || p === null || typeof p.id !== 'string' || typeof p.chance !== 'number' || !(p.chance >= 0 && p.chance <= 100) || typeof p.cameTrue !== 'boolean') return null;
    const b = Math.round(p.chance / 10) * 10;
    called[b] = (called[b] ?? 0) + 1;
    if (p.cameTrue) hit[b] = (hit[b] ?? 0) + 1;
  }
  return Object.keys(called).map(Number).sort((a, b) => a - b).map((b) => {
    const rate = Math.round(((hit[b] ?? 0) / called[b]) * 1000) / 10;
    return { bucket: b, called: called[b], cameTrue: hit[b] ?? 0, rate, drifted: called[b] >= DRIFT_MIN_CALLS && Math.abs(rate - b) > DRIFT_POINTS };
  });
}

/** A stated range, made wider by 10 points each side when the bucket it falls in has drifted. Never wider than 0 to 100. */
export function widenForDrift(low: number, high: number, report: readonly Bucket[]): { low: number; high: number; widened: boolean } {
  const mid = (low + high) / 2;
  const bucket = Math.round(mid / 10) * 10;
  const drifted = report.some((b) => b.bucket === bucket && b.drifted);
  return drifted ? { low: Math.max(0, low - 10), high: Math.min(100, high + 10), widened: true } : { low, high, widened: false };
}
