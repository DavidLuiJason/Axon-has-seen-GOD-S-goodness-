import { createNativeScreenSystem } from './screen-system-native';
import { createScreenSystemHolder } from './screen-system-holder.mjs';
import { createPolicyStorage } from './policy-storage.mjs';
import { createProfilesPersistence } from '../axon-autoclicker/routine-backend.mjs';

/**
 * The one shared screen system. Every D47 screen imports this and calls screenSystem.get() (never builds its own).
 * screenSystem.subscribe(fn) listens to routine events, screenSystem.getPolicy() / setPolicy(next) read and change the policy,
 * screenSystem.saveProfiles() saves the owner's own app names after sys.profiles.setAlias(...).
 * Not called by anything until the screens exist.
 */
export const screenSystem = createScreenSystemHolder({
  factory: (options: Record<string, unknown>) => createNativeScreenSystem(options),
  policyStorage: createPolicyStorage(),
  profilesStorage: createProfilesPersistence(),
});
