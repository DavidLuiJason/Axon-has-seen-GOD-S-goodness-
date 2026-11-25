/** CORTEX R1 / Part 1: immutable typed boundaries. This file contains no message-text reader. */

export type CortexEngineResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: string; readonly message: string };

export type CortexScalar = string | number | boolean | null;
export type EvidenceLabel = 'OBSERVED' | 'REPORTED' | 'INFERRED' | 'VERIFIED' | 'DISPUTED' | 'UNKNOWN';
export type PermissionState = 'ALLOW' | 'ASK' | 'NEVER';
export type DeviceTier = 'WEAK' | 'MID' | 'STRONG';
export type CostClass = 'LOW' | 'MEDIUM' | 'HIGH';
export type TraceStage = 'INPUT' | 'OBJECTIVE_FRAME' | 'OPTION_GENERATOR' | 'DECISION';

const evidenceLabels: Readonly<Record<string, true>> = {
  OBSERVED: true, REPORTED: true, INFERRED: true, VERIFIED: true, DISPUTED: true, UNKNOWN: true,
};
const traceStages: Readonly<Record<string, true>> = {
  INPUT: true, OBJECTIVE_FRAME: true, OPTION_GENERATOR: true, DECISION: true,
};
const speechActs: Readonly<Record<string, true>> = {
  REQUEST: true, QUESTION: true, STATEMENT: true, GREETING: true, THANKS: true, UNKNOWN: true,
};
const operators: Readonly<Record<string, true>> = { RESOLVED: true, PRESENT: true, EQUALS: true, ABSENT: true };
const slotStates: Readonly<Record<string, true>> = { FILLED: true, MISSING: true };
const constraintKinds: Readonly<Record<string, true>> = { REQUIRE: true, FORBID: true, PREFER: true };
const strengths: Readonly<Record<string, true>> = { HARD: true, SOFT: true };
const capabilityAvailability: Readonly<Record<string, true>> = { AVAILABLE: true, UNAVAILABLE: true };
const preconditionKinds: Readonly<Record<string, true>> = { EFFECT: true, SLOT: true };
const reversibilityKinds: Readonly<Record<string, true>> = { REVERSIBLE: true, IRREVERSIBLE: true, NOT_APPLICABLE: true };
const costClasses: Readonly<Record<string, true>> = { LOW: true, MEDIUM: true, HIGH: true };
const commitmentKinds: Readonly<Record<string, true>> = {
  LAW: true, CONSTRAINT: true, DECISION: true, PREFERENCE: true, GOAL: true, FACT: true, EXCEPTION: true,
};
const commitmentStates: Readonly<Record<string, true>> = {
  ACTIVE: true, PROPOSED: true, SUPERSEDED: true, REVOKED: true, DECLINED: true,
};
const timeClasses: Readonly<Record<string, true>> = { INSTANT: true, QUICK: true, SLOW: true };
const deviceTiers: Readonly<Record<string, true>> = { WEAK: true, MID: true, STRONG: true };
const decisionKinds: Readonly<Record<string, true>> = {
  ANSWER: true, RUN: true, PLAN: true, ASK: true, DECLINE: true, PROPOSE_OUTSIDE_AI: true,
};
const answerSources: Readonly<Record<string, true>> = { KNOWLEDGE: true, ENGINE: true };
const askKinds: Readonly<Record<string, true>> = { CLARIFICATION: true, MISSING_INPUT: true, APPROVAL: true };
const declineKinds: Readonly<Record<string, true>> = { NO_CAPABILITY: true, BLOCKED: true, CANNOT_JUDGE: true };
const outsidePurposes: Readonly<Record<string, true>> = { RESEARCH: true, COMPUTATION: true, REVIEW: true };

export interface TraceEntry {
  readonly id: string;
  readonly stage: TraceStage;
  readonly code: string;
  readonly sourceRef: string;
  readonly evidence: EvidenceLabel;
}

export interface SuccessTest {
  readonly id: string;
  readonly targetRef: string;
  readonly operator: 'RESOLVED' | 'PRESENT' | 'EQUALS' | 'ABSENT';
  readonly expected: CortexScalar;
  readonly trace: TraceEntry;
}

export interface MeaningSlot {
  readonly id: string;
  readonly kind: string;
  readonly state: 'FILLED' | 'MISSING';
  readonly valueRef?: string;
  readonly trace: TraceEntry;
}

