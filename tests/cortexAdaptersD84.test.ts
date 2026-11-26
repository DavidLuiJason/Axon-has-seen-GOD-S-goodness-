// D0 (continuing D84): regression pins for the CX-A1..A3 fixes, the typed adapter hook and the tap feeds. Typed data only; no phrase lists.
import { gatherKnowledge } from '../src/brain/mind/cortex/adapters/cortexA1Knowledge.ts';
import { chooseMethods } from '../src/brain/mind/cortex/adapters/cortexA2MethodsRelations.ts';
import { signalsFromEvents, type CommitmentSignalEvent } from '../src/brain/mind/cortex/adapters/cortexA3CommitmentSignals.ts';
import { createCortex } from '../src/brain/mind/cortex/cortex.ts';
import { buildTapInput, tapCortex } from '../src/brain/mind/orchestrator/cortexTap.ts';
import { buildCortexInput } from '../src/brain/mind/cortex/cortexTypes.ts';
import type { CortexInput, CommitmentReference, TraceEntry } from '../src/brain/mind/cortex/cortexTypes.ts';
import type { RelationEdge } from '../src/brain/mind/cortex/relationReasoner.ts';

let checks = 0;
const ok = (c: unknown, label: string): void => { checks++; if (!c) throw new Error('FAIL: ' + label); };
const trace = (id: string): TraceEntry => ({ id, stage: 'INPUT', code: 'TEST', sourceRef: id, evidence: 'OBSERVED' });
const edge = (id: string, fromRef: string, toRef: string): RelationEdge => ({ id, fromRef, toRef, type: 'HYPONYM', evidence: 'VERIFIED', sourceRef: id, trace: trace(id) });

function base(refs: readonly string[], capClauses: readonly string[] = ['t:c1']): CortexInput {
  const raw: any = buildTapInput({ turnId: 't', toolId: 'cap1', missingText: false, recheck: 'PASSED', judgment: null });
  raw.objective.clauses[0].meaning.conceptRefs = refs;
  raw.objective.clauses[0].meaning.allowedSubgoalRefs = ['cap1'];
  const second = JSON.parse(JSON.stringify(raw.objective.clauses[0]));
  second.id = 'other'; second.meaning.id = 'm-other'; second.meaning.conceptRefs = []; second.meaning.allowedSubgoalRefs = [];
  second.meaning.successTest.id = 's-other';
  raw.objective.clauses.push(second);
  raw.candidateCapabilities[0].clauseRefs = capClauses;
  const b: any = buildCortexInput(raw);
  if (!b.ok) throw new Error('fixture invalid: ' + b.error + ' ' + b.message);
  return b.value;
}

