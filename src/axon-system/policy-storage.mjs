// The owner's screen-system policy (how careful AXON is), saved under its own key. Never throws.
export const POLICY_STORAGE_KEY = 'axon.screen-policy.v1';
export const AUTONOMY_LEVELS = Object.freeze(['navigate', 'ask-everything', 'read-only']);
const packages = (list) => [...new Set((Array.isArray(list) ? list : []).map((p) => String(p ?? '').trim()).filter((p) => p && p.length <= 120))].slice(0, 200);

/** Any input in, a safe policy out: unknown autonomy falls back to "navigate", lists are cleaned, de-duplicated and capped. */
export function sanitizePolicy(input) {
  const p = input && typeof input === 'object' ? input : {};
  return { autonomy: AUTONOMY_LEVELS.includes(p.autonomy) ? p.autonomy : 'navigate', askPackages: packages(p.askPackages), blockedPackages: packages(p.blockedPackages) };
}

/** @param {any} [options] */
export function createPolicyStorage({ storage = globalThis.localStorage, key = POLICY_STORAGE_KEY } = {}) {
  return {
    loadSync() { try { const raw = storage?.getItem(key); return sanitizePolicy(raw ? JSON.parse(raw) : {}); } catch { return sanitizePolicy({}); } },
    save(policy) { try { storage.setItem(key, JSON.stringify(sanitizePolicy(policy))); return true; } catch { return false; } },
  };
}
