/** CORTEX R2 / Part 5: typed reasoning method registry and safe dispatch. */
import type { CortexEngineResult, EvidenceLabel, TraceEntry } from './cortexTypes.ts';

export type ReasoningMethodId = 'RULE_DEDUCTION' | 'CONSTRAINT_SATISFACTION' | 'CAUSAL_CHAIN' | 'ANALOGY' | 'COUNTERFACTUAL' | 'EXACT_COMPUTATION';
export type MethodDelegate = 'LOCAL_RULES' | 'LOCAL_CONSTRAINTS' | 'JUDGMENT' | 'NONE' | 'FORESIGHT_LOOKAHEAD' | 'EXACT_ENGINE';

export interface ReasoningMethodDescriptor {
  readonly id: ReasoningMethodId;
  readonly purpose: string;
  readonly inputs: string;
  readonly assumptions: string;
  readonly validity: string;
  readonly output: string;
  readonly limits: string;
  readonly verifier: string;
  readonly delegate: MethodDelegate;
}

export interface MethodFeatureRecord {
  readonly hasRules: boolean;
  readonly hasConstraints: boolean;
  readonly hasCausalChain: boolean;
  readonly analogyRequested: boolean;
  readonly counterfactualRequested: boolean;
  readonly exactOperationRequested: boolean;
  readonly trace: TraceEntry;
}

export interface MethodFact {
  readonly id: string;
  readonly valueRef: string;
  readonly truth: EvidenceLabel;
  readonly trace: TraceEntry;
}

export interface DeductionRule {
  readonly id: string;
  readonly antecedentRefs: readonly string[];
  readonly consequentRef: string;
  readonly evidence: EvidenceLabel;
  readonly trace: TraceEntry;
}

export interface ConstraintFact {
  readonly id: string;
  readonly targetRef: string;
  readonly satisfied: boolean;
  readonly evidence: EvidenceLabel;
  readonly trace: TraceEntry;
}

export interface AnalogyMapping {
  readonly sourceRef: string;
  readonly targetRef: string;
  readonly relationRef: string;
  readonly trace: TraceEntry;
}

export interface AnalogyInput {
  readonly sourceModelRef: string;
  readonly targetModelRef: string;
  readonly mappings: readonly AnalogyMapping[];
  readonly differences: readonly string[];
  readonly validationTestRef: string;
  readonly trace: TraceEntry;
}

export interface DelegatedMethodInput {
  readonly taskRef: string;
  readonly inputRefs: readonly string[];
  readonly trace: TraceEntry;
}

export interface ExactEngineInput {
  readonly operationRef: string;
  readonly inputRefs: readonly string[];
  readonly trace: TraceEntry;
}

export interface MethodExecutionInput {
  readonly methodId: ReasoningMethodId;
  readonly features: MethodFeatureRecord;
  readonly facts: readonly MethodFact[];
  readonly rules: readonly DeductionRule[];
  readonly constraints: readonly ConstraintFact[];
  readonly analogy: AnalogyInput | null;
  readonly causal: DelegatedMethodInput | null;
  readonly counterfactual: DelegatedMethodInput | null;
  readonly exact: ExactEngineInput | null;
  readonly trace: TraceEntry;
}

export interface ExternalMethodResult {
  readonly resultRef: string;
  readonly evidence: EvidenceLabel;
  readonly trace: TraceEntry;
}

export interface ReasoningMethodDependencies {
  readonly judgment: {
    evaluateCausalChain(input: DelegatedMethodInput): CortexEngineResult<ExternalMethodResult>;
  };
  readonly foresight: {
    evaluateCounterfactual(input: DelegatedMethodInput): CortexEngineResult<ExternalMethodResult>;
  };
  readonly exactEngine: {
    compute(input: ExactEngineInput): CortexEngineResult<ExternalMethodResult>;
  };
  readonly verifier: {
    verify(methodId: ReasoningMethodId, outputRef: string, trace: TraceEntry): CortexEngineResult<boolean>;
  };
}

export type MethodOutcome =
  | { readonly kind: 'DEDUCED'; readonly conclusionRef: string; readonly premiseRefs: readonly string[]; readonly evidence: 'INFERRED'; readonly trace: TraceEntry }
  | { readonly kind: 'CONSTRAINT_RESULT'; readonly satisfied: boolean; readonly failedConstraintRefs: readonly string[]; readonly evidence: 'INFERRED'; readonly trace: TraceEntry }
  | { readonly kind: 'CAUSAL_JUDGMENT'; readonly resultRef: string; readonly evidence: EvidenceLabel; readonly trace: TraceEntry }
  | { readonly kind: 'CANDIDATE'; readonly mapping: readonly AnalogyMapping[]; readonly differences: readonly string[]; readonly validationTestRef: string; readonly transferability: 'NOT_ESTABLISHED'; readonly evidence: 'INFERRED'; readonly trace: TraceEntry }
  | { readonly kind: 'COUNTERFACTUAL'; readonly resultRef: string; readonly evidence: EvidenceLabel; readonly trace: TraceEntry }
  | { readonly kind: 'EXACT_RESULT'; readonly resultRef: string; readonly evidence: EvidenceLabel; readonly trace: TraceEntry };

