
// JOB 13 tail + JOB 4 tail (D926): a chat reset forgets the old text handler's open question, and the old handler's counting answers get the independent recheck.
import { readFile } from 'node:fs/promises';
// Real chat door for the reset checks; a recording proxy (same technique as orchestratorOnChat V01-V06) for the recheck checks.
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { createAxonBrain, rebuildChatBrainForTests } from '../src/brain';
import { withOrchestrator } from '../src/brain/orchestratedBrain';
import { resetAxonDialogue, sendQueryToAxonBoundary as say } from '../src/services/axonBrainInterface';
import { Dictionary } from '../src/brain/dictionary';
import { createDictionarySlot } from '../src/brain/knowledge/dictionarySlot';
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
registerSettingsCapability(); registerAxonToolsCapability(); registerEngineTools(); registerAxonSourceCapability(); registerInterfaceCaptureCapability(); registerScreenIntelligenceCapability();
registerBackgroundProofCapability(); registerScreenReaderCapability(); registerDictionaryCapability(); registerPlannedCapabilities(); registerTaughtMeaningsCapability(); registerPlannedMediaCapabilities();
const dictionary = await Dictionary.open({ read: async (p: string) => readFile(join(process.cwd(), 'public/dictionary/en', p), 'utf8'), hash: (t: string) => createHash('sha256').update(t, 'utf8').digest('hex') });
const slot = createDictionarySlot(async () => dictionary);
rebuildChatBrainForTests(slot);

const steady = (s: string) => s.replace(/task-\d+/g, 'task-N').replace(/in \d+ ms/g, 'in N ms');
const stats = (b: { orchestratorStatus(): { stats?: unknown } }) => b.orchestratorStatus().stats as Record<string, number>;

// ---- reset (real chat door)
resetAxonDialogue();
const q = await say('count the lines');
check(q.source === 'local-rules' && q.content.startsWith('What text should I count?'), 'A01 the old handler asks which text to count');
resetAxonDialogue();
const after = await say('what is the weather');
check(after.source === 'foundation' && !after.content.includes('Words:'), 'A02 after a chat reset the next message is NOT taken as the answer to the forgotten question');
await say('count the lines');
const answered = await say('red blue green');
check(answered.source === 'local-rules' && answered.content.includes('Lines: 1') && answered.content.includes('Words: 3'), 'A03 without a reset the answer to the question is still counted (the question flow is not broken)');
resetAxonDialogue();
const cancelled = await say('count the words');
check(cancelled.content.startsWith('What text should I count?'), 'A04 a fresh question works after a reset');

// ---- recheck of the old handler's answers (recording proxy)
{
  const mind = createAxonBrain({ lane: true, slot });
  let tamper: ((c: string) => string) | null = null;
  let forceSource: string | null = null;
  const proxy = {
    ...mind,
    async askWithTrace(request: { text: string; place: 'chat' | 'web' | 'apps' }) {
      const out = await mind.askWithTrace(request);
      if (forceSource !== null) return { ...out, reply: { ...out.reply, source: forceSource, content: 'Done, I did it. Ran as task task-1: COMPLETED in 0 ms.' } };
      return tamper ? { ...out, reply: { ...out.reply, content: tamper(out.reply.content) } } : out;
    },
    async ask(request: { text: string; place: 'chat' | 'web' | 'apps' }) { return (await proxy.askWithTrace(request)).reply; },
  };
  const brain = withOrchestrator(proxy as never, { mode: 'on' });
  const s0 = { ...stats(brain) };
  await brain.ask({ text: 'count the lines', place: 'chat' });
  const good = await brain.ask({ text: 'red blue green', place: 'chat' });
  const s1 = { ...stats(brain) };
  check(good.source === 'local-rules' && good.content.includes('Words: 3'), 'B01 the old handler answered the pending question');
  check(s1.recheckPassed === s0.recheckPassed + 1 && s1.rechecked === s0.rechecked + 1, 'B02 that old-handler answer was rechecked from the whole message and PASSED');
  // wrong count, no quote: the counted text cannot be told, so UNCLEAR and shown (never a false FAILED)
  tamper = (c) => c.replace('Words: 3', 'Words: 9');
  await brain.ask({ text: 'count the lines', place: 'chat' });
  const unclear = await brain.ask({ text: 'red blue green', place: 'chat' });
  const s2 = { ...stats(brain) };
  check(unclear.source === 'local-rules' && s2.recheckUnclear === s1.recheckUnclear + 1 && s2.recheckFailed === s1.recheckFailed, 'B03 a count that does not match an unquoted message is UNCLEAR, not FAILED');
  // wrong count over a QUOTED answer: the quoted text is known, so FAILED and held back
  await brain.ask({ text: 'count the lines', place: 'chat' });
  const held = await brain.ask({ text: '"red blue green"', place: 'chat' });
  const s3 = { ...stats(brain) };
  check(s3.recheckFailed === s2.recheckFailed + 1 && held.source === 'orchestrator:verify' && !held.content.includes('Words: 9'), 'B04 a wrong count over a quoted text FAILS the recheck and is held back, never shown as success');
  tamper = null;
  // a non-tool reply that claims a task ran is recorded as a problem
  forceSource = 'foundation';
  const p0 = stats(brain).problems;
  await brain.ask({ text: 'hello there', place: 'chat' });
  check(stats(brain).problems === p0 + 1, 'B05 a reply that says a task ran but came from no tool lane is recorded as a problem');
  forceSource = null;
  const st = brain.orchestratorStatus();
  check(st.failures === 0 && st.timeouts === 0 && st.fallbacks === 0, 'B06 no failure, timeout or fallback');
}
console.log(`recheckAndReset: ${n} checks; ${f} failed`);
if (f > 0) process.exitCode = 1;
