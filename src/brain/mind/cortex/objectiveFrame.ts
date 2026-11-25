/** CORTEX R1 / Part 2: preserve the owner's objective and trace every derived goal. */
import type {
  CortexConstraint, CortexEngineResult, CortexInput, SuccessTest, TraceEntry,
} from './cortexTypes.ts';

export interface SubgoalProposal {
  readonly id: string;
  readonly parentGoalId: string;
  readonly sourceClauseId: string;
  readonly targetRef: string;
  readonly successTest: SuccessTest;
  readonly trace: TraceEntry;
}

export interface ConstraintProposal {
  readonly id: string;
  readonly sourceConstraintId: string;
  readonly targetRef: string;
  readonly kind: CortexConstraint['kind'];
  readonly strength: CortexConstraint['strength'];
  readonly valueRef: string | null;
  readonly trace: TraceEntry;
}

export interface ObjectiveFrameProposals {
  readonly subgoals?: readonly SubgoalProposal[];
  readonly constraintChanges?: readonly ConstraintProposal[];
}

export interface FrameGoal {
  readonly id: string;
  readonly parentGoalId: string | null;
  readonly sourceClauseId: string;
  readonly targetRef: string;
  readonly successTest: SuccessTest;
  readonly trace: TraceEntry;
}

export interface ScopeRejection {
  readonly proposalId: string;
  readonly reasonCode: string;
  readonly sourceRef: string;
  readonly trace: TraceEntry;
}

export interface ObjectiveFrame {
  readonly originalObjective: CortexInput['objective'];
  readonly goals: readonly FrameGoal[];
  readonly constraints: readonly CortexConstraint[];
  readonly rejected: readonly ScopeRejection[];
  readonly trace: TraceEntry;
}

const strengthRank: Readonly<Record<CortexConstraint['strength'], number>> = { SOFT: 1, HARD: 2 };
const traceStages: Readonly<Record<string, true>> = { INPUT: true, OBJECTIVE_FRAME: true, OPTION_GENERATOR: true, DECISION: true };
const evidenceLabels: Readonly<Record<string, true>> = { OBSERVED: true, REPORTED: true, INFERRED: true, VERIFIED: true, DISPUTED: true, UNKNOWN: true };
const successOperators: Readonly<Record<string, true>> = { RESOLVED: true, PRESENT: true, EQUALS: true, ABSENT: true };
const subgoalKeys: Readonly<Record<string, true>> = { id: true, parentGoalId: true, sourceClauseId: true, targetRef: true, successTest: true, trace: true };
const constraintProposalKeys: Readonly<Record<string, true>> = { id: true, sourceConstraintId: true, targetRef: true, kind: true, strength: true, valueRef: true, trace: true };
const fail = <T>(error: string, message: string): CortexEngineResult<T> => ({ ok: false, error, message });
const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const isText = (value: unknown): value is string =>
  typeof value === 'string' && value.trim().length > 0 && value.length <= 240;
const isTrace = (value: unknown): value is TraceEntry => {
  if (!isRecord(value)) return false;
  return isText(value.id) && typeof value.stage === 'string' && Object.prototype.hasOwnProperty.call(traceStages, value.stage) &&
    isText(value.code) && isText(value.sourceRef) && typeof value.evidence === 'string' &&
    Object.prototype.hasOwnProperty.call(evidenceLabels, value.evidence);
};
const isSuccessTest = (value: unknown): value is SuccessTest => {
  if (!isRecord(value)) return false;
  return isText(value.id) && isText(value.targetRef) && typeof value.operator === 'string' && Object.prototype.hasOwnProperty.call(successOperators, value.operator) &&
    (value.expected === null || typeof value.expected === 'string' || typeof value.expected === 'boolean' ||
      (typeof value.expected === 'number' && Number.isFinite(value.expected))) && isTrace(value.trace);
};
function cloneData<T>(value: T): T {
  if (Array.isArray(value)) return value.map((item) => cloneData(item)) as T;
  if (value !== null && typeof value === 'object') {
    const copy: Record<string, unknown> = Object.create(null) as Record<string, unknown>;
    for (const [key, item] of Object.entries(value as Record<string, unknown>)) copy[key] = cloneData(item);
    return copy as T;
  }
  return value;
}

