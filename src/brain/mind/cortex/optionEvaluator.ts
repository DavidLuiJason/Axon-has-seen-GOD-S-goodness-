/** CORTEX R3 / Part 7: deterministic, evidence-aware option evaluation. */
import type { Flag } from '../judgment/council.ts';
import type { Judgment } from '../judgment/judge.ts';
import type { CortexEngineResult, CostClass, EvidenceLabel, PermissionState, TraceEntry } from './cortexTypes.ts';
import type { CortexOption } from './optionGenerator.ts';

export type TreatmentDepth = 'DIRECT' | 'STRUCTURED' | 'ADVANCED' | 'DEEP_DIVE';
export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'BLOCKING' | 'UNKNOWN';
export type ResourceFit = 'FIT' | 'CONSTRAINED' | 'BLOCKED' | 'UNKNOWN';
export type ActionKind = 'READ' | 'WRITE' | 'SEND' | 'DELETE' | 'MONEY' | 'OTHER';
export type OptionDisposition = 'ELIGIBLE' | 'ASK' | 'BLOCKED';

export interface FlagSignal {
  readonly flag: Flag;
  readonly trace: TraceEntry;
}

export interface JudgmentSignal {
  readonly verdict: Judgment['verdict'];
  readonly flags: readonly FlagSignal[];
  readonly trace: TraceEntry;
}

export interface OptionEvaluationFactors {
  readonly evidence: EvidenceLabel;
  readonly reversibility: 'REVERSIBLE' | 'IRREVERSIBLE' | 'NOT_APPLICABLE';
  readonly costClass: CostClass;
  readonly risk: RiskLevel;
  readonly resourceFit: ResourceFit;
  readonly actionKind: ActionKind;
  readonly permission: PermissionState;
  readonly councilFlags: readonly FlagSignal[];
  readonly judgment: JudgmentSignal;
  readonly uncertain: boolean;
  readonly trace: TraceEntry;
}

export interface OptionEvaluationCandidate {
  readonly option: CortexOption;
  readonly factors: OptionEvaluationFactors;
}

export interface OptionEvaluationRequest {
  readonly currentDepth: TreatmentDepth;
  readonly candidates: readonly OptionEvaluationCandidate[];
  readonly trace: TraceEntry;
}

export interface RejectedEvaluationOption {
  readonly optionId: string;
  readonly reasonCode: string;
  readonly reasonRef: string;
  readonly trace: TraceEntry;
}

export interface RankedEvaluationOption {
  readonly optionId: string;
  readonly kind: CortexOption['kind'];
  readonly disposition: OptionDisposition;
  readonly score: number;
  readonly evidence: EvidenceLabel;
  readonly tieBreakKey: string;
  readonly trace: TraceEntry;
}

export interface OptionEvaluationResult {
  readonly outcome: 'SELECTED' | 'ASK' | 'ALL_BLOCKED';
  readonly selectedOptionId: string | null;
  readonly ranked: readonly RankedEvaluationOption[];
  readonly rejected: readonly RejectedEvaluationOption[];
  readonly currentDepth: TreatmentDepth;
  readonly recommendedDepth: TreatmentDepth;
  readonly escalated: boolean;
  readonly tieBreakUsed: boolean;
  readonly tieBreakRule: 'EVIDENCE_THEN_REVERSIBILITY_THEN_COST_THEN_ID';
  readonly trace: TraceEntry;
}

const evidencePoints: Readonly<Record<EvidenceLabel, number>> = { VERIFIED: 60, OBSERVED: 50, REPORTED: 35, INFERRED: 20, UNKNOWN: 0, DISPUTED: -30 };
const riskPoints: Readonly<Record<RiskLevel, number>> = { LOW: 10, MEDIUM: -5, HIGH: -20, BLOCKING: -100, UNKNOWN: -15 };
const resourcePoints: Readonly<Record<ResourceFit, number>> = { FIT: 10, CONSTRAINED: -10, BLOCKED: -100, UNKNOWN: -20 };
const costPoints: Readonly<Record<CostClass, number>> = { LOW: 10, MEDIUM: 0, HIGH: -10 };
const severityPenalty: Readonly<Record<Flag['severity'], number>> = { LOW: 1, MEDIUM: 5, HIGH: 15, BLOCKING: 100 };
const depthRank: Readonly<Record<TreatmentDepth, number>> = { DIRECT: 0, STRUCTURED: 1, ADVANCED: 2, DEEP_DIVE: 3 };
const depthByRank: Readonly<Record<number, TreatmentDepth>> = { 0: 'DIRECT', 1: 'STRUCTURED', 2: 'ADVANCED', 3: 'DEEP_DIVE' };
const fail = <T>(error: string, message: string): CortexEngineResult<T> => ({ ok: false, error, message });
const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const isText = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0 && value.length <= 240;
const compareText = (left: string, right: string): number => left < right ? -1 : left > right ? 1 : 0;

