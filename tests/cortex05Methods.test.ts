import type { CortexEngineResult, TraceEntry } from '../src/brain/mind/cortex/cortexTypes.ts';
import {
  REASONING_METHODS, executeReasoningMethod, selectReasoningMethod,
  type DelegatedMethodInput, type ExternalMethodResult, type MethodExecutionInput, type MethodFeatureRecord,
  type ReasoningMethodDependencies, type ReasoningMethodId,
} from '../src/brain/mind/cortex/methods.ts';

let checks = 0;
function assert(value: unknown, label: string): asserts value { checks += 1; if (!value) throw new Error(`FAIL: ${label}`); }
function trace(id: string): TraceEntry { return { id, stage: 'INPUT', code: 'METHOD_SOURCE', sourceRef: id, evidence: 'OBSERVED' }; }
function features(method: ReasoningMethodId): MethodFeatureRecord {
  return {
    hasRules: method === 'RULE_DEDUCTION', hasConstraints: method === 'CONSTRAINT_SATISFACTION', hasCausalChain: method === 'CAUSAL_CHAIN',
    analogyRequested: method === 'ANALOGY', counterfactualRequested: method === 'COUNTERFACTUAL', exactOperationRequested: method === 'EXACT_COMPUTATION', trace: trace(`features-${method}`),
  };
}
function delegated(id: string): DelegatedMethodInput { return { taskRef: id, inputRefs: [`${id}-input`], trace: trace(`${id}-trace`) }; }
function external(id: string): CortexEngineResult<ExternalMethodResult> {
  return { ok: true, value: { resultRef: `result-${id}`, evidence: 'INFERRED', trace: trace(`result-trace-${id}`) } };
}
function dependencies(overrides: Partial<ReasoningMethodDependencies> = {}): ReasoningMethodDependencies {
  return {
    judgment: { evaluateCausalChain: () => external('judgment') },
    foresight: { evaluateCounterfactual: () => external('lookahead') },
    exactEngine: { compute: () => external('exact') },
    verifier: { verify: () => ({ ok: true, value: true }) },
    ...overrides,
  };
}
function execution(methodId: ReasoningMethodId): MethodExecutionInput {
  return {
    methodId, features: features(methodId),
    facts: methodId === 'RULE_DEDUCTION' ? [{ id: 'fact-1', valueRef: 'premise-1', truth: 'VERIFIED', trace: trace('fact-1') }] : [],
    rules: methodId === 'RULE_DEDUCTION' ? [{ id: 'rule-1', antecedentRefs: ['premise-1'], consequentRef: 'conclusion-1', evidence: 'VERIFIED', trace: trace('rule-1') }] : [],
    constraints: methodId === 'CONSTRAINT_SATISFACTION' ? [{ id: 'constraint-ok', targetRef: 'state-1', satisfied: true, evidence: 'OBSERVED', trace: trace('constraint-ok') }] : [],
    analogy: methodId === 'ANALOGY' ? {
      sourceModelRef: 'model-source', targetModelRef: 'model-target', mappings: [{ sourceRef: 'source-part', targetRef: 'target-part', relationRef: 'relation-map', trace: trace('mapping') }],
      differences: ['difference-1'], validationTestRef: 'validation-1', trace: trace('analogy'),
    } : null,
    causal: methodId === 'CAUSAL_CHAIN' ? delegated('causal') : null,
    counterfactual: methodId === 'COUNTERFACTUAL' ? delegated('counterfactual') : null,
    exact: methodId === 'EXACT_COMPUTATION' ? { operationRef: 'add', inputRefs: ['left', 'right'], trace: trace('exact-input') } : null,
    trace: trace(`execution-${methodId}`),
  };
}