/** A local, structural adaptation of the repository's typed Meaning/Resolution output. It has no text field. */
export interface MeaningRecord {
  readonly id: string;
  readonly speechAct: 'REQUEST' | 'QUESTION' | 'STATEMENT' | 'GREETING' | 'THANKS' | 'UNKNOWN';
  readonly conceptRefs: readonly string[];
  readonly slots: readonly MeaningSlot[];
  readonly successTest: SuccessTest;
  readonly allowedSubgoalRefs: readonly string[];
  readonly trace: TraceEntry;
}

export interface ObjectiveClause {
  readonly id: string;
  readonly targetRef: string;
  readonly meaning: MeaningRecord;
  readonly trace: TraceEntry;
}

export interface ObjectiveRef {
  readonly originalRequestId: string;
  readonly clauses: readonly ObjectiveClause[];
  readonly trace: TraceEntry;
}

export interface CortexConstraint {
  readonly id: string;
  readonly clauseId: string | null;
  readonly targetRef: string;
  readonly kind: 'REQUIRE' | 'FORBID' | 'PREFER';
  readonly strength: 'HARD' | 'SOFT';
  readonly valueRef: string | null;
  readonly trace: TraceEntry;
}

export interface CapabilityPrecondition {
  readonly kind: 'EFFECT' | 'SLOT';
  readonly ref: string;
  readonly trace: TraceEntry;
}

export interface CapabilityEffect {
  readonly kind: 'EFFECT' | 'SLOT';
  readonly ref: string;
  readonly trace: TraceEntry;
}

export interface CapabilitySlot {
  readonly id: string;
  readonly required: boolean;
  readonly state: 'FILLED' | 'MISSING';
  readonly valueRef: string | null;
  readonly trace: TraceEntry;
}

export interface CandidateCapability {
  readonly id: string;
  readonly clauseRefs: readonly string[];
  readonly availability: 'AVAILABLE' | 'UNAVAILABLE';
  readonly preconditions: readonly CapabilityPrecondition[];
  readonly effects: readonly CapabilityEffect[];
  readonly slots: readonly CapabilitySlot[];
  readonly reversibility: 'REVERSIBLE' | 'IRREVERSIBLE' | 'NOT_APPLICABLE';
  readonly costClass: CostClass;
  readonly trace: TraceEntry;
}

export interface KnowledgeHit {
  readonly id: string;
  readonly clauseId: string;
  readonly answerRef: string;
  readonly sourceId: string;
  readonly truth: EvidenceLabel;
  readonly trace: TraceEntry;
}

export interface CommitmentReference {
  readonly id: string;
  readonly clauseId: string | null;
  readonly kind: 'LAW' | 'CONSTRAINT' | 'DECISION' | 'PREFERENCE' | 'GOAL' | 'FACT' | 'EXCEPTION';
  readonly status: 'ACTIVE' | 'PROPOSED' | 'SUPERSEDED' | 'REVOKED' | 'DECLINED';
  readonly valueRef: string;
  readonly trace: TraceEntry;
}

export interface CapabilityPermission {
  readonly capabilityId: string;
  readonly state: PermissionState;
  readonly trace: TraceEntry;
}

export interface AvailableFact {
  readonly kind: 'EFFECT' | 'SLOT';
  readonly ref: string;
  readonly trace: TraceEntry;
}

export interface CortexBudget {
  readonly stepLimit: number;
  readonly timeClass: 'INSTANT' | 'QUICK' | 'SLOW';
  readonly tokenLimit: number;
  readonly deviceTier: DeviceTier;
  readonly trace: TraceEntry;
}

export interface PendingQuestion {
  readonly id: string;
  readonly clauseId: string | null;
  readonly slotId: string | null;
  readonly optionRefs: readonly string[];
  readonly trace: TraceEntry;
}

export interface CortexInput {
  readonly objective: ObjectiveRef;
  readonly constraints: readonly CortexConstraint[];
  readonly candidateCapabilities: readonly CandidateCapability[];
  readonly knowledgeHits: readonly KnowledgeHit[];
  readonly commitments: readonly CommitmentReference[];
  readonly permissions: readonly CapabilityPermission[];
  readonly availableFacts: readonly AvailableFact[];
  readonly budget: CortexBudget;
  readonly pendingQuestion: PendingQuestion | null;
  readonly trace: TraceEntry;
}

