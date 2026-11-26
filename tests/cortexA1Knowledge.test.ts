import { gatherKnowledge } from '../src/brain/mind/cortex/adapters/cortexA1Knowledge.ts';
import type { CortexInput, TraceEntry } from '../src/brain/mind/cortex/cortexTypes.ts';
import { resolveKnowledgeNeed, type KnowledgeSourceBinding } from '../src/brain/mind/cortex/knowledgeNeed.ts';

function assertOk(value: unknown, label?: string): asserts value { if (!value) throw new Error(label ?? 'assertion failed'); }
const trace = (id: string): TraceEntry => ({ id, stage: 'INPUT', code: 'TEST', sourceRef: id, evidence: 'OBSERVED' });
function input(refs: readonly string[] = ['KNOWLEDGE_DICTIONARY']): CortexInput {
  const t = trace('clause-trace');
  return { objective: { originalRequestId: 'r', clauses: [{ id: 'c1', targetRef: 'target', meaning: {
    id: 'm', speechAct: 'QUESTION', conceptRefs: refs, slots: [], successTest: { id: 's', targetRef: 'target', operator: 'PRESENT', expected: true, trace: t },
    allowedSubgoalRefs: [], trace: t,
  }, trace: t }], trace: t }, constraints: [], candidateCapabilities: [], knowledgeHits: [], commitments: [], permissions: [],
  availableFacts: [], budget: { stepLimit: 1, timeClass: 'QUICK', tokenLimit: 100, deviceTier: 'MID', trace: t }, pendingQuestion: null, trace: t } as CortexInput;
}
function binding(verified = false): KnowledgeSourceBinding {
  return { sourceId: 'dict', kind: 'DICTIONARY', slot: {
    status: () => ({ ready: true, source: 'dictionary', version: '1' }),
    lookup: async () => ({ status: 'found', word: 'target', senses: [{ partOfSpeech: 'noun', meaning: 'meaning' }], source: 'dictionary', version: '1' }),
  }, trace: { ...trace('source'), evidence: verified ? 'VERIFIED' : 'REPORTED' } };
}
async function main(): Promise<void> {
  let checks = 0;
  const verify = (v: unknown, label: string) => { assertOk(v, label); checks += 1; };
  for (let i = 0; i < 12; i += 1) {
    const result = await gatherKnowledge(input(), async () => [binding(i % 2 === 0)]);
    verify(result.input.knowledgeHits.length === (i % 2 === 0 ? 1 : 0), `hand ${i}: only checked hit retained`);
    if (i % 2 === 0) verify(result.input.knowledgeHits[0]!.truth === 'VERIFIED', `hand ${i}: verified label`);
    else verify(result.failures.some((failure) => failure.endsWith('UNVERIFIED_KNOWLEDGE_SOURCE')), `hand ${i}: unverified result not an answer`);
  }
  const needTrace = trace('need');
  const need = { clauseId: 'pin', lookupRef: 'target', features: { dictionary: true, notes: false, archives: false }, trace: needTrace };
  const rawNeed = await resolveKnowledgeNeed(need, [binding()]);
  verify(rawNeed.ok && rawNeed.value.hits[0]?.trace.code === 'SOURCE_RETURNED_MATCH', 'knowledgeNeed trace code pinned');
  let noSourceLookupCalls = 0;
  const empty = await gatherKnowledge(input([]), async () => { noSourceLookupCalls += 1; return [binding()]; });
  verify(empty.input.knowledgeHits.length === 0 && empty.failures.length === 0 && noSourceLookupCalls === 1, 'knowledgeNeed called for clause without source feature');
  const staleInput = { ...input(), knowledgeHits: [{ id: 'stale', clauseId: 'c1', answerRef: 'stale-answer', sourceId: 'old', truth: 'REPORTED', trace: trace('old-hit') }] } as CortexInput;
  const stale = await gatherKnowledge(staleInput, async () => []);
  verify(stale.input.knowledgeHits.length === 0, 'unverified pre-existing hits cannot become answers');
  const thrown = await gatherKnowledge(input(), async () => { throw new Error('broken'); });
  verify(thrown.input.knowledgeHits.length === 0 && thrown.failures[0]?.endsWith('LOOKUP_UNKNOWN'), 'thrown lookup is unknown');
  const timeout = await gatherKnowledge(input(), () => new Promise<readonly KnowledgeSourceBinding[]>(() => undefined), { timeoutMs: 1 });
  verify(timeout.input.knowledgeHits.length === 0 && timeout.failures.length === 1, 'timeout is unknown');
  for (let i = 0; i < 5000; i += 1) {
    const result = await gatherKnowledge(input(), async () => { if (i % 2 === 0) throw new Error('generated'); return [binding(i % 3 === 0)]; });
    verify(result.input.knowledgeHits.every((hit) => hit.truth === 'VERIFIED'), `generated ${i}`);
    verify(result.input.knowledgeHits.length === 0 || result.input.knowledgeHits[0]!.answerRef === 'target', `generated source ${i}`);
  }
  let caught = 0;
  for (let i = 0; i < 8; i += 1) {
    const result = await gatherKnowledge(input(), async () => { throw new Error(`fault-${i}`); });
    if (result.input.knowledgeHits.length === 0 && result.failures.length === 1) caught += 1;
  }
  verify(caught === 8, '8 injected lookup faults caught');
  console.log(`CX-A1 PASS checks=${checks} generated=5000 fault-probes=${caught}/8`);
}
void main();