const freezeDeep = <T>(value: T): T => {
  if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const child of Object.values(value as Record<string, unknown>)) freezeDeep(child);
    Object.freeze(value);
  }
  return value;
};

function validProposals(value: unknown): value is ObjectiveFrameProposals {
  if (!isRecord(value)) return false;
  if (Object.keys(value).some((key) => key !== 'subgoals' && key !== 'constraintChanges')) return false;
  if (value.subgoals !== undefined) {
    if (!Array.isArray(value.subgoals)) return false;
    for (const item of value.subgoals) {
      if (!isRecord(item) || Object.keys(item).some((key) => !Object.prototype.hasOwnProperty.call(subgoalKeys, key)) || !isText(item.id) || !isText(item.parentGoalId) || !isText(item.sourceClauseId) ||
          !isText(item.targetRef) || !isSuccessTest(item.successTest) || !isTrace(item.trace)) return false;
    }
  }
  if (value.constraintChanges !== undefined) {
    if (!Array.isArray(value.constraintChanges)) return false;
    for (const item of value.constraintChanges) {
      if (!isRecord(item) || Object.keys(item).some((key) => !Object.prototype.hasOwnProperty.call(constraintProposalKeys, key)) || !isText(item.id) || !isText(item.sourceConstraintId) || !isText(item.targetRef) ||
          (item.kind !== 'REQUIRE' && item.kind !== 'FORBID' && item.kind !== 'PREFER') ||
          (item.strength !== 'HARD' && item.strength !== 'SOFT') ||
          (item.valueRef !== null && !isText(item.valueRef)) || !isTrace(item.trace)) return false;
    }
  }
  return true;
}

function rejection(proposalId: string, reasonCode: string, sourceRef: string, trace: TraceEntry): ScopeRejection {
  return {
    proposalId, reasonCode, sourceRef,
    trace: { id: `reject:${proposalId}`, stage: 'OBJECTIVE_FRAME', code: reasonCode, sourceRef: trace.id, evidence: 'OBSERVED' },
  };
}

