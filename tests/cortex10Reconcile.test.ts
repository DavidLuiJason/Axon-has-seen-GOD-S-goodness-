import { reconcileCommitment, type ReconciliationRequest, type ReconciliationSignal } from '../src/brain/mind/cortex/reconcile.ts';
import type { Item } from '../src/brain/mind/commitments/commitmentTypes.ts';

let checks = 0;
function assert(value: unknown, label: string): asserts value { checks += 1; if (!value) throw new Error(`FAIL: ${label}`); }
function trace(id: string) { return { id, stage: 'INPUT' as const, code: 'TYPED_MEANING', sourceRef: id, evidence: 'OBSERVED' as const }; }
function item(overrides: Partial<Item> = {}): Item {
  return { id: 'prior-1', kind: 'decision', subject: 'editor', value: 'blue', scope: 'user', scopeId: 'owner', authority: 'owner',
    status: 'active', sourceEvent: 'event-prior', confirmedBy: 'event-confirm', approvalToken: null, parent: null, condition: null,
    expiresAt: null, supersedes: null, why: null, created: 1700000000000, changed: 1700000000000, ...overrides };
}
function signal(overrides: Partial<ReconciliationSignal> = {}): ReconciliationSignal {
  return { id: 'signal-1', sourceEventRef: 'event-new', origin: 'owner', statementKind: 'decision', kind: 'decision',
    subject: 'editor', value: 'red', scope: 'user', scopeId: 'owner', targetPriorCommitmentId: null, intent: null,
    explicitChangeCue: false, retract: false, condition: null, replacementRef: 'replacement-1', observedAt: 1800000000000,
    repetitionCount: 1, trace: trace('signal-trace'), ...overrides };
}
function request(s: ReconciliationSignal, items: readonly Item[] = [], extra: Partial<ReconciliationRequest> = {}): ReconciliationRequest {
  return { signal: s, commitments: items, grants: [], approvalCheck: 'NOT_REQUIRED', irreversibleConflict: false, trace: trace('request-trace'), ...extra };
}
function main(): void {
  let r = reconcileCommitment(request(signal()));
  assert(r.ok && r.value.operation === 'ADD' && r.value.draft?.status === 'proposed', '01 new owner decision is only proposed as ADD');
  r = reconcileCommitment(request(signal({ origin: 'axon' })));
  assert(r.ok && r.value.operation === 'HOLD', '02 non-owner signal cannot establish a commitment');
  r = reconcileCommitment(request(signal({ statementKind: 'proposal' })));
  assert(r.ok && r.value.operation === 'HOLD', '03 proposal is not established');
  r = reconcileCommitment(request(signal({ statementKind: 'musing' })));
  assert(r.ok && r.value.operation === 'HOLD', '04 musing is not established');
  r = reconcileCommitment(request(signal({ statementKind: 'preference', kind: 'preference' })));
  assert(r.ok && r.value.operation === 'HOLD', '05 preference remains a proposal pending owner confirmation');
  r = reconcileCommitment(request(signal({ statementKind: 'hypothetical' })));
  assert(r.ok && r.value.operation === 'HOLD', '06 hypothetical is never a commitment');
  r = reconcileCommitment(request(signal({ statementKind: 'conditional' })));
  assert(r.ok && r.value.operation === 'HOLD', '07 conditional alone does not create a note');
  r = reconcileCommitment(request(signal({ statementKind: 'correction' })));
  assert(r.ok && r.value.operation === 'ASK', '08 correction without a target asks');
  r = reconcileCommitment(request(signal({ targetPriorCommitmentId: 'prior-1', intent: 'correct' }), [item()]));
  assert(r.ok && r.value.operation === 'ASK' && r.value.reasonCode === 'EXPLICIT_INTENT_REQUIRED', '09 intent without explicit change cue asks');
  r = reconcileCommitment(request(signal({ targetPriorCommitmentId: 'prior-1', explicitChangeCue: true }), [item()]));
  assert(r.ok && r.value.operation === 'ASK', '10 change cue without typed intent asks');
  r = reconcileCommitment(request(signal({ targetPriorCommitmentId: 'prior-1', intent: 'correct', explicitChangeCue: true }), [item()]));
  assert(r.ok && r.value.operation === 'REFINE' && r.value.preservationMarker === '[replaced 2023-11-14 by what: replacement-1]' && r.value.preservedItem?.value === 'blue', '11 correction preserves prior item with dated marker');
  r = reconcileCommitment(request(signal({ targetPriorCommitmentId: 'prior-1', intent: 'override', explicitChangeCue: true }), [item()]));
  assert(r.ok && r.value.operation === 'SUPERSEDE' && r.value.preservedItem?.id === 'prior-1', '12 deliberate reversal supersedes while retaining prior item');
  r = reconcileCommitment(request(signal({ targetPriorCommitmentId: 'prior-1', value: 'blue', intent: 'replace', explicitChangeCue: true, repetitionCount: 4 }), [item()]));
  assert(r.ok && r.value.operation === 'HOLD' && r.value.reasonCode === 'SAME_VALUE_NO_CHANGE', '13 repetition and same value never create a change');
  r = reconcileCommitment(request(signal({ targetPriorCommitmentId: 'prior-1', intent: null, explicitChangeCue: false }), [item()]));
  assert(r.ok && r.value.operation === 'ASK', '14 accidental later difference cannot silently supersede');
  const musing = reconcileCommitment(request(signal({ statementKind: 'musing' })));
  const laterDecision = reconcileCommitment(request(signal({ id: 'later', sourceEventRef: 'event-later' })));
  assert(musing.ok && musing.value.operation === 'HOLD' && laterDecision.ok && laterDecision.value.operation === 'ADD', '15 musing then decision keeps the decision distinct');
  const base = item({ kind: 'decision', subject: 'export-policy', value: 'keep-original' });
  r = reconcileCommitment(request(signal({ kind: 'exception', subject: 'export-policy', value: 'allow-copy-for-test', targetPriorCommitmentId: 'prior-1', intent: 'exception', explicitChangeCue: true, condition: 'test-only' }), [base]));
  assert(r.ok && r.value.operation === 'COEXIST' && r.value.draft?.parentId === 'prior-1' && r.value.preservationMarker === null, '16 general rule exception is a child and does not replace the base');
  const law = item({ kind: 'law', subject: 'source-untouchable', value: 'never-write' });
  r = reconcileCommitment(request(signal({ kind: 'law', subject: 'source-untouchable', value: 'write-allowed', targetPriorCommitmentId: 'prior-1', intent: 'override', explicitChangeCue: true }), [law]));
  assert(r.ok && r.value.operation === 'ASK' && r.value.requiresBrokerDecision, '17 protected law conflict without owner approval asks');
  r = reconcileCommitment(request(signal({ kind: 'law', subject: 'source-untouchable', value: 'new-law', targetPriorCommitmentId: 'prior-1', intent: 'override', explicitChangeCue: true }), [law], { approvalCheck: 'VERIFIED' }));
  assert(r.ok && r.value.operation === 'SUPERSEDE' && r.value.requiresBrokerDecision && r.value.requiresOwnerConfirmation, '18 approved protected change remains a proposal for broker and owner path');
  r = reconcileCommitment(request(signal({ scope: 'project', scopeId: 'project-1' })));
  assert(r.ok && r.value.operation === 'ASK' && r.value.reasonCode === 'SCOPE_NOT_VERIFIED', '19 project scope without verified grant asks');
  r = reconcileCommitment(request(signal({ targetPriorCommitmentId: 'prior-1', intent: 'override', explicitChangeCue: true, retract: true }), [item()]));
  assert(r.ok && r.value.operation === 'RETRACT' && r.value.preservationMarker !== null && r.value.preservedItem?.status === 'active', '20 explicit retraction preserves the replaced item');
  r = reconcileCommitment(request(signal({ targetPriorCommitmentId: 'prior-1', intent: 'override', explicitChangeCue: true }), [item()], { irreversibleConflict: true }));
  assert(r.ok && r.value.operation === 'ASK' && r.value.reasonCode === 'IRREVERSIBLE_CONFLICT_REQUIRES_OWNER', '21 irreversible conflict forces one owner decision');
  const withText = { ...signal(), text: 'not allowed' } as unknown as ReconciliationSignal;
  assert(!reconcileCommitment(request(withText)).ok, '22 raw message text is rejected at the typed boundary');
  console.log(`CORTEX part 10 passed: ${checks} checks`);
}
main();
