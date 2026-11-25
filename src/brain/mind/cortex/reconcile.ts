/** CORTEX R4 / Part 10: reconcile typed Meaning signals with immutable commitments. */
import type { Grant, IntentKind, Item, Kind, Origin, Scope } from '../commitments/commitmentTypes.ts';
import type { CortexEngineResult, TraceEntry } from './cortexTypes.ts';

export type MeaningStatementKind = 'decision' | 'proposal' | 'musing' | 'preference' | 'correction' | 'hypothetical' | 'conditional';
export type ReconcileOperation = 'ADD' | 'REFINE' | 'SUPERSEDE' | 'RETRACT' | 'COEXIST' | 'HOLD' | 'ASK';
export type ApprovalCheck = 'NOT_REQUIRED' | 'VERIFIED' | 'MISSING' | 'INVALID';

export interface ReconciliationSignal {
  readonly id: string;
  readonly sourceEventRef: string;
  readonly origin: Origin;
  readonly statementKind: MeaningStatementKind;
  readonly kind: Kind;
  readonly subject: string;
  readonly value: string;
  readonly scope: Scope;
  readonly scopeId: string;
  readonly targetPriorCommitmentId: string | null;
  readonly intent: IntentKind | null;
  readonly explicitChangeCue: boolean;
  readonly retract: boolean;
  readonly condition: string | null;
  readonly replacementRef: string;
  readonly observedAt: number;
  readonly repetitionCount: number;
  readonly trace: TraceEntry;
}

export interface ReconciliationRequest {
  readonly signal: ReconciliationSignal;
  readonly commitments: readonly Item[];
  readonly grants: readonly Grant[];
  /** Result of the existing broker/commitment approval check; CORTEX does not validate or issue tokens. */
  readonly approvalCheck: ApprovalCheck;
  readonly irreversibleConflict: boolean;
  readonly trace: TraceEntry;
}

export interface ReconciliationDraft {
  readonly kind: Kind;
  readonly subject: string;
  readonly value: string;
  readonly scope: Scope;
  readonly scopeId: string;
  readonly status: 'proposed';
  readonly sourceEventRef: string;
  readonly parentId: string | null;
  readonly condition: string | null;
  readonly targetPriorCommitmentId: string | null;
}

export interface ReconciliationResult {
  readonly operation: ReconcileOperation;
  readonly reasonCode: string;
  readonly targetPriorCommitmentId: string | null;
  readonly draft: ReconciliationDraft | null;
  readonly preservedItem: Item | null;
  readonly preservationMarker: string | null;
  readonly requiresOwnerConfirmation: boolean;
  readonly requiresBrokerDecision: boolean;
  readonly trace: TraceEntry;
}

const statementKinds: Readonly<Record<string, true>> = {
  decision: true, proposal: true, musing: true, preference: true, correction: true, hypothetical: true, conditional: true,
};
const kinds: Readonly<Record<string, true>> = { law: true, constraint: true, decision: true, preference: true, goal: true, fact: true, exception: true };
const scopes: Readonly<Record<string, true>> = { user: true, project: true, chat: true, task: true };
const intents: Readonly<Record<string, true>> = { replace: true, correct: true, override: true, exception: true };
const origins: Readonly<Record<string, true>> = { owner: true, axon: true, tool: true, external: true };
const approvals: Readonly<Record<string, true>> = { NOT_REQUIRED: true, VERIFIED: true, MISSING: true, INVALID: true };
const fail = <T>(error: string, message: string): CortexEngineResult<T> => ({ ok: false, error, message });
const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const isText = (value: unknown, max = 500): value is string => typeof value === 'string' && value.trim().length > 0 && value.length <= max;
const isTime = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && Math.abs(value) <= 8640000000000000;

