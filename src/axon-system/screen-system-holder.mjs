// One shared screen system for the whole app: screens ask the holder, not the factory, so they all see the same reader,
// the same running routine and the same events. Policy changes rebuild the system (never while a routine runs).
import { sanitizePolicy } from './policy-storage.mjs';

/** @param {any} options */
export function createScreenSystemHolder({ factory, policyStorage, profilesStorage }) {
  let system = null;
  let policy = policyStorage ? policyStorage.loadSync() : sanitizePolicy({});
  const listeners = new Set();
  const dispatch = (event) => { for (const fn of [...listeners]) { try { fn(event); } catch { /* one screen's listener must never break another's */ } } };
  const copy = (p) => ({ autonomy: p.autonomy, askPackages: [...p.askPackages], blockedPackages: [...p.blockedPackages] });
  return {
    get() { if (!system) system = factory({ policy: copy(policy), onEvent: dispatch, profiles: profilesStorage ? profilesStorage.loadSync() : undefined }); return system; },
    getPolicy: () => copy(policy),
    /** Events from the auto-clicker runner and scheduler: { type: started | step | needs-approval | finished | scheduled-start, ... }. Returns unsubscribe. */
    subscribe(fn) { listeners.add(fn); return () => { listeners.delete(fn); }; },
    async setPolicy(next) {
      if (system?.runner?.isRunning?.()) return { ok: false, code: 'routine-running', text: 'Stop the running routine before changing these settings.' };
      const clean = sanitizePolicy(next);
      const saved = policyStorage ? policyStorage.save(clean) : false;
      policy = clean; system = null;
      return { ok: true, saved, policy: copy(clean) };
    },
    /** Saves the owner's app names (sys.profiles) under their own key. Call after setAlias / removeAlias / setNote. */
    async saveProfiles() { return system && profilesStorage ? profilesStorage.save(system.profiles) : false; },
    /** For tests and for screens in a plain browser demo: use this system instead of building one. */
    override(sys) { system = sys; },
    reset() { system = null; },
  };
}
