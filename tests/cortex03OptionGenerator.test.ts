import { buildCortexInput, type TraceEntry } from '../src/brain/mind/cortex/cortexTypes.ts';
import { generateOptions } from '../src/brain/mind/cortex/optionGenerator.ts';

let checks = 0;
function assert(value: unknown, label: string): asserts value {
  checks += 1;
  if (!value) throw new Error(`FAIL: ${label}`);
}
function trace(id: string): TraceEntry { return { id, stage: 'INPUT', code: 'SOURCE_RECORD', sourceRef: id, evidence: 'OBSERVED' }; }
type CapOptions = {
  id: string; availability?: 'AVAILABLE' | 'UNAVAILABLE'; permission?: 'ALLOW' | 'ASK' | 'NEVER';
  preconditions?: Array<{ kind: 'EFFECT' | 'SLOT'; ref: string }>;
  effects?: Array<{ kind: 'EFFECT' | 'SLOT'; ref: string }>;
  slots?: Array<{ id: string; required: boolean; state: 'FILLED' | 'MISSING'; valueRef?: string | null }>;
};
function makeInput(caps: CapOptions[], extras: { hits?: boolean; available?: string[]; steps?: number } = {}) {
  const candidates = caps.map((cap) => ({
    id: cap.id, clauseRefs: ['clause-1'], availability: cap.availability ?? 'AVAILABLE', preconditions: (cap.preconditions ?? []).map((item, i) => ({ ...item, trace: trace(`${cap.id}-pre-${i}`) })),
    effects: (cap.effects ?? []).map((item, i) => ({ ...item, trace: trace(`${cap.id}-effect-${i}`) })),
    slots: (cap.slots ?? []).map((item, i) => ({ ...item, valueRef: item.valueRef ?? null, trace: trace(`${cap.id}-slot-${i}`) })),
    reversibility: 'REVERSIBLE', costClass: 'LOW', trace: trace(`${cap.id}-cap`),
  }));
  return buildCortexInput({
    objective: { originalRequestId: 'request-options', clauses: [{ id: 'clause-1', targetRef: 'target-1', meaning: {
      id: 'meaning-1', speechAct: 'REQUEST', conceptRefs: ['concept.run'], slots: [],
      successTest: { id: 'success-1', targetRef: 'target-1', operator: 'RESOLVED', expected: true, trace: trace('success') },
      allowedSubgoalRefs: [], trace: trace('meaning'),
    }, trace: trace('clause') }], trace: trace('objective') },
    constraints: [], candidateCapabilities: candidates,
    knowledgeHits: extras.hits ? [{ id: 'hit-1', clauseId: 'clause-1', answerRef: 'answer-1', sourceId: 'dictionary', truth: 'VERIFIED', trace: trace('hit') }] : [],
    commitments: [], permissions: candidates.map((cap) => ({ capabilityId: cap.id, state: caps.find((raw) => raw.id === cap.id)?.permission ?? 'ALLOW', trace: trace(`${cap.id}-permission`) })),
    availableFacts: (extras.available ?? []).map((ref, i) => ({ kind: 'EFFECT', ref, trace: trace(`available-${i}`) })),
    budget: { stepLimit: extras.steps ?? 6, timeClass: 'QUICK', tokenLimit: 1500, deviceTier: 'MID', trace: trace('budget') },
    pendingQuestion: null, trace: trace('input'),
  });
}
function main(): void {
  const none = makeInput([]);
  const noneOptions = none.ok ? generateOptions(none.value, { maxDepth: 3 }) : null;
  assert(noneOptions?.ok && noneOptions.value.options.some((option) => option.kind === 'DECLINE' && option.declineKind === 'NO_CAPABILITY'), '01 no matching capability yields an honest NO_CAPABILITY decline');

  const single = makeInput([{ id: 'cap-one', slots: [{ id: 'amount', required: true, state: 'FILLED', valueRef: 'v-1' }] }]);
  const singleOptions = single.ok ? generateOptions(single.value, { maxDepth: 3 }) : null;
  assert(singleOptions?.ok && singleOptions.value.options.some((option) => option.kind === 'RUN' && option.capabilityId === 'cap-one' && option.state === 'READY'), '02 one fully prepared capability yields a RUN option');

  const chain = makeInput([
    { id: 'cap-a', effects: [{ kind: 'EFFECT', ref: 'prepared' }] },
    { id: 'cap-b', preconditions: [{ kind: 'EFFECT', ref: 'prepared' }], effects: [{ kind: 'EFFECT', ref: 'finished' }] },
  ]);
  const chainOptions = chain.ok ? generateOptions(chain.value, { maxDepth: 3 }) : null;
  assert(chainOptions?.ok && chainOptions.value.options.some((option) => option.kind === 'PLAN' && option.capabilityIds.join(',') === 'cap-a,cap-b'), '03 effects may satisfy the next capability preconditions');

  const cycle = makeInput([
    { id: 'cap-a', preconditions: [{ kind: 'EFFECT', ref: 'from-b' }], effects: [{ kind: 'EFFECT', ref: 'from-a' }] },
    { id: 'cap-b', preconditions: [{ kind: 'EFFECT', ref: 'from-a' }], effects: [{ kind: 'EFFECT', ref: 'from-b' }] },
  ], { available: ['from-b'] });
  const cycleOptions = cycle.ok ? generateOptions(cycle.value, { maxDepth: 4 }) : null;
  assert(cycleOptions?.ok && cycleOptions.value.rejected.some((item) => item.reasonCode === 'CYCLE'), '04 a capability cycle is rejected and traced');

  const unavailable = makeInput([{ id: 'cap-away', availability: 'UNAVAILABLE' }]);
  const unavailableOptions = unavailable.ok ? generateOptions(unavailable.value, { maxDepth: 2 }) : null;
  assert(unavailableOptions?.ok && unavailableOptions.value.options.some((option) => option.kind === 'RUN' && option.capabilityId === 'cap-away' && option.state === 'BLOCKED'), '05 an unavailable capability is shown but blocked');

  const never = makeInput([{ id: 'cap-never', permission: 'NEVER' }]);
  const neverOptions = never.ok ? generateOptions(never.value, { maxDepth: 3 }) : null;
  assert(neverOptions?.ok && neverOptions.value.options.some((option) => option.kind === 'RUN' && option.capabilityId === 'cap-never' && option.state === 'BLOCKED') && !neverOptions.value.options.some((option) => option.kind === 'PLAN' && option.capabilityIds.includes('cap-never')), '06 a NEVER capability remains visible as blocked and never enters a plan');

  const missing = makeInput([{ id: 'cap-missing', slots: [{ id: 'file', required: true, state: 'MISSING' }] }]);
  const missingOptions = missing.ok ? generateOptions(missing.value, { maxDepth: 2 }) : null;
  assert(missingOptions?.ok && missingOptions.value.options.some((option) => option.kind === 'ASK' && option.askKind === 'MISSING_INPUT'), '07 a missing required slot yields an ASK option');

  const approval = makeInput([{ id: 'cap-approval', permission: 'ASK' }]);
  const approvalOptions = approval.ok ? generateOptions(approval.value, { maxDepth: 2 }) : null;
  assert(approvalOptions?.ok && approvalOptions.value.options.some((option) => option.kind === 'ASK' && option.askKind === 'APPROVAL'), '08 an ASK permission yields an approval question option');

  const knowledge = makeInput([], { hits: true });
  const knowledgeOptions = knowledge.ok ? generateOptions(knowledge.value, { maxDepth: 2 }) : null;
  assert(knowledgeOptions?.ok && knowledgeOptions.value.options.some((option) => option.kind === 'ANSWER' && option.answerRef === 'answer-1'), '09 a typed knowledge hit yields an ANSWER option');

  const disputed = makeInput([], { hits: true });
  if (disputed.ok) {
    const hit = disputed.value.knowledgeHits[0]!;
    const changed = { ...disputed.value, knowledgeHits: [{ ...hit, truth: 'DISPUTED' as const }] };
    const disputedOptions = generateOptions(changed, { maxDepth: 2 });
    assert(disputedOptions.ok && !disputedOptions.value.options.some((option) => option.kind === 'ANSWER'), '10 disputed knowledge is not offered as a direct answer');
  } else assert(false, '10 disputed knowledge base input builds');

  const suppliedPrecondition = makeInput([{ id: 'cap-ready', preconditions: [{ kind: 'EFFECT', ref: 'network.ready' }] }], { available: ['network.ready'] });
  const suppliedOptions = suppliedPrecondition.ok ? generateOptions(suppliedPrecondition.value, { maxDepth: 2 }) : null;
  assert(suppliedOptions?.ok && suppliedOptions.value.options.some((option) => option.kind === 'RUN' && option.state === 'READY'), '11 an observed required effect satisfies a precondition');

  const absentPrecondition = makeInput([{ id: 'cap-wait', preconditions: [{ kind: 'EFFECT', ref: 'unknown.ready' }] }]);
  const absentOptions = absentPrecondition.ok ? generateOptions(absentPrecondition.value, { maxDepth: 2 }) : null;
  assert(absentOptions?.ok && absentOptions.value.options.some((option) => option.kind === 'ASK' && option.askKind === 'CLARIFICATION'), '12 an unmet non-slot precondition yields clarification, not a guessed RUN');

  const depthLimited = makeInput([
    { id: 'cap-a', effects: [{ kind: 'EFFECT', ref: 'p' }] },
    { id: 'cap-b', preconditions: [{ kind: 'EFFECT', ref: 'p' }], effects: [{ kind: 'EFFECT', ref: 'q' }] },
  ]);
  const depthOptions = depthLimited.ok ? generateOptions(depthLimited.value, { maxDepth: 1 }) : null;
  assert(depthOptions?.ok && !depthOptions.value.options.some((option) => option.kind === 'PLAN') && depthOptions.value.rejected.some((item) => item.reasonCode === 'DEPTH_LIMIT'), '13 a chain beyond injected depth is stopped');

  const budgetLimited = makeInput([
    { id: 'cap-a', effects: [{ kind: 'EFFECT', ref: 'p' }] },
    { id: 'cap-b', preconditions: [{ kind: 'EFFECT', ref: 'p' }] },
  ], { steps: 1 });
  const budgetOptions = budgetLimited.ok ? generateOptions(budgetLimited.value, { maxDepth: 4 }) : null;
  assert(budgetOptions?.ok && budgetOptions.value.rejected.some((item) => item.reasonCode === 'STEP_BUDGET'), '14 the input step budget caps a chain');

  const orderedOne = makeInput([{ id: 'cap-z' }, { id: 'cap-a' }]);
  const orderedTwo = makeInput([{ id: 'cap-a' }, { id: 'cap-z' }]);
  const first = orderedOne.ok ? generateOptions(orderedOne.value, { maxDepth: 2 }) : null;
  const second = orderedTwo.ok ? generateOptions(orderedTwo.value, { maxDepth: 2 }) : null;
  assert(first?.ok && second?.ok && first.value.options.map((option) => option.id).join('|') === second.value.options.map((option) => option.id).join('|'), '15 option order is deterministic independent of candidate input order');

  const duplicate = makeInput([{ id: 'cap-dup' }, { id: 'cap-dup' }]);
  assert(!duplicate.ok, '16 duplicate capabilities are rejected by the input contract');
  console.log(`CORTEX part 3 option generator passed: ${checks} cases`);
}
main();
