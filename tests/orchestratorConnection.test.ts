// JOB 1 (D111): the orchestrator is connected to the real chat. Every check below is executed, none inferred.
// A: pins and connection audit (static)  B: wrapper laws with a counting fake brain  C: the REAL chat pathway (sendQueryToAxonBoundary).
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { withOrchestrator } from '../src/brain/orchestratedBrain';
import { createOrchestrator } from '../src/brain/mind/orchestrator/orchestrator';
import { ORCHESTRATOR_MODE } from '../src/brain/orchestratorMode';
import { createAxonBrain, getAxonBrain, getOrchestratorStatus, rebuildChatBrainForTests } from '../src/brain';
import { Dictionary } from '../src/brain/dictionary';
import { createDictionarySlot } from '../src/brain/knowledge/dictionarySlot';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resetAxonDialogue, sendQueryToAxonBoundary } from '../src/services/axonBrainInterface';

import { registerSettingsCapability } from '../src/capabilities/registerSettings';
import { registerAxonToolsCapability } from '../src/capabilities/registerAxonTools';
import { registerEngineTools } from '../src/capabilities/registerEngineTools';
import { registerAxonSourceCapability } from '../src/capabilities/registerAxonSource';
import { registerInterfaceCaptureCapability } from '../src/capabilities/registerInterfaceCapture';
import { registerScreenIntelligenceCapability } from '../src/capabilities/registerScreenIntelligence';
import { registerBackgroundProofCapability } from '../src/capabilities/registerBackgroundProof';
import { registerScreenReaderCapability } from '../src/capabilities/registerScreenReader';
import { registerDictionaryCapability } from '../src/capabilities/registerDictionary';
import { registerPlannedCapabilities } from '../src/capabilities/registerPlanned';
import { registerTaughtMeaningsCapability } from '../src/capabilities/registerTaughtMeanings';
import { registerPlannedMediaCapabilities } from '../src/capabilities/registerPlannedMedia';

let n = 0;
let f = 0;
const check = (ok: boolean, name: string) => { n++; if (!ok) { f++; console.log('FAIL ' + name); } };

// ---------- A: pins and connection audit
check(ORCHESTRATOR_MODE === 'shadow', 'A01 the shipped mode is pinned to shadow (changing it is a decision: update this pin in the activation job)');
const walk = (dir: string): string[] => readdirSync(dir).flatMap((name) => { const p = join(dir, name); return statSync(p).isDirectory() ? walk(p) : p.endsWith('.ts') || p.endsWith('.tsx') ? [p] : []; });
const src = walk('src').map((p) => p.split('\\').join('/'));
const buildsOne = src.filter((p) => readFileSync(p, 'utf8').includes('createOrchestrator(') && !p.startsWith('src/brain/mind/orchestrator/'));
check(buildsOne.length === 1 && buildsOne[0] === 'src/brain/orchestratedBrain.ts', 'A02 exactly one place in src builds an orchestrator: ' + buildsOne.join(','));
const indexText = readFileSync('src/brain/index.ts', 'utf8');
check(indexText.includes('withOrchestrator(mind, { mode: ORCHESTRATOR_MODE })'), 'A03 getAxonBrain wraps the Mind with the pinned mode');
check(readFileSync('src/services/axonBrainInterface.ts', 'utf8').includes('getAxonBrain().ask('), 'A04 the chat boundary still asks getAxonBrain (one door)');
check(!indexText.includes("mode: 'on'"), 'A05 nothing in index.ts switches the orchestrator on');

// ---------- B: wrapper laws (fake Mind)
type R = { content: string; source: string; taskId?: string; leadParagraph?: string };
const ran = (body: string) => body + '\n\nRan as task task-1: COMPLETED in 0 ms, from your exact input.';
const GOOD: R = { content: ran('That text has 3 words.\n\nWords: 3\nCharacters: 14 (12 without spaces)\nLetters: 12\nLines: 1'), source: 'runner:text-counter', taskId: 'task-1', leadParagraph: 'lead' };
const BAD: R = { ...GOOD, content: GOOD.content.replace('Words: 3', 'Words: 9') };
const MSG = 'count words in "red blue green"';
function fakeMind(reply: R | ((t: string) => R), delay = 0) {
  const seen: string[] = [];
  let resets = 0;
  const trace = { entries: [], utterance: { id: 'u' } };
  const mind = {
    seen,
    get resets() { return resets; },
    async askWithTrace(request: { text: string; place: string }) { seen.push(request.text); if (delay) await new Promise((r) => setTimeout(r, delay)); const r = typeof reply === 'function' ? reply(request.text) : reply; return { reply: r, trace }; },
    async ask(request: { text: string; place: string }) { return (await mind.askWithTrace(request)).reply; },
    sources: () => ({ connected: [], planned: [] }),
    resetDialogue: () => { resets++; },
    dialogueSnapshot: () => ({}),
  };
  return { mind, trace };
}
const wrap = (m: ReturnType<typeof fakeMind>, options: Parameters<typeof withOrchestrator>[1]) => withOrchestrator(m.mind as never, options);