export interface RejectedOption {
  readonly optionId: string;
  readonly kind: string;
  readonly reasonCode: string;
  readonly sourceRef: string;
  readonly trace: TraceEntry;
}

export interface BudgetUsed {
  readonly steps: number;
  readonly timeClass: 'INSTANT' | 'QUICK' | 'SLOW';
  readonly tokens: number;
  readonly deviceTier: DeviceTier;
  readonly trace: TraceEntry;
}

export interface PlanDecisionStep {
  readonly stepId: string;
  readonly capabilityId: string;
  readonly clauseId: string;
  readonly inputRefs: readonly string[];
  readonly trace: TraceEntry;
}

export type CortexDecision =
  | { readonly kind: 'ANSWER'; readonly source: 'KNOWLEDGE' | 'ENGINE'; readonly clauseId: string; readonly answerRef: string; readonly evidence: EvidenceLabel; readonly trace: TraceEntry }
  | { readonly kind: 'RUN'; readonly capabilityId: string; readonly clauseId: string; readonly inputRefs: readonly string[]; readonly trace: TraceEntry }
  | { readonly kind: 'PLAN'; readonly planId: string; readonly clauseId: string; readonly steps: readonly PlanDecisionStep[]; readonly trace: TraceEntry }
  | { readonly kind: 'ASK'; readonly askKind: 'CLARIFICATION' | 'MISSING_INPUT' | 'APPROVAL'; readonly clauseId: string | null; readonly questionRef: string; readonly optionRefs: readonly string[]; readonly trace: TraceEntry }
  | { readonly kind: 'DECLINE'; readonly declineKind: 'NO_CAPABILITY' | 'BLOCKED' | 'CANNOT_JUDGE'; readonly clauseId: string | null; readonly reasonCode: string; readonly trace: TraceEntry }
  | { readonly kind: 'PROPOSE_OUTSIDE_AI'; readonly proposalId: string; readonly purpose: 'RESEARCH' | 'COMPUTATION' | 'REVIEW'; readonly dataRefs: readonly string[]; readonly trace: TraceEntry };

export interface DecisionRecord {
  readonly id: string;
  readonly decision: CortexDecision;
  readonly reasonCodes: Readonly<Record<string, true>>;
  readonly rejectedOptions: readonly RejectedOption[];
  readonly objectiveTrace: readonly TraceEntry[];
  readonly successTest: SuccessTest;
  readonly budgetUsed: BudgetUsed;
  readonly evidenceLabels: readonly EvidenceLabel[];
  readonly trace: TraceEntry;
}

const fail = <T>(error: string, message: string): CortexEngineResult<T> => ({ ok: false, error, message });
const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const isPlainRecord = (value: unknown): value is Record<string, unknown> => {
  if (!isRecord(value)) return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
};
const has = (map: Readonly<Record<string, true>>, value: unknown): value is string =>
  typeof value === 'string' && Object.prototype.hasOwnProperty.call(map, value);
const isText = (value: unknown, max = 240): value is string =>
  typeof value === 'string' && value.trim().length > 0 && value.length <= max;
const isScalar = (value: unknown): value is CortexScalar =>
  value === null || typeof value === 'string' || typeof value === 'boolean' || (typeof value === 'number' && Number.isFinite(value));
const isStringList = (value: unknown, max = 200): value is readonly string[] =>
  Array.isArray(value) && value.length <= max && value.every((item) => isText(item));
const onlyKeys = (value: Record<string, unknown>, keys: Readonly<Record<string, unknown>>): boolean =>
  Object.keys(value).every((key) => Object.prototype.hasOwnProperty.call(keys, key));

function cloneData(value: unknown, seen = new WeakSet<object>(), depth = 0): unknown {
  if (depth > 32) throw new Error('too-deep');
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (Array.isArray(value)) {
    if (seen.has(value)) throw new Error('cyclic-input');
    seen.add(value);
    const copy = value.map((item) => cloneData(item, seen, depth + 1));
    seen.delete(value);
    return copy;
  }
  if (isPlainRecord(value)) {
    if (seen.has(value)) throw new Error('cyclic-input');
    seen.add(value);
    const copy: Record<string, unknown> = Object.create(null) as Record<string, unknown>;
    for (const [key, item] of Object.entries(value)) copy[key] = cloneData(item, seen, depth + 1);
    seen.delete(value);
    return copy;
  }
  throw new Error('unsupported-value');
}

