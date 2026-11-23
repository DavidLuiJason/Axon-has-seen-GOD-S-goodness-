/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * COMMITMENTS store (pure apart from the storage the caller hands in): saves and restores the ledger as versioned text, the same pattern as candidateStore.ts.
 * - Saved text that is damaged, too big, from an unknown version or that breaks ANY ledger invariant is refused WHOLE (recovery = start empty, and say so).
 * - The ledger quotes the owner's own words, so nothing is written unless `memoryAllowed` is true (the same rule D84 applied to learned LESSONs). It then lives in memory for the run.
 * - A save is refused when the stored copy is newer than the revision the caller loaded (two tabs, two writers): nothing is overwritten.
 * - Storage that throws never throws out of here.
 */
import { LIMITS } from './commitmentTypes.ts';
import type { Ledger } from './commitmentTypes.ts';
import { emptyLedger, validateLedger } from './commitments.ts';
import type { TextStorage } from '../orchestrator/candidateStore.ts';

export const COMMITMENTS_KEY = 'axon.brain.commitments';
export type ParseResult = { readonly ok: true; readonly ledger: Ledger } | { readonly ok: false; readonly reason: 'bad-text' | 'too-large' | 'unsupported-version' | 'broken'; readonly errors: readonly string[] };
export type SaveResult = { readonly ok: true; readonly rev: number } | { readonly ok: false; readonly reason: 'memory-not-allowed' | 'no-storage' | 'stale' | 'storage-failed' | 'invalid-ledger' };
export type LoadResult = { readonly status: 'empty' | 'loaded' | 'refused'; readonly ledger: Ledger; readonly baseRev: number; readonly errors: readonly string[] };

export const serializeLedger = (l: Ledger): string => JSON.stringify(l);

export function parseLedger(text: string): ParseResult {
  if (typeof text !== 'string' || text.length > LIMITS.maxSerialized) return { ok: false, reason: 'too-large', errors: [] };
  let data: unknown;
  try { data = JSON.parse(text); } catch { return { ok: false, reason: 'bad-text', errors: [] }; }
  if (typeof data === 'object' && data !== null && (data as { version?: unknown }).version !== 1) return { ok: false, reason: 'unsupported-version', errors: [] };
  const errors = validateLedger(data);
  return errors.length > 0 ? { ok: false, reason: 'broken', errors } : { ok: true, ledger: data as Ledger };
}

export function loadLedger(storage: TextStorage | null): LoadResult {
  const none = emptyLedger();
  if (storage === null) return { status: 'empty', ledger: none, baseRev: 0, errors: [] };
  let text: string | null;
  try { text = storage.getItem(COMMITMENTS_KEY); } catch { return { status: 'empty', ledger: none, baseRev: 0, errors: [] }; }
  if (text === null) return { status: 'empty', ledger: none, baseRev: 0, errors: [] };
  const parsed = parseLedger(text);
  if (!parsed.ok) return { status: 'refused', ledger: none, baseRev: 0, errors: [parsed.reason, ...parsed.errors] };
  return { status: 'loaded', ledger: parsed.ledger, baseRev: parsed.ledger.rev, errors: [] };
}

/** `baseRev` is the revision the caller loaded (or last saved). The stored copy must still be at that revision. */
export function saveLedger(storage: TextStorage | null, ledger: Ledger, baseRev: number, memoryAllowed: boolean): SaveResult {
  if (!memoryAllowed) return { ok: false, reason: 'memory-not-allowed' };
  if (storage === null) return { ok: false, reason: 'no-storage' };
  if (validateLedger(ledger).length > 0) return { ok: false, reason: 'invalid-ledger' };
  try {
    const stored = storage.getItem(COMMITMENTS_KEY);
    if (stored !== null) {
      const there = parseLedger(stored);
      if (there.ok && there.ledger.rev !== baseRev) return { ok: false, reason: 'stale' };
      if (!there.ok && baseRev !== 0) return { ok: false, reason: 'stale' };
    } else if (baseRev !== 0) return { ok: false, reason: 'stale' };
    storage.setItem(COMMITMENTS_KEY, serializeLedger(ledger));
    return { ok: true, rev: ledger.rev };
  } catch { return { ok: false, reason: 'storage-failed' }; }
}
