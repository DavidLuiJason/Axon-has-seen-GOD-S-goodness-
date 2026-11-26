// CX-A4 (D84): the SHADOW TAP. After the brain has answered a turn, CORTEX is asked what IT would have decided from the same
// facts, typed. Nothing here changes a reply: the tap only RECORDS the decision and whether it agrees with what the brain did.
// Agreement counts are the evidence needed before anyone lets CORTEX decide (owner decision, shadow first).
import { createCortex } from '../cortex/cortex.ts';
import type { CortexAdvisorySignals, CortexDependencies } from '../cortex/cortex.ts';
import type { CortexInput, TraceEntry, KnowledgeHit, CommitmentReference } from '../cortex/cortexTypes.ts';
import { signalsFromEvents, type CommitmentSignalEvent } from '../cortex/adapters/cortexA3CommitmentSignals.ts';
import type { Judgment } from '../judgment/judge.ts';

export type CortexTapInput = {
  readonly turnId: string;
  /** The tool the brain resolved for this turn ('' when none was found). */
  readonly toolId: string;
  /** True when the tool was found but its text is missing (the brain asked, or would ask, for it). */
  readonly missingText: boolean;
  readonly recheck: 'PASSED' | 'FAILED' | 'UNCLEAR' | 'INCOMPLETE' | 'NONE';
  readonly judgment: Judgment | null;
  /** CX-A1..A3 feeds, all optional: with none given the tap behaves exactly as before. Still SHADOW: replies never change. */
  readonly knowledgeHits?: readonly KnowledgeHit[];
  readonly commitments?: readonly CommitmentReference[];
  /** Typed owner events only (A3). Turning words into events is a later Meaning-stage job. */
  readonly ownerEvents?: readonly CommitmentSignalEvent[];
  readonly adapters?: { readonly apply: (value: CortexInput) => CortexInput };
};
export type CortexTap = {
  readonly kind: string;
  readonly capabilityId: string | null;
  readonly reasonCodes: readonly string[];
  /** What the brain actually did this turn: RUN (a tool answered) or ASK (it needed the text). */
  readonly brainDid: 'RUN' | 'ASK';
  readonly agrees: boolean;
};

function trace(id: string, code: string): TraceEntry { return { id, stage: 'INPUT', code, sourceRef: id, evidence: 'OBSERVED' }; }

const QUIET: Judgment['verdict'] = 'PROCEED';

function makeDeps(input: CortexTapInput): CortexDependencies {
  const advisorySignals = (cortexInput: CortexInput): CortexAdvisorySignals => {
    const bad = input.recheck === 'FAILED' || input.recheck === 'UNCLEAR' || input.recheck === 'INCOMPLETE';
    const verdict = input.judgment ? input.judgment.verdict : QUIET;
    return { risk: bad ? 'MEDIUM' : 'LOW', resourceFit: 'FIT', actionKind: 'READ', councilFlags: [], judgment: { verdict, flags: [], trace: trace('judge:' + cortexInput.trace.id, 'ORCHESTRATOR_JUDGMENT') }, uncertain: bad };
  };
  return input.adapters === undefined ? { maxOptionDepth: 4, advisorySignals } : { maxOptionDepth: 4, advisorySignals, adapters: input.adapters };
}

/** The typed facts of one turn. Every live tool is exact, read-only and admitted (liveAdmission), so it is REVERSIBLE and ALLOWed. */
export function buildTapInput(input: CortexTapInput): unknown {
  const id = input.turnId;
  const target = 'result:' + (input.toolId || 'tool');
  const clause = { id: id + ':c1', targetRef: target, meaning: { id: id + ':m1', speechAct: 'REQUEST', conceptRefs: [], slots: [], successTest: { id: id + ':s1', targetRef: target, operator: 'EQUALS', expected: true, trace: trace(id + ':s1t', 'TOOL_RESULT_PRESENT') }, allowedSubgoalRefs: [], trace: trace(id + ':m1t', 'MEANING_FROM_BRAIN') }, trace: trace(id + ':c1t', 'CLAUSE_FROM_BRAIN') };
  const cap = { id: input.toolId || 'tool', clauseRefs: [clause.id], availability: 'AVAILABLE', preconditions: [], effects: [{ kind: 'EFFECT', ref: target, trace: trace(id + ':e1', 'TOOL_EFFECT') }], slots: input.missingText ? [{ id: 'text', required: true, state: 'MISSING', valueRef: null, trace: trace(id + ':sl1', 'TEXT_MISSING') }] : [], reversibility: 'REVERSIBLE', costClass: 'LOW', trace: trace(id + ':cap', 'TOOL_FROM_REGISTRY') };
  return { objective: { originalRequestId: id, clauses: [clause], trace: trace(id + ':obj', 'OBJECTIVE_FROM_BRAIN') }, constraints: [], candidateCapabilities: [cap], knowledgeHits: [...(input.knowledgeHits ?? [])], commitments: signalsFromEvents(input.ownerEvents ?? [], { commitments: input.commitments ?? [] }).commitments,
    permissions: [{ capabilityId: cap.id, state: 'ALLOW', trace: trace(id + ':perm', 'LIVE_TOOL_ADMITTED') }], availableFacts: [],
    budget: { stepLimit: 4, timeClass: 'QUICK', tokenLimit: 2000, deviceTier: 'MID', trace: trace(id + ':bud', 'DEFAULT_BUDGET') },
    pendingQuestion: input.missingText ? { id: id + ':q1', clauseId: clause.id, slotId: 'text', optionRefs: [], trace: trace(id + ':q1t', 'TEXT_QUESTION') } : null, trace: trace(id + ':in', 'TURN_INPUT') };
}

export function tapCortex(input: CortexTapInput): { readonly ok: true; readonly value: CortexTap } | { readonly ok: false; readonly error: string } {
  try {
    const r = createCortex(makeDeps(input)).decide(buildTapInput(input));
    if (!r.ok) return { ok: false, error: r.error };
    const d = r.value.decision;
    const kind = d.decision.kind;
    const brainDid = input.missingText ? 'ASK' : 'RUN';
    const agrees = brainDid === 'ASK' ? kind === 'ASK' : kind === 'RUN' || kind === 'PLAN' || kind === 'ANSWER';
    const capabilityId = d.decision.kind === 'RUN' ? d.decision.capabilityId : null;
    return { ok: true, value: { kind, capabilityId, reasonCodes: Object.keys(d.reasonCodes), brainDid, agrees } };
  } catch (e) { return { ok: false, error: 'cortex tap failed: ' + (e instanceof Error ? e.message : 'unknown') }; }
}
