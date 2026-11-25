/** CORTEX R3 / Part 8: nested work graph, state counts and validated Plan adapter. */
import { formGoal, validatePlan, type Goal, type Plan } from '../plan/plan.ts';
import type { CortexEngineResult, SuccessTest, TraceEntry } from './cortexTypes.ts';

export type WorkItemState = 'NOT_STARTED' | 'READY' | 'IN_PROGRESS' | 'BLOCKED' | 'DONE' | 'VERIFIED';
type ReportedWorkState = Exclude<WorkItemState, 'READY'>;

export interface WorkItemProposal {
  readonly id: string;
  readonly parentId: string | null;
  readonly clauseRef: string;
  readonly inputs: readonly string[];
  readonly outputs: readonly string[];
  readonly dependencies: readonly string[];
  readonly acceptanceTest: SuccessTest;
  readonly capabilityId: string;
  readonly reversibility: 'REVERSIBLE' | 'IRREVERSIBLE' | 'NOT_APPLICABLE';
  readonly reportedState: ReportedWorkState;
  readonly startable: boolean;
  readonly foundationRank: number;
  readonly trace: TraceEntry;
}

export interface TaskGraphInput {
  readonly objectiveId: string;
  readonly objectiveRef: string;
  readonly clauseRefs: readonly string[];
  readonly successTest: SuccessTest;
  readonly constraintRefs: readonly string[];
  readonly maxSteps: number;
  readonly workItems: readonly WorkItemProposal[];
  readonly trace: TraceEntry;
}

export interface TaskWorkItem {
  readonly id: string;
  readonly parentId: string | null;
  readonly clauseRef: string;
  readonly inputs: readonly string[];
  readonly outputs: readonly string[];
  readonly dependencies: readonly string[];
  readonly acceptanceTest: SuccessTest;
  readonly capabilityId: string;
  readonly reversibility: WorkItemProposal['reversibility'];
  readonly state: WorkItemState;
  readonly safeParallel: boolean;
  readonly trace: TraceEntry;
}

export interface WorkStateCounts {
  readonly not_started: number;
  readonly ready: number;
  readonly in_progress: number;
  readonly blocked: number;
  readonly done: number;
  readonly verified: number;
}

export interface TaskGraph {
  readonly objectiveId: string;
  readonly items: readonly TaskWorkItem[];
  readonly foundationFirstOrder: readonly string[];
  readonly safeParallelGroups: readonly (readonly string[])[];
  readonly progress: WorkStateCounts;
  readonly goal: Goal;
  readonly plan: Plan;
  readonly trace: TraceEntry;
}

const fail = <T>(error: string, message: string): CortexEngineResult<T> => ({ ok: false, error, message });
const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const isText = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0 && value.length <= 240;
const compareText = (left: string, right: string): number => left < right ? -1 : left > right ? 1 : 0;
const reportedStates: Readonly<Record<string, true>> = { NOT_STARTED: true, IN_PROGRESS: true, BLOCKED: true, DONE: true, VERIFIED: true };
const reversibilities: Readonly<Record<string, true>> = { REVERSIBLE: true, IRREVERSIBLE: true, NOT_APPLICABLE: true };