{ // shadow: same reply and trace objects, one Mind call, recorded
  const m = fakeMind(GOOD);
  const b = wrap(m, { mode: 'shadow' });
  const out = await b.askWithTrace({ text: MSG, place: 'chat' });
  check(out.reply === (await m.mind.askWithTrace({ text: MSG, place: 'chat' })).reply, 'B01 shadow returns the Mind reply object itself');
  m.mind.seen.length = 0;
  const m2 = fakeMind(GOOD);
  const b2 = wrap(m2, { mode: 'shadow' });
  const o2 = await b2.askWithTrace({ text: MSG, place: 'chat' });
  check(o2.reply === GOOD && o2.trace === m2.trace, 'B02 shadow: reply and trace are the very objects the Mind made');
  check(m2.mind.seen.length === 1 && m2.mind.seen[0] === MSG, 'B03 shadow: the Mind ran ONCE, on the owner\'s exact words');
  const st = b2.orchestratorStatus();
  check(st.mode === 'shadow' && st.messages === 1 && st.failures === 0 && st.timeouts === 0 && st.fallbacks === 0 && st.orchestratorReplies === 0, 'B04 shadow status counts');
  check(st.stats !== null && (st.stats as Record<string, number>).rechecked === 1 && (st.stats as Record<string, number>).recheckPassed === 1, 'B05 shadow: the orchestrator rechecked the tool answer and it passed');
  check(b2.recentOrchestrations().length === 1 && b2.recentOrchestrations()[0].verification?.report.overall === 'PASSED', 'B06 shadow: the orchestration is recorded');
}
{ // shadow with a tampered tool answer: recorded, never changed
  const m = fakeMind(BAD);
  const b = wrap(m, { mode: 'shadow' });
  const out = await b.ask({ text: MSG, place: 'chat' });
  check(out === BAD && m.mind.seen.length === 1, 'B07 shadow: a failed recheck is recorded but the owner still gets the Mind reply (nothing changes in shadow)');
  check(b.recentOrchestrations()[0].verification?.report.overall === 'FAILED' && b.orchestratorStatus().orchestratorReplies === 0, 'B08 shadow: the failure shows in the record');
}
{ // repair in shadow: exact words reach the Mind
  const m = fakeMind(GOOD);
  const b = wrap(m, { mode: 'shadow' });
  await b.ask({ text: 'how much words are in "red blue green"', place: 'chat' });
  check(m.mind.seen.length === 1 && m.mind.seen[0] === 'how much words are in "red blue green"', 'B09 shadow: a message the repair would change still reaches the Mind exactly as typed');
}
{ // off: no orchestrator built
  let built = 0;
  const m = fakeMind(GOOD);
  const b = withOrchestrator(m.mind as never, { mode: 'off', create: () => { built++; throw new Error('must not be built'); } });
  const out = await b.ask({ text: MSG, place: 'chat' });
  check(built === 0 && out === GOOD && m.mind.seen.length === 1 && b.orchestratorStatus().stats === null, 'B10 off: pass-through, orchestrator not built');
}
{ // failure before the Mind is asked: one fallback call
  const m = fakeMind(GOOD);
  const b = wrap(m, { mode: 'shadow', create: () => ({ ask: async () => { throw new Error('boom before the brain'); }, stats: () => ({}), resetDialogue: () => {} }) });
  const out = await b.ask({ text: MSG, place: 'chat' });
  const st = b.orchestratorStatus();
  check(out === GOOD && m.mind.seen.length === 1 && st.failures === 1 && st.fallbacks === 1, 'B11 orchestrator fails before the Mind: the Mind is asked exactly once, directly');
}
{ // failure after the Mind answered: the Mind is NOT asked again
  const m = fakeMind(GOOD);
  const b = wrap(m, { mode: 'shadow', create: (brain) => ({ ask: async (r) => { await brain.askWithTrace(r); throw new Error('boom after the brain'); }, stats: () => ({}), resetDialogue: () => {} }) });
  const out = await b.ask({ text: MSG, place: 'chat' });
  const st = b.orchestratorStatus();
  check(out === GOOD && m.mind.seen.length === 1 && st.failures === 1 && st.fallbacks === 0, 'B12 orchestrator fails after the Mind: the Mind answer is reused, NO second execution');
  const b2 = wrap(fakeMind(GOOD), { mode: 'on', create: (brain) => ({ ask: async (r) => { await brain.askWithTrace(r); throw new Error('boom'); }, stats: () => ({}), resetDialogue: () => {} }) });
  const m3 = fakeMind(GOOD);
  const b3 = wrap(m3, { mode: 'on', create: (brain) => ({ ask: async (r) => { await brain.askWithTrace(r); throw new Error('boom'); }, stats: () => ({}), resetDialogue: () => {} }) });
  const o3 = await b3.ask({ text: MSG, place: 'chat' });
  check(o3 === GOOD && m3.mind.seen.length === 1 && b2.orchestratorStatus().mode === 'on', 'B13 mode on: same law, a failure after the Mind never runs it twice');
}
{ // synchronous throw while building
  const m = fakeMind(GOOD);
  const b = wrap(m, { mode: 'shadow', create: () => { throw new Error('cannot build'); } });
  const out = await b.ask({ text: MSG, place: 'chat' });
  check(out === GOOD && m.mind.seen.length === 1 && b.orchestratorStatus().failures === 1, 'B14 an orchestrator that cannot be built leaves the chat working on the plain Mind');
}
{ // never-ending orchestrator after the Mind answered (shadow): chat does not wait
  const m = fakeMind(GOOD);
  const b = wrap(m, { mode: 'shadow', settleMs: 25, create: (brain) => ({ ask: async (r) => { await brain.askWithTrace(r); await new Promise(() => {}); return null as never; }, stats: () => ({}), resetDialogue: () => {} }) });
  const t0 = Date.now();
  const out = await b.ask({ text: MSG, place: 'chat' });
  check(out === GOOD && Date.now() - t0 < 1000 && b.orchestratorStatus().timeouts === 1 && m.mind.seen.length === 1, 'B15 shadow: a stuck orchestrator never holds the reply (timeout counted, one Mind call)');
}
{ // a slow Mind is NOT cut off by the shadow guard (the guard starts only after the Mind answered)
  const m = fakeMind(GOOD, 120);
  const b = wrap(m, { mode: 'shadow', settleMs: 25 });
  const out = await b.ask({ text: MSG, place: 'chat' });
  check(out === GOOD && b.orchestratorStatus().timeouts === 0 && b.orchestratorStatus().stats !== null && b.recentOrchestrations().length === 1, 'B16 a slow Mind is awaited in full; the orchestrator still records');
}
{ // memory bounded; messages in order
  const m = fakeMind((t) => ({ content: 'echo ' + t, source: 'foundation' }));
  const b = wrap(m, { mode: 'shadow', keep: 3 });
  for (let i = 0; i < 8; i++) await b.ask({ text: 'message ' + i, place: 'chat' });
  check(b.recentOrchestrations().length === 3 && b.orchestratorStatus().messages === 8 && m.mind.seen.join('|') === Array.from({ length: 8 }, (_, i) => 'message ' + i).join('|'), 'B17 only the last 3 orchestrations are kept; 8 messages ran once each, in order');
  const parallel = fakeMind((t) => ({ content: t, source: 'foundation' }), 5);
  const pb = wrap(parallel, { mode: 'shadow' });
  const rs = await Promise.all(['a', 'b', 'c', 'd'].map((t) => pb.ask({ text: t, place: 'chat' })));
  check(rs.map((r) => r.content).join('') === 'abcd' && parallel.mind.seen.join('') === 'abcd', 'B18 overlapping asks are served one at a time, each answered with its own reply');
}
{ // reset reaches both the Mind and the orchestrator
  const m = fakeMind(GOOD);
  const b = wrap(m, { mode: 'shadow' });
  b.resetDialogue();
  check(m.mind.resets === 1, 'B19 resetDialogue reaches the Mind');
  let orchestratorResets = 0;
  const b2 = wrap(fakeMind(GOOD), { mode: 'shadow', create: () => ({ ask: async () => { throw new Error('x'); }, stats: () => ({}), resetDialogue: () => { orchestratorResets++; throw new Error('a reset must not break the chat'); } }) });
  let threw = false;
  try { b2.resetDialogue(); } catch { threw = true; }
  check(orchestratorResets === 1 && !threw, 'B20 resetDialogue reaches the orchestrator and its failure never breaks the chat');
}
{ // mode on (NOT shipped): the return path works and keeps the screen fields
  const m = fakeMind(BAD);
  const b = wrap(m, { mode: 'on' });
  const out = await b.ask({ text: MSG, place: 'chat' });
  check(out.source === 'orchestrator:verify' && out.content.startsWith('I ran text-counter, but my own re-check did not match') && out.taskId === 'task-1' && m.mind.seen.length === 1, 'B21 on: a failed recheck is held back, once, and the reply keeps its task id');
  check(b.orchestratorStatus().orchestratorReplies === 1, 'B22 on: the orchestrator reply is counted');
  const asked = fakeMind(GOOD);
  const ba = wrap(asked, { mode: 'on' });
  const q = await ba.ask({ text: 'Delete the file. Delete the file.', place: 'chat' });
  check(q.source === 'orchestrator:repair' && q.content === 'Did you mean: "Delete the file."?' && asked.mind.seen.length === 0, 'B23 on: a repair question reaches the owner without running the Mind');
  const fixed = fakeMind(GOOD);
  const bf = wrap(fixed, { mode: 'on' });
  const r = await bf.ask({ text: 'how much words are in "red blue green"', place: 'chat' });
  check(r.content.startsWith('I read your message as: how many words are in "red blue green"\n\n') && r.leadParagraph === 'lead' && r.source === 'runner:text-counter' && fixed.mind.seen[0] === 'how many words are in "red blue green"', 'B24 on: a repaired message says so, keeps the Mind\'s other screen fields');
  const keep = fakeMind(GOOD);
  const bk = wrap(keep, { mode: 'on' });
  check((await bk.ask({ text: MSG, place: 'chat' })) === GOOD, 'B25 on: an unchanged answer is the Mind\'s own object');
}

