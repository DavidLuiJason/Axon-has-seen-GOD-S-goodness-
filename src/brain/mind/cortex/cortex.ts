/** CORTEX R4 / Part 12: isolated typed facade between Resolution and Planning. */
import { buildObjectiveFrame, type ObjectiveFrame } from './objectiveFrame.ts';
import { generateOptions, type CortexOption, type OptionGeneration, type OptionGenerationLimits } from './optionGenerator.ts';
import { evaluateOptions, type ActionKind, type FlagSignal, type JudgmentSignal, type OptionEvaluationResult, type RiskLevel, type ResourceFit } from './optionEvaluator.ts';
import { applyAskPolicy, type AskPolicyConfig, type AskPolicyResult } from './askPolicy.ts';
import { buildTaskGraph, type TaskGraph } from './taskGraph.ts';
import { reconcileCommitment, type ReconciliationRequest, type ReconciliationResult } from './reconcile.ts';
import { verifyAndRecover, type OutcomeObservation } from './verifyRecover.ts';
import { buildCortexInput, createDecisionRecord, type BudgetUsed, type CortexDecision, type CortexEngineResult, type CortexInput, type DecisionRecord, type EvidenceLabel, type CostClass, type RejectedOption, type SuccessTest, type TraceEntry } from './cortexTypes.ts';
import { validatePlan, type Goal, type Plan } from '../plan/plan.ts';

export interface CortexAdvisorySignals {
  readonly risk: RiskLevel;
  readonly resourceFit: ResourceFit;
  readonly actionKind: ActionKind;
  readonly councilFlags: readonly FlagSignal[];
  readonly judgment: JudgmentSignal;
  readonly uncertain: boolean;
}

export interface CortexDependencies {
  readonly maxOptionDepth: number;
  readonly advisorySignals: (input: CortexInput, option: CortexOption) => CortexAdvisorySignals;
  readonly askPolicy?: AskPolicyConfig;
  readonly reconciliation?: (input: CortexInput) => ReconciliationRequest | null;
  readonly allowOutsideAiProposal?: boolean;
  readonly exactIntegerAdd?: (left: number, right: number) => CortexEngineResult<number>;
  /** D0: further exact two-operand engines, keyed by a typed concept ref in exactConceptKinds; each carries its own independent second path. */
  readonly exactBinaryOps?: Readonly<Record<string, ExactBinaryOp>>;
}

export interface ExactBinaryOp {
  readonly engine: (left: number, right: number) => CortexEngineResult<number>;
  readonly independent: (left: bigint, right: bigint) => bigint;
}

/** Closed set of typed concept refs that mean exact two-integer computation (an object map, never a phrase list). */
export const exactConceptKinds: Readonly<Record<string, true>> = { INTEGER_ADD: true, INTEGER_SUBTRACT: true, INTEGER_MULTIPLY: true };

function exactOpFor(deps: CortexDependencies, conceptRef: string): ExactBinaryOp | null {
  if (conceptRef === 'INTEGER_ADD' && deps.exactIntegerAdd) return { engine: deps.exactIntegerAdd, independent: (a, b) => a + b };
  const extra = deps.exactBinaryOps?.[conceptRef];
  return extra ?? null;
}

export interface PlanAdapter {
  readonly goal: Goal;
  readonly plan: Plan;
}

export interface CortexFacadeResult {
  readonly decision: DecisionRecord;
  readonly frame: ObjectiveFrame;
  readonly options: OptionGeneration;
  readonly evaluation: OptionEvaluationResult | null;
  readonly askPolicy: AskPolicyResult | null;
  readonly reconciliation: ReconciliationResult | null;
  readonly planAdapter: PlanAdapter | null;
  readonly taskGraph: TaskGraph | null;
  readonly trace: readonly TraceEntry[];
}

const fail = <T>(error: string, message: string): CortexEngineResult<T> => ({ ok: false, error, message });
const outsidePurposes: Readonly<Record<string, 'RESEARCH' | 'COMPUTATION' | 'REVIEW'>> = {
  OUTSIDE_AI_RESEARCH: 'RESEARCH', OUTSIDE_AI_COMPUTATION: 'COMPUTATION', OUTSIDE_AI_REVIEW: 'REVIEW',
};
const evidenceByDecision: Readonly<Record<CortexDecision['kind'], EvidenceLabel>> = {
  ANSWER: 'VERIFIED', RUN: 'OBSERVED', PLAN: 'INFERRED', ASK: 'UNKNOWN', DECLINE: 'UNKNOWN', PROPOSE_OUTSIDE_AI: 'INFERRED',
};
const compareText = (a: string, b: string): number => a < b ? -1 : a > b ? 1 : 0;

