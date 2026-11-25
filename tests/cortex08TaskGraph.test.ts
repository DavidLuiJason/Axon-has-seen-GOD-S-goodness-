import type { TraceEntry } from '../src/brain/mind/cortex/cortexTypes.ts';
import { validatePlan } from '../src/brain/mind/plan/plan.ts';
import { buildTaskGraph, type TaskGraphInput, type WorkItemProposal } from '../src/brain/mind/cortex/taskGraph.ts';

let checks = 0;
function assert(value: unknown, label: string): asserts value { checks += 1; if (!value) throw new Error(`FAIL: ${label}`); }
function trace(id: string): TraceEntry { return { id, stage: 'INPUT', code: 'TASK_GRAPH_INPUT', sourceRef: id, evidence: 'OBSERVED' }; }
function success(id: string, targetRef: string, expected: boolean = true) {
  return { id, targetRef, operator: 'EQUALS' as const, expected, trace: trace(`success-${id}`) };
}
function item(overrides: Partial<WorkItemProposal> & Pick<WorkItemProposal, 'id' | 'clauseRef' | 'capabilityId' | 'acceptanceTest'>): WorkItemProposal {
  return {
    parentId: null, inputs: [], outputs: [`output-${overrides.id}`], dependencies: [], reversibility: 'REVERSIBLE', reportedState: 'NOT_STARTED',
    startable: true, foundationRank: 1, trace: trace(`item-${overrides.id}`), ...overrides,
  };
}
function input(workItems: WorkItemProposal[]): TaskGraphInput {
  return {
    objectiveId: 'objective-1', objectiveRef: 'objective.ref.1', clauseRefs: ['clause-a', 'clause-b'],
    successTest: success('overall', 'objective.complete'), constraintRefs: ['constraint.safe'], maxSteps: 10, workItems, trace: trace('graph-input'),
  };
}
function basicItems(): WorkItemProposal[] {
  return [
    item({ id: 'foundation', clauseRef: 'clause-a', capabilityId: 'tool-prepare', outputs: ['prepared'], acceptanceTest: success('prepare', 'prepared.complete'), foundationRank: 0 }),
    item({ id: 'branch-a', parentId: 'foundation', clauseRef: 'clause-a', capabilityId: 'tool-a', inputs: ['prepared'], outputs: ['branch-a.done'], dependencies: ['foundation'], acceptanceTest: success('a', 'branch-a.done'), foundationRank: 1 }),
    item({ id: 'branch-b', clauseRef: 'clause-b', capabilityId: 'tool-b', inputs: ['source-b'], outputs: ['branch-b.done'], acceptanceTest: success('b', 'branch-b.done'), foundationRank: 1 }),
    item({ id: 'final', clauseRef: 'clause-b', capabilityId: 'tool-final', inputs: ['branch-a.done', 'branch-b.done'], outputs: ['objective.complete'], dependencies: ['branch-a', 'branch-b'], acceptanceTest: success('final', 'objective.complete'), reversibility: 'IRREVERSIBLE', foundationRank: 2 }),
  ];
}