export interface MethodRunResult {
  readonly method: ReasoningMethodId;
  readonly outcome: MethodOutcome;
  readonly verifier: 'PASSED' | 'FAILED' | 'NOT_APPLICABLE';
  readonly trace: TraceEntry;
}

export const REASONING_METHODS: Readonly<Record<ReasoningMethodId, ReasoningMethodDescriptor>> = Object.freeze({
  RULE_DEDUCTION: {
    id: 'RULE_DEDUCTION', purpose: 'Derive a consequence from admitted rules and established premises.',
    inputs: 'verified premises and a typed rule with antecedent and consequent references.',
    assumptions: 'Rules are admitted and premises have verified evidence.', validity: 'All antecedents are present with VERIFIED evidence.',
    output: 'An inferred conclusion reference with its premises.', limits: 'Does not establish the source truth of premises or rules.',
    verifier: 'Check the conclusion against the rule and premise references.', delegate: 'LOCAL_RULES',
  },
  CONSTRAINT_SATISFACTION: {
    id: 'CONSTRAINT_SATISFACTION', purpose: 'Check a candidate state against explicit typed constraints.',
    inputs: 'typed constraint facts with target references and observed satisfaction states.',
    assumptions: 'Constraint definitions and observed states are supplied by trusted stages.', validity: 'Every constraint is checked; unresolved evidence is not silently treated as satisfied.',
    output: 'A satisfied flag and the references of constraints that failed.', limits: 'Does not invent missing constraints or repair a violating state.',
    verifier: 'Re-evaluate each constraint against the source state.', delegate: 'LOCAL_CONSTRAINTS',
  },
  CAUSAL_CHAIN: {
    id: 'CAUSAL_CHAIN', purpose: 'Evaluate a typed causal chain using Judgment.',
    inputs: 'A typed causal task and its fact references.', assumptions: 'The Judgment adapter validates the causal situation.',
    validity: 'The injected Judgment result is successful and traceable.', output: 'A reference to the Judgment result.',
    limits: 'Correlation or similarity alone is not a cause; the method does not prove causation by analogy.',
    verifier: 'Check the returned Judgment result and its evidence.', delegate: 'JUDGMENT',
  },
  ANALOGY: {
    id: 'ANALOGY', purpose: 'Compare typed structures to generate a candidate explanation.',
    inputs: 'Source and target model references, mapped relations, differences and a validation test.',
    assumptions: 'A mapped relation is a proposal, not proof.', validity: 'Mappings and differences are present and the validation test is named.',
    output: 'A CANDIDATE with mappings, differences and a validation test.',
    limits: 'Never claims that a relation transfers or that the analogy is true.',
    verifier: 'Run the named validation test separately; analogy output itself remains a candidate.', delegate: 'NONE',
  },
  COUNTERFACTUAL: {
    id: 'COUNTERFACTUAL', purpose: 'Evaluate a changed condition through foresight lookahead.',
    inputs: 'A typed counterfactual task and its input references.', assumptions: 'The foresight adapter supplies a bounded lookahead.',
    validity: 'The injected lookahead result is successful and reports its search boundary.', output: 'A reference to the foresight result.',
    limits: 'A hypothetical result is not an observed event or a fact about the real world.',
    verifier: 'Check the lookahead result and its bounded-search trace.', delegate: 'FORESIGHT_LOOKAHEAD',
  },
  EXACT_COMPUTATION: {
    id: 'EXACT_COMPUTATION', purpose: 'Compute through an injected exact engine rather than mental recall.',
    inputs: 'A typed operation reference and typed input references.', assumptions: 'The selected exact engine owns the operation contract.',
    validity: 'The engine returns a successful result with a trace and evidence label.', output: 'A reference to the exact result.',
    limits: 'Does not infer missing inputs or replace a failed exact engine with guessed arithmetic.',
    verifier: 'Recompute through an independent path when one is injected and affordable.', delegate: 'EXACT_ENGINE',
  },
});

