import { signalsFromEvents, type CommitmentSignalEvent } from '../src/brain/mind/cortex/adapters/cortexA3CommitmentSignals.ts';
import { reconcileCommitment } from '../src/brain/mind/cortex/reconcile.ts';
import type { CommitmentReference, TraceEntry } from '../src/brain/mind/cortex/cortexTypes.ts';
import type { Item } from '../src/brain/mind/commitments/commitmentTypes.ts';

function assertOk(value: unknown, label?: string): asserts value { if (!value) throw new Error(label ?? 'assertion failed'); }
const trace = (id: string): TraceEntry => ({ id, stage: 'INPUT', code: 'TEST', sourceRef: id, evidence: 'OBSERVED' });
const commitment = (kind: CommitmentReference['kind'] = 'LAW'): CommitmentReference => ({
  id: 'commit1', clauseId: null, kind, status: 'ACTIVE', valueRef: 'value1', trace: trace('old'),
});
const item: Item = { id: 'commit1', kind: 'law', subject: 'subject', value: 'old-value', scope: 'user', scopeId: 'owner',
  authority: 'owner', status: 'active', sourceEvent: 'source', confirmedBy: 'owner-event', approvalToken: null, parent: null,
  condition: null, expiresAt: null, supersedes: null, why: null, created: 1000, changed: 1000 };
const request = {
  signal: { id: 'old-signal', sourceEventRef: 'old-event', origin: 'owner', statementKind: 'decision', kind: 'law',
    subject: 'subject', value: 'new-value', scope: 'user', scopeId: 'owner', targetPriorCommitmentId: 'commit1',
    intent: 'replace', explicitChangeCue: true, retract: false, condition: null, replacementRef: 'replacement',
    observedAt: 2000, repetitionCount: 0, trace: trace('old-signal') },
  commitments: [item], grants: [], approvalCheck: 'VERIFIED', irreversibleConflict: false, trace: trace('request'),
} as const;
const event = (id: string, kind: CommitmentSignalEvent['kind'], byOwner: boolean): CommitmentSignalEvent =>
  ({ id, kind, targetCommitmentId: 'commit1', byOwner, trace: trace(id) });

async function main(): Promise<void> {
  let checks = 0;
  const verify = (v: unknown, label: string) => { assertOk(v, label); checks += 1; };
  for (let i = 0; i < 12; i += 1) {
    const byOwner = i % 2 === 0;
    const result = signalsFromEvents([event(`e${i}`, 'REPLACE', byOwner)], { commitments: [commitment()] });
    verify(result.commitments.length === (byOwner ? 1 : 2), `hand ${i}: reference count`);
    verify(result.commitments[byOwner ? 0 : 1]!.status === (byOwner ? 'ACTIVE' : 'PROPOSED'), `hand ${i}: owner gate`);
    verify(result.commitments[byOwner ? 0 : 1]!.trace.sourceRef === `e${i}`, `hand ${i}: trace retained`);
    if (!byOwner) verify(result.commitments[0]!.status === 'ACTIVE', `hand ${i}: protected source preserved`);
  }
  const eventKinds: readonly CommitmentSignalEvent['kind'][] = ['REPLACE', 'CORRECT'];
  for (const kind of eventKinds) {
    const result = signalsFromEvents([event('owner-event', kind, true)], { commitments: [commitment('DECISION')], reconciliationByEvent: { 'owner-event': request } });
    verify(result.reconciliationRequests.length === 1, `${kind} creates typed request`);
    verify(result.reconciliationRequests[0]!.signal.origin === 'owner', `${kind} owner origin`);
  }
  const chatRequest = signalsFromEvents([event('chat-event', 'OVERRIDE', false)], { commitments: [commitment()], reconciliationByEvent: { 'chat-event': request } });
  verify(chatRequest.reconciliationRequests[0]!.signal.statementKind === 'proposal', 'chat event is proposed');
  verify(chatRequest.reconciliationRequests[0]!.signal.intent === null, 'chat event cannot express change intent');
  const pinned = reconcileCommitment({ ...request, signal: { ...request.signal, origin: 'axon' } });
  verify(pinned.ok && pinned.value.reasonCode === 'NON_OWNER_CANNOT_ESTABLISH', 'reconcile reason code pinned');
  for (let i = 0; i < 5000; i += 1) {
    const byOwner = i % 2 === 0;
    const result = signalsFromEvents([event(`generated-${i}`, i % 3 === 0 ? 'CORRECT' : 'REPLACE', byOwner)], { commitments: [commitment()] });
    verify(result.commitments[byOwner ? 0 : 1]!.status === (byOwner ? 'ACTIVE' : 'PROPOSED'), `generated ${i}`);
    verify(result.reconciliationRequests.length === 0, `generated no implicit request ${i}`);
  }
  let caught = 0;
  for (let i = 0; i < 8; i += 1) {
    const invalid = [{ ...event(`bad-${i}`, 'REPLACE', false), extra: true }] as unknown as readonly CommitmentSignalEvent[];
    const result = signalsFromEvents(invalid, { commitments: [commitment()] });
    if (result.reconciliationRequests.length === 0 && result.commitments.length === 1 && result.commitments[0]!.status === 'ACTIVE') caught += 1;
  }
  verify(caught === 8, '8 malformed-event fault probes caught');
  console.log(`CX-A3 PASS checks=${checks} generated=5000 fault-probes=${caught}/8`);
}
void main();
