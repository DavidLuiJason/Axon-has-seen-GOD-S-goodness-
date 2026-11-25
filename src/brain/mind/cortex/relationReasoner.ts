/** CORTEX R2 / Part 6: bounded, typed relation traversal with explicit limits. */
import type { CortexEngineResult, EvidenceLabel, TraceEntry } from './cortexTypes.ts';

export type RelationType = 'HYPERNYM' | 'HYPONYM' | 'PART_OF' | 'SIMILAR' | 'CAUSE' | 'ANTONYM' | 'DOMAIN' | 'GROUP' | 'CORRELATION';
export type RelationStopReason = 'EXHAUSTED' | 'DEPTH_LIMIT' | 'BREADTH_LIMIT' | 'NODE_LIMIT' | 'RESULT_LIMIT' | 'CATEGORY_NOT_LINKED';

export interface RelationEdge {
  readonly id: string;
  readonly fromRef: string;
  readonly toRef: string;
  readonly type: RelationType;
  readonly evidence: EvidenceLabel;
  readonly sourceRef: string;
  readonly trace: TraceEntry;
}

export interface RelationBudget {
  readonly maxDepth: number;
  readonly maxBreadth: number;
  readonly maxNodes: number;
  readonly maxResults: number;
}

export interface RelationTask {
  readonly taskRef: string;
  readonly categoryRef: string;
  readonly candidateRefs: readonly string[];
  readonly allowedRelations: readonly RelationType[];
  readonly budget: RelationBudget;
  readonly trace: TraceEntry;
}

export interface RelationSource {
  relationsFrom(ref: string): readonly RelationEdge[];
}

export interface RelationLimits {
  readonly transferability: 'NOT_ESTABLISHED' | 'NOT_APPLICABLE';
  readonly causation: 'NOT_ESTABLISHED' | 'NOT_CLAIMED';
  readonly interpretation: 'RELATION_EVIDENCE_ONLY';
}

export interface RelationResult {
  readonly id: string;
  readonly candidateRef: string;
  readonly relationType: RelationType;
  readonly path: readonly RelationEdge[];
  readonly pathDepth: number;
  readonly evidence: EvidenceLabel;
  readonly score: number;
  readonly rank: number;
  readonly limits: RelationLimits;
  readonly trace: TraceEntry;
}

export interface RelationReasoningResult {
  readonly taskRef: string;
  readonly categoryRef: string;
  readonly results: readonly RelationResult[];
  readonly stopReason: RelationStopReason;
  readonly expandedNodes: number;
  readonly examinedEdges: number;
  readonly traces: readonly TraceEntry[];
  readonly trace: TraceEntry;
}

const relationTypes: Readonly<Record<string, true>> = {
  HYPERNYM: true, HYPONYM: true, PART_OF: true, SIMILAR: true, CAUSE: true,
  ANTONYM: true, DOMAIN: true, GROUP: true, CORRELATION: true,
};
const evidenceRanks: Readonly<Record<EvidenceLabel, number>> = {
  VERIFIED: 5, OBSERVED: 4, REPORTED: 3, INFERRED: 2, UNKNOWN: 1, DISPUTED: 0,
};
const fail = <T>(error: string, message: string): CortexEngineResult<T> => ({ ok: false, error, message });
const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const isText = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0 && value.length <= 240;
const isEvidence = (value: unknown): value is EvidenceLabel => typeof value === 'string' && Object.prototype.hasOwnProperty.call(evidenceRanks, value);
const isTrace = (value: unknown): value is TraceEntry => isRecord(value) && isText(value.id) && isText(value.stage) && isText(value.code) && isText(value.sourceRef) && isEvidence(value.evidence);
const compareText = (left: string, right: string): number => left < right ? -1 : left > right ? 1 : 0;
const budgetFields: Readonly<Record<string, true>> = { maxDepth: true, maxBreadth: true, maxNodes: true, maxResults: true };

function validBudget(value: unknown): value is RelationBudget {
  if (!isRecord(value)) return false;
  return Object.keys(budgetFields).every((key) => Number.isInteger(value[key]) && (value[key] as number) > 0 && (value[key] as number) <= 500);
}