function traceValid(value: unknown): value is TraceEntry {
  return isRecord(value) && isText(value.id) && isText(value.stage) && isText(value.code) && isText(value.sourceRef) && isText(value.evidence);
}
function successTestValid(value: unknown): value is SuccessTest {
  if (!isRecord(value)) return false;
  return isText(value.id) && isText(value.targetRef) && (value.operator === 'RESOLVED' || value.operator === 'PRESENT' || value.operator === 'EQUALS' || value.operator === 'ABSENT') &&
    (typeof value.expected === 'string' || typeof value.expected === 'boolean' || (typeof value.expected === 'number' && Number.isFinite(value.expected))) && traceValid(value.trace);
}
function itemValid(value: unknown): value is WorkItemProposal {
  if (!isRecord(value) || Object.keys(value).some((key) => !Object.prototype.hasOwnProperty.call({
    id: true, parentId: true, clauseRef: true, inputs: true, outputs: true, dependencies: true, acceptanceTest: true,
    capabilityId: true, reversibility: true, reportedState: true, startable: true, foundationRank: true, trace: true,
  }, key))) return false;
  return isText(value.id) && (value.parentId === null || isText(value.parentId)) && isText(value.clauseRef) &&
    Array.isArray(value.inputs) && value.inputs.every(isText) && Array.isArray(value.outputs) && value.outputs.every(isText) &&
    Array.isArray(value.dependencies) && value.dependencies.every(isText) && successTestValid(value.acceptanceTest) &&
    isText(value.capabilityId) && typeof value.reversibility === 'string' && Object.prototype.hasOwnProperty.call(reversibilities, value.reversibility) &&
    typeof value.reportedState === 'string' && Object.prototype.hasOwnProperty.call(reportedStates, value.reportedState) &&
    typeof value.startable === 'boolean' && Number.isInteger(value.foundationRank) && (value.foundationRank as number) >= 0 && traceValid(value.trace);
}
function inputValid(value: unknown): value is TaskGraphInput {
  if (!isRecord(value) || Object.keys(value).some((key) => !Object.prototype.hasOwnProperty.call({
    objectiveId: true, objectiveRef: true, clauseRefs: true, successTest: true, constraintRefs: true, maxSteps: true, workItems: true, trace: true,
  }, key))) return false;
  return isText(value.objectiveId) && isText(value.objectiveRef) && Array.isArray(value.clauseRefs) && value.clauseRefs.length > 0 && value.clauseRefs.every(isText) &&
    successTestValid(value.successTest) && Array.isArray(value.constraintRefs) && value.constraintRefs.length <= 20 && value.constraintRefs.every(isText) &&
    Number.isInteger(value.maxSteps) && (value.maxSteps as number) > 0 && (value.maxSteps as number) <= 50 &&
    Array.isArray(value.workItems) && value.workItems.length > 0 && value.workItems.length <= (value.maxSteps as number) && value.workItems.every(itemValid) && traceValid(value.trace);
}

function topologicalOrder(items: readonly WorkItemProposal[]): string[] | null {
  const byId = new Map(items.map((item) => [item.id, item] as const));
  const done = new Set<string>();
  const order: string[] = [];
  while (order.length < items.length) {
    const ready = items.filter((item) => !done.has(item.id) && item.dependencies.every((id) => done.has(id)) && (item.parentId === null || done.has(item.parentId)))
      .sort((a, b) => a.foundationRank - b.foundationRank || compareText(a.id, b.id));
    if (ready.length === 0) return null;
    for (const item of ready) {
      done.add(item.id);
      order.push(item.id);
    }
  }
  return byId.size === items.length ? order : null;
}

function stateFor(item: WorkItemProposal, byId: ReadonlyMap<string, WorkItemProposal>): WorkItemState {
  if (item.reportedState !== 'NOT_STARTED') return item.reportedState;
  if (!item.startable) return 'NOT_STARTED';
  const ready = item.dependencies.every((id) => {
    const dependency = byId.get(id);
    return dependency?.reportedState === 'DONE' || dependency?.reportedState === 'VERIFIED';
  });
  return ready ? 'READY' : 'BLOCKED';
}

function safeParallelItems(items: readonly TaskWorkItem[]): string[] {
  const dependentIds = new Set(items.flatMap((item) => [...item.dependencies, ...(item.parentId === null ? [] : [item.parentId])]));
  const candidates = items.filter((item) => item.parentId === null && item.dependencies.length === 0 && !dependentIds.has(item.id) &&
    item.reversibility === 'REVERSIBLE' && item.state !== 'BLOCKED');
  const outputOwners = new Map<string, string>();
  const safe: string[] = [];
  for (const item of candidates) {
    const conflict = item.outputs.some((ref) => outputOwners.has(ref));
    if (conflict) continue;
    safe.push(item.id);
    for (const ref of item.outputs) outputOwners.set(ref, item.id);
  }
  return safe.sort(compareText);
}

function freezeDeep<T>(value: T): T {
  if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const child of Object.values(value as Record<string, unknown>)) freezeDeep(child);
    Object.freeze(value);
  }
  return value;
}

