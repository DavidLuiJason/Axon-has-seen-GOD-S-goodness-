/** CORTEX R1 / Part 3: enumerate options from typed facts; never create a capability. */
import type {
  CandidateCapability, CortexEngineResult, CortexInput, EvidenceLabel, PermissionState, RejectedOption, TraceEntry,
} from './cortexTypes.ts';

export type CortexOption =
  | { readonly id: string; readonly kind: 'ANSWER'; readonly clauseId: string; readonly answerRef: string; readonly sourceId: string; readonly evidence: EvidenceLabel; readonly trace: TraceEntry }
  | { readonly id: string; readonly kind: 'RUN'; readonly clauseId: string; readonly capabilityId: string; readonly inputRefs: readonly string[]; readonly state: 'READY' | 'BLOCKED'; readonly blockReasonCode: string | null; readonly permission: PermissionState; readonly trace: TraceEntry }
  | { readonly id: string; readonly kind: 'PLAN'; readonly clauseId: string; readonly capabilityIds: readonly string[]; readonly trace: TraceEntry }
  | { readonly id: string; readonly kind: 'ASK'; readonly clauseId: string; readonly askKind: 'CLARIFICATION' | 'MISSING_INPUT' | 'APPROVAL'; readonly capabilityId: string | null; readonly missingRefs: readonly string[]; readonly trace: TraceEntry }
  | { readonly id: string; readonly kind: 'DECLINE'; readonly clauseId: string; readonly declineKind: 'NO_CAPABILITY' | 'BLOCKED' | 'CANNOT_JUDGE'; readonly reasonCode: string; readonly trace: TraceEntry };

export interface OptionGenerationLimits { readonly maxDepth: number }
export interface OptionGeneration {
  readonly options: readonly CortexOption[];
  readonly rejected: readonly RejectedOption[];
  readonly trace: TraceEntry;
}

const fail = <T>(error: string, message: string): CortexEngineResult<T> => ({ ok: false, error, message });
const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const isText = (value: unknown): value is string =>
  typeof value === 'string' && value.trim().length > 0 && value.length <= 240;
const freezeDeep = <T>(value: T): T => {
  if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const child of Object.values(value as Record<string, unknown>)) freezeDeep(child);
    Object.freeze(value);
  }
  return value;
};
const compareText = (a: string, b: string): number => a < b ? -1 : a > b ? 1 : 0;
const sorted = <T extends { readonly id: string }>(items: readonly T[]): T[] =>
  [...items].sort((a, b) => compareText(a.id, b.id));

function trace(id: string, code: string, sourceRef: string, evidence: EvidenceLabel = 'INFERRED'): TraceEntry {
  return { id, stage: 'OPTION_GENERATOR', code, sourceRef, evidence };
}

function rejected(optionId: string, kind: string, reasonCode: string, sourceRef: string): RejectedOption {
  return {
    optionId, kind, reasonCode, sourceRef,
    trace: trace(`rejected:${optionId}`, reasonCode, sourceRef, 'OBSERVED'),
  };
}

function permissionFor(input: CortexInput, capabilityId: string): PermissionState {
  return input.permissions.find((permission) => permission.capabilityId === capabilityId)?.state ?? 'NEVER';
}

function effectKey(kind: 'EFFECT' | 'SLOT', ref: string): string {
  return `${kind}:${ref}`;
}

interface SearchState {
  readonly effects: ReadonlySet<string>;
  readonly slots: ReadonlySet<string>;
  readonly path: readonly string[];
  readonly pathFacts: readonly CandidateCapability[];
}

function capReady(capability: CandidateCapability, state: SearchState, permission: PermissionState): boolean {
  if (capability.availability !== 'AVAILABLE' || permission !== 'ALLOW') return false;
  for (const slot of capability.slots) {
    if (slot.required && slot.state === 'MISSING' && !state.slots.has(slot.id)) return false;
  }
  for (const precondition of capability.preconditions) {
    const key = effectKey(precondition.kind, precondition.ref);
    if (precondition.kind === 'EFFECT' && !state.effects.has(key)) return false;
    if (precondition.kind === 'SLOT' && !state.slots.has(precondition.ref) &&
        !capability.slots.some((slot) => slot.id === precondition.ref && slot.state === 'FILLED')) return false;
  }
  return true;
}

function applyEffects(capability: CandidateCapability, state: SearchState): SearchState {
  const effects = new Set(state.effects);
  const slots = new Set(state.slots);
  for (const item of capability.effects) {
    if (item.kind === 'EFFECT') effects.add(effectKey('EFFECT', item.ref));
    else slots.add(item.ref);
  }
  for (const slot of capability.slots) if (slot.state === 'FILLED') slots.add(slot.id);
  return { effects, slots, path: [...state.path, capability.id], pathFacts: [...state.pathFacts, capability] };
}

function contributes(previous: CandidateCapability, next: CandidateCapability): boolean {
  return previous.effects.some((effect) => next.preconditions.some((precondition) =>
    precondition.kind === effect.kind && precondition.ref === effect.ref));
}

