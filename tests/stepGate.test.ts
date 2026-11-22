// JOB 7 (D111): every planned step is judged BEFORE it runs. A held step never reaches the tool.
import { runPlan } from '../src/brain/mind/orchestrator/planRunner';
import { makeStepGate } from '../src/brain/mind/orchestrator/stepGate';
import { createOrchestrator } from '../src/brain/mind/orchestrator/orchestrator';
import { judgeProposal } from '../src/brain/mind/judgment/judge';
import { formGoal, validatePlan } from '../src/brain/mind/plan/plan';
import type { Goal, Plan } from '../src/brain/mind/plan/plan';
import { listSchemas } from '../src/brain/mind/schema/actionSchemas';
import { buildSituation } from '../src/brain/mind/orchestrator/situation';
import { needsCouncil } from '../src/brain/mind/orchestrator/councilGate';
import { LIVE_SWITCHES } from '../src/tools/runners/liveSwitches';

let n = 0; let f = 0;
const check = (ok: boolean, name: string) => { n++; if (!ok) { f++; console.log('FAIL ' + name); } };
const goalOf = (): Goal => { const g = formGoal({ id: 'g', statement: 'two steps', successKey: 'done', successValue: true, maxSteps: 5, constraints: [] }); if (!g.ok) throw new Error('goal'); return g.value; };
const planOf = (g: Goal, tool1: string, tool2: string): Plan => { const p = validatePlan(g, { goalId: 'g', steps: [
  { id: 's1', toolId: tool1, input: { text: 'count words in "red"' }, needs: [], expectKey: 'a', expectValue: true },
  { id: 's2', toolId: tool2, input: { text: 'two' }, needs: ['s1'], expectKey: 'done', expectValue: true }] }); if (!p.ok) throw new Error('plan'); return p.value; };
const answers = () => { const sent: string[] = []; return { sent, fn: async (t: string) => { sent.push(t); return { verified: true, source: 'runner:x' }; } }; };
const gate = (opts = {}) => makeStepGate(judgeProposal, opts);

// A: pure gate over the real schemas
const schemas = listSchemas();
const sit = (tool: string) => buildSituation({ id: 't', toolId: tool, repairVerdict: 'KEEP', evidence: 'OBSERVED', missingInputs: [] }).proposal;
const approval = schemas.filter((x) => (x.preconditions as readonly string[]).includes('owner-approval')).map((x) => x.tool);
check(approval.length >= 3, 'G01 there are owner-approval tools to test with: ' + approval.join(','));
check(approval.every((t) => !gate()('s', t).allow), 'G02 every owner-approval tool is held before it runs');
const on = Object.entries(LIVE_SWITCHES).filter(([, v]) => v === 'runner').map(([k]) => k);
check(on.every((t) => gate()('s', t).allow), 'G03 every tool switched ON today passes the gate: ' + on.filter((t) => !gate()('s', t).allow).join(','));
check(schemas.filter((x) => !needsCouncil(sit(x.tool))).every((x) => gate()('s', x.tool).allow), 'G04 a plain read never convenes the council and always passes');
const held = gate()('s', approval[0]!);
check(!held.allow && held.verdict === 'ASK' && held.message.startsWith('Before I run ' + approval[0] + ' I need your approval.') && !held.message.includes('{'), 'G05 the question is plain words: ' + (held.allow ? '' : held.message.slice(0, 80)));
check(gate({ approvedTools: [approval[0]!] })('s', approval[0]!).allow === true, 'G06 the owner approving a tool lets an ASK through');
check(gate()('s', 'tool-with-no-schema').allow === true, 'G07 an unknown tool is a plain run (as situation.ts says) and passes');

const stopJudge = ((p: Parameters<typeof judgeProposal>[0]) => { const r = judgeProposal({ ...p, permission: 'NEVER' }); return r; }) as typeof judgeProposal;
{ const g = makeStepGate(stopJudge, { approvedTools: [approval[0]!] })('s', approval[0]!);
  check(!g.allow && g.verdict === 'STOP' && g.message.startsWith('I will not run ' + approval[0]), 'G08 a STOP is never lifted by owner approval and is worded as a refusal'); }

