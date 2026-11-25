/** CORTEX R4 / Part 11: verify an outcome and bound recovery before any retry. */
import type { LoopStatus } from '../loop/loop.ts';
import { verifyOutcome, type VerifyReport } from '../verify/verify.ts';
import type { CortexEngineResult, CortexScalar, CostClass, EvidenceLabel, SuccessTest, TraceEntry } from './cortexTypes.ts';

export type ActionOutcome = 'SUCCESS' | 'FAILURE' | 'UNKNOWN';
export type RecoveryOutcome = 'VERIFIED_SUCCESS' | 'REPLAN' | 'ASK_OWNER' | 'ABSTAIN';

export interface OutcomeObservation {
  readonly outcome: ActionOutcome;
  readonly hasValue: boolean;
  readonly value: CortexScalar;
  readonly sourceRef: string;
  readonly evidence: EvidenceLabel;
  readonly trace: TraceEntry;
}

export interface IndependentCheck {
  readonly availability: 'AVAILABLE' | 'UNAVAILABLE';
  readonly costClass: CostClass;
  readonly observation: OutcomeObservation | null;
  readonly trace: TraceEntry;
}

export interface VerifyRecoverInput {
  readonly successTest: SuccessTest;
  readonly clauseId: string;
  readonly primary: OutcomeObservation;
  readonly independentCheck: IndependentCheck | null;
  readonly remainingStepBudget: number;
  readonly strikes: number;
  readonly cyclesWithoutGain: number;
  readonly ownerDecisionPending: boolean;
  readonly trace: TraceEntry;
}

export interface VerifyRecoverResult {
  readonly outcome: RecoveryOutcome;
  readonly reasonCode: string;
  readonly retryAllowed: boolean;
  readonly nextStrikes: number;
  readonly remainingStepBudget: number;
  readonly cyclesWithoutGain: number;
  readonly primaryReport: VerifyReport;
  readonly independentReport: VerifyReport | null;
  readonly independentPathUsed: boolean;
  readonly loopStatus: LoopStatus;
  readonly trace: TraceEntry;
}

const fail = <T>(error: string, message: string): CortexEngineResult<T> => ({ ok: false, error, message });
const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const isText = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0 && value.length <= 240;
const evidenceLabels: Readonly<Record<string, true>> = { OBSERVED: true, REPORTED: true, INFERRED: true, VERIFIED: true, DISPUTED: true, UNKNOWN: true };
const operators: Readonly<Record<string, true>> = { RESOLVED: true, PRESENT: true, EQUALS: true, ABSENT: true };
const costs: Readonly<Record<string, true>> = { LOW: true, MEDIUM: true, HIGH: true };
function traceValid(value: unknown): value is TraceEntry {
  return isRecord(value) && isText(value.id) && isText(value.stage) && isText(value.code) && isText(value.sourceRef) && isText(value.evidence);
}
function observationValid(value: unknown): value is OutcomeObservation {
  if (!isRecord(value)) return false;
  return (value.outcome === 'SUCCESS' || value.outcome === 'FAILURE' || value.outcome === 'UNKNOWN') &&
    typeof value.hasValue === 'boolean' && (value.value === null || typeof value.value === 'string' || typeof value.value === 'boolean' ||
      (typeof value.value === 'number' && Number.isFinite(value.value))) && isText(value.sourceRef) &&
    typeof value.evidence === 'string' && Object.prototype.hasOwnProperty.call(evidenceLabels, value.evidence) && traceValid(value.trace);
}
function inputValid(value: unknown): value is VerifyRecoverInput {
  if (!isRecord(value) || !isRecord(value.successTest) || !isRecord(value.primary) || !traceValid(value.trace)) return false;
  const test = value.successTest;
  if (!isText(test.id) || !isText(test.targetRef) || typeof test.operator !== 'string' || !Object.prototype.hasOwnProperty.call(operators, test.operator) ||
      !(test.expected === null || typeof test.expected === 'string' || typeof test.expected === 'boolean' || (typeof test.expected === 'number' && Number.isFinite(test.expected))) || !traceValid(test.trace) ||
      !isText(value.clauseId) || !observationValid(value.primary) || !Number.isInteger(value.remainingStepBudget) || (value.remainingStepBudget as number) < 0 ||
      !Number.isInteger(value.strikes) || (value.strikes as number) < 0 || (value.strikes as number) > 2 ||
      !Number.isInteger(value.cyclesWithoutGain) || (value.cyclesWithoutGain as number) < 0 || typeof value.ownerDecisionPending !== 'boolean') return false;
  if (value.independentCheck === null) return true;
  const check = value.independentCheck;
  return isRecord(check) && (check.availability === 'AVAILABLE' || check.availability === 'UNAVAILABLE') &&
    typeof check.costClass === 'string' && Object.prototype.hasOwnProperty.call(costs, check.costClass) &&
    (check.observation === null || observationValid(check.observation)) && traceValid(check.trace);
}
function matches(test: SuccessTest, observation: OutcomeObservation): boolean {
  if (observation.outcome !== 'SUCCESS') return false;
  if (test.operator === 'ABSENT') return !observation.hasValue;
  if (test.operator === 'PRESENT' || test.operator === 'RESOLVED') return observation.hasValue;
  return observation.hasValue && observation.value === test.expected;
}
function reportFor(test: SuccessTest, clauseId: string, observation: OutcomeObservation): CortexEngineResult<VerifyReport> {
  const passed = matches(test, observation);
  const steps = observation.outcome === 'UNKNOWN' ? [] : [{
    clauseId, toolId: observation.sourceRef, assumption: test.id,
    reported: observation.outcome === 'FAILURE' ? 'failure' as const : 'success' as const,
    output: observation.hasValue ? String(observation.value) : 'ABSENT',
    check: { kind: 'STATE' as const, observed: passed ? 'PASS' : 'FAIL', expected: 'PASS' },
  }];
  return verifyOutcome({ clauses: [{ id: clauseId, required: true }], steps, priorFailedAssumptions: [] });
}
function loopStatus(outcome: RecoveryOutcome, reasonCode: string): LoopStatus {
  if (outcome === 'VERIFIED_SUCCESS') return 'SUCCESS';
  if (outcome === 'ASK_OWNER') return 'NEEDS_OWNER';
  if (reasonCode === 'STEP_BUDGET_EXHAUSTED') return 'BUDGET_EXHAUSTED';
  if (reasonCode === 'TWO_STRIKES' || reasonCode === 'TWO_CYCLES_WITHOUT_GAIN') return 'NO_PROGRESS';
  if (outcome === 'REPLAN') return 'SUCCESS_TEST_FAILED';
  return 'PLANNER_FAILED';
}
function freezeDeep<T>(value: T): T {
  if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const child of Object.values(value as Record<string, unknown>)) freezeDeep(child);
    Object.freeze(value);
  }
  return value;
}