function main(): void {
  const baseInput = input(basicItems());
  const built = buildTaskGraph(baseInput);
  assert(built.ok && built.value.items.length === 4, '01 a multi-part objective becomes a nested work graph');
  assert(built.ok && built.value.items.find((work) => work.id === 'branch-a')?.parentId === 'foundation', '02 nested work items retain their parent id');
  assert(built.ok && built.value.items.find((work) => work.id === 'final')?.dependencies.join(',') === 'branch-a,branch-b', '03 explicit dependencies are preserved');
  assert(built.ok && built.value.foundationFirstOrder.indexOf('foundation') < built.value.foundationFirstOrder.indexOf('branch-a'), '04 parent foundation appears before its child in foundation-first order');

  const dependencyCycle = basicItems().map((work) => work.id === 'foundation' ? { ...work, dependencies: ['final'] } : work);
  const cycle = buildTaskGraph(input(dependencyCycle));
  assert(!cycle.ok && cycle.error === 'cycle', '05 a dependency cycle is detected');

  const parentCycle = basicItems().map((work) => work.id === 'foundation' ? { ...work, parentId: 'branch-a' } : work);
  const parentLoop = buildTaskGraph(input(parentCycle));
  assert(!parentLoop.ok && parentLoop.error === 'cycle', '06 a parent-link cycle is detected');

  const independent = [
    item({ id: 'parallel-a', clauseRef: 'clause-a', capabilityId: 'tool-a', outputs: ['out-a'], acceptanceTest: success('a', 'part-a') }),
    item({ id: 'parallel-b', clauseRef: 'clause-b', capabilityId: 'tool-b', outputs: ['out-b'], acceptanceTest: success('b', 'objective.complete') }),
  ];
  const parallel = buildTaskGraph(input(independent));
  assert(parallel.ok && parallel.value.safeParallelGroups.length === 1 && parallel.value.safeParallelGroups[0]?.length === 2, '07 independent reversible root items are marked safe to run in parallel');

  const unsafeParallel = buildTaskGraph(input([
    ...independent,
    item({ id: 'irreversible', clauseRef: 'clause-a', capabilityId: 'tool-send', outputs: ['out-c'], reversibility: 'IRREVERSIBLE', acceptanceTest: success('c', 'part-c') }),
  ]));
  assert(unsafeParallel.ok && !unsafeParallel.value.items.find((work) => work.id === 'irreversible')?.safeParallel, '08 irreversible work is never marked safe-parallel');

  const states = [
    item({ id: 'not-started', clauseRef: 'clause-a', capabilityId: 'tool-a', startable: false, acceptanceTest: success('n', 'part-n') }),
    item({ id: 'in-progress', clauseRef: 'clause-a', capabilityId: 'tool-b', reportedState: 'IN_PROGRESS', acceptanceTest: success('i', 'part-i') }),
    item({ id: 'blocked', clauseRef: 'clause-a', capabilityId: 'tool-c', reportedState: 'BLOCKED', acceptanceTest: success('b', 'part-b') }),
    item({ id: 'done', clauseRef: 'clause-b', capabilityId: 'tool-d', reportedState: 'DONE', acceptanceTest: success('d', 'part-d') }),
    item({ id: 'verified', clauseRef: 'clause-b', capabilityId: 'tool-e', reportedState: 'VERIFIED', acceptanceTest: success('v', 'objective.complete') }),
    item({ id: 'ready', clauseRef: 'clause-b', capabilityId: 'tool-f', acceptanceTest: success('r', 'part-r') }),
  ];
  const counts = buildTaskGraph(input(states));
  assert(counts.ok && counts.value.progress.not_started === 1 && counts.value.progress.ready === 1 && counts.value.progress.in_progress === 1 && counts.value.progress.blocked === 1 && counts.value.progress.done === 1 && counts.value.progress.verified === 1, '09 progress is reported as all six explicit state counts, not a percent');

  const blockedDependency = [
    item({ id: 'dep', clauseRef: 'clause-a', capabilityId: 'tool-dep', startable: false, acceptanceTest: success('dep', 'dep.done') }),
    item({ id: 'wait', clauseRef: 'clause-b', capabilityId: 'tool-wait', dependencies: ['dep'], acceptanceTest: success('wait', 'objective.complete') }),
  ];
  const blocked = buildTaskGraph(input(blockedDependency));
  assert(blocked.ok && blocked.value.items.find((work) => work.id === 'wait')?.state === 'BLOCKED', '10 a not-started dependency blocks a dependent work item');

  const childrenDone = [
    item({ id: 'parent', clauseRef: 'clause-a', capabilityId: 'tool-parent', startable: false, acceptanceTest: success('parent', 'parent.done') }),
    item({ id: 'child-1', parentId: 'parent', clauseRef: 'clause-a', capabilityId: 'tool-child1', reportedState: 'VERIFIED', acceptanceTest: success('child1', 'child1.done') }),
    item({ id: 'child-2', parentId: 'parent', clauseRef: 'clause-b', capabilityId: 'tool-child2', reportedState: 'VERIFIED', acceptanceTest: success('child2', 'objective.complete') }),
  ];
  const parentState = buildTaskGraph(input(childrenDone));
  assert(parentState.ok && parentState.value.items.find((work) => work.id === 'parent')?.state === 'NOT_STARTED' && parentState.value.items.filter((work) => work.parentId === 'parent').every((work) => work.state === 'VERIFIED'), '11 a parent stays not-started even when all its children are verified');

  assert(built.ok && validatePlan(built.value.goal, built.value.plan).ok, '12 emitted Plan passes the existing plan.ts validatePlan');

  const noSuccess = basicItems().filter((work) => work.id !== 'final').map((work) => work.id === 'branch-b' ? { ...work, acceptanceTest: success('b', 'branch-b.done') } : work);
  const missingSuccess = buildTaskGraph(input(noSuccess));
  assert(!missingSuccess.ok && missingSuccess.error === 'missing-objective-success', '13 a graph without an objective-success producer is rejected by its explicit guard');

  const duplicate = basicItems();
  duplicate.push({ ...duplicate[0]!, capabilityId: 'another-tool' });
  assert(!buildTaskGraph(input(duplicate)).ok, '14 duplicate work-item ids are rejected');

  const missingDependency = basicItems().map((work) => work.id === 'final' ? { ...work, dependencies: ['unknown-id'] } : work);
  assert(!buildTaskGraph(input(missingDependency)).ok, '15 missing dependency references are rejected');

  const oversized = { ...input(basicItems()), maxSteps: 51 };
  assert(!buildTaskGraph(oversized).ok, '16 the Plan adapter refuses more than the existing planner step ceiling');

  console.log(`CORTEX part 8 task graph passed: ${checks} cases`);
}
main();