(async () => {
  // ---- A1
  const tr = trace('b');
  const binding = (ev: 'VERIFIED' | 'OBSERVED'): any => ({ sourceId: 'dict', kind: 'DICTIONARY', trace: { ...tr, evidence: ev },
    slot: { status: () => ({ ready: true, source: 'OEWN', version: '2025' }), lookup: async (w: string) => ({ status: 'found', word: w, senses: [{ gloss: 'g' }], source: 'OEWN', version: '2025' }) } });
  const kin = base(['KNOWLEDGE_DICTIONARY']);
  const r1 = await gatherKnowledge(kin, async () => [binding('VERIFIED')]);
  const r2 = await gatherKnowledge(r1.input, async () => [binding('VERIFIED')]);
  ok(r1.input.knowledgeHits.length === 1 && r2.input.knowledgeHits.length === 1, 'A1 repeat call does not duplicate the hit');
  ok(r1.input.knowledgeHits[0]!.trace.code === 'CHECKED_KNOWLEDGE_SOURCE' && r1.input.knowledgeHits[0]!.truth === 'VERIFIED', 'A1 hit label and trace code pinned');
  ok(buildCortexInput(JSON.parse(JSON.stringify(r2.input))).ok, 'A1 output still validates');
  const unv = await gatherKnowledge(kin, async () => [binding('OBSERVED')]);
  ok(unv.input.knowledgeHits.length === 0 && unv.failures.some((f) => f.endsWith('UNVERIFIED_KNOWLEDGE_SOURCE')), 'A1 unchecked source gives no hit and a marker');
  const thrown = await gatherKnowledge(kin, async () => { throw new Error('x'); });
  ok(thrown.input.knowledgeHits.length === 0 && thrown.failures.some((f) => f.endsWith('LOOKUP_UNKNOWN')), 'A1 thrown lookup is UNKNOWN, no hit');
  const slow = await gatherKnowledge(kin, () => new Promise(() => {}), { timeoutMs: 20 });
  ok(slow.failures.some((f) => f.endsWith('LOOKUP_UNKNOWN')) && slow.input.knowledgeHits.length === 0, 'A1 timeout is UNKNOWN');
  const badT = await gatherKnowledge(kin, async () => [binding('VERIFIED')], { timeoutMs: 30001 });
  ok(badT.failures[0] === 'BAD_LOOKUP_CONFIGURATION', 'A1 timeout above 30000 ms refused');
  const edgeT = await gatherKnowledge(kin, async () => [binding('VERIFIED')], { timeoutMs: 30000 });
  ok(edgeT.failures[0] !== 'BAD_LOOKUP_CONFIGURATION', 'A1 timeout of exactly 30000 ms accepted');

  // ---- A2
  const none = chooseMethods(base([]), { relationSource: { relationsFrom: () => [] } });
  ok(none.methods[0]!.trace.code === 'NO_METHOD' && none.methods[0]!.method === null, 'A2 no method: trace code NO_METHOD');
  const some = chooseMethods(base(['RULE_DEDUCTION']), { relationSource: { relationsFrom: () => [] } });
  ok(some.methods[0]!.trace.code === 'METHOD_SELECTED', 'A2 method selected: trace code');
  const bad = chooseMethods(base(['RELATION_CATEGORY'], ['t:c1']), { relationSource: { relationsFrom: () => [{ nonsense: true } as never] } });
  ok(bad.candidateCapabilities.length === 1 && bad.candidateCapabilities[0]!.clauseRefs.length === 1, 'A2 invalid relation data changes nothing');
  const good = chooseMethods(base(['RELATION_CATEGORY'], ['other']), { relationSource: { relationsFrom: (ref: string) => ref === 'result:cap1' ? [edge('e1', 'result:cap1', 'RELATION_CATEGORY')] : ref === 'RELATION_CATEGORY' ? [edge('e2', 'RELATION_CATEGORY', 'cap1')] : [] } });
  ok(good.candidateCapabilities[0]!.clauseRefs.includes('t:c1') && good.candidateCapabilities[0]!.clauseRefs.includes('other'), 'A2 relation extends the existing capability to this clause, keeping the old one');
  const deep = (n: number) => (ref: string): RelationEdge[] => ref === 'result:cap1' ? [edge('d0', 'result:cap1', 'RELATION_CATEGORY')] : ref === 'RELATION_CATEGORY' ? [edge('d1', 'RELATION_CATEGORY', 'h1')] : ref.startsWith('h') && Number(ref.slice(1)) < n ? [edge('d' + (Number(ref.slice(1)) + 1), ref, 'h' + (Number(ref.slice(1)) + 1))] : ref === 'h' + n ? [edge('last', ref, 'cap1')] : [];
  const tooDeep = chooseMethods(base(['RELATION_CATEGORY'], ['other']), { relationSource: { relationsFrom: deep(8) } });
  ok(!tooDeep.candidateCapabilities[0]!.clauseRefs.includes('t:c1'), 'A2 a relation path deeper than 4 is not followed');

  // ---- A3
  const commit = (kind: CommitmentReference['kind']): CommitmentReference => ({ id: 'commit1', clauseId: null, kind, status: 'ACTIVE', valueRef: 'v', trace: trace('old') });
  const ev = (id: string, kind: CommitmentSignalEvent['kind'], byOwner: boolean): CommitmentSignalEvent => ({ id, kind, targetCommitmentId: 'commit1', byOwner, trace: trace(id) });
  const chat = signalsFromEvents([ev('c1', 'REPLACE', false)], { commitments: [commit('LAW')] });
  ok(chat.commitments.length === 2 && chat.commitments[0]!.status === 'ACTIVE' && chat.commitments[1]!.status === 'PROPOSED' && chat.commitments[1]!.trace.code === 'CHAT_EVENT_PROPOSED_ONLY', 'A3 chat event proposes, never changes the law');
  const chatSoft = signalsFromEvents([ev('c2', 'REPLACE', false)], { commitments: [commit('DECISION')] });
  ok(chatSoft.commitments[1]!.trace.code === 'CHAT_COMMITMENT_PROPOSED', 'A3 chat on a plain commitment: its own code');
  const own = signalsFromEvents([ev('o1', 'REPLACE', true)], { commitments: [commit('LAW')] });
  ok(own.commitments.length === 1 && own.commitments[0]!.trace.code === 'OWNER_COMMITMENT_EVENT' && own.commitments[0]!.status === 'ACTIVE', 'A3 owner event keeps one record, owner code');
  const req: any = { signal: { id: 'x', sourceEventRef: 'x', origin: 'owner', statementKind: 'decision', kind: 'law', subject: 's', value: 'v', scope: 'user', scopeId: 'owner', targetPriorCommitmentId: 'commit1', intent: 'replace', explicitChangeCue: true, retract: false, condition: null, replacementRef: 'r', observedAt: 2, repetitionCount: 0, trace: trace('x') }, commitments: [], grants: [], approvalCheck: 'VERIFIED', irreversibleConflict: false, trace: trace('rq') };
  const kinds: CommitmentSignalEvent['kind'][] = ['REPLACE', 'CORRECT', 'OVERRIDE', 'EXCEPTION', 'CONFIRM', 'DECLINE'];
  for (const k of kinds) {
    const o = signalsFromEvents([ev('e-' + k, k, true)], { commitments: [commit('DECISION')], reconciliationByEvent: { ['e-' + k]: req } }).reconciliationRequests[0]!.signal;
    ok(o.origin === 'owner', `A3 ${k}: owner origin`);
    ok(o.retract === (k === 'OVERRIDE'), `A3 ${k}: retract only for OVERRIDE`);
    ok(o.intent === ({ REPLACE: 'replace', CORRECT: 'correct', OVERRIDE: 'override', EXCEPTION: 'exception', CONFIRM: null, DECLINE: null } as const)[k], `A3 ${k}: intent`);
    ok(o.explicitChangeCue === !(k === 'CONFIRM' || k === 'DECLINE'), `A3 ${k}: change cue`);
    ok(o.statementKind === (k === 'CORRECT' ? 'correction' : 'decision'), `A3 ${k}: statement kind`);
    const c = signalsFromEvents([ev('c-' + k, k, false)], { commitments: [commit('DECISION')], reconciliationByEvent: { ['c-' + k]: req } }).reconciliationRequests[0]!.signal;
    ok(c.origin === 'axon' && c.retract === false && c.intent === null && c.statementKind === 'proposal' && c.explicitChangeCue === false, `A3 ${k}: chat event stays a proposal`);
  }

  // ---- facade hook
  const deps = (adapters?: { apply: (v: CortexInput) => CortexInput }) => ({ maxOptionDepth: 4, advisorySignals: () => ({ risk: 'LOW', resourceFit: 'FIT', actionKind: 'READ', councilFlags: [], judgment: { verdict: 'PROCEED', flags: [], trace: trace('j') }, uncertain: false }), ...(adapters ? { adapters } : {}) }) as never;
  const raw = buildTapInput({ turnId: 'h', toolId: 'cap1', missingText: false, recheck: 'PASSED', judgment: null });
  const plain = createCortex(deps()).decide(raw);
  ok(plain.ok, 'facade without adapters still decides');
  const broken = createCortex(deps({ apply: () => ({ nonsense: true }) as never })).decide(raw);
  ok(!broken.ok && broken.error === 'bad-adapter-output', 'facade: a bad adapter fails closed with its own error code');
  const passthrough = createCortex(deps({ apply: (v) => v })).decide(raw);
  ok(passthrough.ok && plain.ok && passthrough.value.decision.decision.kind === plain.value.decision.decision.kind, 'facade: an identity adapter changes nothing');

  // ---- tap feeds
  const withHit = buildTapInput({ turnId: 'k', toolId: 'cap1', missingText: false, recheck: 'PASSED', judgment: null, knowledgeHits: r1.input.knowledgeHits, commitments: [commit('LAW')], ownerEvents: [ev('chat', 'REPLACE', false)] }) as any;
  ok(withHit.knowledgeHits.length === 1 && withHit.commitments.length === 2 && withHit.commitments[1].status === 'PROPOSED', 'tap: typed feeds reach the CORTEX input');
  const none2 = buildTapInput({ turnId: 'k', toolId: 'cap1', missingText: false, recheck: 'PASSED', judgment: null }) as any;
  ok(none2.knowledgeHits.length === 0 && none2.commitments.length === 0, 'tap: no feeds means empty lists as before');
  const t = tapCortex({ turnId: 'k', toolId: 'cap1', missingText: false, recheck: 'PASSED', judgment: null, commitments: [commit('LAW')], ownerEvents: [ev('chat', 'REPLACE', false)] });
  ok(t.ok && t.value.agrees, 'tap: a chat event against a law does not break the shadow decision');
  console.log('cortexAdaptersD84: ' + checks + ' checks; 0 failed');
})().catch((e) => { console.log(String(e instanceof Error ? e.message : e)); throw e; });