function trace(id: string, code: string, sourceRef: string, evidence: EvidenceLabel = 'INFERRED'): TraceEntry {
  return { id, stage: 'DECISION', code, sourceRef, evidence };
}
function maxCost(a: CortexInput['candidateCapabilities'][number]['costClass'], b: CortexInput['candidateCapabilities'][number]['costClass']): CortexInput['candidateCapabilities'][number]['costClass'] {
  const rank = { LOW: 0, MEDIUM: 1, HIGH: 2 } as const;
  return rank[a] >= rank[b] ? a : b;
}
function decisionSuccessTest(input: CortexInput, clauseId: string | null): SuccessTest {
  return input.objective.clauses.find((clause) => clause.id === clauseId)?.meaning.successTest ?? input.objective.clauses[0]!.meaning.successTest;
}
function capabilityFor(input: CortexInput, id: string): CortexInput['candidateCapabilities'][number] | undefined {
  return input.candidateCapabilities.find((capability) => capability.id === id);
}
function permissionFor(input: CortexInput, capabilityId: string): 'ALLOW' | 'ASK' | 'NEVER' {
  return input.permissions.find((item) => item.capabilityId === capabilityId)?.state ?? 'NEVER';
}
function optionsFor(input: CortexInput): CortexEngineResult<OptionGeneration> {
  const limits: OptionGenerationLimits = { maxDepth: 5 };
  return generateOptions(input, limits);
}

function rejectAll(options: OptionGeneration, reasonCode: string): RejectedOption[] {
  return options.options.map((option) => ({ optionId: option.id, kind: option.kind, reasonCode, sourceRef: option.trace.sourceRef,
    trace: trace(`rejected:${option.id}`, reasonCode, option.trace.id, 'OBSERVED') }));
}
function mergeRejected(generated: readonly RejectedOption[], evaluated: OptionEvaluationResult | null, selectedId: string | null): RejectedOption[] {
  const output = new Map<string, RejectedOption>();
  for (const item of generated) output.set(`${item.optionId}:${item.reasonCode}`, item);
  for (const item of evaluated?.rejected ?? []) {
    output.set(`${item.optionId}:${item.reasonCode}`, { optionId: item.optionId,
      kind: evaluated?.ranked.find((ranked) => ranked.optionId === item.optionId)?.kind ?? 'OPTION',
      reasonCode: item.reasonCode, sourceRef: item.reasonRef, trace: item.trace });
  }
  if (selectedId !== null) for (const [key, item] of output) if (item.optionId === selectedId) output.delete(key);
  return [...output.values()].sort((a, b) => compareText(a.optionId, b.optionId) || compareText(a.reasonCode, b.reasonCode));
}

function makeRecord(input: CortexInput, decision: CortexDecision, rejectedOptions: readonly RejectedOption[], reasonCode: string, clauseId: string | null): CortexEngineResult<DecisionRecord> {
  const decisionTrace = decision.trace;
  const record: unknown = {
    id: `cortex-decision:${input.objective.originalRequestId}`,
    decision,
    reasonCodes: { [reasonCode]: true },
    rejectedOptions: [...rejectedOptions],
    objectiveTrace: [input.trace, input.objective.trace, ...input.objective.clauses.flatMap((clause) => [clause.trace, clause.meaning.trace])],
    successTest: decisionSuccessTest(input, clauseId),
    budgetUsed: {
      steps: 0, timeClass: input.budget.timeClass, tokens: 0, deviceTier: input.budget.deviceTier,
      trace: trace(`budget-used:${input.objective.originalRequestId}`, 'PURE_DECISION_NO_EXECUTION_BUDGET_CONSUMED', input.budget.trace.id, 'OBSERVED'),
    } satisfies BudgetUsed,
    evidenceLabels: [evidenceByDecision[decision.kind]],
    trace: decisionTrace,
  };
  return createDecisionRecord(record);
}