function freezeDeep<T>(value: T, seen = new WeakSet<object>()): T {
  if (value !== null && typeof value === 'object') {
    const object = value as object;
    if (seen.has(object)) return value;
    seen.add(object);
    for (const child of Object.values(value as Record<string, unknown>)) freezeDeep(child, seen);
    Object.freeze(object);
  }
  return value;
}

function validTrace(value: unknown): value is TraceEntry {
  if (!isPlainRecord(value)) return false;
  const allowed = { id: true, stage: true, code: true, sourceRef: true, evidence: true };
  return onlyKeys(value, allowed) && isText(value.id) && has(traceStages, value.stage) &&
    isText(value.code) && isText(value.sourceRef) && has(evidenceLabels, value.evidence);
}

function validSuccessTest(value: unknown): value is SuccessTest {
  if (!isPlainRecord(value)) return false;
  const allowed = { id: true, targetRef: true, operator: true, expected: true, trace: true };
  return onlyKeys(value, allowed) && isText(value.id) && isText(value.targetRef) &&
    has(operators, value.operator) && isScalar(value.expected) && validTrace(value.trace);
}

function validMeaningSlot(value: unknown): boolean {
  if (!isPlainRecord(value)) return false;
  const allowed = { id: true, kind: true, state: true, valueRef: true, trace: true };
  return onlyKeys(value, allowed) && isText(value.id) && isText(value.kind) && has(slotStates, value.state) &&
    (value.valueRef === undefined || isText(value.valueRef)) && validTrace(value.trace);
}

function validMeaning(value: unknown): value is MeaningRecord {
  if (!isPlainRecord(value)) return false;
  const allowed = { id: true, speechAct: true, conceptRefs: true, slots: true, successTest: true, allowedSubgoalRefs: true, trace: true };
  if (!onlyKeys(value, allowed) || !isText(value.id) || !has(speechActs, value.speechAct) ||
      !isStringList(value.conceptRefs) || !Array.isArray(value.slots) || !value.slots.every(validMeaningSlot) ||
      !validSuccessTest(value.successTest) || !isStringList(value.allowedSubgoalRefs) || !validTrace(value.trace)) return false;
  return true;
}

function validObjective(value: unknown): value is ObjectiveRef {
  if (!isPlainRecord(value)) return false;
  const allowed = { originalRequestId: true, clauses: true, trace: true };
  if (!onlyKeys(value, allowed) || !isText(value.originalRequestId) || !Array.isArray(value.clauses) ||
      value.clauses.length === 0 || value.clauses.length > 100 || !validTrace(value.trace)) return false;
  const seen = new Set<string>();
  for (const clause of value.clauses) {
    if (!isPlainRecord(clause)) return false;
    const clauseKeys = { id: true, targetRef: true, meaning: true, trace: true };
    if (!onlyKeys(clause, clauseKeys) || !isText(clause.id) || !isText(clause.targetRef) ||
        !validMeaning(clause.meaning) || !validTrace(clause.trace) || seen.has(clause.id)) return false;
    if (clause.meaning.successTest.targetRef !== clause.targetRef) return false;
    seen.add(clause.id);
  }
  return true;
}

function validConstraint(value: unknown, clauseIds: ReadonlySet<string>): value is CortexConstraint {
  if (!isPlainRecord(value)) return false;
  const allowed = { id: true, clauseId: true, targetRef: true, kind: true, strength: true, valueRef: true, trace: true };
  return onlyKeys(value, allowed) && isText(value.id) &&
    (value.clauseId === null || (isText(value.clauseId) && clauseIds.has(value.clauseId))) &&
    isText(value.targetRef) && has(constraintKinds, value.kind) && has(strengths, value.strength) &&
    (value.valueRef === null || isText(value.valueRef)) && validTrace(value.trace);
}

