/** CORTEX R2 / Part 4: choose injected knowledge slots from typed clause features. */
import type { KnowledgeLookupResult, KnowledgeSlot } from '../../knowledge/slot.ts';
import type { CortexEngineResult, EvidenceLabel, TraceEntry } from './cortexTypes.ts';

export type KnowledgeSourceKind = 'DICTIONARY' | 'NOTES' | 'ARCHIVE';

export interface KnowledgeNeedFeatures {
  readonly dictionary: boolean;
  readonly notes: boolean;
  readonly archives: boolean;
}

export interface KnowledgeNeedRequest {
  readonly clauseId: string;
  readonly lookupRef: string;
  readonly features: KnowledgeNeedFeatures;
  readonly trace: TraceEntry;
}

export interface KnowledgeSourceBinding {
  readonly sourceId: string;
  readonly kind: KnowledgeSourceKind;
  readonly slot: Pick<KnowledgeSlot, 'status' | 'lookup'>;
  readonly trace: TraceEntry;
}

export interface KnowledgeSourceAttempt {
  readonly sourceId: string;
  readonly kind: KnowledgeSourceKind;
  readonly status: 'FOUND' | 'NOT_FOUND' | 'NOT_READY' | 'ERROR' | 'DUPLICATE_SOURCE';
  readonly sourceName: string;
  readonly version: string;
  readonly trace: TraceEntry;
}

export interface KnowledgeNeedHit {
  readonly id: string;
  readonly clauseId: string;
  readonly lookupRef: string;
  readonly sourceId: string;
  readonly sourceKind: KnowledgeSourceKind;
  readonly sourceName: string;
  readonly version: string;
  readonly senses: KnowledgeLookupResult extends infer R ? R extends { status: 'found'; senses: infer S } ? S : never : never;
  readonly truth: EvidenceLabel;
  readonly trace: TraceEntry;
}

export interface KnowledgeNeedResolution {
  readonly outcome: 'FOUND' | 'NO_SOURCE_HOLDS_IT' | 'SOURCE_UNAVAILABLE' | 'NO_SOURCE_SELECTED';
  readonly selectedKinds: readonly KnowledgeSourceKind[];
  readonly hits: readonly KnowledgeNeedHit[];
  readonly attempts: readonly KnowledgeSourceAttempt[];
  readonly duplicateSourceIds: readonly string[];
  readonly missingKinds: readonly KnowledgeSourceKind[];
  readonly trace: TraceEntry;
}

const sourceKinds: Readonly<Record<string, true>> = { DICTIONARY: true, NOTES: true, ARCHIVE: true };
const fail = <T>(error: string, message: string): CortexEngineResult<T> => ({ ok: false, error, message });
const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const isText = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0 && value.length <= 240;
const isTrace = (value: unknown): value is TraceEntry => isRecord(value) && isText(value.id) && isText(value.stage) && isText(value.code) && isText(value.sourceRef) && isText(value.evidence);

function cloneData<T>(value: T): T {
  if (Array.isArray(value)) return value.map((item) => cloneData(item)) as T;
  if (value !== null && typeof value === 'object') {
    const copy: Record<string, unknown> = Object.create(null) as Record<string, unknown>;
    for (const [key, item] of Object.entries(value as Record<string, unknown>)) copy[key] = cloneData(item);
    return copy as T;
  }
  return value;
}
const freezeDeep = <T>(value: T): T => {
  if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const child of Object.values(value as Record<string, unknown>)) freezeDeep(child);
    Object.freeze(value);
  }
  return value;
};

function validateRequest(value: unknown): value is KnowledgeNeedRequest {
  if (!isRecord(value) || Object.keys(value).some((key) => key !== 'clauseId' && key !== 'lookupRef' && key !== 'features' && key !== 'trace')) return false;
  if (!isText(value.clauseId) || !isText(value.lookupRef) || !isTrace(value.trace) || !isRecord(value.features)) return false;
  if (Object.keys(value.features).some((key) => key !== 'dictionary' && key !== 'notes' && key !== 'archives')) return false;
  return typeof value.features.dictionary === 'boolean' && typeof value.features.notes === 'boolean' && typeof value.features.archives === 'boolean';
}

function validateSource(value: unknown): value is KnowledgeSourceBinding {
  if (!isRecord(value) || Object.keys(value).some((key) => key !== 'sourceId' && key !== 'kind' && key !== 'slot' && key !== 'trace')) return false;
  return isText(value.sourceId) && typeof value.kind === 'string' && Object.prototype.hasOwnProperty.call(sourceKinds, value.kind) &&
    isRecord(value.slot) && typeof value.slot.status === 'function' && typeof value.slot.lookup === 'function' && isTrace(value.trace);
}

/**
 * Looks up the typed reference through KnowledgeSlot only. Repeated source ids are
 * treated as one source, even when the same binding appears more than once.
 */