function directBlockReason(
  capability: CandidateCapability,
  permission: PermissionState,
  input: CortexInput,
): { reason: string | null; missingSlots: string[]; missingEffects: string[] } {
  const availableSlots = new Set(input.availableFacts.filter((fact) => fact.kind === 'SLOT').map((fact) => fact.ref));
  const availableEffects = new Set(input.availableFacts.filter((fact) => fact.kind === 'EFFECT').map((fact) => fact.ref));
  const missingSlots = capability.slots.filter((slot) => slot.required && slot.state === 'MISSING' && !availableSlots.has(slot.id)).map((slot) => slot.id);
  const missingSlotPreconditions = capability.preconditions.filter((item) => item.kind === 'SLOT' && !availableSlots.has(item.ref) &&
    !capability.slots.some((slot) => slot.id === item.ref && slot.state === 'FILLED')).map((item) => item.ref);
  missingSlots.push(...missingSlotPreconditions.filter((id) => !missingSlots.includes(id)));
  const missingEffects = capability.preconditions.filter((item) => item.kind === 'EFFECT' && !availableEffects.has(item.ref)).map((item) => item.ref);
  if (permission === 'NEVER') return { reason: 'PERMISSION_NEVER', missingSlots, missingEffects };
  if (capability.availability === 'UNAVAILABLE') return { reason: 'CAPABILITY_UNAVAILABLE', missingSlots, missingEffects };
  if (permission === 'ASK') return { reason: 'APPROVAL_REQUIRED', missingSlots, missingEffects };
  if (input.budget.stepLimit < 1) return { reason: 'STEP_BUDGET', missingSlots, missingEffects };
  if (missingSlots.length > 0) return { reason: 'MISSING_INPUT', missingSlots, missingEffects };
  if (missingEffects.length > 0) return { reason: 'UNMET_PRECONDITION', missingSlots, missingEffects };
  return { reason: null, missingSlots, missingEffects };
}