function validCapability(value: unknown, clauseIds: ReadonlySet<string>): value is CandidateCapability {
  if (!isPlainRecord(value)) return false;
  const allowed = { id: true, clauseRefs: true, availability: true, preconditions: true, effects: true, slots: true, reversibility: true, costClass: true, trace: true };
  if (!onlyKeys(value, allowed) || !isText(value.id) || !isStringList(value.clauseRefs) || value.clauseRefs.length === 0 ||
      !value.clauseRefs.every((id) => clauseIds.has(id)) || !has(capabilityAvailability, value.availability) ||
      !Array.isArray(value.preconditions) || !Array.isArray(value.effects) || !Array.isArray(value.slots) ||
      !has(reversibilityKinds, value.reversibility) || !has(costClasses, value.costClass) || !validTrace(value.trace)) return false;
  const factsValid = (facts: unknown[]): boolean => facts.every((fact) => {
    if (!isPlainRecord(fact)) return false;
    const factKeys = { kind: true, ref: true, trace: true };
    return onlyKeys(fact, factKeys) && has(preconditionKinds, fact.kind) && isText(fact.ref) && validTrace(fact.trace);
  });
  if (!factsValid(value.preconditions) || !factsValid(value.effects)) return false;
  const slotIds = new Set<string>();
  for (const slot of value.slots) {
    if (!isPlainRecord(slot)) return false;
    const slotKeys = { id: true, required: true, state: true, valueRef: true, trace: true };
    if (!onlyKeys(slot, slotKeys) || !isText(slot.id) || typeof slot.required !== 'boolean' ||
        !has(slotStates, slot.state) || (slot.valueRef !== null && !isText(slot.valueRef)) || !validTrace(slot.trace) || slotIds.has(slot.id)) return false;
    if (slot.state === 'FILLED' && slot.required && slot.valueRef === null) return false;
    slotIds.add(slot.id);
  }
  return true;
}

function validKnowledgeHit(value: unknown, clauseIds: ReadonlySet<string>): value is KnowledgeHit {
  if (!isPlainRecord(value)) return false;
  const allowed = { id: true, clauseId: true, answerRef: true, sourceId: true, truth: true, trace: true };
  return onlyKeys(value, allowed) && isText(value.id) && isText(value.clauseId) && clauseIds.has(value.clauseId) &&
    isText(value.answerRef) && isText(value.sourceId) && has(evidenceLabels, value.truth) && validTrace(value.trace);
}

function validCommitment(value: unknown, clauseIds: ReadonlySet<string>): value is CommitmentReference {
  if (!isPlainRecord(value)) return false;
  const allowed = { id: true, clauseId: true, kind: true, status: true, valueRef: true, trace: true };
  return onlyKeys(value, allowed) && isText(value.id) &&
    (value.clauseId === null || (isText(value.clauseId) && clauseIds.has(value.clauseId))) &&
    has(commitmentKinds, value.kind) && has(commitmentStates, value.status) && isText(value.valueRef) && validTrace(value.trace);
}

function validPermission(value: unknown): value is CapabilityPermission {
  if (!isPlainRecord(value)) return false;
  const allowed = { capabilityId: true, state: true, trace: true };
  return onlyKeys(value, allowed) && isText(value.capabilityId) &&
    (value.state === 'ALLOW' || value.state === 'ASK' || value.state === 'NEVER') && validTrace(value.trace);
}

function validAvailableFact(value: unknown): value is AvailableFact {
  if (!isPlainRecord(value)) return false;
  const allowed = { kind: true, ref: true, trace: true };
  return onlyKeys(value, allowed) && has(preconditionKinds, value.kind) && isText(value.ref) && validTrace(value.trace);
}

function validBudget(value: unknown): value is CortexBudget {
  if (!isPlainRecord(value)) return false;
  const allowed = { stepLimit: true, timeClass: true, tokenLimit: true, deviceTier: true, trace: true };
  return onlyKeys(value, allowed) && Number.isInteger(value.stepLimit) && (value.stepLimit as number) >= 0 && (value.stepLimit as number) <= 100 &&
    Number.isInteger(value.tokenLimit) && (value.tokenLimit as number) >= 0 && (value.tokenLimit as number) <= 1000000 &&
    has(timeClasses, value.timeClass) && has(deviceTiers, value.deviceTier) && validTrace(value.trace);
}

