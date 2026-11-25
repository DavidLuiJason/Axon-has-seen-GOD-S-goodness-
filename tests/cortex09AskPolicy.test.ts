import type { TraceEntry } from '../src/brain/mind/cortex/cortexTypes.ts';
import { applyAskPolicy, type AskCandidate, type AskPolicyInput } from '../src/brain/mind/cortex/askPolicy.ts';

let checks = 0;
function assert(value: unknown, label: string): asserts value { checks += 1; if (!value) throw new Error(`FAIL: ${label}`); }
function trace(id: string): TraceEntry { return { id, stage: 'INPUT', code: 'ASK_POLICY_INPUT', sourceRef: id, evidence: 'OBSERVED' }; }
function candidate(id: string, overrides: Partial<AskCandidate> = {}): AskCandidate {
  return {
    id, clauseId: 'clause-1', askKind: 'CLARIFICATION', questionRef: `question-ref-${id}`, optionRefs: [`option-a-${id}`, `option-b-${id}`],
    contextCanAnswer: false, calculationCanAnswer: false, safeReversibleStepCanAnswer: false,
    irreversibleAction: false, approvalRequired: false, answerChangesResult: true, trace: trace(`candidate-${id}`), ...overrides,
  };
}
function input(candidates: AskCandidate[], pendingQueue: AskCandidate[] = []): AskPolicyInput {
  return { candidates, pendingQueue, trace: trace('ask-policy-input') };
}

function main(): void {
  const context = applyAskPolicy(input([candidate('context', { contextCanAnswer: true })]));
  assert(context.ok && context.value.currentQuestions.length === 0 && context.value.decisions[0]?.disposition === 'RESOLVED_BY_CONTEXT', '01 ask is skipped when context already answers');

  const calculated = applyAskPolicy(input([candidate('calculate', { calculationCanAnswer: true })]));
  assert(calculated.ok && calculated.value.currentQuestions.length === 0 && calculated.value.decisions[0]?.disposition === 'CALCULATE_FIRST', '02 a calculation is tried before asking');

  const reversible = applyAskPolicy(input([candidate('reversible', { safeReversibleStepCanAnswer: true })]));
  assert(reversible.ok && reversible.value.currentQuestions.length === 0 && reversible.value.decisions[0]?.disposition === 'ACT_REVERSIBLY_FIRST', '03 a safe reversible step is tried instead of asking');

  const noChange = applyAskPolicy(input([candidate('no-change', { answerChangesResult: false })]));
  assert(noChange.ok && noChange.value.currentQuestions.length === 0 && noChange.value.decisions[0]?.reasonCode === 'ANSWER_WOULD_NOT_CHANGE_RESULT', '04 no question is asked when the answer cannot change the result');

  const required = applyAskPolicy(input([candidate('needed')]));
  assert(required.ok && required.value.currentQuestions[0]?.id === 'needed' && required.value.decisions[0]?.disposition === 'ASK_NOW', '05 an unresolved answer that changes the result is asked');

  const irreversible = applyAskPolicy(input([candidate('irreversible', { contextCanAnswer: true, irreversibleAction: true })]));
  assert(irreversible.ok && irreversible.value.currentQuestions[0]?.askKind === 'APPROVAL', '06 irreversible action requires ASK even when context provides information');

  const approval = applyAskPolicy(input([candidate('approval', { safeReversibleStepCanAnswer: true, approvalRequired: true })]));
  assert(approval.ok && approval.value.currentQuestions[0]?.askKind === 'APPROVAL', '07 explicit approval requirement takes precedence over a reversible route');

  const defaultCount = applyAskPolicy(input([candidate('first'), candidate('second'), candidate('third')]));
  assert(defaultCount.ok && defaultCount.value.currentQuestions.length === 1 && defaultCount.value.usedDefaultAskCount && defaultCount.value.askCountApplied === 1, '08 default policy asks one question per turn');

  assert(defaultCount.ok && defaultCount.value.currentQuestions[0]?.optionRefs.join(',') === 'option-a-first,option-b-first', '09 options are attached to the current question first');
  assert(defaultCount.ok && defaultCount.value.pendingQuestions.map((item) => item.id).join(',') === 'second,third', '10 remaining questions are queued in their original order');

  const expanded = applyAskPolicy(input([candidate('a'), candidate('b'), candidate('c')]), { maxQuestionsPerTurn: 2 });
  assert(expanded.ok && expanded.value.currentQuestions.map((item) => item.id).join(',') === 'a,b' && expanded.value.pendingQuestions[0]?.id === 'c', '11 an injected question count of two is honoured');

  const oldQueue = applyAskPolicy(input([candidate('new-1'), candidate('new-2')], [candidate('old-1'), candidate('old-2')]));
  assert(oldQueue.ok && oldQueue.value.currentQuestions[0]?.id === 'old-1' && oldQueue.value.pendingQuestions.map((item) => item.id).join(',') === 'old-2,new-1,new-2', '12 existing pending questions keep their order ahead of new questions');

  const resolvedOld = applyAskPolicy(input([candidate('new')], [candidate('old-resolved', { contextCanAnswer: true })]));
  assert(resolvedOld.ok && resolvedOld.value.currentQuestions[0]?.id === 'new' && !resolvedOld.value.pendingQuestions.some((item) => item.id === 'old-resolved'), '13 a pending question answered by context is removed from the queue');

  const duplicate = applyAskPolicy(input([candidate('duplicate')], [candidate('duplicate')]));
  assert(!duplicate.ok && duplicate.error === 'duplicate-question', '14 duplicate queued question ids are rejected');

  const invalidCount = applyAskPolicy(input([candidate('invalid-count')]), { maxQuestionsPerTurn: 0 });
  assert(!invalidCount.ok && invalidCount.error === 'bad-ask-count', '15 an invalid injected question count is rejected');

  console.log(`CORTEX part 9 ask policy passed: ${checks} cases`);
}
main();
