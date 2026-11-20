// PREDICTION JOURNAL (pure). Remembers what judgment predicted, waits for what really happened, and keeps the record that calibration reads.
import type { Prediction } from '../foresight/calibration.ts';

export const PENDING_LIMIT = 500;
export const KEPT_LIMIT = 5000;
const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const goodPrediction = (p: unknown): p is Prediction => isObj(p) && typeof p.id === 'string' && p.id !== '' && p.id.length <= 100 && typeof p.chance === 'number' && p.chance >= 0 && p.chance <= 100 && typeof p.cameTrue === 'boolean';

export function createPredictionJournal() {
  let pending: { id: string; chance: number }[] = [];
  let kept: Prediction[] = [];
  return {
    /** Remember a prediction until its outcome is known. A repeated id replaces the older one. */
    expect(id: string, chance: number): boolean {
      if (typeof id !== 'string' || id === '' || id.length > 100 || typeof chance !== 'number' || !(chance >= 0 && chance <= 100)) return false;
      pending = pending.filter((p) => p.id !== id);
      pending.push({ id, chance });
      if (pending.length > PENDING_LIMIT) pending = pending.slice(pending.length - PENDING_LIMIT);
      return true;
    },
    /** What really happened. False when nothing was expected under that id (so nothing is invented). */
    outcome(id: string, cameTrue: boolean): boolean {
      const at = pending.findIndex((p) => p.id === id);
      if (at < 0 || typeof cameTrue !== 'boolean') return false;
      const [p] = pending.splice(at, 1);
      kept.push({ id: p.id, chance: p.chance, cameTrue });
      if (kept.length > KEPT_LIMIT) kept = kept.slice(kept.length - KEPT_LIMIT);
      return true;
    },
    pendingCount(): number { return pending.length; },
    list(): readonly Prediction[] { return kept.map((p) => ({ ...p })); },
    exportText(): string { return JSON.stringify({ version: 1, pending, kept }); },
    importText(text: string): boolean {
      let data: unknown;
      try { data = JSON.parse(text); } catch { return false; }
      if (!isObj(data) || data.version !== 1 || !Array.isArray(data.pending) || !Array.isArray(data.kept) || data.pending.length > PENDING_LIMIT || data.kept.length > KEPT_LIMIT) return false;
      const nextPending: { id: string; chance: number }[] = [];
      for (const p of data.pending) {
        if (!isObj(p) || typeof p.id !== 'string' || p.id === '' || typeof p.chance !== 'number' || !(p.chance >= 0 && p.chance <= 100)) return false;
        nextPending.push({ id: p.id, chance: p.chance });
      }
      const nextKept: Prediction[] = [];
      for (const p of data.kept) { if (!goodPrediction(p)) return false; nextKept.push({ id: p.id, chance: p.chance, cameTrue: p.cameTrue }); }
      pending = nextPending;
      kept = nextKept;
      return true;
    },
  };
}