const methodIds: Readonly<Record<string, true>> = {
  RULE_DEDUCTION: true, CONSTRAINT_SATISFACTION: true, CAUSAL_CHAIN: true,
  ANALOGY: true, COUNTERFACTUAL: true, EXACT_COMPUTATION: true,
};
const evidenceLabels: Readonly<Record<string, true>> = { OBSERVED: true, REPORTED: true, INFERRED: true, VERIFIED: true, DISPUTED: true, UNKNOWN: true };
const featureKeys: Readonly<Record<string, true>> = { hasRules: true, hasConstraints: true, hasCausalChain: true, analogyRequested: true, counterfactualRequested: true, exactOperationRequested: true, trace: true };
const fail = <T>(error: string, message: string): CortexEngineResult<T> => ({ ok: false, error, message });
const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const isText = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0 && value.length <= 240;
const isTrace = (value: unknown): value is TraceEntry => isRecord(value) && isText(value.id) && isText(value.stage) && isText(value.code) && isText(value.sourceRef) && typeof value.evidence === 'string' && Object.prototype.hasOwnProperty.call(evidenceLabels, value.evidence);

/** Deterministic priority: exact computation, counterfactual, causal, analogy, constraints, rules. */
export function selectReasoningMethod(features: MethodFeatureRecord): CortexEngineResult<ReasoningMethodId> {
  if (!isRecord(features) || Object.keys(features).some((key) => !Object.prototype.hasOwnProperty.call(featureKeys, key)) || !isTrace(features.trace) || typeof features.hasRules !== 'boolean' || typeof features.hasConstraints !== 'boolean' ||
      typeof features.hasCausalChain !== 'boolean' || typeof features.analogyRequested !== 'boolean' || typeof features.counterfactualRequested !== 'boolean' ||
      typeof features.exactOperationRequested !== 'boolean') return fail('bad-input', 'Method selection requires a typed feature record.');
  if (features.exactOperationRequested) return { ok: true, value: 'EXACT_COMPUTATION' };
  if (features.counterfactualRequested) return { ok: true, value: 'COUNTERFACTUAL' };
  if (features.hasCausalChain) return { ok: true, value: 'CAUSAL_CHAIN' };
  if (features.analogyRequested) return { ok: true, value: 'ANALOGY' };
  if (features.hasConstraints) return { ok: true, value: 'CONSTRAINT_SATISFACTION' };
  if (features.hasRules) return { ok: true, value: 'RULE_DEDUCTION' };
  return fail('no-method', 'No reasoning method is supported by the supplied typed features.');
}

function validInput(value: unknown): value is MethodExecutionInput {
  if (!isRecord(value) || Object.keys(value).some((key) => !Object.prototype.hasOwnProperty.call({
    methodId: true, features: true, facts: true, rules: true, constraints: true, analogy: true, causal: true, counterfactual: true, exact: true, trace: true,
  }, key))) return false;
  if (typeof value.methodId !== 'string' || !Object.prototype.hasOwnProperty.call(methodIds, value.methodId) || !isTrace(value.trace) ||
      !Array.isArray(value.facts) || !Array.isArray(value.rules) || !Array.isArray(value.constraints)) return false;
  if (value.analogy !== null && value.analogy !== undefined && !isRecord(value.analogy)) return false;
  if (value.causal !== null && value.causal !== undefined && !isRecord(value.causal)) return false;
  if (value.counterfactual !== null && value.counterfactual !== undefined && !isRecord(value.counterfactual)) return false;
  if (value.exact !== null && value.exact !== undefined && !isRecord(value.exact)) return false;
  return selectReasoningMethod(value.features as MethodFeatureRecord).ok;
}

function verifiedPremise(facts: readonly MethodFact[], ref: string): boolean {
  return facts.some((fact) => fact.valueRef === ref && fact.truth === 'VERIFIED');
}

function freezeDeep<T>(value: T): T {
  if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const child of Object.values(value as Record<string, unknown>)) freezeDeep(child);
    Object.freeze(value);
  }
  return value;
}