function validTask(value: unknown): value is RelationTask {
  if (!isRecord(value) || Object.keys(value).some((key) => !Object.prototype.hasOwnProperty.call({
    taskRef: true, categoryRef: true, candidateRefs: true, allowedRelations: true, budget: true, trace: true,
  }, key))) return false;
  return isText(value.taskRef) && isText(value.categoryRef) && Array.isArray(value.candidateRefs) && value.candidateRefs.every(isText) &&
    Array.isArray(value.allowedRelations) && value.allowedRelations.every((item) => typeof item === 'string' && Object.prototype.hasOwnProperty.call(relationTypes, item)) &&
    validBudget(value.budget) && isTrace(value.trace);
}

function validEdge(value: unknown): value is RelationEdge {
  if (!isRecord(value) || Object.keys(value).some((key) => !Object.prototype.hasOwnProperty.call({
    id: true, fromRef: true, toRef: true, type: true, evidence: true, sourceRef: true, trace: true,
  }, key))) return false;
  return isText(value.id) && isText(value.fromRef) && isText(value.toRef) && typeof value.type === 'string' &&
    Object.prototype.hasOwnProperty.call(relationTypes, value.type) && isEvidence(value.evidence) && isText(value.sourceRef) && isTrace(value.trace);
}

function weakestEvidence(path: readonly RelationEdge[]): EvidenceLabel {
  let weakest: EvidenceLabel = 'VERIFIED';
  for (const edge of path) if (evidenceRanks[edge.evidence] < evidenceRanks[weakest]) weakest = edge.evidence;
  return weakest;
}

function relationLimits(path: readonly RelationEdge[]): RelationLimits {
  return {
    transferability: path.some((edge) => edge.type === 'SIMILAR') ? 'NOT_ESTABLISHED' : 'NOT_APPLICABLE',
    causation: path.some((edge) => edge.type === 'CORRELATION') ? 'NOT_ESTABLISHED' : 'NOT_CLAIMED',
    interpretation: 'RELATION_EVIDENCE_ONLY',
  };
}

interface SearchState {
  readonly ref: string;
  readonly path: readonly RelationEdge[];
  readonly visited: readonly string[];
}