/** Verifies one action, checks a cheap independent path, and never authorises a blind third retry. */
export function verifyAndRecover(input: VerifyRecoverInput): CortexEngineResult<VerifyRecoverResult> {
  try {
    if (!inputValid(input)) return fail('bad-input', 'Verification needs a success test, typed observations and bounded recovery counters.');
    const primaryResult = reportFor(input.successTest, input.clauseId, input.primary);
    if (!primaryResult.ok) return fail(primaryResult.error, primaryResult.message);
    const useIndependent = input.independentCheck !== null && input.independentCheck.availability === 'AVAILABLE' &&
      input.independentCheck.costClass === 'LOW' && input.independentCheck.observation !== null;
    let independentReport: VerifyReport | null = null;
    if (useIndependent && input.independentCheck?.observation) {
      const independent = reportFor(input.successTest, input.clauseId, input.independentCheck.observation);
      if (!independent.ok) return fail(independent.error, independent.message);
      independentReport = independent.value;
    }

    const primaryPassed = primaryResult.value.overall === 'PASSED';
    const primaryFailed = primaryResult.value.overall === 'FAILED';
    const primaryUnknown = !primaryPassed && !primaryFailed;
    const independentPassed = independentReport?.overall === 'PASSED';
    const independentFailed = independentReport?.overall === 'FAILED';
    const independentUnknown = useIndependent && !independentPassed && !independentFailed;
    let outcome: RecoveryOutcome;
    let reasonCode: string;
    let nextStrikes = input.strikes;

    if (primaryPassed && (!useIndependent || independentPassed)) {
      outcome = 'VERIFIED_SUCCESS';
      reasonCode = useIndependent ? 'BOTH_PATHS_VERIFY_SUCCESS' : 'PRIMARY_PATH_VERIFIES_SUCCESS';
    } else if (primaryUnknown && independentPassed) {
      outcome = 'VERIFIED_SUCCESS';
      reasonCode = 'INDEPENDENT_PATH_RESOLVES_UNKNOWN_OUTCOME';
    } else if ((primaryPassed && independentFailed) || (primaryFailed && independentPassed) || independentUnknown || (primaryUnknown && !useIndependent)) {
      outcome = 'ASK_OWNER';
      reasonCode = 'UNKNOWN_OR_CONFLICTING_OUTCOME_CHECKED_BEFORE_RETRY';
    } else {
      nextStrikes = Math.min(2, input.strikes + 1);
      if (input.ownerDecisionPending) {
        outcome = 'ASK_OWNER';
        reasonCode = 'OWNER_DECISION_PENDING';
      } else if (input.remainingStepBudget <= 0) {
        outcome = 'ABSTAIN';
        reasonCode = 'STEP_BUDGET_EXHAUSTED';
      } else if (input.cyclesWithoutGain >= 2) {
        outcome = 'ABSTAIN';
        reasonCode = 'TWO_CYCLES_WITHOUT_GAIN';
      } else if (input.strikes >= 2) {
        outcome = 'ABSTAIN';
        reasonCode = 'TWO_STRIKES';
      } else {
        outcome = 'REPLAN';
        reasonCode = primaryUnknown ? 'INDEPENDENT_CHECK_FOUND_NO_SUCCESS' : 'SUCCESS_TEST_DID_NOT_PASS';
      }
    }
    const result: VerifyRecoverResult = {
      outcome, reasonCode, retryAllowed: outcome === 'REPLAN', nextStrikes,
      remainingStepBudget: outcome === 'REPLAN' ? Math.max(0, input.remainingStepBudget - 1) : input.remainingStepBudget,
      cyclesWithoutGain: input.cyclesWithoutGain, primaryReport: primaryResult.value, independentReport,
      independentPathUsed: useIndependent, loopStatus: loopStatus(outcome, reasonCode),
      trace: { id: `verify-recover:${input.trace.id}`, stage: 'DECISION', code: reasonCode, sourceRef: input.trace.id,
        evidence: outcome === 'VERIFIED_SUCCESS' ? 'VERIFIED' : outcome === 'ASK_OWNER' ? 'UNKNOWN' : 'INFERRED' },
    };
    return { ok: true, value: freezeDeep(result) };
  } catch {
    return fail('verify-recover-failed', 'Verification or recovery stopped without claiming success or retrying.');
  }
}
