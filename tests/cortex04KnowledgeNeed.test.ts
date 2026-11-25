import type { KnowledgeLookupResult, KnowledgeSlot } from '../src/brain/knowledge/slot.ts';
import type { TraceEntry } from '../src/brain/mind/cortex/cortexTypes.ts';
import { resolveKnowledgeNeed, type KnowledgeNeedRequest, type KnowledgeSourceBinding } from '../src/brain/mind/cortex/knowledgeNeed.ts';

let checks = 0;
function assert(value: unknown, label: string): asserts value { checks += 1; if (!value) throw new Error(`FAIL: ${label}`); }
function trace(id: string): TraceEntry { return { id, stage: 'INPUT', code: 'SOURCE_RECORD', sourceRef: id, evidence: 'OBSERVED' }; }
function request(features: KnowledgeNeedRequest['features'] = { dictionary: true, notes: false, archives: false }): KnowledgeNeedRequest {
  return { clauseId: 'clause-knowledge', lookupRef: 'typed.lookup.ref', features, trace: trace('knowledge-request') };
}
function slot(found: boolean, ready = true, source = 'source-dictionary', version = 'v1'): Pick<KnowledgeSlot, 'status' | 'lookup'> {
  return {
    status: () => ({ ready, source, version }),
    async lookup(word: string): Promise<KnowledgeLookupResult> {
      return found
        ? { status: 'found', word, senses: [{ partOfSpeech: 'noun', meaning: 'A source-backed meaning' }], source, version }
        : { status: 'not-found', word, source, version };
    },
  };
}
function binding(id: string, kind: KnowledgeSourceBinding['kind'], found: boolean, ready = true): KnowledgeSourceBinding {
  return { sourceId: id, kind, slot: slot(found, ready, `name-${id}`), trace: trace(`source-${id}`) };
}

async function main(): Promise<void> {
  const basic = await resolveKnowledgeNeed(request(), [binding('dict-1', 'DICTIONARY', true)]);
  assert(basic.ok && basic.value.outcome === 'FOUND' && basic.value.hits.length === 1, '01 a typed dictionary need returns one hit');

  const notes = await resolveKnowledgeNeed(request({ dictionary: false, notes: true, archives: false }), [binding('notes-1', 'NOTES', true)]);
  assert(notes.ok && notes.value.selectedKinds[0] === 'NOTES' && notes.value.hits[0]?.sourceKind === 'NOTES', '02 owner-note features select the notes source');

  const archive = await resolveKnowledgeNeed(request({ dictionary: false, notes: false, archives: true }), [binding('archive-1', 'ARCHIVE', true)]);
  assert(archive.ok && archive.value.selectedKinds[0] === 'ARCHIVE', '03 domain/archive features select the archive source');

  const all = await resolveKnowledgeNeed(request({ dictionary: true, notes: true, archives: true }), [
    binding('dict-1', 'DICTIONARY', true), binding('notes-1', 'NOTES', true), binding('archive-1', 'ARCHIVE', true),
  ]);
  assert(all.ok && all.value.hits.length === 3 && all.value.selectedKinds.length === 3, '04 every explicitly needed source kind is queried');

  const noNeed = await resolveKnowledgeNeed(request({ dictionary: false, notes: false, archives: false }), []);
  assert(noNeed.ok && noNeed.value.outcome === 'NO_SOURCE_SELECTED' && noNeed.value.hits.length === 0, '05 no source is queried when no knowledge source is needed');

  const noHold = await resolveKnowledgeNeed(request(), [binding('dict-empty', 'DICTIONARY', false)]);
  assert(noHold.ok && noHold.value.outcome === 'NO_SOURCE_HOLDS_IT' && noHold.value.hits.length === 0, '06 a not-found response returns no source holds it');

  const missingBinding = await resolveKnowledgeNeed(request({ dictionary: false, notes: true, archives: false }), []);
  assert(missingBinding.ok && missingBinding.value.outcome === 'SOURCE_UNAVAILABLE' && missingBinding.value.missingKinds.includes('NOTES'), '07 a required but absent source is reported unavailable, not guessed');

  const unready = await resolveKnowledgeNeed(request(), [binding('dict-sleeping', 'DICTIONARY', true, false)]);
  assert(unready.ok && unready.value.outcome === 'SOURCE_UNAVAILABLE' && unready.value.attempts[0]?.status === 'NOT_READY', '08 a non-ready slot is not queried');

  const repeated = await resolveKnowledgeNeed(request(), [binding('same-source', 'DICTIONARY', true), binding('same-source', 'DICTIONARY', true)]);
  assert(repeated.ok && repeated.value.hits.length === 1 && repeated.value.duplicateSourceIds.includes('same-source'), '09 the same source repeated twice is counted once');

  const labelled = await resolveKnowledgeNeed(request(), [binding('dict-labelled', 'DICTIONARY', true)]);
  assert(labelled.ok && labelled.value.hits[0]?.truth === 'REPORTED' && labelled.value.hits[0]?.sourceId === 'dict-labelled', '10 a hit carries its source and conservative REPORTED truth label');

  const metadata = await resolveKnowledgeNeed(request(), [binding('dict-version', 'DICTIONARY', true)]);
  assert(metadata.ok && metadata.value.hits[0]?.version === 'v1' && metadata.value.hits[0]?.sourceName === 'name-dict-version', '11 a hit preserves slot source metadata');

  const partial = await resolveKnowledgeNeed(request({ dictionary: true, notes: true, archives: false }), [binding('dict-partial', 'DICTIONARY', true)]);
  assert(partial.ok && partial.value.outcome === 'FOUND' && partial.value.missingKinds.includes('NOTES'), '12 one source hit is preserved while another required source remains missing');

  const rawText = { ...request(), text: 'untyped message text' };
  const textRejected = await resolveKnowledgeNeed(rawText, [binding('dict-raw', 'DICTIONARY', true)]);
  assert(!textRejected.ok, '13 message text is not accepted in a knowledge-need request');

  const emptyKey = await resolveKnowledgeNeed({ ...request(), lookupRef: ' ' }, [binding('dict-empty-key', 'DICTIONARY', true)]);
  assert(!emptyKey.ok, '14 an empty lookup reference is rejected');

  console.log(`CORTEX part 4 knowledge need passed: ${checks} cases`);
}
void main();
