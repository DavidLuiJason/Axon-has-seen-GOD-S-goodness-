import { createCortex, toOrchestratorPlan, type CortexDependencies, type CortexAdvisorySignals } from '../src/brain/mind/cortex/cortex.ts';
import type { CortexInput, TraceEntry } from '../src/brain/mind/cortex/cortexTypes.ts';
import type { CortexOption } from '../src/brain/mind/cortex/optionGenerator.ts';

let checks = 0;
function assert(value: unknown, label: string): asserts value { checks += 1; if (!value) throw new Error(`FAIL: ${label}`); }
function trace(id: string): TraceEntry { return { id, stage: 'INPUT', code: 'HAND_WORKED_FACT', sourceRef: id, evidence: 'OBSERVED' }; }
function advisory(input: CortexInput, option: CortexOption): CortexAdvisorySignals {
  return { risk: 'LOW', resourceFit: 'FIT', actionKind: 'OTHER', councilFlags: [], judgment: {
    verdict: 'PROCEED', flags: [], trace: { id: `judge:${option.id}`, stage: 'DECISION', code: 'NO_BLOCKING_FLAGS', sourceRef: input.trace.id, evidence: 'OBSERVED' },
  }, uncertain: false };
}
function deps(overrides: Partial<CortexDependencies> = {}): CortexDependencies {
  return { maxOptionDepth: 5, advisorySignals: advisory, allowOutsideAiProposal: true,
    exactIntegerAdd: (left, right) => ({ ok: true, value: left + right }), ...overrides };
}
function meaning(id: string, conceptRefs: readonly string[] = [], slots: readonly { id: string; kind: string; state: 'FILLED' | 'MISSING'; valueRef?: string }[] = [], target = 'target-1', expected: string | number | boolean = true, speechAct: 'REQUEST' | 'QUESTION' | 'STATEMENT' | 'GREETING' | 'THANKS' | 'UNKNOWN' = 'REQUEST') {
  return { id, speechAct, conceptRefs, slots: slots.map((slot, index) => ({ ...slot, trace: trace(`${id}-slot-${index}`) })),
    successTest: { id: `${id}-success`, targetRef: target, operator: 'EQUALS' as const, expected, trace: trace(`${id}-success-trace`) },
    allowedSubgoalRefs: [], trace: trace(`${id}-trace`) };
}
function rawInput(id: string, options: {
  concepts?: readonly string[]; speechAct?: 'REQUEST' | 'QUESTION' | 'STATEMENT' | 'GREETING' | 'THANKS' | 'UNKNOWN';
  target?: string; expected?: string | number | boolean; clauses?: readonly unknown[]; capabilities?: readonly unknown[];
  knowledge?: readonly unknown[]; permissions?: readonly unknown[]; pending?: unknown; commitments?: readonly unknown[];
} = {}): unknown {
  const clause = { id: `${id}-clause`, targetRef: options.target ?? 'target-1', meaning: meaning(`${id}-meaning`, options.concepts ?? [], [], options.target ?? 'target-1', options.expected ?? true, options.speechAct ?? 'REQUEST'), trace: trace(`${id}-clause-trace`) };
  const capabilities = [...(options.capabilities ?? [])] as Array<Record<string, unknown>>;
  const permissions = options.permissions ?? capabilities.map((cap, index) => ({ capabilityId: cap.id, state: 'ALLOW', trace: trace(`${id}-permission-${index}`) }));
  return { objective: { originalRequestId: id, clauses: options.clauses ?? [clause], trace: trace(`${id}-objective`) }, constraints: [],
    candidateCapabilities: capabilities, knowledgeHits: options.knowledge ?? [], commitments: options.commitments ?? [], permissions,
    availableFacts: [], budget: { stepLimit: 8, timeClass: 'QUICK', tokenLimit: 5000, deviceTier: 'MID', trace: trace(`${id}-budget`) },
    pendingQuestion: options.pending ?? null, trace: trace(`${id}-input`) };
}
function capability(id: string, clauseRefs: readonly string[], effects: readonly string[], preconditions: readonly string[] = [], availability: 'AVAILABLE' | 'UNAVAILABLE' = 'AVAILABLE', reversibility: 'REVERSIBLE' | 'IRREVERSIBLE' = 'REVERSIBLE') {
  return { id, clauseRefs, availability, preconditions: preconditions.map((ref, index) => ({ kind: 'EFFECT', ref, trace: trace(`${id}-pre-${index}`) })),
    effects: effects.map((ref, index) => ({ kind: 'EFFECT', ref, trace: trace(`${id}-effect-${index}`) })), slots: [], reversibility, costClass: 'LOW', trace: trace(`${id}-trace`) };
}
function knowledge(id: string, clauseId: string, answerRef: string, truth: 'VERIFIED' | 'OBSERVED' = 'VERIFIED') {
  return { id, clauseId, answerRef, sourceId: 'dictionary', truth, trace: trace(`${id}-trace`) };
}
function pending(id: string, clauseId: string) {
  return { id, clauseId, slotId: 'missing-choice', optionRefs: ['option-a', 'option-b'], trace: trace(`${id}-pending-trace`) };
}
function main(): void {
  const c = createCortex(deps());
  // Required end-to-end hand-worked cases (1–10).
  let r = c.decide(rawInput('greeting', { speechAct: 'GREETING', knowledge: [knowledge('hello-hit', 'greeting-clause', 'conversation-word:hello')] }));
  assert(r.ok && r.value.decision.decision.kind === 'ANSWER' && r.value.decision.decision.source === 'KNOWLEDGE', '01 greeting is answered from admitted conversation knowledge');
  r = c.decide(rawInput('addition', { concepts: ['INTEGER_ADD'], target: 'sum', expected: 42,
    clauses: [{ id: 'addition-clause', targetRef: 'sum', meaning: meaning('addition-meaning', ['INTEGER_ADD'], [
      { id: 'left', kind: 'INTEGER_LEFT', state: 'FILLED', valueRef: '17' }, { id: 'right', kind: 'INTEGER_RIGHT', state: 'FILLED', valueRef: '25' },
    ], 'sum', 42), trace: trace('addition-clause-trace') }] }));
  assert(r.ok && r.value.decision.decision.kind === 'ANSWER' && r.value.decision.decision.source === 'ENGINE' && r.value.decision.evidenceLabels.includes('VERIFIED'), '02 arithmetic uses exact engine and independent BigInt path');
  r = c.decide(rawInput('meaning', { knowledge: [knowledge('dictionary-hit', 'meaning-clause', 'dictionary:sprightly')] }));
  assert(r.ok && r.value.decision.decision.kind === 'ANSWER' && r.value.decision.decision.answerRef === 'dictionary:sprightly', '03 word meaning uses the dictionary knowledge hit');

  const twoClauses = [
    { id: 'two-clause-a', targetRef: 'result-a', meaning: meaning('two-meaning-a', [], [], 'result-a'), trace: trace('two-clause-a-trace') },
    { id: 'two-clause-b', targetRef: 'result-b', meaning: meaning('two-meaning-b', [], [], 'result-b'), trace: trace('two-clause-b-trace') },
  ];
  r = c.decide(rawInput('two-clause', { clauses: twoClauses, target: 'result-b', capabilities: [
    capability('prepare-a', ['two-clause-a', 'two-clause-b'], ['result-a']), capability('finish-b', ['two-clause-b'], ['result-b'], ['result-a']),
  ] }));
  assert(r.ok && r.value.decision.decision.kind === 'PLAN' && r.value.decision.decision.steps.length === 2 && r.value.decision.decision.steps[0]?.capabilityId === 'prepare-a', '04 two clauses become two ordered planned steps');

  r = c.decide(rawInput('vague', { pending: pending('need-clarification', 'vague-clause') }));
  assert(r.ok && r.value.decision.decision.kind === 'ASK' && r.value.decision.decision.optionRefs.length === 2, '05 vague request asks one clarification and provides options');
  r = c.decide(rawInput('unavailable', { capabilities: [capability('missing-tool', ['unavailable-clause'], ['target-1'], [], 'UNAVAILABLE')] }));
  assert(r.ok && r.value.decision.decision.kind === 'DECLINE' && r.value.decision.decision.declineKind === 'BLOCKED', '06 unavailable capability produces an honest decline');

  r = c.decide(rawInput('never', { capabilities: [capability('never-tool', ['never-clause'], ['target-1'])],
    permissions: [{ capabilityId: 'never-tool', state: 'NEVER', trace: trace('never-permission') }] }));
  assert(r.ok && r.value.decision.decision.kind === 'DECLINE', '07 NEVER permission cannot produce an action');

  r = c.decide(rawInput('project', { concepts: ['PROJECT'], target: 'project.done', capabilities: [
    capability('discover', ['project-clause'], ['project.discovered']), capability('design', ['project-clause'], ['project.designed'], ['project.discovered']),
    capability('build', ['project-clause'], ['project.done'], ['project.designed']),
  ] }));
  assert(r.ok && r.value.decision.decision.kind === 'PLAN' && r.value.decision.decision.steps.length === 3 && r.value.planAdapter !== null, '08 multi-part project is decomposed into a validated task graph and Plan');

  const conflictInput = rawInput('contradiction');
  const conflictDeps = deps({ reconciliation: () => ({ signal: {
    id: 'signal-conflict', sourceEventRef: 'event-conflict', origin: 'owner', statementKind: 'decision', kind: 'decision', subject: 'mode', value: 'new', scope: 'user', scopeId: 'owner',
    targetPriorCommitmentId: 'old', intent: null, explicitChangeCue: false, retract: false, condition: null, replacementRef: 'conflict-ref', observedAt: 1800000000000, repetitionCount: 1,
    trace: trace('meaning-conflict'),
  }, commitments: [], grants: [], approvalCheck: 'NOT_REQUIRED', irreversibleConflict: false, trace: trace('reconcile-input') }) });
  r = createCortex(conflictDeps).decide(conflictInput);
  assert(r.ok && r.value.decision.decision.kind === 'ASK' && r.value.decision.decision.askKind === 'CLARIFICATION', '09 contradiction with an earlier decision asks instead of overwriting it');

  const outsideInput = rawInput('outside-ai', { concepts: ['OUTSIDE_AI_RESEARCH'] }) as Record<string, unknown>;
  const outsideClauses = (outsideInput.objective as { clauses: Array<{ meaning: Record<string, unknown> }> }).clauses;
  outsideClauses[0]!.meaning.slots = [{ id: 'credential-ref', kind: 'CREDENTIAL_REFERENCE', state: 'FILLED', valueRef: 'secret-token-ref', trace: trace('secret-token-trace') }];
  r = c.decide(outsideInput);
  assert(r.ok && r.value.decision.decision.kind === 'PROPOSE_OUTSIDE_AI' && r.value.decision.decision.dataRefs.length === 0, '10 outside AI is a proposal with no attached secrets or data');

  // Fifty additional distinct whole inputs exercise stable output and the same facade contracts.
  for (let i = 0; i < 10; i += 1) {
    const id = `dictionary-${i}`;
    const result = c.decide(rawInput(id, { knowledge: [knowledge(`${id}-hit`, `${id}-clause`, `dictionary:entry-${i}`)] }));
    assert(result.ok && result.value.decision.decision.kind === 'ANSWER' && result.value.decision.decision.answerRef === `dictionary:entry-${i}`, `11-${i} distinct knowledge input returns its own hit`);
  }
  for (let i = 0; i < 10; i += 1) {
    const id = `single-run-${i}`;
    const result = c.decide(rawInput(id, { capabilities: [capability(`tool-${i}`, [`${id}-clause`], ['target-1'])] }));
    assert(result.ok && result.value.decision.decision.kind === 'RUN' && result.value.decision.decision.capabilityId === `tool-${i}`, `12-${i} distinct reversible capability input selects its capability`);
  }
  for (let i = 0; i < 10; i += 1) {
    const id = `unavailable-${i}`;
    const result = c.decide(rawInput(id, { capabilities: [capability(`unavailable-${i}`, [`${id}-clause`], ['target-1'], [], 'UNAVAILABLE')] }));
    assert(result.ok && result.value.decision.decision.kind === 'DECLINE' && result.value.decision.decision.declineKind === 'BLOCKED', `13-${i} unavailable input never invents an alternative tool`);
  }
  for (let i = 0; i < 10; i += 1) {
    const id = `never-${i}`;
    const result = c.decide(rawInput(id, { capabilities: [capability(`never-${i}`, [`${id}-clause`], ['target-1'])],
      permissions: [{ capabilityId: `never-${i}`, state: 'NEVER', trace: trace(`${id}-permission`) }] }));
    assert(result.ok && result.value.decision.decision.kind !== 'RUN' && result.value.decision.decision.kind !== 'PLAN', `14-${i} NEVER input cannot escape through RUN or PLAN`);
  }
  for (let i = 0; i < 10; i += 1) {
    const id = `question-${i}`;
    const result = c.decide(rawInput(id, { pending: pending(`${id}-question`, `${id}-clause`) }));
    assert(result.ok && result.value.decision.decision.kind === 'ASK', `15-${i} distinct unresolved context produces an ASK outcome`);
  }

  // Guard properties beyond the 60-case set.
  const neverSource = rawInput('never-chain', { capabilities: [capability('never-first', ['never-chain-clause'], ['intermediate']),
    capability('allowed-second', ['never-chain-clause'], ['target-1'], ['intermediate'])],
    permissions: [{ capabilityId: 'never-first', state: 'NEVER', trace: trace('never-first-permission') },
      { capabilityId: 'allowed-second', state: 'ALLOW', trace: trace('allowed-second-permission') }] });
  const neverResult = c.decide(neverSource);
  assert(neverResult.ok && neverResult.value.decision.decision.kind !== 'RUN' && neverResult.value.decision.decision.kind !== 'PLAN', '61 facade blocks NEVER capability even when it is a chain candidate');
  const stableInput = rawInput('deterministic', { knowledge: [knowledge('stable-hit', 'deterministic-clause', 'dictionary:stable')] });
  const first = c.decide(stableInput); const second = c.decide(stableInput);
  assert(first.ok && second.ok && JSON.stringify(first.value.decision) === JSON.stringify(second.value.decision), '62 identical input gives identical decision and rejected-option order');
  const withText = rawInput('raw-text') as Record<string, unknown>;
  withText.rawMessage = 'should not be read';
  assert(!c.decide(withText).ok, '63 facade rejects raw message text rather than matching it');

  const planResult = c.decide(rawInput('adapt-plan', { target: 'target-1', capabilities: [
    capability('adapter-first', ['adapt-plan-clause'], ['stage']), capability('adapter-last', ['adapt-plan-clause'], ['target-1'], ['stage']),
  ] }));
  const adapted = planResult.ok ? toOrchestratorPlan(planResult.value) : null;
  assert(adapted !== null && adapted.ok && adapted.value.plan.steps.length === 2, '64 Plan adapter returns the already validated orchestrator plan');
  const tieInput = rawInput('ordered-options', { capabilities: [capability('cap-b', ['ordered-options-clause'], ['target-1']), capability('cap-a', ['ordered-options-clause'], ['target-1'])] });
  const tieResult = c.decide(tieInput);
  assert(tieResult.ok && tieResult.value.decision.decision.kind === 'RUN' && tieResult.value.decision.decision.capabilityId === 'cap-a' &&
    tieResult.value.decision.rejectedOptions.some((item) => item.optionId.includes('cap-b')), '65 two eligible options use a deterministic lexical tie-break and record the rejected rival');
  const nonPlan = toOrchestratorPlan(first.ok ? first.value : ({} as never));
  assert(!nonPlan.ok, '66 non-PLAN decisions cannot be adapted as a Plan');
  if (planResult.ok && planResult.value.planAdapter !== null) {
    const invalidAdapter = { ...planResult.value, planAdapter: { ...planResult.value.planAdapter, plan: { ...planResult.value.planAdapter.plan, steps: [] } } };
    assert(!toOrchestratorPlan(invalidAdapter).ok, '67 facade revalidates a tampered Plan before orchestration');
  } else { assert(false, 'tampered Plan guard requires a completed Plan'); }
  console.log(`CORTEX part 12 passed: ${checks} checks (60 end-to-end inputs plus boundary checks)`);
}
main();
