// JOB 5 (D926): the council sits only when the situation needs it, its decision reaches the owner in plain words, and a failing council never touches the answer.
// Part A is pure. Part B uses a scripted brain (the same technique as orchestrator.test.ts) because no risky tool is live in chat today.
import { createOrchestrator } from '../src/brain/mind/orchestrator/orchestrator';
import { NOT_CONVENED, needsCouncil, plainCouncilNote } from '../src/brain/mind/orchestrator/councilGate';
import { buildSituation } from '../src/brain/mind/orchestrator/situation';
import { judgeProposal } from '../src/brain/mind/judgment/judge';
import { listSchemas } from '../src/brain/mind/schema/actionSchemas';
import { LIVE_SWITCHES } from '../src/tools/runners/liveSwitches';
import type { Proposal } from '../src/brain/mind/judgment/council';

let n = 0;
let f = 0;
const check = (ok: boolean, name: string) => { n++; if (!ok) { f++; console.log('FAIL ' + name); } };
const simple: Proposal = { id: 't', actionKind: 'READ', reversible: true, affectsOthers: false, interpretation: 'HIGH', evidence: 'VERIFIED', permission: 'ALLOW', departsFromStatedGoal: false, missingInputs: [], undefinedTerms: [], dependenciesMet: true, costOfDoingNothing: 'NONE' };

// ---- A: the gate
check(!needsCouncil(simple), 'C01 a plain, reversible, clear, verified read does not convene the council');
const variants: Array<[string, Partial<Proposal>]> = [
  ['not a read', { actionKind: 'WRITE' }], ['irreversible', { reversible: false }], ['affects others', { affectsOthers: true }], ['medium reading', { interpretation: 'MEDIUM' }],
  ['disputed evidence', { evidence: 'DISPUTED' }], ['needs permission', { permission: 'ASK' }], ['departs from goal', { departsFromStatedGoal: true }], ['dependency unmet', { dependenciesMet: false }],
  ['missing input', { missingInputs: ['text'] }], ['undefined term', { undefinedTerms: ['x'] }],
];
for (const [name, change] of variants) check(needsCouncil({ ...simple, ...change }), 'C02 convened when: ' + name);
const j = judgeProposal(simple);
check(j.ok && JSON.stringify(j.value) === JSON.stringify(NOT_CONVENED), 'C03 skipping the council gives exactly the verdict the council would have given');
const schemas = listSchemas();
const sit = (tool: string) => buildSituation({ id: 't', toolId: tool, repairVerdict: 'KEEP', evidence: 'VERIFIED', missingInputs: [] }).proposal;
const plain = schemas.filter((x) => x.effects.length === 1 && x.effects[0] === 'shows-result' && x.preconditions.length === 0);
check(plain.length > 10 && plain.every((x) => !needsCouncil(sit(x.tool))), 'C04 none of the ' + plain.length + ' plain result tools convenes the council');
const approval = schemas.filter((x) => (x.preconditions as readonly string[]).includes('owner-approval'));
check(approval.length >= 3 && approval.every((x) => needsCouncil(sit(x.tool))), 'C05 every owner-approval tool convenes it');
// ---- ADMISSION: nothing risky can be switched ON in chat without the council noticing
const on = Object.entries(LIVE_SWITCHES).filter(([, v]) => v === 'runner').map(([k]) => k);
check(on.length >= 10, 'C06 ' + on.length + ' tools are switched ON');
check(on.every((tool) => { const r = judgeProposal(sit(tool)); return r.ok && r.value.verdict === 'PROCEED'; }), 'C07 every tool switched ON today gets a plain PROCEED from the council (so chat shows no council note): ' + on.filter((t) => { const r = judgeProposal(sit(t)); return !(r.ok && r.value.verdict === 'PROCEED'); }).join(', '));
// A tool that writes a file (converter) legitimately convenes the council; it must still pass without a note, and a plain read must not convene it.
check(on.includes('converter') ? needsCouncil(sit('converter')) : true, 'C07b a switched-ON tool that declares a file write convenes the council (' + on.filter((t) => needsCouncil(sit(t))).join(', ') + ')');
// ---- the owner's words
const ask = judgeProposal({ ...simple, actionKind: 'WRITE', reversible: false, permission: 'ASK', evidence: 'UNKNOWN' });
const note = ask.ok ? plainCouncilNote(ask.value, 'auto-clicker') : null;
check(note !== null && note.startsWith('I should have checked with you before running auto-clicker.') && !note.includes('{') && !note.includes('severity') && !note.includes('seat'), 'C08 an ASK becomes one plain sentence group, no raw object: ' + (note ?? 'none').slice(0, 90));
check(plainCouncilNote(NOT_CONVENED, 'x') === null, 'C09 a plain PROCEED says nothing');
const warn = judgeProposal({ ...simple, actionKind: 'WRITE', evidence: 'INFERRED' });
check(warn.ok && warn.value.verdict === 'PROCEED_WITH_WARNING' && (plainCouncilNote(warn.value, 'x') ?? '').startsWith('A caution about x:'), 'C10 a warning is worded as a caution');
const stop = judgeProposal({ ...simple, permission: 'NEVER' });
check(stop.ok && stop.value.verdict === 'STOP' && (plainCouncilNote(stop.value, 'x') ?? '').startsWith('I should not have run x'), 'C11 a STOP is worded as a refusal');

