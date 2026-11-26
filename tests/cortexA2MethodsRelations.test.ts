import { chooseMethods } from '../src/brain/mind/cortex/adapters/cortexA2MethodsRelations.ts';
import type { CortexInput, TraceEntry, CandidateCapability } from '../src/brain/mind/cortex/cortexTypes.ts';
import type { RelationEdge } from '../src/brain/mind/cortex/relationReasoner.ts';

function assertOk(value: unknown, label?: string): asserts value { if (!value) throw new Error(label ?? 'assertion failed'); }
const trace = (id: string): TraceEntry => ({ id, stage: 'INPUT', code: 'TEST', sourceRef: id, evidence: 'OBSERVED' });
const edge = (id: string, fromRef: string, toRef: string): RelationEdge => ({
  id, fromRef, toRef, type: 'HYPONYM', evidence: 'VERIFIED', sourceRef: id, trace: trace(id),
});
function input(refs: readonly string[] = ['RULE_DEDUCTION']): CortexInput {
  const t = trace('clause');
  const cap: CandidateCapability = { id: 'cap1', clauseRefs: ['c1'], availability: 'AVAILABLE', preconditions: [], effects: [],
    slots: [], reversibility: 'REVERSIBLE', costClass: 'LOW', trace: t };
  return { objective: { originalRequestId: 'r', clauses: [{ id: 'c1', targetRef: 'task', meaning: {
    id: 'm', speechAct: 'REQUEST', conceptRefs: refs, slots: [], successTest: { id: 's', targetRef: 'task', operator: 'PRESENT', expected: true, trace: t },
    allowedSubgoalRefs: ['cap1'], trace: t,
  }, trace: t }], trace: t }, constraints: [{ id: 'constraint1', clauseId: null, targetRef: 'cap1', kind: 'REQUIRE', strength: 'HARD', valueRef: null, trace: t }],
  candidateCapabilities: [cap], knowledgeHits: [], commitments: [], permissions: [], availableFacts: [],
  budget: { stepLimit: 1, timeClass: 'QUICK', tokenLimit: 100, deviceTier: 'MID', trace: t }, pendingQuestion: null, trace: t } as CortexInput;
}
async function main(): Promise<void> {
  let checks = 0;
  const verify = (v: unknown, label: string) => { assertOk(v, label); checks += 1; };
  const deps = { relationSource: { relationsFrom: (ref: string) => ref === 'task' ? [edge('e1', 'task', 'RELATION_CATEGORY')] : ref === 'RELATION_CATEGORY' ? [edge('e2', 'RELATION_CATEGORY', 'cap1')] : [] } };
  for (let i = 0; i < 12; i += 1) {
    const refs = i % 2 === 0 ? ['RULE_DEDUCTION', 'RELATION_CATEGORY'] : ['EXACT_COMPUTATION', 'RELATION_CATEGORY'];
    const result = chooseMethods(input(refs), deps);
    verify(result.methods.length === 1, `hand ${i}: method row`);
    verify(result.methods[0]!.method === (i % 2 === 0 ? 'RULE_DEDUCTION' : 'EXACT_COMPUTATION'), `hand ${i}: selected method`);
    verify(result.candidateCapabilities.some((cap) => cap.id === 'cap1'), `hand ${i}: existing capability retained`);
    verify(result.constraints.some((constraint) => constraint.clauseId === 'c1'), `hand ${i}: relation constraint scoped`);
  }
  const noMethod = chooseMethods(input([]), deps);
  verify(noMethod.methods[0]!.method === null, 'no unsupported method');
  const noRelations = chooseMethods(input(['RULE_DEDUCTION']), { relationSource: { relationsFrom: () => [] } });
  verify(noRelations.candidateCapabilities.length === 1, 'unlinked category does not invent capability');
  for (let i = 0; i < 5000; i += 1) {
    const result = chooseMethods(input(i % 2 === 0 ? ['RULE_DEDUCTION', 'RELATION_CATEGORY'] : ['COUNTERFACTUAL', 'RELATION_CATEGORY']), deps);
    verify(result.methods.length === 1, `generated ${i}`);
    verify(result.candidateCapabilities.every((cap) => cap.availability === 'AVAILABLE' || cap.availability === 'UNAVAILABLE'), `generated capability ${i}`);
  }
  let caught = 0;
  for (let i = 0; i < 8; i += 1) {
    const result = chooseMethods(input([]), { relationSource: { relationsFrom: () => [] } });
    if (result.methods[0]?.method === null) caught += 1;
  }
  verify(caught === 8, '8 no-method fault probes caught');
  console.log(`CX-A2 PASS checks=${checks} generated=5000 fault-probes=${caught}/8`);
}
void main();
