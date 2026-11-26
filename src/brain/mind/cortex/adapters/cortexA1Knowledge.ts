import { resolveKnowledgeNeed, type KnowledgeSourceBinding, type KnowledgeNeedRequest } from '../knowledgeNeed.ts';
import type { CortexInput, KnowledgeHit, TraceEntry } from '../cortexTypes.ts';

export type KnowledgeLookup = (need: KnowledgeNeedRequest) => Promise<readonly KnowledgeSourceBinding[]>;
export interface KnowledgeAdapterOptions { readonly timeoutMs?: number }
export interface KnowledgeGatherResult { readonly input: CortexInput; readonly failures: readonly string[] }

const featureMap: Readonly<Record<string, keyof KnowledgeNeedRequest['features']>> = {
  KNOWLEDGE_DICTIONARY: 'dictionary',
  KNOWLEDGE_NOTES: 'notes',
  KNOWLEDGE_ARCHIVE: 'archives',
};
const traceFor = (clauseId: string, sourceRef: string, code: string, evidence: TraceEntry['evidence']): TraceEntry =>
  ({ id: `cx-a1:${clauseId}`, stage: 'OPTION_GENERATOR', code, sourceRef, evidence });

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('lookup-timeout')), timeoutMs);
    promise.then((value) => { clearTimeout(timer); resolve(value); }, (error: unknown) => { clearTimeout(timer); reject(error); });
  });
}

/** Adds only source-backed hits. No message text is read and failures remain UNKNOWN. */
export async function gatherKnowledge(input: CortexInput, lookup: KnowledgeLookup, options: KnowledgeAdapterOptions = {}): Promise<KnowledgeGatherResult> {
  const timeoutMs = options.timeoutMs ?? 1500;
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 30000 || typeof lookup !== 'function') {
    return { input, failures: ['BAD_LOOKUP_CONFIGURATION'] };
  }
  const hits: KnowledgeHit[] = input.knowledgeHits.filter((hit) => hit.truth === 'VERIFIED');
  const failures: string[] = [];
  for (const clause of input.objective.clauses) {
    const features = { dictionary: false, notes: false, archives: false };
    for (const ref of clause.meaning.conceptRefs) {
      const key = featureMap[ref];
      if (key !== undefined) features[key] = true;
    }
    const need: KnowledgeNeedRequest = {
      clauseId: clause.id, lookupRef: clause.meaning.successTest.targetRef, features, trace: clause.trace,
    };
    try {
      const bindings = await withTimeout(Promise.resolve().then(() => lookup(need)), timeoutMs);
      const resolved = await resolveKnowledgeNeed(need, bindings);
      if (!resolved.ok) { failures.push(`${clause.id}:KNOWLEDGE_NEED_FAILED`); continue; }
      for (const hit of resolved.value.hits) {
        const binding = bindings.find((item) => item.sourceId === hit.sourceId);
        if (binding?.trace.evidence !== 'VERIFIED') {
          failures.push(`${clause.id}:UNVERIFIED_KNOWLEDGE_SOURCE`);
          continue;
        }
        if (hits.some((existing) => existing.id === hit.id)) continue; // a repeated call must not add the same hit twice
        hits.push({
          id: hit.id, clauseId: clause.id, answerRef: hit.lookupRef, sourceId: hit.sourceId, truth: 'VERIFIED',
          trace: { ...hit.trace, evidence: 'VERIFIED', code: 'CHECKED_KNOWLEDGE_SOURCE' },
        });
      }
      if (resolved.value.outcome === 'SOURCE_UNAVAILABLE') failures.push(`${clause.id}:SOURCE_UNAVAILABLE`);
    } catch {
      failures.push(`${clause.id}:LOOKUP_UNKNOWN`);
    }
  }
  return { input: { ...input, knowledgeHits: hits }, failures };
}