function main(): void {
  assert(Object.keys(REASONING_METHODS).length === 6 && Object.values(REASONING_METHODS).every((item) => item.purpose.length > 0 && item.inputs.length > 0 && item.assumptions.length > 0 && item.validity.length > 0 && item.output.length > 0 && item.limits.length > 0 && item.verifier.length > 0), '01 every registry method declares purpose, inputs, assumptions, validity, output, limits and verifier');
  assert(REASONING_METHODS.RULE_DEDUCTION.delegate === 'LOCAL_RULES', '02 rule deduction is a local typed rule method');
  assert(REASONING_METHODS.CONSTRAINT_SATISFACTION.delegate === 'LOCAL_CONSTRAINTS', '03 constraint satisfaction declares its local facts boundary');
  assert(REASONING_METHODS.CAUSAL_CHAIN.delegate === 'JUDGMENT', '04 causal-chain method delegates through Judgment');
  assert(REASONING_METHODS.ANALOGY.output.includes('CANDIDATE') && REASONING_METHODS.ANALOGY.limits.includes('Never'), '05 analogy declares candidate-only output and a transfer limit');
  assert(REASONING_METHODS.COUNTERFACTUAL.delegate === 'FORESIGHT_LOOKAHEAD', '06 counterfactual method delegates to foresight lookahead');
  assert(REASONING_METHODS.EXACT_COMPUTATION.delegate === 'EXACT_ENGINE', '07 exact computation delegates to an injected exact engine');

  const ruleSelection = selectReasoningMethod(features('RULE_DEDUCTION'));
  const constraintSelection = selectReasoningMethod(features('CONSTRAINT_SATISFACTION'));
  const causalSelection = selectReasoningMethod(features('CAUSAL_CHAIN'));
  const analogySelection = selectReasoningMethod(features('ANALOGY'));
  const counterfactualSelection = selectReasoningMethod(features('COUNTERFACTUAL'));
  const exactSelection = selectReasoningMethod(features('EXACT_COMPUTATION'));
  assert(ruleSelection.ok && ruleSelection.value === 'RULE_DEDUCTION', '08 typed rule features select rule deduction');
  assert(constraintSelection.ok && constraintSelection.value === 'CONSTRAINT_SATISFACTION', '09 typed constraints select constraint satisfaction');
  assert(causalSelection.ok && causalSelection.value === 'CAUSAL_CHAIN', '10 typed causal feature selects Judgment');
  assert(analogySelection.ok && analogySelection.value === 'ANALOGY', '11 typed analogy feature selects analogy');
  assert(counterfactualSelection.ok && counterfactualSelection.value === 'COUNTERFACTUAL', '12 typed counterfactual feature selects foresight');
  assert(exactSelection.ok && exactSelection.value === 'EXACT_COMPUTATION', '13 typed exact-operation feature selects exact computation');

  const priority = { ...features('RULE_DEDUCTION'), exactOperationRequested: true, counterfactualRequested: true };
  const prioritySelection = selectReasoningMethod(priority);
  assert(prioritySelection.ok && prioritySelection.value === 'EXACT_COMPUTATION', '14 exact computation wins the documented deterministic priority');
  const noMethod = selectReasoningMethod({ ...features('RULE_DEDUCTION'), hasRules: false });
  assert(!noMethod.ok && noMethod.error === 'no-method', '15 no matching typed feature returns no-method');

  const wrong = executeReasoningMethod({ ...execution('RULE_DEDUCTION'), methodId: 'ANALOGY' }, dependencies());
  assert(!wrong.ok && wrong.error === 'wrong-method', '16 a method that disagrees with the selector is refused');

  const rule = executeReasoningMethod(execution('RULE_DEDUCTION'), dependencies());
  assert(rule.ok && rule.value.outcome.kind === 'DEDUCED' && rule.value.outcome.conclusionRef === 'conclusion-1', '17 rule deduction derives only from VERIFIED premises and a VERIFIED rule');

  const constraint = executeReasoningMethod(execution('CONSTRAINT_SATISFACTION'), dependencies());
  assert(constraint.ok && constraint.value.outcome.kind === 'CONSTRAINT_RESULT' && constraint.value.outcome.satisfied, '18 constraint satisfaction returns the computed typed constraint result');

  const textFeatures = { ...features('RULE_DEDUCTION'), text: 'choose a method from this sentence' };
  assert(!selectReasoningMethod(textFeatures).ok, '19 raw message text is not accepted as a method feature');

  const unverified = execution('RULE_DEDUCTION');
  const unverifiedFacts = [{ ...unverified.facts[0]!, truth: 'INFERRED' as const }];
  const unverifiedResult = executeReasoningMethod({ ...unverified, facts: unverifiedFacts }, dependencies());
  assert(!unverifiedResult.ok && unverifiedResult.error === 'no-valid-rule', '20 an unverified premise cannot support rule deduction');

  const unclearConstraint = execution('CONSTRAINT_SATISFACTION');
  const disputedConstraint = [{ ...unclearConstraint.constraints[0]!, evidence: 'DISPUTED' as const }];
  const disputedResult = executeReasoningMethod({ ...unclearConstraint, constraints: disputedConstraint }, dependencies());
  assert(disputedResult.ok && disputedResult.value.outcome.kind === 'CONSTRAINT_RESULT' && !disputedResult.value.outcome.satisfied, '21 disputed constraint evidence is not counted as satisfied');

  const analogy = executeReasoningMethod(execution('ANALOGY'), dependencies());
  assert(analogy.ok && analogy.value.outcome.kind === 'CANDIDATE' && analogy.value.outcome.transferability === 'NOT_ESTABLISHED' && analogy.value.verifier === 'NOT_APPLICABLE', '22 analogy always stays a candidate with mapping, differences and a validation test');

  let judged = false;
  const judgedDeps = dependencies({ judgment: { evaluateCausalChain: () => { judged = true; return external('judgment'); } } });
  const causal = executeReasoningMethod(execution('CAUSAL_CHAIN'), judgedDeps);
  assert(causal.ok && judged && causal.value.outcome.kind === 'CAUSAL_JUDGMENT', '23 causal reasoning is delegated to the injected Judgment adapter');

  let lookedAhead = false;
  const lookaheadDeps = dependencies({ foresight: { evaluateCounterfactual: () => { lookedAhead = true; return external('lookahead'); } } });
  const counterfactual = executeReasoningMethod(execution('COUNTERFACTUAL'), lookaheadDeps);
  assert(counterfactual.ok && lookedAhead && counterfactual.value.outcome.kind === 'COUNTERFACTUAL', '24 counterfactual reasoning is delegated to foresight lookahead');

  let computed = false;
  const exactDeps = dependencies({ exactEngine: { compute: () => { computed = true; return external('exact'); } } });
  const exact = executeReasoningMethod(execution('EXACT_COMPUTATION'), exactDeps);
  assert(exact.ok && computed && exact.value.outcome.kind === 'EXACT_RESULT', '25 exact computation calls the injected exact engine');

  const verifyFail = executeReasoningMethod(execution('EXACT_COMPUTATION'), dependencies({ verifier: { verify: () => ({ ok: true, value: false }) } }));
  assert(verifyFail.ok && verifyFail.value.verifier === 'FAILED' && verifyFail.value.trace.evidence === 'UNKNOWN', '26 an unverified method result is never labelled verified');

  const delegateFail = executeReasoningMethod(execution('CAUSAL_CHAIN'), dependencies({ judgment: { evaluateCausalChain: () => ({ ok: false, error: 'judgment-failed', message: 'No safe causal judgment.' }) } }));
  assert(!delegateFail.ok && delegateFail.error === 'judgment-failed', '27 a Judgment failure is returned rather than replaced with a guess');
  console.log(`CORTEX part 5 methods passed: ${checks} cases`);
}
main();