function validPendingQuestion(value: unknown, clauseIds: ReadonlySet<string>): value is PendingQuestion | null {
  if (value === null) return true;
  if (!isPlainRecord(value)) return false;
  const allowed = { id: true, clauseId: true, slotId: true, optionRefs: true, trace: true };
  return onlyKeys(value, allowed) && isText(value.id) &&
    (value.clauseId === null || (isText(value.clauseId) && clauseIds.has(value.clauseId))) &&
    (value.slotId === null || isText(value.slotId)) && isStringList(value.optionRefs) && validTrace(value.trace);
}

/** Validate, clone and deeply freeze all input facts. The caller's records are never retained or changed. */
export function buildCortexInput(value: unknown): CortexEngineResult<CortexInput> {
  try {
    const copy = cloneData(value);
    if (!isPlainRecord(copy)) return fail('bad-input', 'CORTEX input must be a plain typed record.');
    const keys = {
      objective: true, constraints: true, candidateCapabilities: true, knowledgeHits: true, commitments: true,
      permissions: true, availableFacts: true, budget: true, pendingQuestion: true, trace: true,
    };
    if (!onlyKeys(copy, keys) || !validObjective(copy.objective) || !Array.isArray(copy.constraints) ||
        !Array.isArray(copy.candidateCapabilities) || !Array.isArray(copy.knowledgeHits) ||
        !Array.isArray(copy.commitments) || !Array.isArray(copy.permissions) || !Array.isArray(copy.availableFacts) ||
        !validBudget(copy.budget) || !validTrace(copy.trace)) return fail('bad-input', 'CORTEX input does not match its typed contract.');
    const clauseIds = new Set(copy.objective.clauses.map((clause) => clause.id));
    if (!copy.constraints.every((item) => validConstraint(item, clauseIds))) return fail('bad-input', 'A constraint is invalid or refers to an unknown clause.');
    if (!copy.candidateCapabilities.every((item) => validCapability(item, clauseIds))) return fail('bad-input', 'A candidate capability is invalid.');
    if (!copy.knowledgeHits.every((item) => validKnowledgeHit(item, clauseIds))) return fail('bad-input', 'A knowledge hit is invalid or refers to an unknown clause.');
    if (!copy.commitments.every((item) => validCommitment(item, clauseIds))) return fail('bad-input', 'A commitment reference is invalid.');
    if (!copy.permissions.every(validPermission) || !copy.availableFacts.every(validAvailableFact)) return fail('bad-input', 'A permission or available fact is invalid.');
    if (!validPendingQuestion(copy.pendingQuestion, clauseIds)) return fail('bad-input', 'The pending question is invalid.');

    const capabilityIds = new Set<string>();
    for (const capability of copy.candidateCapabilities) {
      if (capabilityIds.has(capability.id)) return fail('duplicate-capability', 'Capability identifiers must be unique.');
      capabilityIds.add(capability.id);
    }
    const permissionIds = new Set<string>();
    for (const permission of copy.permissions) {
      if (permissionIds.has(permission.capabilityId) || !capabilityIds.has(permission.capabilityId)) return fail('bad-permission-map', 'Permissions must map once to a known capability.');
      permissionIds.add(permission.capabilityId);
    }
    if (permissionIds.size !== capabilityIds.size) return fail('missing-permission', 'Every candidate capability needs an explicit permission state.');
    const factIds = new Set<string>();
    for (const item of copy.availableFacts) {
      const key = `${item.kind}:${item.ref}`;
      if (factIds.has(key)) return fail('duplicate-fact', 'Available facts must be unique.');
      factIds.add(key);
    }
    return { ok: true, value: freezeDeep(copy as unknown as CortexInput) };
  } catch {
    return fail('bad-input', 'CORTEX input could not be safely copied or validated.');
  }
}

function validStringMap(value: unknown): value is Readonly<Record<string, true>> {
  if (!isPlainRecord(value)) return false;
  const entries = Object.entries(value);
  return entries.length > 0 && entries.every(([key, item]) => isText(key) && item === true);
}

function validRejectedOption(value: unknown): value is RejectedOption {
  if (!isPlainRecord(value)) return false;
  const allowed = { optionId: true, kind: true, reasonCode: true, sourceRef: true, trace: true };
  return onlyKeys(value, allowed) && isText(value.optionId) && isText(value.kind) &&
    isText(value.reasonCode) && isText(value.sourceRef) && validTrace(value.trace);
}

