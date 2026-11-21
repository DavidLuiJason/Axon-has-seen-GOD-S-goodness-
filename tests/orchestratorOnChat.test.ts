// JOB 3 + JOB 4 + JOB 6a (D111): with the orchestrator ON, the real chat pathway repairs, asks, verifies and handles answers.
// Every message goes through sendQueryToAxonBoundary (the chat's real door) unless a check says otherwise. Replies are compared with the PLAIN brain.
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { createAxonBrain, getAxonBrain, getOrchestratorStatus, rebuildChatBrainForTests } from '../src/brain';
import { withOrchestrator } from '../src/brain/orchestratedBrain';
import { ORCHESTRATOR_MODE } from '../src/brain/orchestratorMode';
import { repairMessage } from '../src/brain/mind/repair/repair';
import { CANCEL_REPLY, TEXT_QUESTION } from '../src/brain/mind/orchestrator/dialogueQuestions';
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
const plain = async (text: string) => { const r = await createAxonBrain({ lane: true, slot }).ask({ text, place: 'chat' }); return { source: r.source, content: steady(r.content) }; };
const chat = async (text: string) => { const r = await say(text); return { source: r.source ?? '', content: steady(r.content) }; };
const sameAsPlain = async (text: string, got: { source: string; content: string }) => { const p = await plain(text); return p.source === got.source && p.content === got.content; };
const DOUBLE = 'Delete the file. Delete the file.';
const ASK = 'Did you mean: "Delete the file."?';

check(ORCHESTRATOR_MODE === 'on' && getOrchestratorStatus()?.mode === 'on', 'P00 the chat brain runs with the orchestrator ON');

// ---- JOB 3: repair
{ resetAxonDialogue();
  const a = await chat('how much words are in "red blue green"');
  check(a.source === 'runner:text-counter' && a.content.startsWith('I read your message as: how many words are in "red blue green"\n\n') && a.content.includes('Words: 3'), 'R01 a grammar slip is repaired, said out loud, and answered');
  const b = await chat('count words in "one two three". count words in "one two three".');
  check(b.source === 'runner:text-counter' && b.content.includes('Words: 3') && b.content.startsWith('I read your message as: '), 'R02 a doubled request is repaired and answered once');
  const c = await chat('count words in "the the the cat. the the the cat."');
  check(c.source === 'runner:text-counter' && !c.content.startsWith('I read your message as') && c.content.includes('Words: 8'), 'R03 repeated words INSIDE quotes are the owner\'s text and are never repaired');
  const d = await chat('count words in "a   b\n\nc"');
  check(d.content.includes('Words: 3') && d.content.includes('Lines: 3') && !d.content.startsWith('I read'), 'R04 spaces and line breaks inside quotes are kept exactly');
  const e = await chat('count words in "a b');
  check(!e.content.startsWith('I read your message as'), 'R05 an open quote is not "repaired"');
}
{ resetAxonDialogue(); // risky repair asks, then yes / no / cancel / moved on
  const q = await chat(DOUBLE);
  check(q.source === 'orchestrator:repair' && q.content === ASK, 'R10 a risky repair ASKS first and runs nothing');
  const yes = await chat('yes');
  check(await sameAsPlain('Delete the file.', yes), 'R11 yes runs the repaired reading (same as the plain brain on that text)');
  resetAxonDialogue();
  await chat(DOUBLE);
  const no = await chat('no');
  check(await sameAsPlain(DOUBLE, no), 'R12 no runs the owner\'s exact original words');
  resetAxonDialogue();
  await chat(DOUBLE);
  const cancel = await chat('cancel');
  check(cancel.source === 'orchestrator:dialogue' && cancel.content === CANCEL_REPLY, 'R13 cancel drops the request');
  check(await sameAsPlain('yes', await chat('yes')), 'R14 after a cancel, "yes" is an ordinary message (nothing stays pending)');
  resetAxonDialogue();
  await chat(DOUBLE);
  const moved = await chat('count words in "a b c"');
  check(moved.source === 'runner:text-counter' && moved.content.includes('Words: 3') && !moved.content.startsWith('I read'), 'R15 a new request after the question is answered normally');
  check(await sameAsPlain('yes', await chat('yes')), 'R16 and the old question is gone: a later "yes" is an ordinary message');
  resetAxonDialogue();
  await chat(DOUBLE);
  await chat('hello');
  check(await sameAsPlain('yes', await chat('yes')), 'R17 any unrelated message drops the question; "yes" two turns later does not resurrect it');
  resetAxonDialogue();
  await chat(DOUBLE);
  resetAxonDialogue();
  check(await sameAsPlain('yes', await chat('yes')), 'R18 a new chat clears an open repair question');
}
{ resetAxonDialogue(); // endless repair cycles
  const replies: string[] = [];
  for (let i = 0; i < 6; i++) replies.push((await chat(DOUBLE)).content);
  check(replies.every((r) => r === ASK), 'R20 the same doubled message six times: six identical questions, no escalation, no loop');
  const yes = await chat('yes');
  const again = await chat('yes');
  check(await sameAsPlain('Delete the file.', yes) && await sameAsPlain('yes', again), 'R21 one yes answers once; a second yes is ordinary (a question is never asked twice for one message)');
  const corpus = ['how much words are in "a b"', 'count words in "x". count words in "x".', 'I like fewer apples. I like fewer apples.', DOUBLE, 'how much words are in "a b c d"', 'sort these lines: "b\na". sort these lines: "b\na".'];
  let stable = true;
  for (const text of corpus) { const r = repairMessage({ text }); if (!r.ok) { stable = false; continue; } const again2 = repairMessage({ text: r.value.reading }); if (!again2.ok || again2.value.verdict !== 'KEEP') stable = false; }
  check(stable, 'R22 repairing an already repaired text changes nothing (one pass is enough, so a cycle cannot form)');
}