// ---------- C: the REAL chat pathway (the same capability registrations src/main.tsx makes at start-up)
registerSettingsCapability(); registerAxonToolsCapability(); registerEngineTools(); registerAxonSourceCapability(); registerInterfaceCaptureCapability(); registerScreenIntelligenceCapability();
registerBackgroundProofCapability(); registerScreenReaderCapability(); registerDictionaryCapability(); registerPlannedCapabilities(); registerTaughtMeaningsCapability(); registerPlannedMediaCapabilities();
const dictionary = await Dictionary.open({ read: async (p: string) => readFile(join(process.cwd(), 'public/dictionary/en', p), 'utf8'), hash: (t: string) => createHash('sha256').update(t, 'utf8').digest('hex') });
const slot = createDictionarySlot(async () => dictionary);
rebuildChatBrainForTests(slot);
const before = getOrchestratorStatus();
check(before !== null && before.mode === 'shadow', 'C01 the real brain is wrapped, mode shadow');
const reset0 = before?.messages ?? 0;
const plain = await createAxonBrain({ lane: true, slot }).ask({ text: 'count words in "hello brave new world"', place: 'chat' });
const chat = await sendQueryToAxonBoundary('count words in "hello brave new world"');
const after = getOrchestratorStatus();
const strip = (s: string) => { const i = s.indexOf('\n\nRan as task'); return i < 0 ? s : s.slice(0, i); };
check(after !== null && after.messages === reset0 + 1, 'C02 one real chat message reached the orchestrator exactly once');
check(chat.role === 'assistant' && chat.source === plain.source && strip(chat.content) === strip(plain.content), 'C03 the chat reply is the same as the plain brain\'s (source ' + chat.source + ')');
check(chat.content.includes('Words: 4'), 'C04 the real reply carries the right answer');
const rec = (getAxonBrain() as unknown as { recentOrchestrations(): { verification: { report: { overall: string } } | null }[] }).recentOrchestrations();
check(rec.length >= 1 && rec[rec.length - 1].verification?.report.overall === 'PASSED', 'C05 the orchestrator rechecked the real tool answer independently (PASSED)');
check(after !== null && after.failures === 0 && after.timeouts === 0 && after.fallbacks === 0 && after.orchestratorReplies === 0, 'C06 no failure, timeout, fallback or orchestrator reply in the real chat');
const chat2 = await sendQueryToAxonBoundary('hello');
check(chat2.role === 'assistant' && chat2.content.length > 0 && getOrchestratorStatus()?.messages === reset0 + 2, 'C07 a non-tool message also flows through once');
resetAxonDialogue();
check(getOrchestratorStatus()?.messages === reset0 + 2, 'C08 a new chat resets the dialogue without losing the counters');
// the orchestrator class itself still works unwrapped (nothing else changed)
check(typeof createOrchestrator(fakeMind(GOOD).mind as never).resetDialogue === 'function', 'C09 the orchestrator exposes resetDialogue');

console.log(`orchestratorConnection: ${n} checks; ${f} failed`);
if (f > 0) process.exitCode = 1;