function traceValid(value: unknown): value is TraceEntry {
  return isRecord(value) && isText(value.id) && isText(value.stage) && isText(value.code) && isText(value.sourceRef) && isText(value.evidence);
}
function flagValid(value: unknown): value is FlagSignal {
  if (!isRecord(value) || !isRecord(value.flag)) return false;
  const flag = value.flag;
  return typeof flag.severity === 'string' && Object.prototype.hasOwnProperty.call(severityPenalty, flag.severity) &&
    typeof flag.resolvable === 'boolean' && isText(flag.reason) && traceValid(value.trace);
}
function factorsValid(value: unknown): value is OptionEvaluationFactors {
  if (!isRecord(value) || !traceValid(value.trace) || !isRecord(value.judgment) || !traceValid(value.judgment.trace)) return false;
  if (!Array.isArray(value.councilFlags) || !value.councilFlags.every(flagValid) || !Array.isArray(value.judgment.flags) || !value.judgment.flags.every(flagValid)) return false;
  return typeof value.evidence === 'string' && Object.prototype.hasOwnProperty.call(evidencePoints, value.evidence) &&
    (value.reversibility === 'REVERSIBLE' || value.reversibility === 'IRREVERSIBLE' || value.reversibility === 'NOT_APPLICABLE') &&
    typeof value.costClass === 'string' && Object.prototype.hasOwnProperty.call(costPoints, value.costClass) &&
    typeof value.risk === 'string' && Object.prototype.hasOwnProperty.call(riskPoints, value.risk) &&
    typeof value.resourceFit === 'string' && Object.prototype.hasOwnProperty.call(resourcePoints, value.resourceFit) &&
    (value.actionKind === 'READ' || value.actionKind === 'WRITE' || value.actionKind === 'SEND' || value.actionKind === 'DELETE' || value.actionKind === 'MONEY' || value.actionKind === 'OTHER') &&
    (value.permission === 'ALLOW' || value.permission === 'ASK' || value.permission === 'NEVER') &&
    (value.judgment.verdict === 'PROCEED' || value.judgment.verdict === 'PROCEED_WITH_WARNING' || value.judgment.verdict === 'ASK' || value.judgment.verdict === 'STOP') &&
    typeof value.uncertain === 'boolean';
}
function requestValid(value: unknown): value is OptionEvaluationRequest {
  if (!isRecord(value) || Object.keys(value).some((key) => !Object.prototype.hasOwnProperty.call({ currentDepth: true, candidates: true, trace: true }, key))) return false;
  if (typeof value.currentDepth !== 'string' || !Object.prototype.hasOwnProperty.call(depthRank, value.currentDepth) || !traceValid(value.trace) || !Array.isArray(value.candidates) || value.candidates.length === 0) return false;
  return value.candidates.every((candidate) => isRecord(candidate) && isRecord(candidate.option) && isText(candidate.option.id) && factorsValid(candidate.factors));
}