// ---- B: through the orchestrator with a scripted brain
const ran = (body: string) => body + '\n\nRan as task task-1: COMPLETED in 0 ms, from your exact input.';
const brainOf = (reply: { content: string; source: string; taskId?: string }) => ({ async askWithTrace() { return { reply, trace: { utterance: { id: 'u', text: 'x', place: 'chat', at: 0 }, entries: [] } }; } });
const RISKY = { content: ran('Clicking started.'), source: 'runner:auto-clicker', taskId: 'task-1' };
{
  const o = createOrchestrator(brainOf(RISKY), { mode: 'on' });
  const r = await o.ask({ text: 'start the auto clicker', place: 'chat' });
  check(r.reply.content.includes('Clicking started.') && r.reply.content.includes('Council note: I should have checked with you before running auto-clicker.'), 'C12 on: a risky tool answer carries the council note in plain words');
  check(r.orchestration.judgment?.verdict === 'ASK' && r.orchestration.replyChanged === true, 'C13 on: the verdict is ASK and the reply is marked changed');
  const st = o.stats() as unknown as Record<string, number>;
  check(st.councilConvened === 1 && st.councilSkipped === 0 && st.councilNotes === 1 && st.councilFailed === 0, 'C14 on: counted as convened once, one note');
  const s = createOrchestrator(brainOf(RISKY), { mode: 'shadow' });
  const sr = await s.ask({ text: 'start the auto clicker', place: 'chat' });
  check(sr.reply.content === RISKY.content && sr.orchestration.replyChanged === false && sr.orchestration.judgment?.verdict === 'ASK', 'C15 shadow: the reply is untouched, the verdict is only recorded');
}
{
  const GOOD = { content: ran('That text has 3 words.\n\nWords: 3\nCharacters: 14 (12 without spaces)\nLetters: 12\nLines: 1'), source: 'runner:text-counter', taskId: 'task-1' };
  const o = createOrchestrator(brainOf(GOOD), { mode: 'on' });
  const r = await o.ask({ text: 'count words in "red blue green"', place: 'chat' });
  const st = o.stats() as unknown as Record<string, number>;
  check(r.reply.content === GOOD.content && r.orchestration.judgment?.verdict === 'PROCEED' && st.councilSkipped === 1 && st.councilConvened === 0, 'C16 a simple verified tool answer: council skipped, reply unchanged');
}
{
  const throwing = ((): never => { throw new Error('council exploded'); }) as unknown as typeof judgeProposal;
  const o = createOrchestrator(brainOf(RISKY), { mode: 'on', judge: throwing });
  const r = await o.ask({ text: 'start the auto clicker', place: 'chat' });
  const st = o.stats() as unknown as Record<string, number>;
  check(r.reply.content === RISKY.content && st.councilFailed === 1 && r.orchestration.problems.includes('council failed') && r.orchestration.judgment === null, 'C17 a council that throws never touches the answer; it is counted and recorded');
  const refusing = (() => ({ ok: false, error: 'bad-input', message: 'no' })) as unknown as typeof judgeProposal;
  const o2 = createOrchestrator(brainOf(RISKY), { mode: 'on', judge: refusing });
  const r2 = await o2.ask({ text: 'start the auto clicker', place: 'chat' });
  check(r2.reply.content === RISKY.content && (o2.stats() as unknown as Record<string, number>).councilFailed === 1, 'C18 a council that refuses the situation is also counted and leaves the answer alone');
}
console.log(`council: ${n} checks; ${f} failed`);