// B: the plan runner
{ const g = goalOf(); const a = answers(); const r = await runPlan(g, planOf(g, 'text-counter', 'sort-lines'), a.fn, gate());
  check(r.status === 'DONE' && a.sent.length === 2, 'P01 a plan of plain tools runs exactly as before'); }
{ const g = goalOf(); const a = answers(); const r = await runPlan(g, planOf(g, 'text-counter', approval[0]!), a.fn, gate());
  check(r.status === 'HELD' && r.stepId === 's2' && r.verdict === 'ASK' && a.sent.length === 1 && a.sent[0] === 'count words in "red"' && r.steps.length === 1 && r.state.a === true, 'P02 step 1 runs, the risky step 2 is held BEFORE the tool is asked (1 request sent, not 2)'); }
{ const g = goalOf(); const a = answers(); const r = await runPlan(g, planOf(g, approval[0]!, 'sort-lines'), a.fn, gate());
  check(r.status === 'HELD' && a.sent.length === 0 && r.steps.length === 0, 'P03 a risky first step runs nothing at all'); }
{ const g = goalOf(); const a = answers(); const r = await runPlan(g, planOf(g, 'text-counter', approval[0]!), a.fn, gate({ approvedTools: [approval[0]!] }));
  check(r.status === 'DONE' && a.sent.length === 2, 'P04 after the owner approves, the same plan finishes'); }
{ const g = goalOf(); const a = answers(); const r = await runPlan(g, planOf(g, 'text-counter', approval[0]!), a.fn);
  check(r.status === 'DONE' && a.sent.length === 2, 'P05 no gate given: behaviour is unchanged (old callers keep working)'); }
// a council that throws or refuses holds a step that needed the council, never runs it
{ const g = goalOf(); let failed = 0; const a = answers();
  const throwing = (() => { throw new Error('boom'); }) as unknown as Parameters<typeof makeStepGate>[0];
  const r = await runPlan(g, planOf(g, 'text-counter', approval[0]!), a.fn, makeStepGate(throwing, { onFailed: () => { failed++; } }));
  check(r.status === 'HELD' && a.sent.length === 1 && failed === 1, 'P06 a council that throws holds the step (not run unjudged) and is counted');
  const refusing = (() => ({ ok: false, error: 'bad' })) as unknown as Parameters<typeof makeStepGate>[0];
  const a2 = answers(); const r2 = await runPlan(g, planOf(g, 'text-counter', approval[0]!), a2.fn, makeStepGate(refusing));
  check(r2.status === 'HELD' && a2.sent.length === 1, 'P07 a council that refuses also holds it');
  const a3 = answers(); const r3 = await runPlan(g, planOf(g, 'text-counter', 'sort-lines'), a3.fn, makeStepGate(throwing));
  check(r3.status === 'DONE', 'P08 a plain read never needs the council, so a broken council cannot stop it'); }

// C: through the orchestrator
const ran = (b: string) => b + '\n\nRan as task task-1: COMPLETED in 0 ms, from your exact input.';
const brainOf = (seen: string[]) => ({ async askWithTrace(req: { text: string }) { seen.push(req.text); return { reply: { content: ran('That text has 1 words.\n\nWords: 1\nCharacters: 3 (3 without spaces)\nLetters: 3\nLines: 1'), source: 'runner:text-counter', taskId: 'task-1' }, trace: { utterance: { id: 'u', text: req.text, place: 'chat', at: 0 }, entries: [] } }; } });
{ const g = goalOf(); const seen: string[] = []; const o = createOrchestrator(brainOf(seen), { mode: 'on' });
  const r = await o.runPlan(g, planOf(g, 'text-counter', approval[0]!));
  const st = o.stats() as unknown as Record<string, number>;
  check(r.status === 'HELD' && seen.length === 1 && st.stepsHeld === 1, 'O01 the orchestrator holds the risky step before asking the brain (brain asked once, stepsHeld 1)');
  const seen2: string[] = []; const o2 = createOrchestrator(brainOf(seen2), { mode: 'on' });
  const r2 = await o2.runPlan(g, planOf(g, 'text-counter', approval[0]!), [approval[0]!]);
  check(r2.status !== 'HELD' && seen2.includes('two'), 'O02 approvedTools lets the risky step reach the brain (its text was sent)'); }
console.log(`stepGate: ${n} checks; ${f} failed`);
if (f > 0) process.exitCode = 1;