function effectiveEvidence(candidate: OptionEvaluationCandidate): EvidenceLabel {
  const supplied = candidate.factors.evidence;
  if (candidate.option.kind !== 'ANSWER') return supplied;
  return evidencePoints[candidate.option.evidence] < evidencePoints[supplied] ? candidate.option.evidence : supplied;
}
function effectivePermission(candidate: OptionEvaluationCandidate): PermissionState {
  if (candidate.factors.permission === 'NEVER' || (candidate.option.kind === 'RUN' && candidate.option.permission === 'NEVER')) return 'NEVER';
  if (candidate.factors.permission === 'ASK' || (candidate.option.kind === 'RUN' && candidate.option.permission === 'ASK')) return 'ASK';
  return 'ALLOW';
}
function disposition(candidate: OptionEvaluationCandidate): { value: OptionDisposition; reason: string | null } {
  const f = candidate.factors;
  if (effectivePermission(candidate) === 'NEVER') return { value: 'BLOCKED', reason: 'PERMISSION_NEVER' };
  if (f.risk === 'BLOCKING') return { value: 'BLOCKED', reason: 'BLOCKING_RISK' };
  if (f.resourceFit === 'BLOCKED') return { value: 'BLOCKED', reason: 'RESOURCE_BLOCKED' };
  if (f.judgment.verdict === 'STOP') return { value: 'BLOCKED', reason: 'JUDGMENT_STOP' };
  if ([...f.councilFlags, ...f.judgment.flags].some((item) => item.flag.severity === 'BLOCKING')) return { value: 'BLOCKED', reason: 'COUNCIL_OR_JUDGMENT_VETO' };
  if (candidate.option.kind === 'RUN' && candidate.option.state === 'BLOCKED') {
    if (effectivePermission(candidate) === 'ASK' || candidate.option.blockReasonCode === 'APPROVAL_REQUIRED') return { value: 'ASK', reason: 'APPROVAL_REQUIRED' };
    return { value: 'BLOCKED', reason: candidate.option.blockReasonCode ?? 'RUN_OPTION_BLOCKED' };
  }
  const actionNeedsAsk = f.reversibility === 'IRREVERSIBLE' || f.actionKind === 'SEND' || f.actionKind === 'DELETE' || f.actionKind === 'MONEY';
  if (actionNeedsAsk || effectivePermission(candidate) === 'ASK' || f.judgment.verdict === 'ASK' || candidate.option.kind === 'ASK') return { value: 'ASK', reason: actionNeedsAsk ? 'IRREVERSIBLE_OR_COSTLY_ACTION' : 'APPROVAL_OR_CLARIFICATION_REQUIRED' };
  if (candidate.option.kind === 'DECLINE') return { value: 'BLOCKED', reason: 'DECLINE_OPTION_NOT_ACTIONABLE' };
  return { value: 'ELIGIBLE', reason: null };
}
function score(candidate: OptionEvaluationCandidate): number {
  const f = candidate.factors;
  let total = evidencePoints[effectiveEvidence(candidate)] + (f.reversibility === 'REVERSIBLE' ? 20 : f.reversibility === 'IRREVERSIBLE' ? -20 : 0) +
    costPoints[f.costClass] + riskPoints[f.risk] + resourcePoints[f.resourceFit];
  total += f.judgment.verdict === 'PROCEED' ? 10 : f.judgment.verdict === 'PROCEED_WITH_WARNING' ? -5 : f.judgment.verdict === 'ASK' ? -30 : -100;
  for (const item of [...f.councilFlags, ...f.judgment.flags]) total -= severityPenalty[item.flag.severity] + (item.flag.resolvable ? 0 : 5);
  return total;
}
function needsDeeper(candidate: OptionEvaluationCandidate): boolean {
  const f = candidate.factors;
  const evidence = effectiveEvidence(candidate);
  return f.uncertain || evidence === 'UNKNOWN' || evidence === 'DISPUTED' || f.resourceFit === 'UNKNOWN' || f.risk === 'UNKNOWN' ||
    f.judgment.verdict === 'PROCEED_WITH_WARNING' || f.judgment.flags.some((item) => item.flag.severity === 'HIGH' || item.flag.severity === 'BLOCKING') ||
    f.councilFlags.some((item) => item.flag.severity === 'HIGH' || item.flag.severity === 'BLOCKING');
}
function nextDepth(current: TreatmentDepth, escalate: boolean): TreatmentDepth {
  return depthByRank[Math.min(3, depthRank[current] + (escalate ? 1 : 0))] ?? 'DEEP_DIVE';
}
function tieBreakKey(candidate: OptionEvaluationCandidate): string {
  const f = candidate.factors;
  const reversal = f.reversibility === 'REVERSIBLE' ? '0' : f.reversibility === 'NOT_APPLICABLE' ? '1' : '2';
  const cost = f.costClass === 'LOW' ? '0' : f.costClass === 'MEDIUM' ? '1' : '2';
  return `${String(6 - evidencePoints[effectiveEvidence(candidate)]).padStart(4, '0')}:${reversal}:${cost}:${candidate.option.id}`;
}
function freezeDeep<T>(value: T): T {
  if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const child of Object.values(value as Record<string, unknown>)) freezeDeep(child);
    Object.freeze(value);
  }
  return value;
}

