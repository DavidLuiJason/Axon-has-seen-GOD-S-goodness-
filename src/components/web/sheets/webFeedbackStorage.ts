/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export const WEB_FEEDBACK_STORAGE_KEY = 'axon.webFeedback.v1';
export const MAX_WEB_FEEDBACK_ENTRIES = 20;

export interface WebFeedbackEntry {
  id: string;
  text: string;
  createdAt: number;
}

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

function getDefaultStorage(): StorageLike | null {
  try {
    return typeof localStorage !== 'undefined' ? localStorage : null;
  } catch {
    return null;
  }
}

export function readWebFeedbackEntries(
  storage: StorageLike | null = getDefaultStorage()
): WebFeedbackEntry[] {
  if (!storage) return [];
  try {
    const raw = storage.getItem(WEB_FEEDBACK_STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const valid: WebFeedbackEntry[] = [];
    for (const item of parsed) {
      if (
        item &&
        typeof item === 'object' &&
        typeof (item as WebFeedbackEntry).id === 'string' &&
        typeof (item as WebFeedbackEntry).text === 'string' &&
        typeof (item as WebFeedbackEntry).createdAt === 'number'
      ) {
        valid.push(item as WebFeedbackEntry);
      }
    }
    return valid.slice(0, MAX_WEB_FEEDBACK_ENTRIES);
  } catch {
    return [];
  }
}

export function saveWebFeedbackEntry(
  rawText: string,
  storage: StorageLike | null = getDefaultStorage()
): { saved: boolean; entries: WebFeedbackEntry[] } {
  const text = rawText.trim();
  const existing = readWebFeedbackEntries(storage);
  if (!text) return { saved: false, entries: existing };

  const entry: WebFeedbackEntry = {
    id: `fb-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    text,
    createdAt: Date.now(),
  };

  const next = [entry, ...existing].slice(0, MAX_WEB_FEEDBACK_ENTRIES);
  if (storage) {
    try {
      storage.setItem(WEB_FEEDBACK_STORAGE_KEY, JSON.stringify(next));
    } catch {
      return { saved: false, entries: existing };
    }
  }
  return { saved: true, entries: next };
}
