import { verifyAndRecover, type VerifyRecoverInput, type OutcomeObservation } from '../src/brain/mind/cortex/verifyRecover.ts';
import type { SuccessTest, TraceEntry } from '../src/brain/mind/cortex/cortexTypes.ts';

let checks = 0;
function assert(value: unknown, label: string): asserts value { checks += 1; if (!value) throw new Error(`FAIL: ${label}`); }
function trace(id: string): TraceEntry { return { id, stage: 'DECISION', code: 'CHECK', sourceRef: id, evidence: 'OBSERVED' }; }
const test: SuccessTest = { id: 'success-1', targetRef: 'result', operator: 'EQUALS', expected: 42, trace: trace('success-test') };
function obs(outcome: OutcomeObservation['outcome'], value: number | null = 42): OutcomeObservation {
  return { outcome, hasValue: value !== null, value, sourceRef: 'engine', evidence: outcome === 'SUCCESS' ? 'OBSERVED' : outcome === 'UNKNOWN' ? 'UNKNOWN' : 'DISPUTED', trace: trace(`obs-${outcome}-${value}`) };
}
function input(overrides: Partial<VerifyRecoverInput> = {}): VerifyRecoverInput {
  return { successTest: test, clauseId: 'clause-1', primary: obs('SUCCESS'), independentCheck: {
    availability: 'AVAILABLE', costClass: 'LOW', observation: obs('SUCCESS'), trace: trace('independent-check'),
  }, remainingStepBudget: 3, strikes: 0, cyclesWithoutGain: 0, ownerDecisionPending: false, trace: trace('recover-input'), ...overrides };
}
function main(): void {
  let r = verifyAndRecover(input());
  assert(r.ok && r.value.outcome === 'VERIFIED_SUCCESS' && r.value.loopStatus === 'SUCCESS', '01 primary and cheap independent path verify success');
  r = verifyAndRecover(input({ primary: obs('FAILURE'), independentCheck: { availability: 'AVAILABLE', costClass: 'LOW', observation: obs('FAILURE'), trace: trace('fail-check') } }));
  assert(r.ok && r.value.outcome === 'REPLAN' && r.value.retryAllowed && r.value.nextStrikes === 1, '02 two failed paths allow one bounded replan');
  r = verifyAndRecover(input({ primary: obs('UNKNOWN'), independentCheck: { availability: 'AVAILABLE', costClass: 'LOW', observation: obs('UNKNOWN', null), trace: trace('unknown-check') } }));
  assert(r.ok && r.value.outcome === 'ASK_OWNER' && !r.value.retryAllowed, '03 unknown outcome is checked before any retry');
  r = verifyAndRecover(input({ primary: obs('UNKNOWN'), independentCheck: { availability: 'AVAILABLE', costClass: 'LOW', observation: obs('SUCCESS'), trace: trace('resolves-check') } }));
  assert(r.ok && r.value.outcome === 'VERIFIED_SUCCESS' && r.value.reasonCode === 'INDEPENDENT_PATH_RESOLVES_UNKNOWN_OUTCOME', '04 independent second path can resolve unknown primary outcome');
  r = verifyAndRecover(input({ primary: obs('UNKNOWN'), independentCheck: null }));
  assert(r.ok && r.value.outcome === 'ASK_OWNER' && r.value.nextStrikes === 0, '05 unknown without second path asks before incrementing retry strikes');
  r = verifyAndRecover(input({ primary: obs('FAILURE'), independentCheck: null, remainingStepBudget: 0 }));
  assert(r.ok && r.value.outcome === 'ABSTAIN' && r.value.loopStatus === 'BUDGET_EXHAUSTED', '06 exhausted step budget abstains');
  r = verifyAndRecover(input({ primary: obs('FAILURE'), independentCheck: null, cyclesWithoutGain: 2 }));
  assert(r.ok && r.value.outcome === 'ABSTAIN' && r.value.reasonCode === 'TWO_CYCLES_WITHOUT_GAIN', '07 two cycles without gain stop recovery');
  r = verifyAndRecover(input({ primary: obs('FAILURE'), independentCheck: null, strikes: 2 }));
  assert(r.ok && r.value.outcome === 'ABSTAIN' && r.value.reasonCode === 'TWO_STRIKES' && !r.value.retryAllowed, '08 two strikes prevent a third blind retry');
  r = verifyAndRecover(input({ primary: obs('FAILURE'), independentCheck: null, strikes: 1 }));
  assert(r.ok && r.value.outcome === 'REPLAN' && r.value.nextStrikes === 2, '09 second strike is the last permitted replan');
  r = verifyAndRecover(input({ primary: obs('SUCCESS'), independentCheck: { availability: 'AVAILABLE', costClass: 'LOW', observation: obs('FAILURE'), trace: trace('mismatch-check') } }));
  assert(r.ok && r.value.outcome === 'ASK_OWNER' && r.value.reasonCode === 'UNKNOWN_OR_CONFLICTING_OUTCOME_CHECKED_BEFORE_RETRY', '10 contradictory second path blocks a false success');
  r = verifyAndRecover(input({ primary: obs('SUCCESS'), independentCheck: { availability: 'AVAILABLE', costClass: 'HIGH', observation: obs('FAILURE'), trace: trace('expensive-check') } }));
  assert(r.ok && r.value.outcome === 'VERIFIED_SUCCESS' && !r.value.independentPathUsed, '11 expensive independent path is not required when primary verifies');
  r = verifyAndRecover(input({ primary: obs('FAILURE'), independentCheck: null, ownerDecisionPending: true }));
  assert(r.ok && r.value.outcome === 'ASK_OWNER' && r.value.reasonCode === 'OWNER_DECISION_PENDING', '12 owner decision pending stops recovery');
  r = verifyAndRecover(input({ successTest: { ...test, expected: 42 }, primary: obs('SUCCESS', 42), independentCheck: null }));
  assert(r.ok && r.value.outcome === 'VERIFIED_SUCCESS', '13 exact numeric success test accepts exact number');
  r = verifyAndRecover(input({ successTest: { ...test, expected: '42' }, primary: obs('SUCCESS', 42), independentCheck: null }));
  assert(r.ok && r.value.outcome === 'REPLAN', '14 numeric and string values are not conflated');
  r = verifyAndRecover(input({ successTest: { ...test, operator: 'ABSENT', expected: null }, primary: { ...obs('SUCCESS', null), hasValue: false }, independentCheck: null }));
  assert(r.ok && r.value.outcome === 'VERIFIED_SUCCESS', '15 ABSENT success test requires no value');
  r = verifyAndRecover(input({ successTest: { ...test, operator: 'PRESENT', expected: true }, primary: { ...obs('SUCCESS', 42), hasValue: true }, independentCheck: null }));
  assert(r.ok && r.value.outcome === 'VERIFIED_SUCCESS', '16 PRESENT success test requires a value');
  r = verifyAndRecover(input({ primary: { ...obs('SUCCESS', 41), hasValue: true }, independentCheck: null }));
  assert(r.ok && r.value.outcome === 'REPLAN' && r.value.primaryReport.mayClaimSuccess === false, '17 a reported success with wrong value is not accepted');
  const bad = { ...input(), strikes: 3 } as unknown as VerifyRecoverInput;
  assert(!verifyAndRecover(bad).ok, '18 out-of-range recovery counters return EngineResult error');
  console.log(`CORTEX part 11 passed: ${checks} checks`);
}
main();