function askDecision(input: CortexInput, clauseId: string | null, questionRef: string, optionRefs: readonly string[], askKind: 'CLARIFICATION' | 'MISSING_INPUT' | 'APPROVAL', sourceRef: string): CortexDecision {
  return { kind: 'ASK', askKind, clauseId, questionRef, optionRefs: [...optionRefs],
    trace: trace(`decision:ask:${input.objective.originalRequestId}`, 'QUESTION_NECESSARY', sourceRef, 'UNKNOWN') };
}
function declineDecision(input: CortexInput, clauseId: string | null, declineKind: 'NO_CAPABILITY' | 'BLOCKED' | 'CANNOT_JUDGE', reasonCode: string, sourceRef: string): CortexDecision {
  return { kind: 'DECLINE', declineKind, clauseId, reasonCode,
    trace: trace(`decision:decline:${input.objective.originalRequestId}`, reasonCode, sourceRef, 'UNKNOWN') };
}

function applyReconciliation(input: CortexInput, deps: CortexDependencies): CortexEngineResult<ReconciliationResult | null> {
  if (!deps.reconciliation) return { ok: true, value: null };
  try {
    const request = deps.reconciliation(input);
    if (request === null) return { ok: true, value: null };
    return reconcileCommitment(request);
  } catch {
    return fail('reconciliation-adapter-failed', 'The typed commitment adapter failed without changing a commitment.');
  }
}

function exactConceptOf(clause: CortexInput['objective']['clauses'][number]): string | null {
  return clause.meaning.conceptRefs.find((ref) => exactConceptKinds[ref] === true) ?? null;
}

function exactAddition(input: CortexInput, clauseId: string, deps: CortexDependencies): CortexEngineResult<{ readonly value: number; readonly evidence: 'VERIFIED' }> | null {
  const clause = input.objective.clauses.find((item) => item.id === clauseId);
  const conceptRef = clause ? exactConceptOf(clause) : null;
  if (!clause || conceptRef === null) return null;
  const op = exactOpFor(deps, conceptRef);
  if (!op) return fail('exact-engine-missing', 'A typed exact computation needs an injected exact engine for its concept.');
  const leftSlot = clause.meaning.slots.find((slot) => slot.kind === 'INTEGER_LEFT');
  const rightSlot = clause.meaning.slots.find((slot) => slot.kind === 'INTEGER_RIGHT');
  if (!leftSlot || !rightSlot || leftSlot.state !== 'FILLED' || rightSlot.state !== 'FILLED' || leftSlot.valueRef === undefined || rightSlot.valueRef === undefined) {
    return fail('integer-input-missing', 'Typed integer addition needs two filled integer operand slots.');
  }
  const left = Number(leftSlot.valueRef);
  const right = Number(rightSlot.valueRef);
  if (!Number.isSafeInteger(left) || !Number.isSafeInteger(right)) return fail('integer-input-invalid', 'The exact integer engine accepts safe integer operands only.');
  let exact: CortexEngineResult<number>;
  let independent: bigint;
  try {
    exact = op.engine(left, right);
    independent = op.independent(BigInt(leftSlot.valueRef), BigInt(rightSlot.valueRef));
  } catch {
    return fail('integer-computation-failed', 'The exact engine or independent integer path did not complete safely.');
  }
  if (!exact.ok) return exact;
  if (!Number.isSafeInteger(exact.value) || BigInt(exact.value) !== independent) {
    return fail('independent-path-mismatch', 'The exact engine disagrees with the independent integer computation.');
  }
  const expected = clause.meaning.successTest.expected;
  const primary: OutcomeObservation = { outcome: 'SUCCESS', hasValue: true, value: exact.value, sourceRef: 'injected-exact-integer-engine', evidence: 'OBSERVED', trace: leftSlot.trace };
  const second: OutcomeObservation = { outcome: 'SUCCESS', hasValue: true, value: Number(independent), sourceRef: 'independent-bigint-path', evidence: 'OBSERVED', trace: rightSlot.trace };
  const verified = verifyAndRecover({ successTest: clause.meaning.successTest, clauseId, primary,
    independentCheck: { availability: 'AVAILABLE', costClass: 'LOW', observation: second, trace: trace(`integer-second-path:${clauseId}`, 'BIGINT_INDEPENDENT_PATH', rightSlot.trace.id, 'OBSERVED') },
    remainingStepBudget: input.budget.stepLimit, strikes: 0, cyclesWithoutGain: 0, ownerDecisionPending: false, trace: trace(`integer-verify:${clauseId}`, 'EXACT_ARITHMETIC_VERIFY', clause.trace.id, 'OBSERVED') });
  if (!verified.ok) return fail(verified.error, verified.message);
  if (verified.value.outcome !== 'VERIFIED_SUCCESS' || expected !== exact.value) return fail('integer-success-test-failed', 'The exact result did not satisfy the objective success test.');
  return { ok: true, value: { value: exact.value, evidence: 'VERIFIED' } };
}