function traceValid(value: unknown): value is TraceEntry {
  return isRecord(value) && isText(value.id) && isText(value.stage) && isText(value.code) && isText(value.sourceRef) && isText(value.evidence);
}
function itemValid(value: unknown): value is Item {
  if (!isRecord(value)) return false;
  return isText(value.id, 120) && typeof value.kind === 'string' && Object.prototype.hasOwnProperty.call(kinds, value.kind) &&
    isText(value.subject, 120) && isText(value.value, 500) && typeof value.scope === 'string' && Object.prototype.hasOwnProperty.call(scopes, value.scope) &&
    isText(value.scopeId, 120) && (value.authority === 'owner' || value.authority === 'inferred') &&
    (value.status === 'proposed' || value.status === 'active' || value.status === 'superseded' || value.status === 'revoked' || value.status === 'declined') &&
    isText(value.sourceEvent, 120) && (value.confirmedBy === null || isText(value.confirmedBy, 120)) &&
    (value.approvalToken === null || isText(value.approvalToken, 200)) && (value.parent === null || isText(value.parent, 120)) &&
    (value.condition === null || isText(value.condition, 200)) && (value.expiresAt === null || isTime(value.expiresAt)) &&
    (value.supersedes === null || isText(value.supersedes, 120)) && (value.why === null || isText(value.why, 500)) &&
    isTime(value.created) && isTime(value.changed);
}
function signalValid(value: unknown): value is ReconciliationSignal {
  if (!isRecord(value)) return false;
  const allowed = { id: true, sourceEventRef: true, origin: true, statementKind: true, kind: true, subject: true, value: true, scope: true,
    scopeId: true, targetPriorCommitmentId: true, intent: true, explicitChangeCue: true, retract: true, condition: true,
    replacementRef: true, observedAt: true, repetitionCount: true, trace: true };
  return Object.keys(value).every((key) => Object.prototype.hasOwnProperty.call(allowed, key)) &&
    isText(value.id, 120) && isText(value.sourceEventRef, 120) && typeof value.origin === 'string' && Object.prototype.hasOwnProperty.call(origins, value.origin) &&
    typeof value.statementKind === 'string' && Object.prototype.hasOwnProperty.call(statementKinds, value.statementKind) &&
    typeof value.kind === 'string' && Object.prototype.hasOwnProperty.call(kinds, value.kind) && isText(value.subject, 120) && isText(value.value, 500) &&
    typeof value.scope === 'string' && Object.prototype.hasOwnProperty.call(scopes, value.scope) && isText(value.scopeId, 120) &&
    (value.targetPriorCommitmentId === null || isText(value.targetPriorCommitmentId, 120)) &&
    (value.intent === null || (typeof value.intent === 'string' && Object.prototype.hasOwnProperty.call(intents, value.intent))) &&
    typeof value.explicitChangeCue === 'boolean' && typeof value.retract === 'boolean' &&
    (value.condition === null || isText(value.condition, 200)) && isText(value.replacementRef, 240) &&
    isTime(value.observedAt) && Number.isInteger(value.repetitionCount) && (value.repetitionCount as number) >= 0 && traceValid(value.trace);
}
function requestValid(value: unknown): value is ReconciliationRequest {
  if (!isRecord(value)) return false;
  const allowed = { signal: true, commitments: true, grants: true, approvalCheck: true, irreversibleConflict: true, trace: true };
  if (!Object.keys(value).every((key) => Object.prototype.hasOwnProperty.call(allowed, key)) || !signalValid(value.signal) ||
      !Array.isArray(value.commitments) || !value.commitments.every(itemValid) || !Array.isArray(value.grants) ||
      !value.grants.every((grant) => isRecord(grant) && Object.keys(grant).every((key) => key === 'scope' || key === 'scopeId') && typeof grant.scope === 'string' && Object.prototype.hasOwnProperty.call(scopes, grant.scope) && isText(grant.scopeId, 120)) ||
      typeof value.approvalCheck !== 'string' || !Object.prototype.hasOwnProperty.call(approvals, value.approvalCheck) ||
      typeof value.irreversibleConflict !== 'boolean' || !traceValid(value.trace)) return false;
  const ids = new Set<string>();
  for (const item of value.commitments) {
    if (ids.has(item.id)) return false;
    ids.add(item.id);
  }
  return true;
}
function protectedKind(kind: Kind): boolean { return kind === 'law' || kind === 'constraint'; }
function hasGrant(grants: readonly Grant[], scope: Scope, scopeId: string): boolean {
  if (scope !== 'project' && scope !== 'task') return true;
  return grants.some((grant) => grant.scope === scope && grant.scopeId === scopeId);
}
function preservationMarker(item: Item, replacementRef: string): string | null {
  const date = new Date(item.changed);
  if (!Number.isFinite(date.getTime())) return null;
  return `[replaced ${date.toISOString().slice(0, 10)} by what: ${replacementRef}]`;
}
function cloneItem(item: Item | null): Item | null { return item === null ? null : { ...item }; }
function freezeDeep<T>(value: T): T {
  if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const child of Object.values(value as Record<string, unknown>)) freezeDeep(child);
    Object.freeze(value);
  }
  return value;
}
function finish(request: ReconciliationRequest, operation: ReconcileOperation, reasonCode: string, previous: Item | null, draft: ReconciliationDraft | null, protectedTouched: boolean): CortexEngineResult<ReconciliationResult> {
  const isReplacement = operation === 'REFINE' || operation === 'SUPERSEDE' || operation === 'RETRACT';
  const marker = previous === null || !isReplacement ? null : preservationMarker(previous, request.signal.replacementRef);
  if (isReplacement && previous !== null && marker === null) return fail('bad-date', 'The prior commitment date cannot be represented safely.');
  const result: ReconciliationResult = {
    operation, reasonCode, targetPriorCommitmentId: request.signal.targetPriorCommitmentId, draft: draft === null ? null : { ...draft },
    preservedItem: cloneItem(previous), preservationMarker: marker,
    requiresOwnerConfirmation: operation === 'ADD' || operation === 'REFINE' || operation === 'SUPERSEDE' || operation === 'RETRACT' || operation === 'COEXIST',
    requiresBrokerDecision: protectedTouched || operation === 'SUPERSEDE' || operation === 'RETRACT',
    trace: { id: `reconcile:${request.signal.id}`, stage: 'DECISION', code: operation, sourceRef: request.signal.trace.id, evidence: 'INFERRED' },
  };
  return { ok: true, value: freezeDeep(result) };
}
function draftOf(signal: ReconciliationSignal, parentId: string | null = null): ReconciliationDraft {
  return {
    kind: signal.kind, subject: signal.subject, value: signal.value, scope: signal.scope, scopeId: signal.scopeId,
    status: 'proposed', sourceEventRef: signal.sourceEventRef, parentId, condition: signal.condition,
    targetPriorCommitmentId: signal.targetPriorCommitmentId,
  };
}

