// JOB 2 (D926): the judgment situation is BUILT from the tool's declared schema, how the message was read and what the recheck found (not written by hand).
// Pure checks over every schema, then the real brain through the orchestrator to see the judgment note in the trace.
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { createAxonBrain, rebuildChatBrainForTests } from '../src/brain';
import { withOrchestrator } from '../src/brain/orchestratedBrain';
import { buildSituation } from '../src/brain/mind/orchestrator/situation';
import { judgeProposal } from '../src/brain/mind/judgment/judge';
import { listSchemas, getSchema } from '../src/brain/mind/schema/actionSchemas';
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
const sit = (toolId: string, evidence: 'VERIFIED' | 'UNKNOWN' | 'DISPUTED' = 'VERIFIED', repairVerdict: 'KEEP' | 'REPAIRED' | 'ASK' | 'NONE' = 'KEEP', missingInputs: string[] = []) => {
  const s = buildSituation({ id: 't', toolId, repairVerdict, evidence, missingInputs });
  const j = judgeProposal(s.proposal);
  return { s, j: j.ok ? j.value : null };
};
const schemas = listSchemas();

// ---- every declared schema builds a valid situation and gets a verdict
check(schemas.length > 40 && schemas.every((x) => sit(x.tool).j !== null), 'S01 every one of ' + schemas.length + ' declared schemas builds a Proposal the judgment engine accepts');
// ---- pure read tools: a verified answer proceeds with no flag
const pure = schemas.filter((x) => x.effects.length === 1 && x.effects[0] === 'shows-result' && x.preconditions.length === 0);
check(pure.length > 10 && pure.every((x) => { const r = sit(x.tool); return r.j?.verdict === 'PROCEED' && r.j.flags.length === 0 && r.s.proposal.actionKind === 'READ'; }), 'S02 every plain "shows a result" tool (' + pure.length + ') is a READ and a verified answer PROCEEDS with no flag');
// ---- declared risk drives the verdict
const approval = schemas.filter((x) => (x.preconditions as readonly string[]).includes('owner-approval'));
check(approval.length >= 3 && approval.every((x) => sit(x.tool).j?.verdict === 'ASK'), 'S03 every tool that declares owner-approval ASKS (' + approval.length + ' tools)');
const irreversible = schemas.filter((x) => x.undo === 'irreversible');
check(irreversible.length >= 1 && irreversible.every((x) => { const r = sit(x.tool); return r.s.proposal.reversible === false && r.j !== null && r.j.verdict !== 'PROCEED' && r.j.flags.some((fl) => fl.seat === 'TIME'); }), 'S04 an irreversible tool is flagged by the TIME seat and never simply proceeds');
const ac = getSchema('auto-clicker');
check(ac !== null && sit('auto-clicker').s.proposal.actionKind === 'WRITE' && sit('auto-clicker').j?.verdict === 'ASK', 'S05 the auto-clicker (changes a setting, irreversible, owner approval) is a WRITE that ASKS');
const deleting = schemas.filter((x) => (x.effects as readonly string[]).includes('deletes'));
check(deleting.length >= 1 && deleting.every((x) => sit(x.tool).s.proposal.actionKind === 'DELETE'), 'S06 a tool that deletes is a DELETE');
const writing = schemas.filter((x) => (x.effects as readonly string[]).includes('writes-file') && !(x.effects as readonly string[]).includes('deletes'));
check(writing.length >= 1 && writing.every((x) => sit(x.tool).s.proposal.actionKind === 'WRITE'), 'S07 a tool that writes a file is a WRITE');
// ---- how the message was read and what the recheck found
const med = sit('text-counter', 'VERIFIED', 'REPAIRED');
check(med.s.proposal.interpretation === 'MEDIUM' && med.j?.flags.length === 1 && med.j.flags[0].seat === 'PURPOSE' && med.j.verdict === 'PROCEED', 'S08 a repaired message lowers interpretation to MEDIUM: one low PURPOSE flag, still proceeds');
check(sit('text-counter', 'VERIFIED', 'ASK').j?.verdict === 'ASK', 'S09 a message the repair stage could not settle ASKS');
check(sit('text-counter', 'DISPUTED').j?.verdict === 'ASK', 'S10 a disputed recheck ASKS even for a read');
check(sit('text-counter', 'VERIFIED', 'KEEP', ['text']).j?.verdict === 'ASK', 'S11 a missing input ASKS');
check(sit('auto-clicker', 'UNKNOWN').j?.flags.some((fl) => fl.seat === 'CRITIC') === true, 'S12 an action with unknown evidence is also flagged by the CRITIC seat');
// ---- honesty about what is not known
const unknown = sit('no-such-tool');
check(unknown.s.proposal.actionKind === 'RUN' && unknown.s.basis[0].includes('no action schema'), 'S13 a tool with no schema is treated as RUN and the basis says so');
const dev = schemas.filter((x) => (x.preconditions as readonly string[]).includes('device-capable'));
check(dev.length >= 1 && dev.every((x) => sit(x.tool).s.proposal.dependenciesMet === false), 'S14 a declared device or network need is never claimed as met');
check(sit('text-counter').s.basis.length >= 2 && sit('text-counter').s.basis.every((line) => line.length > 0), 'S15 every situation carries a basis saying where each field came from');
// ---- real brain through the orchestrator: the judgment note is in the trace and the reply is unchanged
{
  const mind = createAxonBrain({ lane: true, slot });
  const brain = withOrchestrator(mind as never, { mode: 'on' });
  const out = await brain.ask({ text: 'count words in "red blue green"', place: 'chat' });
  const seen = brain.recentOrchestrations();
  const last = seen[seen.length - 1];
  check(out.source === 'runner:text-counter' && out.content.includes('Words: 3'), 'S16 the answer through the real brain is unchanged');
  check(last !== undefined && last.judgment?.verdict === 'PROCEED' && (last.judgmentBasis ?? [])[0]?.includes('schema text-counter') === true, 'S17 the orchestration holds a judgment built from the text-counter schema: ' + ((last?.judgmentBasis ?? [])[0] ?? 'none').slice(0, 70));
  const st = brain.orchestratorStatus();
  check(st.failures === 0 && st.timeouts === 0 && st.fallbacks === 0, 'S18 no failure, timeout or fallback');
}
console.log(`situation: ${n} checks; ${f} failed`);
if (f > 0) process.exitCode = 1;