export async function resolveKnowledgeNeed(
  request: KnowledgeNeedRequest,
  sources: readonly KnowledgeSourceBinding[],
): Promise<CortexEngineResult<KnowledgeNeedResolution>> {
  try {
    if (!validateRequest(request) || !Array.isArray(sources) || !sources.every(validateSource)) {
      return fail('bad-input', 'A knowledge need requires a typed clause request and KnowledgeSlot bindings.');
    }
    const selectedKinds: KnowledgeSourceKind[] = [];
    if (request.features.dictionary) selectedKinds.push('DICTIONARY');
    if (request.features.notes) selectedKinds.push('NOTES');
    if (request.features.archives) selectedKinds.push('ARCHIVE');
    if (selectedKinds.length === 0) {
      return { ok: true, value: freezeDeep({
        outcome: 'NO_SOURCE_SELECTED', selectedKinds, hits: [], attempts: [], duplicateSourceIds: [], missingKinds: [],
        trace: { id: `knowledge:${request.clauseId}`, stage: 'OPTION_GENERATOR', code: 'NO_KNOWLEDGE_SOURCE_NEEDED', sourceRef: request.trace.id, evidence: 'OBSERVED' },
      }) };
    }

    const selectedBindings = sources.filter((source) => selectedKinds.includes(source.kind));
    const seen = new Set<string>();
    const duplicates = new Set<string>();
    const unique: KnowledgeSourceBinding[] = [];
    for (const source of selectedBindings) {
      if (seen.has(source.sourceId)) duplicates.add(source.sourceId);
      else { seen.add(source.sourceId); unique.push(source); }
    }

    const missingKinds = selectedKinds.filter((kind) => !unique.some((source) => source.kind === kind));
    const hits: KnowledgeNeedHit[] = [];
    const attempts: KnowledgeSourceAttempt[] = [];
    for (const source of unique) {
      const status = source.slot.status();
      if (!status.ready) {
        attempts.push({ sourceId: source.sourceId, kind: source.kind, status: 'NOT_READY', sourceName: status.source, version: status.version,
          trace: { id: `attempt:${source.sourceId}`, stage: 'OPTION_GENERATOR', code: 'KNOWLEDGE_SLOT_NOT_READY', sourceRef: source.trace.id, evidence: 'OBSERVED' } });
        continue;
      }
      const lookup = await source.slot.lookup(request.lookupRef);
      if (lookup.status === 'found') {
        hits.push({
          id: `knowledge-hit:${request.clauseId}:${source.sourceId}`, clauseId: request.clauseId, lookupRef: request.lookupRef,
          sourceId: source.sourceId, sourceKind: source.kind, sourceName: lookup.source, version: lookup.version,
          senses: cloneData(lookup.senses), truth: 'REPORTED',
          trace: { id: `knowledge-trace:${source.sourceId}`, stage: 'OPTION_GENERATOR', code: 'SOURCE_RETURNED_MATCH', sourceRef: source.trace.id, evidence: 'REPORTED' },
        });
        attempts.push({ sourceId: source.sourceId, kind: source.kind, status: 'FOUND', sourceName: lookup.source, version: lookup.version,
          trace: { id: `attempt:${source.sourceId}`, stage: 'OPTION_GENERATOR', code: 'KNOWLEDGE_MATCH_FOUND', sourceRef: source.trace.id, evidence: 'REPORTED' } });
      } else if (lookup.status === 'not-found') {
        attempts.push({ sourceId: source.sourceId, kind: source.kind, status: 'NOT_FOUND', sourceName: lookup.source, version: lookup.version,
          trace: { id: `attempt:${source.sourceId}`, stage: 'OPTION_GENERATOR', code: 'KNOWLEDGE_SOURCE_NO_MATCH', sourceRef: source.trace.id, evidence: 'OBSERVED' } });
      } else {
        attempts.push({ sourceId: source.sourceId, kind: source.kind, status: 'ERROR', sourceName: lookup.source, version: lookup.version,
          trace: { id: `attempt:${source.sourceId}`, stage: 'OPTION_GENERATOR', code: 'KNOWLEDGE_SOURCE_ERROR', sourceRef: source.trace.id, evidence: 'UNKNOWN' } });
      }
    }
    const hasFailure = attempts.some((item) => item.status === 'ERROR' || item.status === 'NOT_READY') || missingKinds.length > 0;
    const outcome = hits.length > 0 ? 'FOUND' : (hasFailure ? 'SOURCE_UNAVAILABLE' : 'NO_SOURCE_HOLDS_IT');
    const resolution: KnowledgeNeedResolution = {
      outcome, selectedKinds, hits, attempts,
      duplicateSourceIds: [...duplicates].sort(), missingKinds,
      trace: { id: `knowledge:${request.clauseId}`, stage: 'OPTION_GENERATOR', code: outcome, sourceRef: request.trace.id, evidence: hits.length > 0 ? 'REPORTED' : 'OBSERVED' },
    };
    return { ok: true, value: freezeDeep(resolution) };
  } catch {
    return fail('knowledge-lookup-failed', 'A knowledge slot failed; no unsupported answer was inferred.');
  }
}