/** Reconciles only typed Meaning intent; this function never reads CEvent.text or any message text. */
export function reconcileCommitment(request: ReconciliationRequest): CortexEngineResult<ReconciliationResult> {
  try {
    if (!requestValid(request)) return fail('bad-input', 'Reconciliation requires typed Meaning signals and valid commitment records.');
    const signal = request.signal;
    const items = request.commitments;
    if (signal.origin !== 'owner') return finish(request, 'HOLD', 'NON_OWNER_CANNOT_ESTABLISH', null, null, false);
    if (signal.statementKind === 'proposal' || signal.statementKind === 'musing' || signal.statementKind === 'preference' ||
        signal.statementKind === 'hypothetical' || signal.statementKind === 'conditional') {
      return finish(request, 'HOLD', 'NON_DECISION_SPEECH_ACT', null, null, false);
    }
    if (signal.scope === 'user' && signal.scopeId !== 'owner') return finish(request, 'ASK', 'USER_SCOPE_MISMATCH', null, null, false);
    if (!hasGrant(request.grants, signal.scope, signal.scopeId)) return finish(request, 'ASK', 'SCOPE_NOT_VERIFIED', null, null, false);

    const previous = signal.targetPriorCommitmentId === null ? null : items.find((item) => item.id === signal.targetPriorCommitmentId) ?? null;
    if (signal.targetPriorCommitmentId !== null && previous === null) return finish(request, 'ASK', 'TARGET_NOT_FOUND', null, null, false);

    if (previous === null) {
      if (signal.statementKind === 'correction' || signal.intent !== null) return finish(request, 'ASK', 'CHANGE_NEEDS_EXISTING_TARGET', null, null, protectedKind(signal.kind));
      const activeSameSubject = items.filter((item) => item.status === 'active' && item.scope === signal.scope && item.scopeId === signal.scopeId && item.subject === signal.subject);
      if (activeSameSubject.some((item) => item.value === signal.value)) return finish(request, 'HOLD', 'REPEATED_SAME_VALUE', null, null, false);
      if (activeSameSubject.length > 0) return finish(request, 'ASK', 'ACTIVE_CONFLICT_NEEDS_TARGET_AND_INTENT', null, null, false);
      const protectedTouched = protectedKind(signal.kind);
      if (protectedTouched && request.approvalCheck !== 'VERIFIED') return finish(request, 'ASK', 'PROTECTED_APPROVAL_REQUIRED', null, null, true);
      return finish(request, 'ADD', 'NEW_OWNER_DECISION_PROPOSED', null, draftOf(signal), protectedTouched);
    }

    if (previous.status !== 'active') return finish(request, 'HOLD', 'TARGET_NOT_ACTIVE', previous, null, protectedKind(previous.kind));
    if (previous.subject !== signal.subject || previous.scope !== signal.scope || previous.scopeId !== signal.scopeId) {
      return finish(request, 'ASK', 'TARGET_SCOPE_OR_SUBJECT_MISMATCH', previous, null, protectedKind(previous.kind) || protectedKind(signal.kind));
    }
    if (previous.kind !== signal.kind && signal.kind !== 'exception') return finish(request, 'ASK', 'KIND_MUST_STAY', previous, null, protectedKind(previous.kind) || protectedKind(signal.kind));
    if (previous.value === signal.value && !signal.retract) return finish(request, 'HOLD', 'SAME_VALUE_NO_CHANGE', previous, null, protectedKind(previous.kind));
    if (!signal.explicitChangeCue || signal.intent === null) return finish(request, 'ASK', 'EXPLICIT_INTENT_REQUIRED', previous, null, protectedKind(previous.kind) || protectedKind(signal.kind));
    if (request.irreversibleConflict) return finish(request, 'ASK', 'IRREVERSIBLE_CONFLICT_REQUIRES_OWNER', previous, null, protectedKind(previous.kind) || protectedKind(signal.kind));

    const protectedTouched = protectedKind(previous.kind) || protectedKind(signal.kind);
    if (protectedTouched && request.approvalCheck !== 'VERIFIED') return finish(request, 'ASK', 'PROTECTED_APPROVAL_REQUIRED', previous, null, true);

    if (signal.kind === 'exception' && signal.intent === 'exception') {
      if (signal.condition === null || signal.condition.trim().length === 0) return finish(request, 'ASK', 'EXCEPTION_CONDITION_REQUIRED', previous, null, protectedTouched);
      return finish(request, 'COEXIST', 'NARROW_EXCEPTION_CHILD', previous, draftOf(signal, previous.id), protectedTouched);
    }
    if (signal.retract) {
      if (signal.intent !== 'override') return finish(request, 'ASK', 'RETRACTION_INTENT_REQUIRED', previous, null, protectedTouched);
      return finish(request, 'RETRACT', 'EXPLICIT_OWNER_RETRACTION', previous, null, protectedTouched);
    }
    if (signal.intent === 'correct') return finish(request, 'REFINE', 'EXPLICIT_OWNER_CORRECTION', previous, draftOf(signal), protectedTouched);
    if (signal.intent === 'replace' || signal.intent === 'override') {
      if (protectedTouched && signal.intent === 'replace') return finish(request, 'ASK', 'PROTECTED_REPLACE_NOT_ALLOWED', previous, null, true);
      return finish(request, 'SUPERSEDE', 'EXPLICIT_OWNER_REVERSAL', previous, draftOf(signal), protectedTouched);
    }
    return finish(request, 'ASK', 'INTENT_NOT_SUPPORTED', previous, null, protectedTouched);
  } catch {
    return fail('reconciliation-failed', 'Reconciliation stopped without changing or discarding a commitment.');
  }
}