/** Builds clause goals, then admits only proposals whose scope is anchored to the original typed objective. */
export function buildObjectiveFrame(
  input: CortexInput,
  proposals: ObjectiveFrameProposals = {},
): CortexEngineResult<ObjectiveFrame> {
  try {
    if (!isRecord(input) || !isRecord(input.objective) || !Array.isArray(input.objective.clauses) ||
        !Array.isArray(input.constraints) || !isTrace(input.trace) || !validProposals(proposals)) {
      return fail('bad-input', 'The objective frame needs a validated CORTEX input and typed proposals.');
    }
    const facts = input as CortexInput;
    const clauses = facts.objective.clauses;
    const goals: FrameGoal[] = clauses.map((clause) => ({
      id: `goal:${clause.id}`,
      parentGoalId: null,
      sourceClauseId: clause.id,
      targetRef: clause.targetRef,
      successTest: cloneData(clause.meaning.successTest),
      trace: { id: `root:${clause.id}`, stage: 'OBJECTIVE_FRAME', code: 'CLAUSE_SUCCESS_TEST', sourceRef: clause.trace.id, evidence: 'INFERRED' },
    }));
    const rejected: ScopeRejection[] = [];
    const seenGoalIds = new Set(goals.map((goal) => goal.id));
    const clauseById = new Map(clauses.map((clause) => [clause.id, clause] as const));

    for (const proposal of proposals.subgoals ?? []) {
      const source = clauseById.get(proposal.sourceClauseId);
      if (seenGoalIds.has(proposal.id)) {
        rejected.push(rejection(proposal.id, 'DUPLICATE_GOAL_ID', proposal.sourceClauseId, proposal.trace));
        continue;
      }
      if (!source) {
        rejected.push(rejection(proposal.id, 'UNTRACED_SCOPE', proposal.sourceClauseId, proposal.trace));
        continue;
      }
      const rootId = `goal:${source.id}`;
      if (proposal.parentGoalId !== rootId) {
        rejected.push(rejection(proposal.id, 'PARENT_MISMATCH', proposal.sourceClauseId, proposal.trace));
        continue;
      }
      const scopeAllowed = proposal.targetRef === source.targetRef || source.meaning.allowedSubgoalRefs.includes(proposal.targetRef);
      if (!scopeAllowed) {
        rejected.push(rejection(proposal.id, 'ADDED_SCOPE', proposal.sourceClauseId, proposal.trace));
        continue;
      }
      if (proposal.successTest.targetRef !== proposal.targetRef) {
        rejected.push(rejection(proposal.id, 'SUCCESS_SCOPE_MISMATCH', proposal.sourceClauseId, proposal.trace));
        continue;
      }
      goals.push({
        id: proposal.id,
        parentGoalId: rootId,
        sourceClauseId: source.id,
        targetRef: proposal.targetRef,
        successTest: cloneData(proposal.successTest),
        trace: { id: `goal-trace:${proposal.id}`, stage: 'OBJECTIVE_FRAME', code: 'TRACEABLE_SUBGOAL', sourceRef: proposal.trace.id, evidence: 'INFERRED' },
      });
      seenGoalIds.add(proposal.id);
    }

    const constraints: CortexConstraint[] = facts.constraints.map((item) => cloneData(item));
    const baseById = new Map(facts.constraints.map((constraint) => [constraint.id, constraint] as const));
    const seenConstraintIds = new Set(constraints.map((constraint) => constraint.id));
    for (const proposal of proposals.constraintChanges ?? []) {
      const source = baseById.get(proposal.sourceConstraintId);
      if (seenConstraintIds.has(proposal.id)) {
        rejected.push(rejection(proposal.id, 'DUPLICATE_CONSTRAINT_ID', proposal.sourceConstraintId, proposal.trace));
        continue;
      }
      if (!source) {
        rejected.push(rejection(proposal.id, 'UNTRACED_CONSTRAINT', proposal.sourceConstraintId, proposal.trace));
        continue;
      }
      if (proposal.targetRef !== source.targetRef || proposal.kind !== source.kind || proposal.valueRef !== source.valueRef) {
        rejected.push(rejection(proposal.id, 'CONSTRAINT_SCOPE_CHANGED', proposal.sourceConstraintId, proposal.trace));
        continue;
      }
      if (strengthRank[proposal.strength] < strengthRank[source.strength]) {
        rejected.push(rejection(proposal.id, 'CONSTRAINT_WEAKENED', proposal.sourceConstraintId, proposal.trace));
        continue;
      }
      constraints.push({
        id: proposal.id,
        clauseId: source.clauseId,
        targetRef: source.targetRef,
        kind: source.kind,
        strength: proposal.strength,
        valueRef: source.valueRef,
        trace: { id: `constraint-trace:${proposal.id}`, stage: 'OBJECTIVE_FRAME', code: 'CONSTRAINT_PRESERVED_OR_STRENGTHENED', sourceRef: proposal.trace.id, evidence: 'INFERRED' },
      });
      seenConstraintIds.add(proposal.id);
    }

    const frame: ObjectiveFrame = {
      originalObjective: cloneData(facts.objective),
      goals,
      constraints,
      rejected,
      trace: { id: `frame:${facts.objective.originalRequestId}`, stage: 'OBJECTIVE_FRAME', code: 'OBJECTIVE_SCOPE_RETAINED', sourceRef: facts.objective.trace.id, evidence: 'OBSERVED' },
    };
    return { ok: true, value: freezeDeep(frame) };
  } catch {
    return fail('bad-input', 'The objective frame could not be safely derived.');
  }
}