// ---- JOB 6a: "which text?" question
{ resetAxonDialogue();
  const q = await chat('convert to uppercase');
  check(q.source === 'orchestrator:dialogue' && q.content === TEXT_QUESTION, 'D01 a tool found without its text asks for the text');
  const a = await chat('hello brave world');
  check(a.source === 'runner:case-converter' && a.content.startsWith('HELLO BRAVE WORLD'), 'D02 the next message is used as the text and the tool runs');
  check(getOrchestratorStatus() !== null && (getOrchestratorStatus()?.stats as Record<string, number>).dialogueFilled >= 1, 'D03 the filled question is counted');
  resetAxonDialogue();
  await chat('convert to uppercase');
  const c = await chat('cancel');
  check(c.source === 'orchestrator:dialogue' && c.content === CANCEL_REPLY, 'D04 cancel drops the open question');
  check(await sameAsPlain('hello brave world', await chat('hello brave world')), 'D05 after a cancel the next text is an ordinary message');
  resetAxonDialogue();
  await chat('convert to uppercase');
  const r = await chat('count words in "a b"');
  check(r.source === 'runner:text-counter' && r.content.includes('Words: 2'), 'D06 a NEW request while a question is open is answered, not swallowed as text');
  resetAxonDialogue();
  await chat('convert to uppercase');
  await chat('count words in "x"'); await chat('count words in "x"'); await chat('count words in "x"');
  const late = await chat('hello brave world');
  check(await sameAsPlain('hello brave world', late), 'D07 a question that nobody answered for three turns expires');
  resetAxonDialogue();
  await chat('convert to uppercase');
  resetAxonDialogue();
  check(await sameAsPlain('hello brave world', await chat('hello brave world')), 'D08 a new chat clears an open text question');
}

// ---- JOB 4: verification and no duplicate execution (real brain, observed through a recording proxy)
{
  const mind = createAxonBrain({ lane: true, slot });
  const calls: { text: string; source: string }[] = [];
  let tamper = false;
  const proxy = {
    ...mind,
    async askWithTrace(request: { text: string; place: 'chat' | 'web' | 'apps' }) {
      const out = await mind.askWithTrace(request);
      calls.push({ text: request.text, source: out.reply.source });
      return tamper ? { ...out, reply: { ...out.reply, content: out.reply.content.replace('Words: 3', 'Words: 9') } } : out;
    },
    async ask(request: { text: string; place: 'chat' | 'web' | 'apps' }) { return (await proxy.askWithTrace(request)).reply; },
  };
  const brain = withOrchestrator(proxy as never, { mode: 'on' });
  const ok = await brain.ask({ text: 'count words in "red blue green"', place: 'chat' });
  check(ok.source === 'runner:text-counter' && ok.content.includes('Words: 3') && calls.length === 1, 'V01 a correct tool answer passes the independent recheck and is shown (one run)');
  tamper = true;
  const held = await brain.ask({ text: 'count words in "red blue green"', place: 'chat' });
  check(held.source === 'orchestrator:verify' && !held.content.includes('Words: 9') && held.content.startsWith('I ran text-counter, but my own re-check did not match'), 'V02 an answer that FAILS its recheck is held back, never reported as success');
  check(calls.length === 2, 'V03 the held-back answer ran the tool once, not again');
  tamper = false;
  calls.length = 0;
  await brain.ask({ text: 'convert to uppercase', place: 'chat' });
  await brain.ask({ text: 'hello brave world', place: 'chat' });
  const runs = calls.filter((c) => c.source.startsWith('runner:'));
  check(runs.length === 1 && runs[0].text === 'convert to uppercase "hello brave world"', 'V04 asking for text and using the answer runs the tool exactly ONCE (the probe of the answer never executes a tool)');
  const st = brain.orchestratorStatus();
  check(st.failures === 0 && st.timeouts === 0 && st.fallbacks === 0, 'V05 no failure, timeout or fallback');
  const unclear = await brain.ask({ text: 'calculate checksum of "123456789" using CRC32', place: 'chat' });
  check(unclear.source === 'runner:hash-tool' && unclear.content.includes('cbf43926'), 'V06 a tool without an independent check (UNCLEAR) is shown as the tool said it, not as verified');
}
const end = getOrchestratorStatus();
check(end !== null && end.failures === 0 && end.timeouts === 0 && end.fallbacks === 0, 'P99 over this whole run the real chat orchestrator had 0 failures, 0 timeouts, 0 fallbacks');
console.log(`orchestratorOnChat: ${n} checks; ${f} failed`);
if (f > 0) process.exitCode = 1;