/** Builds a typed DAG in foundation-first order and refuses plans that Plan.validatePlan rejects. */
export function buildTaskGraph(input: TaskGraphInput): CortexEngineResult<TaskGraph> {
  try {
    if (!inputValid(input)) return fail('bad-input', 'Task graph input must contain bounded, traced work items and a scalar objective success test.');
    if (input.successTest.expected === null) return fail('bad-success-test', 'The Plan adapter requires a non-null scalar success value.');
    const clauseIds = new Set(input.clauseRefs);
    if (clauseIds.size !== input.clauseRefs.length) return fail('duplicate-clause', 'Objective clause references must be unique.');
    const byId = new Map<string, WorkItemProposal>();
    for (const item of input.workItems) {
      if (byId.has(item.id)) return fail('duplicate-item', 'Two work items share the same id.');
      if (!clauseIds.has(item.clauseRef)) return fail('untraced-item', 'A work item does not trace to an objective clause.');
      if (item.parentId === item.id || item.dependencies.includes(item.id)) return fail('self-cycle', 'A work item cannot be its own parent or dependency.');
      byId.set(item.id, item);
    }
    for (const item of input.workItems) {
      if (item.parentId !== null && !byId.has(item.parentId)) return fail('unknown-parent', 'A work item refers to a missing parent.');
      for (const dependency of item.dependencies) if (!byId.has(dependency)) return fail('unknown-dependency', 'A work item refers to a missing dependency.');
      if (item.reportedState === 'DONE' || item.reportedState === 'VERIFIED') {
        const prerequisites = [...item.dependencies];
        if (prerequisites.some((id) => byId.get(id)?.reportedState !== 'DONE' && byId.get(id)?.reportedState !== 'VERIFIED')) {
          return fail('premature-completion', 'A completed work item has an unfinished dependency or parent.');
        }
      }
    }
    const order = topologicalOrder(input.workItems);
    if (!order) return fail('cycle', 'Work-item dependencies or parent links contain a cycle.');
    const finalProducer = input.workItems.some((item) => item.acceptanceTest.targetRef === input.successTest.targetRef && item.acceptanceTest.expected === input.successTest.expected);
    if (!finalProducer) return fail('missing-objective-success', 'No work item produces the objective success test required by Plan.');

    const orderedProposals = order.map((id) => byId.get(id)!);
    const items: TaskWorkItem[] = orderedProposals.map((item) => ({
      id: item.id, parentId: item.parentId, clauseRef: item.clauseRef, inputs: [...item.inputs], outputs: [...item.outputs],
      dependencies: [...item.dependencies], acceptanceTest: item.acceptanceTest, capabilityId: item.capabilityId,
      reversibility: item.reversibility, state: stateFor(item, byId), safeParallel: false,
      trace: { id: `work-item:${item.id}`, stage: 'DECISION', code: 'TASK_ITEM_TRACED', sourceRef: item.trace.id, evidence: 'INFERRED' },
    }));
    const safeIds = new Set(safeParallelItems(items));
    const marked = items.map((item) => ({ ...item, safeParallel: safeIds.has(item.id) }));
    const counts: { not_started: number; ready: number; in_progress: number; blocked: number; done: number; verified: number } = { not_started: 0, ready: 0, in_progress: 0, blocked: 0, done: 0, verified: 0 };
    for (const item of marked) {
      if (item.state === 'NOT_STARTED') counts.not_started += 1;
      else if (item.state === 'READY') counts.ready += 1;
      else if (item.state === 'IN_PROGRESS') counts.in_progress += 1;
      else if (item.state === 'BLOCKED') counts.blocked += 1;
      else if (item.state === 'DONE') counts.done += 1;
      else counts.verified += 1;
    }
    const goalResult = formGoal({
      id: input.objectiveId, statement: input.objectiveRef, successKey: input.successTest.targetRef,
      successValue: input.successTest.expected, maxSteps: input.maxSteps, constraints: input.constraintRefs,
    });
    if (!goalResult.ok) return fail(goalResult.error, goalResult.message);
    const plan: Plan = {
      goalId: input.objectiveId,
      steps: marked.map((item) => {
        const stepInput: Record<string, string> = { clauseRef: item.clauseRef };
        item.inputs.forEach((ref, index) => { stepInput[`input${index}`] = ref; });
        return {
          id: item.id, toolId: item.capabilityId, input: stepInput, needs: [...item.dependencies],
          expectKey: item.acceptanceTest.targetRef, expectValue: item.acceptanceTest.expected as string | number | boolean,
        };
      }),
    };
    const checked = validatePlan(goalResult.value, plan);
    if (!checked.ok) return fail('plan-invalid', checked.message);
    const graph: TaskGraph = {
      objectiveId: input.objectiveId, items: marked, foundationFirstOrder: order,
      safeParallelGroups: safeIds.size > 0 ? [[...safeIds].sort(compareText)] : [], progress: counts,
      goal: goalResult.value, plan: checked.value,
      trace: { id: `task-graph:${input.objectiveId}`, stage: 'DECISION', code: 'TASK_GRAPH_PLAN_VALIDATED', sourceRef: input.trace.id, evidence: 'OBSERVED' },
    };
    return { ok: true, value: freezeDeep(graph) };
  } catch {
    return fail('task-graph-failed', 'Task graph construction stopped without emitting an unvalidated Plan.');
  }
}