function factorFor(input: CortexInput, option: CortexOption, deps: CortexDependencies) {
  const signals = deps.advisorySignals(input, option);
  const ids = option.kind === 'RUN' ? [option.capabilityId] : option.kind === 'PLAN' ? [...option.capabilityIds] : [];
  const capabilities = ids.map((id) => capabilityFor(input, id)).filter((item): item is NonNullable<typeof item> => item !== undefined);
  const reversibility = capabilities.some((item) => item.reversibility === 'IRREVERSIBLE') ? 'IRREVERSIBLE' as const :
    capabilities.some((item) => item.reversibility === 'REVERSIBLE') ? 'REVERSIBLE' as const : 'NOT_APPLICABLE' as const;
  const costClass = capabilities.reduce<CostClass>((cost, item) => maxCost(cost, item.costClass), 'LOW');
  const permission = option.kind === 'RUN' ? option.permission : ids.some((id) => permissionFor(input, id) !== 'ALLOW') ? 'NEVER' as const : 'ALLOW' as const;
  const evidence = option.kind === 'ANSWER' ? option.evidence : 'OBSERVED' as const;
  return {
    evidence, reversibility, costClass, risk: signals.risk, resourceFit: signals.resourceFit, actionKind: signals.actionKind,
    permission, councilFlags: signals.councilFlags, judgment: signals.judgment, uncertain: signals.uncertain,
    trace: trace(`factors:${option.id}`, 'INJECTED_JUDGMENT_AND_COUNCIL_SIGNALS', option.trace.id, evidence),
  };
}

function askFromOption(input: CortexInput, option: Extract<CortexOption, { kind: 'ASK' }>, deps: CortexDependencies): CortexEngineResult<{ readonly policy: AskPolicyResult; readonly decision: CortexDecision }> {
  const capability = option.capabilityId === null ? undefined : capabilityFor(input, option.capabilityId);
  const policy = applyAskPolicy({ candidates: [{
    id: option.id, clauseId: option.clauseId, askKind: option.askKind, questionRef: option.id, optionRefs: option.missingRefs,
    contextCanAnswer: false, calculationCanAnswer: false, safeReversibleStepCanAnswer: false,
    irreversibleAction: capability?.reversibility === 'IRREVERSIBLE', approvalRequired: option.askKind === 'APPROVAL',
    answerChangesResult: true, trace: option.trace,
  }], pendingQueue: [], trace: option.trace }, deps.askPolicy);
  if (!policy.ok) return policy;
  const first = policy.value.currentQuestions[0];
  if (!first) return fail('question-not-needed', 'The necessity check found no question to ask.');
  return { ok: true as const, value: { policy: policy.value, decision: askDecision(input, first.clauseId, first.questionRef, first.optionRefs, first.askKind, option.trace.id) } };
}