/** Searches task -> category -> typed candidates, then ranks and stops at injected bounds. */
export function reasonRelations(task: RelationTask, source: RelationSource): CortexEngineResult<RelationReasoningResult> {
  try {
    if (!validTask(task) || !source || typeof source.relationsFrom !== 'function') return fail('bad-input', 'Relation reasoning requires a typed task, budget and relation source.');
    const traces: TraceEntry[] = [
      { id: `relation-task:${task.taskRef}`, stage: 'OPTION_GENERATOR', code: 'TASK_SELECTED', sourceRef: task.trace.id, evidence: 'OBSERVED' },
      { id: `relation-category:${task.categoryRef}`, stage: 'OPTION_GENERATOR', code: 'CATEGORY_SELECTED', sourceRef: task.trace.id, evidence: 'INFERRED' },
    ];
    const allowed = new Set(task.allowedRelations);
    const taskEdgesRaw = source.relationsFrom(task.taskRef);
    if (!Array.isArray(taskEdgesRaw) || !taskEdgesRaw.every(validEdge)) return fail('bad-source-data', 'The relation source returned an invalid task-to-category edge.');
    const taskEdges = taskEdgesRaw.filter((edge) => edge.toRef === task.categoryRef && allowed.has(edge.type));
    if (taskEdges.length === 0) {
      const empty: RelationReasoningResult = {
        taskRef: task.taskRef, categoryRef: task.categoryRef, results: [], stopReason: 'CATEGORY_NOT_LINKED',
        expandedNodes: 0, examinedEdges: taskEdgesRaw.length, traces,
        trace: { id: `relation-stop:${task.taskRef}`, stage: 'OPTION_GENERATOR', code: 'CATEGORY_NOT_LINKED', sourceRef: task.trace.id, evidence: 'UNKNOWN' },
      };
      return { ok: true, value: Object.freeze(empty) };
    }

    const initialPath = [...taskEdges].sort((a, b) => compareText(a.id, b.id))[0]!;
    const queue: SearchState[] = [{ ref: task.categoryRef, path: [initialPath], visited: [task.taskRef, task.categoryRef] }];
    const seenEdges = new Set<string>(taskEdges.map((edge) => edge.id));
    const candidateSet = new Set(task.candidateRefs);
    const results: RelationResult[] = [];
    let expandedNodes = 0;
    let examinedEdges = taskEdgesRaw.length;
    let stopReason: RelationStopReason = 'EXHAUSTED';
    let stopped = false;

    while (queue.length > 0 && !stopped) {
      if (expandedNodes >= task.budget.maxNodes) { stopReason = 'NODE_LIMIT'; break; }
      const state = queue.shift()!;
      const depth = state.path.length;
      expandedNodes += 1;
      traces.push({ id: `relation-candidates:${state.ref}`, stage: 'OPTION_GENERATOR', code: 'CANDIDATE_EXPANSION', sourceRef: task.trace.id, evidence: 'INFERRED' });
      let outgoing = source.relationsFrom(state.ref);
      if (!Array.isArray(outgoing) || !outgoing.every(validEdge)) return fail('bad-source-data', 'The relation source returned an invalid relation edge.');
      examinedEdges += outgoing.length;
      outgoing = outgoing.filter((edge) => allowed.has(edge.type)).sort((a, b) => compareText(a.type, b.type) || compareText(a.toRef, b.toRef) || compareText(a.id, b.id));
      if (outgoing.length > task.budget.maxBreadth) {
        outgoing = outgoing.slice(0, task.budget.maxBreadth);
        stopReason = 'BREADTH_LIMIT';
      }
      for (const edge of outgoing) {
        if (seenEdges.has(edge.id)) continue;
        seenEdges.add(edge.id);
        if (state.visited.includes(edge.toRef)) continue;
        const path = [...state.path, edge];
        const candidateMatches = candidateSet.size === 0 || candidateSet.has(edge.toRef);
        if (candidateMatches && edge.toRef !== task.categoryRef && edge.toRef !== task.taskRef) {
          const evidence = weakestEvidence(path);
          const limits = relationLimits(path);
          const score = evidenceRanks[evidence] * 10 - path.length;
          results.push({
            id: `relation-result:${edge.toRef}:${path.map((part) => part.id).join('>')}`,
            candidateRef: edge.toRef, relationType: edge.type, path, pathDepth: path.length,
            evidence, score, rank: 0, limits,
            trace: { id: `relation-result-trace:${edge.toRef}`, stage: 'OPTION_GENERATOR', code: 'TYPED_RELATION_PATH_FOUND', sourceRef: edge.trace.id, evidence },
          });
          if (results.length >= task.budget.maxResults) { stopReason = 'RESULT_LIMIT'; stopped = true; break; }
        }
        if (path.length < task.budget.maxDepth) {
          queue.push({ ref: edge.toRef, path, visited: [...state.visited, edge.toRef] });
        } else if (!stopped) {
          stopReason = 'DEPTH_LIMIT';
        }
      }
      if (stopReason === 'BREADTH_LIMIT' && !stopped && queue.length === 0) break;
    }

    results.sort((a, b) => b.score - a.score || compareText(a.candidateRef, b.candidateRef) || compareText(a.id, b.id));
    const ranked = results.map((result, index) => ({ ...result, rank: index + 1 }));
    traces.push({ id: `relation-ranking:${task.taskRef}`, stage: 'OPTION_GENERATOR', code: 'CANDIDATES_RANKED', sourceRef: task.trace.id, evidence: 'INFERRED' });
    traces.push({ id: `relation-stop:${task.taskRef}`, stage: 'OPTION_GENERATOR', code: stopReason, sourceRef: task.trace.id, evidence: stopReason === 'EXHAUSTED' ? 'OBSERVED' : 'INFERRED' });
    const result: RelationReasoningResult = {
      taskRef: task.taskRef, categoryRef: task.categoryRef, results: ranked, stopReason, expandedNodes, examinedEdges, traces,
      trace: { id: `relation-summary:${task.taskRef}`, stage: 'OPTION_GENERATOR', code: 'RELATION_SEARCH_FINISHED', sourceRef: task.trace.id, evidence: 'OBSERVED' },
    };
    return { ok: true, value: Object.freeze(result) };
  } catch {
    return fail('relation-source-failed', 'The relation source failed; the bounded search stopped without guessing.');
  }
}