function validBudgetUsed(value: unknown): value is BudgetUsed {
  if (!isPlainRecord(value)) return false;
  const allowed = { steps: true, timeClass: true, tokens: true, deviceTier: true, trace: true };
  return onlyKeys(value, allowed) && Number.isInteger(value.steps) && (value.steps as number) >= 0 &&
    Number.isInteger(value.tokens) && (value.tokens as number) >= 0 && has(timeClasses, value.timeClass) &&
    has(deviceTiers, value.deviceTier) && validTrace(value.trace);
}

function validPlanStep(value: unknown): value is PlanDecisionStep {
  if (!isPlainRecord(value)) return false;
  const allowed = { stepId: true, capabilityId: true, clauseId: true, inputRefs: true, trace: true };
  return onlyKeys(value, allowed) && isText(value.stepId) && isText(value.capabilityId) &&
    isText(value.clauseId) && isStringList(value.inputRefs) && validTrace(value.trace);
}

function validDecision(value: unknown): value is CortexDecision {
  if (!isPlainRecord(value) || !has(decisionKinds, value.kind) || !validTrace(value.trace)) return false;
  const common = { kind: true, trace: true };
  if (value.kind === 'ANSWER') {
    const allowed = { ...common, source: true, clauseId: true, answerRef: true, evidence: true };
    return onlyKeys(value, allowed) && has(answerSources, value.source) && isText(value.clauseId) &&
      isText(value.answerRef) && has(evidenceLabels, value.evidence);
  }
  if (value.kind === 'RUN') {
    const allowed = { ...common, capabilityId: true, clauseId: true, inputRefs: true };
    return onlyKeys(value, allowed) && isText(value.capabilityId) && isText(value.clauseId) && isStringList(value.inputRefs);
  }
  if (value.kind === 'PLAN') {
    const allowed = { ...common, planId: true, clauseId: true, steps: true };
    return onlyKeys(value, allowed) && isText(value.planId) && isText(value.clauseId) &&
      Array.isArray(value.steps) && value.steps.length > 0 && value.steps.every(validPlanStep);
  }
  if (value.kind === 'ASK') {
    const allowed = { ...common, askKind: true, clauseId: true, questionRef: true, optionRefs: true };
    return onlyKeys(value, allowed) && has(askKinds, value.askKind) &&
      (value.clauseId === null || isText(value.clauseId)) && isText(value.questionRef) && isStringList(value.optionRefs);
  }
  if (value.kind === 'DECLINE') {
    const allowed = { ...common, declineKind: true, clauseId: true, reasonCode: true };
    return onlyKeys(value, allowed) && has(declineKinds, value.declineKind) &&
      (value.clauseId === null || isText(value.clauseId)) && isText(value.reasonCode);
  }
  const allowed = { ...common, proposalId: true, purpose: true, dataRefs: true };
  return onlyKeys(value, allowed) && isText(value.proposalId) && has(outsidePurposes, value.purpose) && isStringList(value.dataRefs);
}

/** Build a decision record only when it contains one exact decision variant and all proof fields. */
export function createDecisionRecord(value: unknown): CortexEngineResult<DecisionRecord> {
  try {
    const copy = cloneData(value);
    if (!isPlainRecord(copy)) return fail('bad-decision', 'A decision record must be a plain object.');
    const allowed = {
      id: true, decision: true, reasonCodes: true, rejectedOptions: true, objectiveTrace: true,
      successTest: true, budgetUsed: true, evidenceLabels: true, trace: true,
    };
    if (!onlyKeys(copy, allowed) || !isText(copy.id) || !validDecision(copy.decision) ||
        !validStringMap(copy.reasonCodes) || !Array.isArray(copy.rejectedOptions) ||
        !copy.rejectedOptions.every(validRejectedOption) || !Array.isArray(copy.objectiveTrace) ||
        copy.objectiveTrace.length === 0 || !copy.objectiveTrace.every(validTrace) ||
        !validSuccessTest(copy.successTest) || !validBudgetUsed(copy.budgetUsed) ||
        !Array.isArray(copy.evidenceLabels) || !copy.evidenceLabels.every((label) => has(evidenceLabels, label)) ||
        !validTrace(copy.trace)) return fail('bad-decision', 'The decision record is invalid or does not contain exactly one decision kind.');
    return { ok: true, value: freezeDeep(copy as unknown as DecisionRecord) };
  } catch {
    return fail('bad-decision', 'The decision record could not be safely copied or validated.');
  }
}