function buildPlan(input: CortexInput, option: Extract<CortexOption, { kind: 'PLAN' }>): CortexEngineResult<{ graph: TaskGraph; adapter: PlanAdapter; decision: CortexDecision }> {
  const selectedClause = input.objective.clauses.find((clause) => clause.id === option.clauseId);
  if (!selectedClause) return fail('plan-clause-missing', 'The selected Plan does not refer to an objective clause.');
  const successTest = selectedClause.meaning.successTest;
  const pathCapabilities = option.capabilityIds.map((id) => capabilityFor(input, id));
  if (pathCapabilities.some((capability) => !capability) || pathCapabilities.length < 2) return fail('plan-capability-missing', 'A Plan path must contain at least two known capabilities.');
  const caps = pathCapabilities as NonNullable<(typeof pathCapabilities)[number]>[];
  if (caps.some((capability) => permissionFor(input, capability.id) !== 'ALLOW' || capability.availability !== 'AVAILABLE')) {
    return fail('plan-permission-blocked', 'A Plan path includes an unavailable or non-ALLOWED capability.');
  }
  const finalCap = caps[caps.length - 1]!;
  if (!finalCap.effects.some((effect) => effect.ref === successTest.targetRef)) return fail('plan-does-not-produce-objective', 'The final capability does not produce the objective success target.');
  const workItems = caps.map((capability, index) => {
    const clauseRef = capability.clauseRefs.find((id) => input.objective.clauses.some((clause) => clause.id === id)) ?? option.clauseId;
    const outputRef = capability.effects.find((effect) => effect.ref === successTest.targetRef)?.ref ?? capability.effects[0]?.ref ?? `capability:${capability.id}:complete`;
    const acceptanceTest: SuccessTest = index === caps.length - 1 ? successTest : {
      id: `intermediate-success:${capability.id}`, targetRef: outputRef, operator: 'PRESENT', expected: true,
      trace: trace(`intermediate-test:${capability.id}`, 'CAPABILITY_EFFECT_ACCEPTANCE', capability.trace.id, 'INFERRED'),
    };
    const dependency = index === 0 ? [] : [caps[index - 1]!.id];
    return {
      id: capability.id, parentId: index === 0 ? null : caps[index - 1]!.id, clauseRef,
      inputs: capability.slots.filter((slot) => slot.state === 'FILLED' && slot.valueRef !== null).map((slot) => slot.valueRef as string),
      outputs: capability.effects.map((effect) => effect.ref), dependencies: dependency, acceptanceTest,
      capabilityId: capability.id, reversibility: capability.reversibility, reportedState: 'NOT_STARTED' as const,
      startable: index === 0, foundationRank: index, trace: capability.trace,
    };
  });
  const graph = buildTaskGraph({ objectiveId: input.objective.originalRequestId, objectiveRef: input.objective.originalRequestId,
    clauseRefs: input.objective.clauses.map((clause) => clause.id), successTest,
    constraintRefs: input.constraints.map((constraint) => constraint.id), maxSteps: Math.min(50, Math.max(1, input.budget.stepLimit)),
    workItems, trace: trace(`plan-graph:${input.objective.originalRequestId}`, 'CANDIDATE_PLAN_GRAPH', option.trace.id, 'INFERRED') });
  if (!graph.ok) return fail(graph.error, graph.message);
  const steps = graph.value.items.map((item) => ({ stepId: item.id, capabilityId: item.capabilityId, clauseId: item.clauseRef, inputRefs: [...item.inputs],
    trace: trace(`plan-step:${item.id}`, 'VALIDATED_PLAN_STEP', item.trace.id, 'INFERRED') }));
  const decision: CortexDecision = { kind: 'PLAN', planId: graph.value.plan.goalId, clauseId: option.clauseId, steps,
    trace: trace(`decision:plan:${input.objective.originalRequestId}`, 'TASK_GRAPH_AND_PLAN_VALIDATED', graph.value.trace.id, 'INFERRED') };
  return { ok: true, value: { graph: graph.value, adapter: { goal: graph.value.goal, plan: graph.value.plan }, decision } };
}

