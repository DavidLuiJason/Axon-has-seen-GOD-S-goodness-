import type { CommitmentReference, TraceEntry } from '../cortexTypes.ts';
import type { ReconciliationRequest, ReconciliationSignal } from '../reconcile.ts';

export type OwnerEventKind = 'REPLACE' | 'CORRECT' | 'OVERRIDE' | 'EXCEPTION' | 'CONFIRM' | 'DECLINE';
export interface CommitmentSignalEvent {
  readonly id: string;
  readonly kind: OwnerEventKind;
  readonly targetCommitmentId: string;
  readonly byOwner: boolean;
  readonly trace: TraceEntry;
}
export interface CommitmentSignalContext {
  readonly commitments?: readonly CommitmentReference[];
  /** Complete typed Part 10 requests prepared by the Meaning stage, keyed by event id. */
  readonly reconciliationByEvent?: Readonly<Record<string, ReconciliationRequest>>;
}
export interface CommitmentSignalsResult {
  readonly commitments: readonly CommitmentReference[];
  readonly reconciliationRequests: readonly ReconciliationRequest[];
}
const eventKinds: Readonly<Record<OwnerEventKind, true>> = {
  REPLACE: true, CORRECT: true, OVERRIDE: true, EXCEPTION: true, CONFIRM: true, DECLINE: true,
};
const protectedKinds: Readonly<Record<string, true>> = { LAW: true, CONSTRAINT: true };

function validEvent(value: unknown): value is CommitmentSignalEvent {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const event = value as Record<string, unknown>;
  return Object.keys(event).every((key) => key === 'id' || key === 'kind' || key === 'targetCommitmentId' || key === 'byOwner' || key === 'trace') &&
    typeof event.id === 'string' && event.id.trim().length > 0 &&
    typeof event.kind === 'string' && Object.prototype.hasOwnProperty.call(eventKinds, event.kind) &&
    typeof event.targetCommitmentId === 'string' && event.targetCommitmentId.trim().length > 0 &&
    typeof event.byOwner === 'boolean' && typeof event.trace === 'object' && event.trace !== null &&
    typeof (event.trace as Record<string, unknown>).id === 'string' &&
    typeof (event.trace as Record<string, unknown>).stage === 'string' &&
    typeof (event.trace as Record<string, unknown>).code === 'string' &&
    typeof (event.trace as Record<string, unknown>).sourceRef === 'string' &&
    typeof (event.trace as Record<string, unknown>).evidence === 'string';
}

/** Converts already-typed events only. It deliberately has no message or word-reading path. */
export function signalsFromEvents(events: readonly CommitmentSignalEvent[], context: CommitmentSignalContext = {}): CommitmentSignalsResult {
  if (!Array.isArray(events) || !events.every(validEvent)) return { commitments: [...(context.commitments ?? [])], reconciliationRequests: [] };
  const commitments = [...(context.commitments ?? [])];
  const requests: ReconciliationRequest[] = [];
  for (const event of events) {
    const index = commitments.findIndex((item) => item.id === event.targetCommitmentId);
    if (index >= 0) {
      const previous = commitments[index]!;
      const protectedTarget = Object.prototype.hasOwnProperty.call(protectedKinds, previous.kind);
      if (!event.byOwner) {
        commitments.push({ ...previous, id: event.id, status: 'PROPOSED', trace: {
          id: `cx-a3:${event.id}`, stage: 'DECISION', code: protectedTarget ? 'CHAT_EVENT_PROPOSED_ONLY' : 'CHAT_COMMITMENT_PROPOSED',
          sourceRef: event.trace.id, evidence: 'UNKNOWN',
        } });
      } else {
        commitments[index] = { ...previous, trace: {
          id: `cx-a3:${event.id}`, stage: 'DECISION', code: 'OWNER_COMMITMENT_EVENT',
          sourceRef: event.trace.id, evidence: 'OBSERVED',
        } };
      }
    }
    const request = context.reconciliationByEvent?.[event.id];
    if (request !== undefined) {
      const signal: ReconciliationSignal = {
        ...request.signal,
        id: event.id,
        sourceEventRef: event.id,
        origin: event.byOwner ? 'owner' : 'axon',
        statementKind: event.byOwner ? (event.kind === 'CORRECT' ? 'correction' : 'decision') : 'proposal',
        targetPriorCommitmentId: event.targetCommitmentId,
        intent: event.byOwner ? ({
          REPLACE: 'replace', CORRECT: 'correct', OVERRIDE: 'override', EXCEPTION: 'exception',
          CONFIRM: null, DECLINE: null,
        } as const)[event.kind] : null,
        explicitChangeCue: event.byOwner && (event.kind === 'REPLACE' || event.kind === 'CORRECT' || event.kind === 'OVERRIDE' || event.kind === 'EXCEPTION'),
        retract: event.byOwner && event.kind === 'OVERRIDE',
        trace: event.trace,
      };
      requests.push({ ...request, signal, trace: event.trace });
    }
  }
  return { commitments, reconciliationRequests: requests };
}
