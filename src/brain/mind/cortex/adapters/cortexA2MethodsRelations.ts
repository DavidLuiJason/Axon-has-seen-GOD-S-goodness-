import { selectReasoningMethod, type MethodFeatureRecord, type ReasoningMethodId } from '../methods.ts';
import { reasonRelations, type RelationSource, type RelationType } from '../relationReasoner.ts';
import type { CortexInput, CandidateCapability, CortexConstraint, TraceEntry } from '../cortexTypes.ts';

export interface CortexAdapterDependencies {
  readonly relationSource: RelationSource;
  readonly allowedRelations?: readonly RelationType[];
}
export interface MethodCandidate {
  readonly clauseId: string;
  readonly method: ReasoningMethodId | null;
  readonly reason: string;
  readonly trace: TraceEntry;
}
export interface ChooseMethodsResult {
  readonly input: CortexInput;
  readonly methods: readonly MethodCandidate[];
  readonly candidateCapabilities: readonly CandidateCapability[];
  readonly constraints: readonly CortexConstraint[];
}

const featureMap: Readonly<Record<string, keyof Omit<MethodFeatureRecord, 'trace'>>> = {
  RULE_DEDUCTION: 'hasRules',
  CONSTRAINT_SATISFACTION: 'hasConstraints',
  CAUSAL_CHAIN: 'hasCausalChain',
  ANALOGY: 'analogyRequested',
  COUNTERFACTUAL: 'counterfactualRequested',
  EXACT_COMPUTATION: 'exactOperationRequested',
};
const categoryKinds: Readonly<Record<string, true>> = { RELATION_CATEGORY: true };
const relationTypes: Readonly<Record<RelationType, true>> = {
  HYPERNYM: true, HYPONYM: true, PART_OF: true, SIMILAR: true, CAUSE: true,
  ANTONYM: true, DOMAIN: true, GROUP: true, CORRELATION: true,
};
const allowedDefault: readonly RelationType[] = Object.freeze(Object.keys(relationTypes) as RelationType[]);

export function chooseMethods(input: CortexInput, deps: CortexAdapterDependencies): ChooseMethodsResult {
  const methods: MethodCandidate[] = [];
  const capabilities: CandidateCapability[] = [...input.candidateCapabilities];
  const constraints: CortexConstraint[] = [...input.constraints];
  for (const clause of input.objective.clauses) {
    const flags = { hasRules: false, hasConstraints: false, hasCausalChain: false, analogyRequested: false, counterfactualRequested: false, exactOperationRequested: false };
    for (const ref of clause.meaning.conceptRefs) {
      const key = featureMap[ref];
      if (key !== undefined) flags[key] = true;
    }
    const features: MethodFeatureRecord = { ...flags, trace: clause.trace };
    const selected = selectReasoningMethod(features);
    methods.push({
      clauseId: clause.id, method: selected.ok ? selected.value : null,
      reason: selected.ok ? 'METHOD_SELECTED' : selected.error,
      trace: { id: `cx-a2-method:${clause.id}`, stage: 'OPTION_GENERATOR', code: selected.ok ? 'METHOD_SELECTED' : 'NO_METHOD', sourceRef: clause.trace.id, evidence: selected.ok ? 'INFERRED' : 'UNKNOWN' },
    });
    const categoryRef = clause.meaning.conceptRefs.find((ref) => Object.prototype.hasOwnProperty.call(categoryKinds, ref));
    if (categoryRef === undefined) continue;
    const candidateRefs = clause.meaning.allowedSubgoalRefs;
    const relations = reasonRelations({
      taskRef: clause.targetRef, categoryRef, candidateRefs, allowedRelations: deps.allowedRelations ?? allowedDefault,
      budget: { maxDepth: 4, maxBreadth: 20, maxNodes: 100, maxResults: 50 }, trace: clause.trace,
    }, deps.relationSource);
    if (!relations.ok) continue;
    for (const result of relations.value.results) {
      const existingIndex = capabilities.findIndex((capability) => capability.id === result.candidateRef);
      const existing = existingIndex < 0 ? undefined : capabilities[existingIndex];
      if (existing !== undefined && !existing.clauseRefs.includes(clause.id)) {
        capabilities[existingIndex] = { ...existing, clauseRefs: [...existing.clauseRefs, clause.id] };
      }
      const sourceConstraint = constraints.find((item) => item.targetRef === result.candidateRef);
      if (sourceConstraint !== undefined && sourceConstraint.clauseId !== clause.id) {
        constraints.push({ ...sourceConstraint, id: `${sourceConstraint.id}:${clause.id}`, clauseId: clause.id,
          trace: { id: `cx-a2-constraint:${clause.id}`, stage: 'OPTION_GENERATOR', code: 'RELATION_CONSTRAINT_CARRIED', sourceRef: result.trace.id, evidence: result.evidence } });
      }
    }
  }
  const uniqueCapabilities = capabilities.filter((item, index) => capabilities.findIndex((candidate) => candidate.id === item.id) === index);
  const uniqueConstraints = constraints.filter((item, index) => constraints.findIndex((candidate) => candidate.id === item.id) === index);
  const next = { ...input, candidateCapabilities: uniqueCapabilities, constraints: uniqueConstraints };
  return { input: next, methods, candidateCapabilities: uniqueCapabilities, constraints: uniqueConstraints };
}

/** Drop-in optional facade dependency. Omitting it preserves the pre-adapter CORTEX path. */
export function createCortexInputAdapter(deps: CortexAdapterDependencies): {
  readonly apply: (input: CortexInput) => CortexInput;
} {
  return Object.freeze({
    apply(input: CortexInput): CortexInput {
      return chooseMethods(input, deps).input;
    },
  });
}