/** Bounded, deterministic option generation from the immutable input facts only. */
export function generateOptions(input: CortexInput, limits: OptionGenerationLimits): CortexEngineResult<OptionGeneration> {
  try {
    if (!isRecord(input) || !isRecord(input.objective) || !Array.isArray(input.objective.clauses) ||
        !Array.isArray(input.candidateCapabilities) || !Array.isArray(input.permissions) ||
        !Array.isArray(input.knowledgeHits) || !Array.isArray(input.availableFacts) || !isRecord(input.budget) ||
        !Number.isInteger(limits?.maxDepth) || limits.maxDepth < 1 || limits.maxDepth > 10) {
      return fail('bad-input', 'Option generation requires typed CORTEX facts and a bounded positive depth.');
    }
    const facts = input as CortexInput;
    const options: CortexOption[] = [];
    const rejectedOptions: RejectedOption[] = [];
    const allCaps = sorted(facts.candidateCapabilities);

    for (const clause of facts.objective.clauses) {
      const answers = sorted(facts.knowledgeHits.filter((hit) => hit.clauseId === clause.id && hit.truth !== 'DISPUTED' && hit.truth !== 'UNKNOWN'));
      for (const hit of answers) {
        options.push({
          id: `answer:${clause.id}:${hit.id}`, kind: 'ANSWER', clauseId: clause.id,
          answerRef: hit.answerRef, sourceId: hit.sourceId, evidence: hit.truth,
          trace: trace(`answer-trace:${hit.id}`, 'KNOWLEDGE_HIT', hit.trace.id, hit.truth),
        });
      }

      const caps = allCaps.filter((capability) => capability.clauseRefs.includes(clause.id));
      const directReady: CandidateCapability[] = [];
      let asksCreated = 0;
      for (const capability of caps) {
        const permission = permissionFor(facts, capability.id);
        const block = directBlockReason(capability, permission, facts);
        const inputRefs = capability.slots.filter((slot) => slot.state === 'FILLED' && slot.valueRef !== null).map((slot) => slot.valueRef as string);
        const optionId = `run:${clause.id}:${capability.id}`;
        options.push({
          id: optionId, kind: 'RUN', clauseId: clause.id, capabilityId: capability.id,
          inputRefs, state: block.reason === null ? 'READY' : 'BLOCKED',
          blockReasonCode: block.reason, permission,
          trace: trace(`run-trace:${capability.id}`, block.reason === null ? 'RUN_OPTION_READY' : block.reason, capability.trace.id,
            block.reason === null ? 'OBSERVED' : 'INFERRED'),
        });
        if (block.reason === null) directReady.push(capability);
        if (block.reason === 'APPROVAL_REQUIRED') {
          asksCreated += 1;
          options.push({ id: `ask:approval:${clause.id}:${capability.id}`, kind: 'ASK', clauseId: clause.id,
            askKind: 'APPROVAL', capabilityId: capability.id, missingRefs: [],
            trace: trace(`ask-approval:${capability.id}`, 'APPROVAL_REQUIRED', capability.trace.id) });
        } else if (block.missingSlots.length > 0 && permission !== 'NEVER' && capability.availability === 'AVAILABLE') {
          asksCreated += 1;
          options.push({ id: `ask:input:${clause.id}:${capability.id}`, kind: 'ASK', clauseId: clause.id,
            askKind: 'MISSING_INPUT', capabilityId: capability.id, missingRefs: block.missingSlots,
            trace: trace(`ask-input:${capability.id}`, 'MISSING_INPUT', capability.trace.id) });
        } else if (block.missingEffects.length > 0 && permission !== 'NEVER' && capability.availability === 'AVAILABLE') {
          asksCreated += 1;
          options.push({ id: `ask:clarify:${clause.id}:${capability.id}`, kind: 'ASK', clauseId: clause.id,
            askKind: 'CLARIFICATION', capabilityId: capability.id, missingRefs: block.missingEffects,
            trace: trace(`ask-clarify:${capability.id}`, 'UNMET_PRECONDITION', capability.trace.id) });
        }
      }

      const initialEffects = new Set(facts.availableFacts.filter((fact) => fact.kind === 'EFFECT').map((fact) => effectKey('EFFECT', fact.ref)));
      const initialSlots = new Set(facts.availableFacts.filter((fact) => fact.kind === 'SLOT').map((fact) => fact.ref));
      for (const capability of caps) for (const slot of capability.slots) if (slot.state === 'FILLED') initialSlots.add(slot.id);
      const baseState: SearchState = { effects: initialEffects, slots: initialSlots, path: [], pathFacts: [] };
      const seenPlans = new Set<string>();
      const seenRejected = new Set<string>();
      const noteRejected = (id: string, kind: string, code: string, source: string): void => {
        const key = `${id}|${code}`;
        if (seenRejected.has(key)) return;
        seenRejected.add(key);
        rejectedOptions.push(rejected(id, kind, code, source));
      };

      const walk = (state: SearchState): void => {
        const previous = state.pathFacts[state.pathFacts.length - 1];
        if (!previous) return;
        for (const next of caps) {
          const permission = permissionFor(facts, next.id);
          const hasEdge = contributes(previous, next);
          if (!hasEdge) continue;
          if (state.path.includes(next.id)) {
            noteRejected(`cycle:${clause.id}:${state.path.join('>')}>${next.id}`, 'PLAN', 'CYCLE', next.trace.id);
            continue;
          }
          if (permission !== 'ALLOW' || next.availability !== 'AVAILABLE') continue;
          const nextStateReady = capReady(next, state, permission);
          if (!nextStateReady) continue;
          const proposedPath = [...state.path, next.id];
          const proposedId = `plan:${clause.id}:${proposedPath.join('>')}`;
          if (proposedPath.length > facts.budget.stepLimit) {
            noteRejected(proposedId, 'PLAN', 'STEP_BUDGET', next.trace.id);
            continue;
          }
          if (proposedPath.length > limits.maxDepth) {
            noteRejected(proposedId, 'PLAN', 'DEPTH_LIMIT', next.trace.id);
            continue;
          }
          const nextState = applyEffects(next, state);
          if (proposedPath.length > 1 && !seenPlans.has(proposedId)) {
            options.push({
              id: proposedId, kind: 'PLAN', clauseId: clause.id, capabilityIds: proposedPath,
              trace: trace(`plan-trace:${proposedId}`, 'CHAIN_PRECONDITIONS_SATISFIED', next.trace.id),
            });
            seenPlans.add(proposedId);
          }
          walk(nextState);
        }
      };

      if (facts.budget.stepLimit > 0) {
        for (const start of directReady) {
          const state = applyEffects(start, baseState);
          walk(state);
        }
      }

      const hasAnswer = answers.length > 0;
      const hasReadyAction = options.some((option) => option.clauseId === clause.id &&
        ((option.kind === 'RUN' && option.state === 'READY') || option.kind === 'PLAN'));
      const hasAsk = asksCreated > 0;
      if (!hasAnswer && !hasReadyAction && !hasAsk) {
        const declineKind = caps.length === 0 ? 'NO_CAPABILITY' : 'BLOCKED';
        const reasonCode = caps.length === 0 ? 'NO_MATCHING_CAPABILITY' : 'ALL_CAPABILITIES_BLOCKED';
        options.push({
          id: `decline:${clause.id}:${reasonCode}`, kind: 'DECLINE', clauseId: clause.id,
          declineKind, reasonCode,
          trace: trace(`decline-trace:${clause.id}`, reasonCode, clause.trace.id, 'OBSERVED'),
        });
      }
    }

    options.sort((a, b) => compareText(a.id, b.id));
    rejectedOptions.sort((a, b) => compareText(a.optionId, b.optionId) || compareText(a.reasonCode, b.reasonCode));
    const result: OptionGeneration = {
      options,
      rejected: rejectedOptions,
      trace: trace(`options:${facts.objective.originalRequestId}`, 'OPTIONS_ENUMERATED', facts.objective.trace.id, 'OBSERVED'),
    };
    return { ok: true, value: freezeDeep(result) };
  } catch {
    return fail('option-generation-failed', 'Options could not be generated safely from the supplied facts.');
  }
}
