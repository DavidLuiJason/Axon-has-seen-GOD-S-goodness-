/** CORTEX R3 / Part 9: necessity-first, one-question policy. */
import type { CortexEngineResult, TraceEntry } from './cortexTypes.ts';

export type AskKind = 'CLARIFICATION' | 'MISSING_INPUT' | 'APPROVAL';
export type AskDisposition = 'RESOLVED_BY_CONTEXT' | 'CALCULATE_FIRST' | 'ACT_REVERSIBLY_FIRST' | 'NO_QUESTION_NEEDED' | 'ASK_NOW';

export interface AskCandidate {
  readonly id: string;
  readonly clauseId: string | null;
  readonly askKind: AskKind;
  readonly questionRef: string;
  readonly optionRefs: readonly string[];
  readonly contextCanAnswer: boolean;
  readonly calculationCanAnswer: boolean;
  readonly safeReversibleStepCanAnswer: boolean;
  readonly irreversibleAction: boolean;
  readonly approvalRequired: boolean;
  readonly answerChangesResult: boolean;
  readonly trace: TraceEntry;
}

export interface AskPolicyInput {
  readonly candidates: readonly AskCandidate[];
  readonly pendingQueue: readonly AskCandidate[];
  readonly trace: TraceEntry;
}

export interface AskPolicyConfig {
  readonly maxQuestionsPerTurn?: number;
}

export interface AskDecision {
  readonly candidateId: string;
  readonly disposition: AskDisposition;
  readonly reasonCode: string;
  readonly trace: TraceEntry;
}

export interface PendingAskQuestion {
  readonly id: string;
  readonly clauseId: string | null;
  readonly askKind: AskKind;
  readonly questionRef: string;
  readonly optionRefs: readonly string[];
  readonly trace: TraceEntry;
}

export interface AskPolicyResult {
  readonly currentQuestions: readonly PendingAskQuestion[];
  readonly pendingQuestions: readonly PendingAskQuestion[];
  readonly decisions: readonly AskDecision[];
  readonly askCountApplied: number;
  readonly usedDefaultAskCount: boolean;
  readonly trace: TraceEntry;
}

const fail = <T>(error: string, message: string): CortexEngineResult<T> => ({ ok: false, error, message });
const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const isText = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0 && value.length <= 240;
const askKinds: Readonly<Record<string, true>> = { CLARIFICATION: true, MISSING_INPUT: true, APPROVAL: true };
function traceValid(value: unknown): value is TraceEntry {
  return isRecord(value) && isText(value.id) && isText(value.stage) && isText(value.code) && isText(value.sourceRef) && isText(value.evidence);
}
function candidateValid(value: unknown): value is AskCandidate {
  if (!isRecord(value) || Object.keys(value).some((key) => !Object.prototype.hasOwnProperty.call({
    id: true, clauseId: true, askKind: true, questionRef: true, optionRefs: true, contextCanAnswer: true, calculationCanAnswer: true,
    safeReversibleStepCanAnswer: true, irreversibleAction: true, approvalRequired: true, answerChangesResult: true, trace: true,
  }, key))) return false;
  return isText(value.id) && (value.clauseId === null || isText(value.clauseId)) && typeof value.askKind === 'string' &&
    Object.prototype.hasOwnProperty.call(askKinds, value.askKind) && isText(value.questionRef) && Array.isArray(value.optionRefs) && value.optionRefs.every(isText) &&
    typeof value.contextCanAnswer === 'boolean' && typeof value.calculationCanAnswer === 'boolean' && typeof value.safeReversibleStepCanAnswer === 'boolean' &&
    typeof value.irreversibleAction === 'boolean' && typeof value.approvalRequired === 'boolean' && typeof value.answerChangesResult === 'boolean' && traceValid(value.trace);
}
function inputValid(value: unknown): value is AskPolicyInput {
  if (!isRecord(value) || Object.keys(value).some((key) => !Object.prototype.hasOwnProperty.call({ candidates: true, pendingQueue: true, trace: true }, key))) return false;
  return Array.isArray(value.candidates) && value.candidates.every(candidateValid) && Array.isArray(value.pendingQueue) && value.pendingQueue.every(candidateValid) && traceValid(value.trace);
}
function decisionFor(candidate: AskCandidate): { disposition: AskDisposition; reasonCode: string } {
  if (candidate.approvalRequired || candidate.irreversibleAction) return { disposition: 'ASK_NOW', reasonCode: 'IRREVERSIBLE_OR_APPROVAL_REQUIRED' };
  if (candidate.contextCanAnswer) return { disposition: 'RESOLVED_BY_CONTEXT', reasonCode: 'CONTEXT_ANSWERS_IT' };
  if (candidate.calculationCanAnswer) return { disposition: 'CALCULATE_FIRST', reasonCode: 'CALCULATION_CAN_ANSWER' };
  if (candidate.safeReversibleStepCanAnswer) return { disposition: 'ACT_REVERSIBLY_FIRST', reasonCode: 'SAFE_REVERSIBLE_STEP_CAN_ANSWER' };
  if (!candidate.answerChangesResult) return { disposition: 'NO_QUESTION_NEEDED', reasonCode: 'ANSWER_WOULD_NOT_CHANGE_RESULT' };
  return { disposition: 'ASK_NOW', reasonCode: 'UNRESOLVED_ANSWER_CHANGES_RESULT' };
}
function questionOf(candidate: AskCandidate, forcedApproval: boolean): PendingAskQuestion {
  return {
    id: candidate.id, clauseId: candidate.clauseId, askKind: forcedApproval ? 'APPROVAL' : candidate.askKind,
    questionRef: candidate.questionRef, optionRefs: [...candidate.optionRefs],
    trace: { id: `ask-policy:${candidate.id}`, stage: 'DECISION', code: forcedApproval ? 'APPROVAL_QUESTION' : 'NECESSARY_QUESTION', sourceRef: candidate.trace.id, evidence: 'INFERRED' },
  };
}
function freezeDeep<T>(value: T): T {
  if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const child of Object.values(value as Record<string, unknown>)) freezeDeep(child);
    Object.freeze(value);
  }
  return value;
}