/** Creates an isolated deciding core. No function here calls a tool, broker, provider, loop or chat. */
export function createCortex(deps: CortexDependencies): { decide(input: unknown): CortexEngineResult<CortexFacadeResult> } {
  return Object.freeze({
    decide(raw: unknown): CortexEngineResult<CortexFacadeResult> {
      try {
        if (!Number.isInteger(deps.maxOptionDepth) || deps.maxOptionDepth < 1 || deps.maxOptionDepth > 10 || typeof deps.advisorySignals !== 'function') {
          return fail('bad-dependencies', 'CORTEX needs a bounded option depth and injected Judgment/Council signals.');
        }
        const built = buildCortexInput(raw);
        if (!built.ok) return fail(built.error, built.message);
        const input = built.value;
        const frameResult = buildObjectiveFrame(input);
        if (!frameResult.ok) return fail(frameResult.error, frameResult.message);
        const generated = generateOptions(input, { maxDepth: deps.maxOptionDepth });
        if (!generated.ok) return fail(generated.error, generated.message);
        const goalProducingOptions = generated.value.options.filter((option) => {
          if (option.kind !== 'PLAN') return true;
          const clause = input.objective.clauses.find((item) => item.id === option.clauseId);
          const finalId = option.capabilityIds[option.capabilityIds.length - 1];
          const finalCapability = finalId === undefined ? undefined : capabilityFor(input, finalId);
          return clause !== undefined && finalCapability !== undefined && finalCapability.effects.some((effect) => effect.ref === clause.meaning.successTest.targetRef);
        });
        const nonGoalPlans = generated.value.options.filter((option) => option.kind === 'PLAN' && !goalProducingOptions.some((valid) => valid.id === option.id));
        const options: OptionGeneration = { ...generated.value, rejected: [...generated.value.rejected, ...nonGoalPlans.map((option) => ({
          optionId: option.id, kind: 'PLAN', reasonCode: 'PLAN_DOES_NOT_PRODUCE_OBJECTIVE_SUCCESS', sourceRef: option.trace.sourceRef,
          trace: trace(`rejected-goal-plan:${option.id}`, 'PLAN_DOES_NOT_PRODUCE_OBJECTIVE_SUCCESS', option.trace.id, 'OBSERVED'),
        }))] };
        const traceEntries: TraceEntry[] = [input.trace, input.objective.trace, frameResult.value.trace, options.trace];

        const reconciliation = applyReconciliation(input, deps);
        if (!reconciliation.ok) return fail(reconciliation.error, reconciliation.message);
        if (reconciliation.value !== null) {
          traceEntries.push(reconciliation.value.trace);
          if (reconciliation.value.operation === 'ASK') {
            const decision = askDecision(input, input.objective.clauses[0]!.id, `reconcile-question:${input.objective.originalRequestId}`,
              reconciliation.value.targetPriorCommitmentId === null ? [] : [reconciliation.value.targetPriorCommitmentId], 'CLARIFICATION', reconciliation.value.trace.id);
            const reconciliationClauseId = input.objective.clauses[0]!.id;
            const record = makeRecord(input, decision, rejectAll(options, 'COMMITMENT_CONFLICT_REQUIRES_OWNER'), 'COMMITMENT_RECONCILIATION_ASK', reconciliationClauseId);
            if (!record.ok) return fail(record.error, record.message);
            return { ok: true, value: freeze({ decision: record.value, frame: frameResult.value, options, evaluation: null, askPolicy: null,
              reconciliation: reconciliation.value, planAdapter: null, taskGraph: null, trace: traceEntries }) };
          }
        }

        for (const clause of input.objective.clauses) {
          const purpose = clause.meaning.conceptRefs.map((ref) => outsidePurposes[ref]).find((value) => value !== undefined);
          if (purpose !== undefined) {
            if (deps.allowOutsideAiProposal !== true) {
              const decision = declineDecision(input, clause.id, 'CANNOT_JUDGE', 'OUTSIDE_AI_PROPOSAL_NOT_ENABLED', clause.trace.id);
              const record = makeRecord(input, decision, rejectAll(options, 'OUTSIDE_AI_PATH_NOT_ENABLED'), 'OUTSIDE_AI_PROPOSAL_NOT_ENABLED', clause.id);
              if (!record.ok) return fail(record.error, record.message);
              return { ok: true, value: freeze({ decision: record.value, frame: frameResult.value, options, evaluation: null, askPolicy: null,
                reconciliation: reconciliation.value, planAdapter: null, taskGraph: null, trace: traceEntries }) };
            }
            const decision: CortexDecision = { kind: 'PROPOSE_OUTSIDE_AI', proposalId: `outside-ai-proposal:${input.objective.originalRequestId}`,
              purpose, dataRefs: [], trace: trace(`decision:outside-ai:${input.objective.originalRequestId}`, 'PROPOSAL_ONLY_NO_DATA_TRANSFER', clause.trace.id, 'INFERRED') };
            const record = makeRecord(input, decision, rejectAll(options, 'OUTSIDE_AI_PROPOSAL_TAKES_NO_ACTION'), 'OUTSIDE_AI_PROPOSAL_ONLY', clause.id);
            if (!record.ok) return fail(record.error, record.message);
            return { ok: true, value: freeze({ decision: record.value, frame: frameResult.value, options, evaluation: null, askPolicy: null,
              reconciliation: reconciliation.value, planAdapter: null, taskGraph: null, trace: traceEntries }) };
          }
        }

        if (input.pendingQuestion !== null) {
          const pending = input.pendingQuestion;
          const ask = applyAskPolicy({ candidates: [{ id: pending.id, clauseId: pending.clauseId, askKind: 'CLARIFICATION', questionRef: pending.id,
            optionRefs: pending.optionRefs, contextCanAnswer: false, calculationCanAnswer: false, safeReversibleStepCanAnswer: false,
            irreversibleAction: false, approvalRequired: false, answerChangesResult: true, trace: pending.trace }], pendingQueue: [], trace: pending.trace }, deps.askPolicy);
          if (!ask.ok) return fail(ask.error, ask.message);
          const current = ask.value.currentQuestions[0];
          if (!current) return fail('pending-question-not-needed', 'The question necessity check did not retain the pending question.');
          const decision = askDecision(input, current.clauseId, current.questionRef, current.optionRefs, current.askKind, pending.trace.id);
          const record = makeRecord(input, decision, rejectAll(options, 'PENDING_CLARIFICATION_PRECEDES_ACTION'), 'PENDING_QUESTION', current.clauseId);
          if (!record.ok) return fail(record.error, record.message);
          return { ok: true, value: freeze({ decision: record.value, frame: frameResult.value, options, evaluation: null, askPolicy: ask.value,
            reconciliation: reconciliation.value, planAdapter: null, taskGraph: null, trace: traceEntries }) };
        }

        const additionClause = input.objective.clauses.find((clause) => exactConceptOf(clause) !== null);
        if (additionClause) {
          const exact = exactAddition(input, additionClause.id, deps);
          if (!exact || !exact.ok) {
            const reason = exact && !exact.ok ? exact.error : 'EXACT_ENGINE_NOT_APPLICABLE';
            const decision = declineDecision(input, additionClause.id, 'CANNOT_JUDGE', reason, additionClause.trace.id);
            const record = makeRecord(input, decision, rejectAll(options, 'EXACT_ENGINE_DID_NOT_VERIFY'), reason, additionClause.id);
            if (!record.ok) return fail(record.error, record.message);
            return { ok: true, value: freeze({ decision: record.value, frame: frameResult.value, options, evaluation: null, askPolicy: null,
              reconciliation: reconciliation.value, planAdapter: null, taskGraph: null, trace: traceEntries }) };
          }
          const decision: CortexDecision = { kind: 'ANSWER', source: 'ENGINE', clauseId: additionClause.id, answerRef: `exact-result:${exact.value.value}`,
            evidence: exact.value.evidence, trace: trace(`decision:exact-add:${input.objective.originalRequestId}`, 'EXACT_AND_INDEPENDENT_PATHS_AGREE', additionClause.trace.id, 'VERIFIED') };
          const record = makeRecord(input, decision, rejectAll(options, 'EXACT_TYPED_ENGINE_PRECEDENCE'), 'EXACT_COMPUTATION_VERIFIED', additionClause.id);
          if (!record.ok) return fail(record.error, record.message);
          traceEntries.push(decision.trace);
          return { ok: true, value: freeze({ decision: record.value, frame: frameResult.value, options, evaluation: null, askPolicy: null,
            reconciliation: reconciliation.value, planAdapter: null, taskGraph: null, trace: traceEntries }) };
        }

        const candidates = goalProducingOptions.map((option) => ({ option, factors: factorFor(input, option, deps) }));
        const evaluation = evaluateOptions({ currentDepth: 'DIRECT', candidates, trace: trace(`eval:${input.objective.originalRequestId}`, 'EVALUATE_TYPED_OPTIONS', options.trace.id, 'INFERRED') });
        if (!evaluation.ok) return fail(evaluation.error, evaluation.message);
        traceEntries.push(evaluation.value.trace);
        const selected = options.options.find((option) => option.id === evaluation.value.selectedOptionId);
        let decision: CortexDecision;
        let askPolicy: AskPolicyResult | null = null;
        let planAdapter: PlanAdapter | null = null;
        let taskGraph: TaskGraph | null = null;
        let selectedId: string | null = null;

        if (selected?.kind === 'ANSWER') {
          selectedId = selected.id;
          decision = { kind: 'ANSWER', source: 'KNOWLEDGE', clauseId: selected.clauseId, answerRef: selected.answerRef, evidence: selected.evidence,
            trace: trace(`decision:knowledge:${input.objective.originalRequestId}`, 'KNOWLEDGE_HIT_SELECTED', selected.trace.id, selected.evidence) };
        } else if (selected?.kind === 'RUN') {
          selectedId = selected.id;
          if (selected.permission === 'NEVER' || permissionFor(input, selected.capabilityId) === 'NEVER') {
            decision = declineDecision(input, selected.clauseId, 'BLOCKED', 'PERMISSION_NEVER', selected.trace.id);
            selectedId = null;
          } else if (selected.state !== 'READY') {
            decision = declineDecision(input, selected.clauseId, 'BLOCKED', selected.blockReasonCode ?? 'RUN_OPTION_BLOCKED', selected.trace.id);
            selectedId = null;
          } else {
            decision = { kind: 'RUN', capabilityId: selected.capabilityId, clauseId: selected.clauseId, inputRefs: [...selected.inputRefs],
              trace: trace(`decision:run:${input.objective.originalRequestId}`, 'ONE_ALLOWED_CAPABILITY_SELECTED', selected.trace.id, 'OBSERVED') };
          }
        } else if (selected?.kind === 'PLAN') {
          selectedId = selected.id;
          const planned = buildPlan(input, selected);
          if (!planned.ok) return fail(planned.error, planned.message);
          taskGraph = planned.value.graph;
          planAdapter = planned.value.adapter;
          decision = planned.value.decision;
          traceEntries.push(taskGraph.trace);
        } else if (selected?.kind === 'ASK') {
          selectedId = selected.id;
          const asked = askFromOption(input, selected, deps);
          if (!asked.ok) return fail(asked.error, asked.message);
          askPolicy = asked.value.policy;
          decision = asked.value.decision;
        } else {
          const blockedNever = options.options.some((option) => option.kind === 'RUN' && option.permission === 'NEVER');
          const blocked = options.options.find((option) => option.kind === 'DECLINE');
          const declineKind = blocked?.kind === 'DECLINE' ? blocked.declineKind : 'BLOCKED';
          const reasonCode = blockedNever ? 'PERMISSION_NEVER' : blocked?.kind === 'DECLINE' ? blocked.reasonCode : 'ALL_OPTIONS_BLOCKED';
          decision = declineDecision(input, blocked?.kind === 'DECLINE' ? blocked.clauseId : null, declineKind, reasonCode,
            blocked?.kind === 'DECLINE' ? blocked.trace.id : options.trace.id);
        }

        if ((decision.kind === 'RUN' || decision.kind === 'PLAN')) {
          const actionIds = decision.kind === 'RUN' ? [decision.capabilityId] : decision.steps.map((step) => step.capabilityId);
          if (actionIds.some((id) => permissionFor(input, id) === 'NEVER')) {
            decision = declineDecision(input, decision.kind === 'RUN' ? decision.clauseId : decision.clauseId, 'BLOCKED', 'PERMISSION_NEVER', decision.trace.id);
            planAdapter = null; taskGraph = null; selectedId = null;
          }
        }

        const reasonCode = decision.kind === 'ANSWER' ? 'KNOWLEDGE_OR_EXACT_ENGINE_ANSWER' : decision.kind === 'RUN' ? 'ONE_CAPABILITY_PROPOSED' :
          decision.kind === 'PLAN' ? 'BOUNDED_PLAN_PROPOSED' : decision.kind === 'ASK' ? 'QUESTION_NECESSARY' :
          decision.kind === 'DECLINE' ? decision.reasonCode : 'OUTSIDE_AI_PROPOSAL_ONLY';
        const rejectedOptions = mergeRejected(options.rejected, evaluation.value, selectedId);
        const record = makeRecord(input, decision, rejectedOptions, reasonCode, decision.kind === 'DECLINE' ? decision.clauseId :
          decision.kind === 'PROPOSE_OUTSIDE_AI' ? input.objective.clauses[0]!.id : decision.clauseId);
        if (!record.ok) return fail(record.error, record.message);
        traceEntries.push(decision.trace);
        return { ok: true, value: freeze({ decision: record.value, frame: frameResult.value, options, evaluation: evaluation.value,
          askPolicy, reconciliation: reconciliation.value, planAdapter, taskGraph, trace: traceEntries }) };
      } catch {
        return fail('cortex-decision-failed', 'CORTEX stopped without executing a capability or emitting an untraced decision.');
      }
    },
  });
}

function freeze<T>(value: T, seen = new WeakSet<object>()): T {
  if (value !== null && typeof value === 'object') {
    const object = value as object;
    if (seen.has(object) || Object.isFrozen(object)) return value;
    seen.add(object);
    for (const child of Object.values(value as Record<string, unknown>)) freeze(child, seen);
    Object.freeze(object);
  }
  return value;
}

/** Adapt only a facade PLAN that already passed the existing Plan validator; this never executes it. */
export function toOrchestratorPlan(result: CortexFacadeResult): CortexEngineResult<PlanAdapter> {
  try {
    if (result.decision.decision.kind !== 'PLAN' || result.planAdapter === null) return fail('not-a-plan', 'Only a validated CORTEX PLAN can be adapted to the orchestrator Plan types.');
    const checked = validatePlan(result.planAdapter.goal, result.planAdapter.plan);
    if (!checked.ok) return fail('invalid-plan', checked.message);
    return { ok: true, value: freeze({ goal: result.planAdapter.goal, plan: checked.value }) };
  } catch {
    return fail('plan-adapter-failed', 'The validated Plan could not be safely adapted.');
  }
}
