import { buildCortexInput, type TraceEntry } from '../src/brain/mind/cortex/cortexTypes.ts';
import { buildObjectiveFrame } from '../src/brain/mind/cortex/objectiveFrame.ts';

let checks = 0;
function assert(value: unknown, label: string): asserts value {
  checks += 1;
  if (!value) throw new Error(`FAIL: ${label}`);
}
function trace(id: string): TraceEntry { return { id, stage: 'INPUT', code: 'SOURCE_RECORD', sourceRef: id, evidence: 'OBSERVED' }; }
function input(): ReturnType<typeof buildCortexInput> {
  return buildCortexInput({
    objective: {
      originalRequestId: 'request-frame',
      clauses: [
        { id: 'clause-a', targetRef: 'target-a', meaning: {
          id: 'meaning-a', speechAct: 'REQUEST', conceptRefs: ['concept.a'], slots: [],
          successTest: { id: 'success-a', targetRef: 'target-a', operator: 'RESOLVED', expected: true, trace: trace('success-a') },
          allowedSubgoalRefs: ['target-a.detail'], trace: trace('meaning-a'),
        }, trace: trace('clause-a') },
        { id: 'clause-b', targetRef: 'target-b', meaning: {
          id: 'meaning-b', speechAct: 'QUESTION', conceptRefs: ['concept.b'], slots: [],
          successTest: { id: 'success-b', targetRef: 'target-b', operator: 'PRESENT', expected: true, trace: trace('success-b') },
          allowedSubgoalRefs: [], trace: trace('meaning-b'),
        }, trace: trace('clause-b') },
      ], trace: trace('objective'),
    },
    constraints: [{ id: 'hard-1', clauseId: 'clause-a', targetRef: 'target-a', kind: 'REQUIRE', strength: 'HARD', valueRef: 'value-a', trace: trace('hard-1') },
      { id: 'soft-1', clauseId: 'clause-b', targetRef: 'target-b', kind: 'PREFER', strength: 'SOFT', valueRef: 'value-b', trace: trace('soft-1') }],
    candidateCapabilities: [], knowledgeHits: [], commitments: [], permissions: [], availableFacts: [],
    budget: { stepLimit: 3, timeClass: 'INSTANT', tokenLimit: 500, deviceTier: 'WEAK', trace: trace('budget') },
    pendingQuestion: null, trace: trace('input'),
  });
}
function main(): void {
  const built = input();
  assert(built.ok, '01 typed source objective is valid');
  if (!built.ok) return;
  const base = buildObjectiveFrame(built.value);
  assert(base.ok && base.value.goals.length === 2, '02 one root success goal is derived per objective clause');
  assert(base.ok && base.value.goals[0]!.successTest.id === 'success-a' && base.value.goals[1]!.successTest.id === 'success-b', '03 each clause keeps its own success test');
  assert(base.ok && base.value.originalObjective.originalRequestId === 'request-frame', '04 the original request reference is retained');
  assert(base.ok && Object.isFrozen(base.value.originalObjective), '05 the original objective remains immutable');

  const validChild = buildObjectiveFrame(built.value, { subgoals: [{
    id: 'child-a', parentGoalId: 'goal:clause-a', sourceClauseId: 'clause-a', targetRef: 'target-a.detail',
    successTest: { id: 'success-child', targetRef: 'target-a.detail', operator: 'RESOLVED', expected: true, trace: trace('success-child') }, trace: trace('child-a'),
  }] });
  assert(validChild.ok && validChild.value.goals.some((goal) => goal.id === 'child-a'), '06 a traced and allowed subgoal is accepted');

  const untraced = buildObjectiveFrame(built.value, { subgoals: [{
    id: 'child-untraced', parentGoalId: 'goal:clause-a', sourceClauseId: 'missing-clause', targetRef: 'target-a.detail',
    successTest: { id: 'success-untraced', targetRef: 'target-a.detail', operator: 'RESOLVED', expected: true, trace: trace('s-untraced') }, trace: trace('child-untraced'),
  }] });
  assert(untraced.ok && !untraced.value.goals.some((goal) => goal.id === 'child-untraced') && untraced.value.rejected.some((item) => item.proposalId === 'child-untraced'), '07 a subgoal without an objective clause is rejected and flagged');

  const changedScope = buildObjectiveFrame(built.value, { subgoals: [{
    id: 'child-changed', parentGoalId: 'goal:clause-a', sourceClauseId: 'clause-a', targetRef: 'new-unrequested-scope',
    successTest: { id: 'success-changed', targetRef: 'new-unrequested-scope', operator: 'RESOLVED', expected: true, trace: trace('s-changed') }, trace: trace('child-changed'),
  }] });
  assert(changedScope.ok && !changedScope.value.goals.some((goal) => goal.id === 'child-changed') && changedScope.value.rejected.some((item) => item.reasonCode === 'ADDED_SCOPE'), '08 a goal that changes the objective is not admitted');

  const wrongParent = buildObjectiveFrame(built.value, { subgoals: [{
    id: 'child-parent', parentGoalId: 'goal:clause-b', sourceClauseId: 'clause-a', targetRef: 'target-a.detail',
    successTest: { id: 'success-parent', targetRef: 'target-a.detail', operator: 'RESOLVED', expected: true, trace: trace('s-parent') }, trace: trace('child-parent'),
  }] });
  assert(wrongParent.ok && wrongParent.value.rejected.some((item) => item.proposalId === 'child-parent'), '09 a subgoal cannot attach to another clause');

  const keptHard = buildObjectiveFrame(built.value, { constraintChanges: [{
    id: 'softened-hard', sourceConstraintId: 'hard-1', targetRef: 'target-a', kind: 'REQUIRE', strength: 'SOFT', valueRef: 'value-a', trace: trace('softened-hard'),
  }] });
  assert(keptHard.ok && keptHard.value.constraints.find((item) => item.id === 'hard-1')?.strength === 'HARD' && keptHard.value.rejected.some((item) => item.proposalId === 'softened-hard'), '10 a HARD constraint cannot be weakened');

  const changedConstraint = buildObjectiveFrame(built.value, { constraintChanges: [{
    id: 'changed-constraint', sourceConstraintId: 'hard-1', targetRef: 'other-target', kind: 'REQUIRE', strength: 'HARD', valueRef: 'value-a', trace: trace('changed-constraint'),
  }] });
  assert(changedConstraint.ok && changedConstraint.value.rejected.some((item) => item.proposalId === 'changed-constraint'), '11 a constraint cannot be redirected to another target');

  const promotedSoft = buildObjectiveFrame(built.value, { constraintChanges: [{
    id: 'promoted-soft', sourceConstraintId: 'soft-1', targetRef: 'target-b', kind: 'PREFER', strength: 'HARD', valueRef: 'value-b', trace: trace('promoted-soft'),
  }] });
  assert(promotedSoft.ok && promotedSoft.value.constraints.some((item) => item.id === 'promoted-soft' && item.strength === 'HARD'), '12 a constraint may be strengthened without changing its meaning');

  const missingConstraint = buildObjectiveFrame(built.value, { constraintChanges: [{
    id: 'unbased-constraint', sourceConstraintId: 'unknown', targetRef: 'target-b', kind: 'PREFER', strength: 'SOFT', valueRef: 'value-b', trace: trace('unbased-constraint'),
  }] });
  assert(missingConstraint.ok && missingConstraint.value.rejected.some((item) => item.proposalId === 'unbased-constraint'), '13 an untraced constraint proposal is rejected');

  const repeated = buildObjectiveFrame(built.value);
  assert(base.ok && repeated.ok && JSON.stringify(base.value) === JSON.stringify(repeated.value), '14 the same objective produces the same frame');
  console.log(`CORTEX part 2 objective frame passed: ${checks} cases`);
}
main();