/** Existing pending items are considered first; new questions retain their input order. */
export function applyAskPolicy(input: AskPolicyInput, config: AskPolicyConfig = {}): CortexEngineResult<AskPolicyResult> {
  try {
    if (!inputValid(input)) return fail('bad-input', 'Ask policy requires typed questions, options and traces.');
    const useDefault = config.maxQuestionsPerTurn === undefined;
    const askCount = config.maxQuestionsPerTurn ?? 1;
    if (!Number.isInteger(askCount) || askCount < 1 || askCount > 10) return fail('bad-ask-count', 'The injected question count must be a whole number from 1 to 10.');
    const ordered = [...input.pendingQueue, ...input.candidates];
    const seen = new Set<string>();
    for (const candidate of ordered) {
      if (seen.has(candidate.id)) return fail('duplicate-question', 'A question id appears more than once in the pending or new queue.');
      seen.add(candidate.id);
    }
    const decisions: AskDecision[] = [];
    const needed: PendingAskQuestion[] = [];
    for (const candidate of ordered) {
      const decision = decisionFor(candidate);
      decisions.push({ candidateId: candidate.id, ...decision,
        trace: { id: `ask-decision:${candidate.id}`, stage: 'DECISION', code: decision.reasonCode, sourceRef: candidate.trace.id, evidence: 'INFERRED' } });
      if (decision.disposition === 'ASK_NOW') needed.push(questionOf(candidate, candidate.approvalRequired || candidate.irreversibleAction));
    }
    const currentQuestions = needed.slice(0, askCount);
    const pendingQuestions = needed.slice(askCount);
    const result: AskPolicyResult = {
      currentQuestions, pendingQuestions, decisions, askCountApplied: askCount, usedDefaultAskCount: useDefault,
      trace: { id: `ask-policy:${input.trace.id}`, stage: 'DECISION', code: currentQuestions.length > 0 ? 'ASKS_QUEUED_IN_ORDER' : 'NO_QUESTION_NEEDED', sourceRef: input.trace.id, evidence: 'OBSERVED' },
    };
    return { ok: true, value: freezeDeep(result) };
  } catch {
    return fail('ask-policy-failed', 'Ask policy stopped without emitting an untraced question.');
  }
}
