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
function calc(id: string, concept: string, l: string, r: string, expected: number) {
  return rawInput(id, { concepts: [concept], target: 'result', expected, clauses: [{ id: `${id}-clause`, targetRef: 'result',
    meaning: meaning(`${id}-meaning`, [concept], [
      { id: 'left', kind: 'INTEGER_LEFT', state: 'FILLED', valueRef: l }, { id: 'right', kind: 'INTEGER_RIGHT', state: 'FILLED', valueRef: r },
    ], 'result', expected), trace: trace(`${id}-clause-trace`) }] });
}
function main(): void {
  const ops: CortexDependencies['exactBinaryOps'] = {
    INTEGER_SUBTRACT: { engine: (a, b) => ({ ok: true, value: a - b }), independent: (a, b) => a - b },
    INTEGER_MULTIPLY: { engine: (a, b) => ({ ok: true, value: a * b }), independent: (a, b) => a * b },
  };
  const c = createCortex(deps({ exactBinaryOps: ops }));
  let r = c.decide(calc('sub', 'INTEGER_SUBTRACT', '100', '58', 42));
  assert(r.ok && r.value.decision.decision.kind === 'ANSWER' && r.value.decision.decision.source === 'ENGINE' && r.value.decision.decision.answerRef === 'exact-result:42', '01 100 minus 58 is 42 through the generic exact path');
  r = c.decide(calc('mul', 'INTEGER_MULTIPLY', '6', '7', 42));
  assert(r.ok && r.value.decision.decision.kind === 'ANSWER' && r.value.decision.decision.answerRef === 'exact-result:42', '02 6 times 7 is 42');
  r = c.decide(calc('add', 'INTEGER_ADD', '17', '25', 42));
  assert(r.ok && r.value.decision.decision.kind === 'ANSWER' && r.value.decision.decision.answerRef === 'exact-result:42', '03 addition still works as before');
  r = createCortex(deps()).decide(calc('nosub', 'INTEGER_SUBTRACT', '100', '58', 42));
  assert(r.ok && r.value.decision.decision.kind === 'DECLINE' && r.value.decision.decision.reasonCode === 'exact-engine-missing', '04 a concept with no injected engine is declined, never guessed');
  const bad = createCortex(deps({ exactBinaryOps: { INTEGER_MULTIPLY: { engine: (a, b) => ({ ok: true, value: a * b + 1 }), independent: (a, b) => a * b } } }));
  r = bad.decide(calc('badmul', 'INTEGER_MULTIPLY', '6', '7', 43));
  assert(r.ok && r.value.decision.decision.kind === 'DECLINE' && r.value.decision.decision.reasonCode === 'independent-path-mismatch', '05 an engine that disagrees with its independent path is refused');
  r = c.decide(calc('wrongexp', 'INTEGER_SUBTRACT', '100', '58', 41));
  assert(r.ok && r.value.decision.decision.kind === 'DECLINE', '06 a result that fails the objective success test is not answered');
  r = c.decide(calc('unsafe', 'INTEGER_MULTIPLY', '9007199254740991', '2', 1));
  assert(r.ok && r.value.decision.decision.kind === 'DECLINE', '07 results beyond safe integers are refused');
  const again = c.decide(calc('sub', 'INTEGER_SUBTRACT', '100', '58', 42));
  assert(JSON.stringify(again) === JSON.stringify(c.decide(calc('sub', 'INTEGER_SUBTRACT', '100', '58', 42))), '08 same input gives the same decision twice');
  console.log(`CORTEX D0 generic exact ops passed: ${checks} checks`);
}
main();
