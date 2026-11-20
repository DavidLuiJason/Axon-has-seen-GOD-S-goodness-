import test from 'node:test';
import assert from 'node:assert/strict';
import { sanitizePolicy, createPolicyStorage, POLICY_STORAGE_KEY } from '../src/axon-system/policy-storage.mjs';
import { createScreenSystemHolder } from '../src/axon-system/screen-system-holder.mjs';

const store = () => { const m = new Map(); return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => { m.set(k, v); }, m }; };

test('policy is cleaned: unknown autonomy, junk and duplicate package names, caps', () => {
  assert.deepEqual(sanitizePolicy(undefined), { autonomy: 'navigate', askPackages: [], blockedPackages: [] });
  assert.deepEqual(sanitizePolicy({ autonomy: 'wild', askPackages: [' a.b ', 'a.b', '', 5, 'x'.repeat(200)], blockedPackages: 'nope' }), { autonomy: 'navigate', askPackages: ['a.b', '5'], blockedPackages: [] });
  assert.equal(sanitizePolicy({ autonomy: 'read-only' }).autonomy, 'read-only');
  assert.equal(sanitizePolicy({ askPackages: Array.from({ length: 300 }, (_, i) => `p${i}`) }).askPackages.length, 200);
});
test('policy storage saves under its own key and never throws', () => {
  const storage = store(); const ps = createPolicyStorage({ storage });
  assert.equal(ps.save({ autonomy: 'ask-everything', askPackages: ['a.b'] }), true); assert.deepEqual([...storage.m.keys()], [POLICY_STORAGE_KEY]);
  assert.deepEqual(ps.loadSync(), { autonomy: 'ask-everything', askPackages: ['a.b'], blockedPackages: [] });
  const bad = createPolicyStorage({ storage: { getItem() { throw new Error('x'); }, setItem() { throw new Error('x'); } } });
  assert.equal(bad.loadSync().autonomy, 'navigate'); assert.equal(bad.save({}), false); assert.equal(createPolicyStorage({ storage: null }).save({}), false);
  storage.m.set(POLICY_STORAGE_KEY, '{not json'); assert.equal(ps.loadSync().autonomy, 'navigate');
});
test('the holder builds the system once, with the saved policy, and hands out copies of the policy', () => {
  const storage = store(); createPolicyStorage({ storage }).save({ autonomy: 'ask-everything', blockedPackages: ['z.z'] });
  let built = 0; let seen;
  const holder = createScreenSystemHolder({ factory: (o) => { built += 1; seen = o; return { tag: 'sys', runner: { isRunning: () => false } }; }, policyStorage: createPolicyStorage({ storage }) });
  assert.equal(holder.get(), holder.get()); assert.equal(built, 1);
  assert.deepEqual(seen.policy, { autonomy: 'ask-everything', askPackages: [], blockedPackages: ['z.z'] });
  holder.getPolicy().blockedPackages.push('hack'); assert.deepEqual(holder.getPolicy().blockedPackages, ['z.z']);
});
test('events reach every subscriber, a broken listener does not hurt the others, unsubscribe works', () => {
  let emit; const holder = createScreenSystemHolder({ factory: (o) => { emit = o.onEvent; return { runner: { isRunning: () => false } }; } });
  const a = []; const b = [];
  const offA = holder.subscribe((e) => a.push(e.type)); holder.subscribe(() => { throw new Error('boom'); }); holder.subscribe((e) => b.push(e.type));
  holder.get(); emit({ type: 'started' }); offA(); emit({ type: 'finished' });
  assert.deepEqual([a, b], [['started'], ['started', 'finished']]);
});
test('changing the policy saves it and rebuilds the system, but never while a routine runs', async () => {
  const storage = store(); let running = false; let built = 0;
  const holder = createScreenSystemHolder({ factory: () => { built += 1; return { runner: { isRunning: () => running } }; }, policyStorage: createPolicyStorage({ storage }) });
  const first = holder.get();
  const ok = await holder.setPolicy({ autonomy: 'read-only', askPackages: ['bank.app'] });
  assert.deepEqual([ok.ok, ok.saved, ok.policy.autonomy], [true, true, 'read-only']);
  const second = holder.get(); assert.notEqual(first, second); assert.equal(built, 2);
  running = true;
  const blocked = await holder.setPolicy({ autonomy: 'navigate' });
  assert.deepEqual([blocked.ok, blocked.code], [false, 'routine-running']); assert.equal(holder.getPolicy().autonomy, 'read-only'); assert.equal(holder.get(), second);
  const noStorage = createScreenSystemHolder({ factory: () => ({}) });
  assert.equal((await noStorage.setPolicy({})).saved, false);
});
test('override and reset let tests and demos supply their own system', () => {
  const holder = createScreenSystemHolder({ factory: () => ({ tag: 'real' }) });
  holder.override({ tag: 'fake' }); assert.equal(holder.get().tag, 'fake'); holder.reset(); assert.equal(holder.get().tag, 'real');
});

test('the owner\'s app names are loaded into the new system and saved on request', async () => {
  const { createProfilesPersistence } = await import('../src/axon-autoclicker/routine-backend.mjs');
  const { createAppProfiles } = await import('../src/axon-apps/app-profiles.mjs');
  const storage = store(); const ps = createProfilesPersistence({ storage });
  const seed = createAppProfiles(); seed.setAlias('my bank', 'com.example.bankapp'); await ps.save(seed);
  let seen;
  const holder = createScreenSystemHolder({ factory: (o) => { seen = o; return { profiles: createAppProfiles(o.profiles), runner: { isRunning: () => false } }; }, profilesStorage: ps });
  const sys = holder.get(); assert.equal(sys.profiles.lookup('my bank'), 'com.example.bankapp'); assert.deepEqual(Object.keys(seen), ['policy', 'onEvent', 'profiles']);
  sys.profiles.setAlias('chat', 'com.example.chat'); assert.equal(await holder.saveProfiles(), true);
  assert.equal(createAppProfiles(ps.loadSync()).lookup('chat'), 'com.example.chat');
  assert.equal(await createScreenSystemHolder({ factory: () => ({}) }).saveProfiles(), false);
});
