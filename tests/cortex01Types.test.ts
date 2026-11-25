import {
  buildCortexInput,
  createDecisionRecord,
  type CortexInput,
  type DecisionRecord,
  type TraceEntry,
} from '../src/brain/mind/cortex/cortexTypes.ts';

let checks = 0;
function assert(value: unknown, label: string): asserts value {
  checks += 1;
  if (!value) throw new Error(`FAIL: ${label}`);
}
function trace(id: string): TraceEntry {
  return { id, stage: 'INPUT', code: 'SOURCE_RECORD', sourceRef: id, evidence: 'OBSERVED' };
}
function rawInput(): unknown {
  return {
    objective: {
      originalRequestId: 'request-1',
      clauses: [{
        id: 'clause-1', targetRef: 'target-1',
        meaning: {
          id: 'meaning-1', speechAct: 'REQUEST', conceptRefs: ['concept.add'],
          slots: [{ id: 'slot-a', kind: 'NUMBER', state: 'FILLED', valueRef: 'value-17', trace: trace('slot-trace') }],
          successTest: { id: 'success-1', targetRef: 'target-1', operator: 'RESOLVED', expected: true, trace: trace('success-trace') },
          allowedSubgoalRefs: ['target-1.detail'], trace: trace('meaning-trace'),
        },
        trace: trace('clause-trace'),
      }],
      trace: trace('objective-trace'),
    },
    constraints: [{ id: 'constraint-1', clauseId: 'clause-1', targetRef: 'target-1', kind: 'REQUIRE', strength: 'HARD', valueRef: 'value-17', trace: trace('constraint-trace') }],
    candidateCapabilities: [{
      id: 'cap-add', clauseRefs: ['clause-1'], availability: 'AVAILABLE', preconditions: [],
      effects: [{ kind: 'EFFECT', ref: 'result.ready', trace: trace('effect-trace') }],
      slots: [{ id: 'slot-a', required: true, state: 'FILLED', valueRef: 'value-17', trace: trace('cap-slot-trace') }],
      reversibility: 'REVERSIBLE', costClass: 'LOW', trace: trace('cap-trace'),
    }],
    knowledgeHits: [{ id: 'hit-1', clauseId: 'clause-1', answerRef: 'answer-1', sourceId: 'dictionary', truth: 'VERIFIED', trace: trace('hit-trace') }],
    commitments: [{ id: 'commit-1', clauseId: 'clause-1', kind: 'DECISION', status: 'ACTIVE', valueRef: 'decision-1', trace: trace('commit-trace') }],
    permissions: [{ capabilityId: 'cap-add', state: 'ALLOW', trace: trace('permission-trace') }],
    availableFacts: [],
    budget: { stepLimit: 4, timeClass: 'QUICK', tokenLimit: 1200, deviceTier: 'MID', trace: trace('budget-trace') },
    pendingQuestion: null,
    trace: trace('input-trace'),
  };
}
function record(decision: DecisionRecord['decision']): unknown {
  return {
    id: 'decision-record-1', decision,
    reasonCodes: { TYPE_VALID: true }, rejectedOptions: [], objectiveTrace: [trace('objective-record-trace')],
    successTest: { id: 'success-1', targetRef: 'target-1', operator: 'RESOLVED', expected: true, trace: trace('record-success-trace') },
    budgetUsed: { steps: 0, timeClass: 'QUICK', tokens: 0, deviceTier: 'MID', trace: trace('used-budget-trace') },
    evidenceLabels: ['VERIFIED'], trace: trace('decision-trace'),
  };
}

function main(): void {
  const source = rawInput() as Record<string, unknown>;
  const built = buildCortexInput(source);
  assert(built.ok, '01 valid typed Cortex input builds');

  const noObjective = { ...(rawInput() as object) } as Record<string, unknown>;
  delete noObjective.objective;
  assert(!buildCortexInput(noObjective).ok, '02 objective is required');

  const withRawText = rawInput() as Record<string, unknown>;
  const objective = withRawText.objective as Record<string, unknown>;
  const clauses = objective.clauses as Array<Record<string, unknown>>;
  const firstClause = clauses[0] as Record<string, unknown>;
  clauses[0] = { ...firstClause, meaning: { ...(firstClause.meaning as Record<string, unknown>), text: 'raw request text is forbidden' } };
  assert(!buildCortexInput(withRawText).ok, '03 Meaning records cannot carry message text');

  const emptyClauses = rawInput() as Record<string, unknown>;
  (emptyClauses.objective as Record<string, unknown>).clauses = [];
  assert(!buildCortexInput(emptyClauses).ok, '04 an objective must contain a clause');

  const missingPermission = rawInput() as Record<string, unknown>;
  missingPermission.permissions = [];
  assert(!buildCortexInput(missingPermission).ok, '05 every candidate needs an explicit permission state');

  const duplicateCapability = rawInput() as Record<string, unknown>;
  duplicateCapability.candidateCapabilities = [
    ...(duplicateCapability.candidateCapabilities as unknown[]),
    (duplicateCapability.candidateCapabilities as unknown[])[0],
  ];
  assert(!buildCortexInput(duplicateCapability).ok, '06 duplicate capability identifiers are rejected');

  const badBudget = rawInput() as Record<string, unknown>;
  badBudget.budget = { stepLimit: -1, timeClass: 'QUICK', tokenLimit: 1200, deviceTier: 'MID', trace: trace('bad-budget') };
  assert(!buildCortexInput(badBudget).ok, '07 negative resource budgets are rejected');

  const clonedSource = rawInput() as Record<string, unknown>;
  const before = JSON.stringify(clonedSource);
  const cloned = buildCortexInput(clonedSource);
  assert(cloned.ok && JSON.stringify(clonedSource) === before, '08 building does not mutate its source');

  const frozen = buildCortexInput(rawInput());
  assert(frozen.ok && Object.isFrozen(frozen.value) && Object.isFrozen(frozen.value.objective.clauses[0]!.meaning.slots), '09 built records and nested arrays are immutable');

  let mutationBlocked = false;
  if (frozen.ok) {
    try { (frozen.value.objective.clauses[0]!.meaning.conceptRefs as string[]).push('intruder'); } catch { mutationBlocked = true; }
  }
  assert(mutationBlocked && frozen.ok && frozen.value.objective.clauses[0]!.meaning.conceptRefs.length === 1, '10 nested mutation cannot alter the input snapshot');

  const answer = { kind: 'ANSWER', source: 'KNOWLEDGE', clauseId: 'clause-1', answerRef: 'answer-1', evidence: 'VERIFIED', trace: trace('answer-decision') } as const;
  assert(createDecisionRecord(record(answer)).ok, '11 one discriminated decision kind is accepted');

  const mixed = record(answer) as Record<string, unknown>;
  mixed.decision = { ...answer, otherKind: 'RUN', capabilityId: 'cap-add' };
  assert(!createDecisionRecord(mixed).ok, '12 a hybrid or multi-kind decision is rejected');

  console.log(`CORTEX part 1 type contracts passed: ${checks} cases`);
}
main();