/** Chooses one option, requests approval where required, and escalates uncertainty one depth rung. */
export function evaluateOptions(request: OptionEvaluationRequest): CortexEngineResult<OptionEvaluationResult> {
  try {
    if (!requestValid(request)) return fail('bad-input', 'Option evaluation needs candidates with complete typed factors and signals.');
    const ids = new Set<string>();
    for (const candidate of request.candidates) {
      if (ids.has(candidate.option.id)) return fail('duplicate-option', 'Two candidates share the same option id.');
      ids.add(candidate.option.id);
    }
    const evaluated = request.candidates.map((candidate) => ({ candidate, disposition: disposition(candidate), score: score(candidate), key: tieBreakKey(candidate) }));
    evaluated.sort((a, b) => b.score - a.score || compareText(a.key, b.key));
    const tieBreakUsed = evaluated.some((item, index) => index > 0 && evaluated[index - 1]!.score === item.score);
    const eligible = evaluated.filter((item) => item.disposition.value === 'ELIGIBLE');
    const askCandidates = evaluated.filter((item) => item.disposition.value === 'ASK');
    const chosen = eligible[0] ?? askCandidates[0] ?? null;
    const outcome: OptionEvaluationResult['outcome'] = chosen === null ? 'ALL_BLOCKED' : chosen.disposition.value === 'ASK' ? 'ASK' : 'SELECTED';
    const rejected: RejectedEvaluationOption[] = [];
    const ranked: RankedEvaluationOption[] = evaluated.map((item) => ({
      optionId: item.candidate.option.id,
      kind: item.candidate.option.kind,
      disposition: item.disposition.value,
      score: item.score,
      evidence: effectiveEvidence(item.candidate),
      tieBreakKey: item.key,
      trace: { id: `evaluated:${item.candidate.option.id}`, stage: 'DECISION', code: item.disposition.reason ?? 'SCORED', sourceRef: item.candidate.factors.trace.id, evidence: effectiveEvidence(item.candidate) },
    }));
    for (const item of evaluated) {
      if (chosen && item.candidate.option.id === chosen.candidate.option.id) continue;
      let reasonCode = item.disposition.reason;
      if (reasonCode === null) reasonCode = 'LOWER_RANKED';
      else if (chosen && item.disposition.value === 'ASK' && chosen.disposition.value === 'ELIGIBLE') reasonCode = 'ASK_NOT_SELECTED_WHILE_SAFE_OPTION_EXISTS';
      else if (chosen && item.disposition.value === 'ASK' && chosen.disposition.value === 'ASK') reasonCode = 'QUESTION_QUEUED_BEHIND_SELECTED_QUESTION';
      rejected.push({ optionId: item.candidate.option.id, reasonCode, reasonRef: item.candidate.factors.trace.id,
        trace: { id: `rejected-evaluation:${item.candidate.option.id}`, stage: 'DECISION', code: reasonCode, sourceRef: item.candidate.factors.trace.id, evidence: 'OBSERVED' } });
    }
    const escalated = request.candidates.some((candidate) => needsDeeper(candidate));
    const result: OptionEvaluationResult = {
      outcome, selectedOptionId: chosen?.candidate.option.id ?? null, ranked, rejected,
      currentDepth: request.currentDepth, recommendedDepth: nextDepth(request.currentDepth, escalated), escalated,
      tieBreakUsed, tieBreakRule: 'EVIDENCE_THEN_REVERSIBILITY_THEN_COST_THEN_ID',
      trace: { id: `evaluation:${request.trace.id}`, stage: 'DECISION', code: outcome, sourceRef: request.trace.id, evidence: escalated ? 'INFERRED' : 'OBSERVED' },
    };
    return { ok: true, value: freezeDeep(result) };
  } catch {
    return fail('evaluation-failed', 'Option evaluation stopped without authorising an action.');
  }
}