/** Validates method/feature alignment, performs only local exact checks, and delegates the other engines. */
export function executeReasoningMethod(
  input: MethodExecutionInput,
  deps: ReasoningMethodDependencies,
): CortexEngineResult<MethodRunResult> {
  try {
    if (!validInput(input)) return fail('bad-input', 'Method execution needs valid typed facts and method input.');
    const selected = selectReasoningMethod(input.features);
    if (!selected.ok) return selected;
    if (selected.value !== input.methodId) return fail('wrong-method', 'The selected method does not match the typed feature record.');
    let outcome: MethodOutcome;
    let outputRef: string;
    if (input.methodId === 'RULE_DEDUCTION') {
      const rule = input.rules.find((item) => item.evidence === 'VERIFIED' && item.antecedentRefs.every((ref) => verifiedPremise(input.facts, ref)));
      if (!rule) return fail('no-valid-rule', 'No admitted rule has all VERIFIED premises.');
      outcome = { kind: 'DEDUCED', conclusionRef: rule.consequentRef, premiseRefs: [...rule.antecedentRefs], evidence: 'INFERRED',
        trace: { id: `deduction:${rule.id}`, stage: 'OPTION_GENERATOR', code: 'VERIFIED_RULE_APPLIED', sourceRef: rule.trace.id, evidence: 'INFERRED' } };
      outputRef = rule.consequentRef;
    } else if (input.methodId === 'CONSTRAINT_SATISFACTION') {
      if (input.constraints.length === 0) return fail('no-constraints', 'Constraint satisfaction needs at least one typed constraint.');
      const failed = input.constraints.filter((item) => !item.satisfied || item.evidence === 'UNKNOWN' || item.evidence === 'DISPUTED').map((item) => item.id);
      outcome = { kind: 'CONSTRAINT_RESULT', satisfied: failed.length === 0, failedConstraintRefs: failed, evidence: 'INFERRED',
        trace: { id: `constraints:${input.trace.id}`, stage: 'OPTION_GENERATOR', code: 'CONSTRAINTS_CHECKED', sourceRef: input.trace.id, evidence: 'INFERRED' } };
      outputRef = `constraints:${input.trace.id}`;
    } else if (input.methodId === 'ANALOGY') {
      const analogy = input.analogy;
      if (!analogy || !isText(analogy.validationTestRef) || analogy.mappings.length === 0 || analogy.differences.length === 0) {
        return fail('incomplete-analogy', 'An analogy needs mappings, differences and a named validation test.');
      }
      outcome = { kind: 'CANDIDATE', mapping: analogy.mappings, differences: analogy.differences, validationTestRef: analogy.validationTestRef,
        transferability: 'NOT_ESTABLISHED', evidence: 'INFERRED',
        trace: { id: `analogy:${analogy.sourceModelRef}:${analogy.targetModelRef}`, stage: 'OPTION_GENERATOR', code: 'ANALOGY_CANDIDATE_ONLY', sourceRef: analogy.trace.id, evidence: 'INFERRED' } };
      return { ok: true, value: freezeDeep({ method: input.methodId, outcome, verifier: 'NOT_APPLICABLE',
        trace: { id: `method:${input.methodId}`, stage: 'OPTION_GENERATOR', code: 'CANDIDATE_REQUIRES_VALIDATION', sourceRef: input.trace.id, evidence: 'INFERRED' } }) };
    } else {
      let delegated: CortexEngineResult<ExternalMethodResult>;
      if (input.methodId === 'CAUSAL_CHAIN') {
        if (!input.causal) return fail('missing-causal-input', 'The Judgment adapter needs a typed causal task.');
        delegated = deps.judgment.evaluateCausalChain(input.causal);
        if (!delegated.ok) return delegated;
        outcome = { kind: 'CAUSAL_JUDGMENT', resultRef: delegated.value.resultRef, evidence: delegated.value.evidence, trace: delegated.value.trace };
      } else if (input.methodId === 'COUNTERFACTUAL') {
        if (!input.counterfactual) return fail('missing-counterfactual-input', 'The foresight adapter needs a typed counterfactual task.');
        delegated = deps.foresight.evaluateCounterfactual(input.counterfactual);
        if (!delegated.ok) return delegated;
        outcome = { kind: 'COUNTERFACTUAL', resultRef: delegated.value.resultRef, evidence: delegated.value.evidence, trace: delegated.value.trace };
      } else {
        if (!input.exact) return fail('missing-exact-input', 'The exact engine needs an operation reference and input references.');
        delegated = deps.exactEngine.compute(input.exact);
        if (!delegated.ok) return delegated;
        outcome = { kind: 'EXACT_RESULT', resultRef: delegated.value.resultRef, evidence: delegated.value.evidence, trace: delegated.value.trace };
      }
      outputRef = (outcome as { readonly resultRef: string }).resultRef;
    }
    const verified = deps.verifier.verify(input.methodId, outputRef, input.trace);
    if (!verified.ok) return verified;
    return { ok: true, value: freezeDeep({
      method: input.methodId, outcome, verifier: verified.value ? 'PASSED' : 'FAILED',
      trace: { id: `method:${input.methodId}`, stage: 'OPTION_GENERATOR', code: verified.value ? 'METHOD_VERIFIED_BY_ADAPTER' : 'METHOD_NOT_VERIFIED', sourceRef: input.trace.id, evidence: verified.value ? 'VERIFIED' : 'UNKNOWN' },
    }) };
  } catch {
    return fail('method-failed', 'The selected reasoning method failed without producing a trusted result.');
  }
}
