import type { TraceEntry } from '../src/brain/mind/cortex/cortexTypes.ts';
import { reasonRelations, type RelationEdge, type RelationSource, type RelationTask } from '../src/brain/mind/cortex/relationReasoner.ts';

let checks = 0;
function assert(value: unknown, label: string): asserts value { checks += 1; if (!value) throw new Error(`FAIL: ${label}`); }
function trace(id: string): TraceEntry { return { id, stage: 'INPUT', code: 'RELATION_SOURCE', sourceRef: id, evidence: 'OBSERVED' }; }
function edge(id: string, fromRef: string, toRef: string, type: RelationEdge['type'], evidence: RelationEdge['evidence'] = 'VERIFIED'): RelationEdge {
  return { id, fromRef, toRef, type, evidence, sourceRef: `source-${id}`, trace: trace(`edge-${id}`) };
}
function task(overrides: Partial<RelationTask> = {}): RelationTask {
  return { taskRef: 'task-1', categoryRef: 'category-1', candidateRefs: [], allowedRelations: ['HYPERNYM', 'HYPONYM', 'PART_OF', 'SIMILAR', 'CAUSE', 'ANTONYM', 'DOMAIN', 'GROUP', 'CORRELATION'],
    budget: { maxDepth: 4, maxBreadth: 5, maxNodes: 30, maxResults: 20 }, trace: trace('relation-task'), ...overrides };
}
function graph(edges: RelationEdge[]): RelationSource {
  return { relationsFrom(ref: string) { return edges.filter((item) => item.fromRef === ref); } };
}

function main(): void {
  const baseEdges = [
    edge('task-cat', 'task-1', 'category-1', 'DOMAIN'),
    edge('cat-a', 'category-1', 'candidate-a', 'HYPONYM', 'VERIFIED'),
    edge('cat-b', 'category-1', 'candidate-b', 'GROUP', 'INFERRED'),
    edge('a-part', 'candidate-a', 'candidate-c', 'PART_OF', 'OBSERVED'),
  ];
  const base = reasonRelations(task(), graph(baseEdges));
  assert(base.ok && base.value.results.length >= 3, '01 task-to-category traversal returns typed candidate paths');
  assert(base.ok && base.value.traces.some((item) => item.code === 'TASK_SELECTED'), '02 the task stage is traced');
  assert(base.ok && base.value.traces.some((item) => item.code === 'CATEGORY_SELECTED'), '03 the category stage is traced');
  assert(base.ok && base.value.traces.some((item) => item.code === 'CANDIDATE_EXPANSION'), '04 candidate expansion is traced');
  assert(base.ok && base.value.traces.some((item) => item.code === 'CANDIDATES_RANKED'), '05 the ranking stage is traced');
  assert(base.ok && base.value.traces.some((item) => item.code === 'EXHAUSTED'), '06 exhausted search has an explicit stop trace');

  const filtered = reasonRelations(task({ candidateRefs: ['candidate-b'] }), graph(baseEdges));
  assert(filtered.ok && filtered.value.results.length === 1 && filtered.value.results[0]?.candidateRef === 'candidate-b', '07 an explicit candidate list filters emitted candidates');

  const depth = reasonRelations(task({ budget: { maxDepth: 1, maxBreadth: 5, maxNodes: 30, maxResults: 20 } }), graph(baseEdges));
  assert(depth.ok && depth.value.stopReason === 'DEPTH_LIMIT', '08 depth budget stops deeper relation traversal');

  const breadth = reasonRelations(task({ budget: { maxDepth: 3, maxBreadth: 1, maxNodes: 30, maxResults: 20 } }), graph(baseEdges));
  assert(breadth.ok && breadth.value.stopReason === 'BREADTH_LIMIT', '09 breadth budget limits expansion at a node');

  const nodes = reasonRelations(task({ budget: { maxDepth: 4, maxBreadth: 5, maxNodes: 1, maxResults: 20 } }), graph(baseEdges));
  assert(nodes.ok && nodes.value.stopReason === 'NODE_LIMIT', '10 node budget stops the search');

  const ranked = reasonRelations(task(), graph([
    edge('task-cat', 'task-1', 'category-1', 'DOMAIN'),
    edge('weak', 'category-1', 'candidate-weak', 'GROUP', 'INFERRED'),
    edge('strong', 'category-1', 'candidate-strong', 'GROUP', 'VERIFIED'),
  ]));
  assert(ranked.ok && ranked.value.results[0]?.candidateRef === 'candidate-strong', '11 verified evidence ranks ahead of inferred evidence');

  const tie = reasonRelations(task(), graph([
    edge('task-cat', 'task-1', 'category-1', 'DOMAIN'),
    edge('tie-z', 'category-1', 'candidate-z', 'GROUP', 'VERIFIED'),
    edge('tie-a', 'category-1', 'candidate-a', 'GROUP', 'VERIFIED'),
  ]));
  assert(tie.ok && tie.value.results[0]?.candidateRef === 'candidate-a', '12 equal scores break ties by candidate reference');

  const similar = reasonRelations(task(), graph([
    edge('task-cat', 'task-1', 'category-1', 'DOMAIN'), edge('similar', 'category-1', 'candidate-similar', 'SIMILAR'),
  ]));
  assert(similar.ok && similar.value.results[0]?.limits.transferability === 'NOT_ESTABLISHED', '13 similarity remains a candidate relation and never proves transferability');

  const correlation = reasonRelations(task(), graph([
    edge('task-cat', 'task-1', 'category-1', 'DOMAIN'), edge('corr', 'category-1', 'candidate-corr', 'CORRELATION'),
  ]));
  assert(correlation.ok && correlation.value.results[0]?.limits.causation === 'NOT_ESTABLISHED', '14 correlation is not reported as cause');

  const missingCategory = reasonRelations(task(), graph([edge('other', 'task-1', 'other-category', 'DOMAIN')]));
  assert(missingCategory.ok && missingCategory.value.stopReason === 'CATEGORY_NOT_LINKED' && missingCategory.value.results.length === 0, '15 an unlinked category returns an explicit empty stop');

  const sourceFailure = reasonRelations(task(), { relationsFrom() { throw new Error('source failed'); } });
  assert(!sourceFailure.ok && sourceFailure.error === 'relation-source-failed', '16 a throwing relation source returns an EngineResult error');

  console.log(`CORTEX part 6 relation reasoner passed: ${checks} cases`);
}
main();
