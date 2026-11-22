// JOB 6 (D926): a plan step held on an ASK waits for the owner's yes or no in chat. yes carries on from the held step (earlier steps never run twice),
// no and cancel end the plan without running the held tool, anything else drops it, and a STOP is never waiting for a yes.
import { createOrchestrator } from '../src/brain/mind/orchestrator/orchestrator';
import { CANCEL_REPLY } from '../src/brain/mind/orchestrator/dialogueQuestions';
import { judgeProposal } from '../src/brain/mind/judgment/judge';
import { formGoal, validatePlan } from '../src/brain/mind/plan/plan';
import type { Goal, Plan } from '../src/brain/mind/plan/plan';
import { listSchemas } from '../src/brain/mind/schema/actionSchemas';

let n = 0; let f = 0;
const check = (ok: boolean, name: string) => { n++; if (!ok) { f++; console.log('FAIL ' + name); } };
const approval = listSchemas().filter((x) => (x.preconditions as readonly string[]).includes('owner-approval')).map((x) => x.tool);
const goalOf = (): Goal => { const g = formGoal({ id: 'g', statement: 'three steps', successKey: 'done', successValue: true, maxSteps: 6, constraints: [] }); if (!g.ok) throw new Error('goal'); return g.value; };
const planOf = (g: Goal, tools: readonly [string, string, string]): Plan => { const p = validatePlan(g, { goalId: 'g', steps: [
  { id: 's1', toolId: tools[0], input: { text: 'count words in "red"' }, needs: [], expectKey: 'a', expectValue: true },
  { id: 's2', toolId: tools[1], input: { text: 'step two' }, needs: ['s1'], expectKey: 'b', expectValue: true },
  { id: 's3', toolId: tools[2], input: { text: 'step three' }, needs: ['s2'], expectKey: 'done', expectValue: true }] }); if (!p.ok) throw new Error('plan'); return p.value; };
const ran = (b: string) => b + '\n\nRan as task task-1: COMPLETED in 0 ms, from your exact input.';
const brainOf = (seen: string[]) => ({ async askWithTrace(req: { text: string }) { seen.push(req.text); return { reply: { content: ran('That text has 1 words.\n\nWords: 1\nCharacters: 3 (3 without spaces)\nLetters: 3\nLines: 1'), source: 'runner:text-counter', taskId: 'task-1' }, trace: { utterance: { id: 'u', text: req.text, place: 'chat', at: 0 }, entries: [] } }; } });
const stat = (o: { stats(): unknown }) => o.stats() as unknown as Record<string, number>;
const count = (seen: string[], text: string) => seen.filter((t) => t === text).length;
const A = approval[0]!; const B = approval[1]!;
check(approval.length >= 2, 'J00 there are two owner-approval tools to test with');

// yes: the plan carries on from the held step
{ const g = goalOf(); const seen: string[] = []; const o = createOrchestrator(brainOf(seen), { mode: 'on' });
  const run = await o.runPlan(g, planOf(g, ['text-counter', A, 'text-counter']));
  check(run.status === 'HELD' && run.verdict === 'ASK' && run.toolId === A && run.stepId === 's2' && run.question.startsWith('Before I run ' + A + ' I need your approval.'), 'J01 the plan is held at step 2 with a plain question naming the tool');
  check(seen.length === 1 && stat(o).planAsked === 1, 'J02 only step 1 reached the brain; the held question is counted');
  const r = await o.ask({ text: 'yes', place: 'chat' });
  check(r.reply.source === 'orchestrator:plan' && r.orchestration.replyChanged === true && r.orchestration.dialogue.action === 'filled', 'J03 yes is answered by the plan, not sent to the brain as a new request');
  check(count(seen, 'count words in "red"') >= 1 && count(seen, 'yes') === 0 && seen.includes('step two'), 'J04 the held step now reached the brain and the word yes did not');
  check(count(seen, 'count words in "red"') === 1, 'J05 step 1 ran exactly once: approving never re-runs an earlier step');
  check(stat(o).planApproved === 1 && !r.reply.content.includes('{'), 'J06 approval counted, reply is plain words');
  const again = await o.ask({ text: 'yes', place: 'chat' });
  check(again.reply.source !== 'orchestrator:plan', 'J07 a second yes does not run anything: nothing is waiting any more'); }

// no, cancel, moving on
{ const g = goalOf(); const seen: string[] = []; const o = createOrchestrator(brainOf(seen), { mode: 'on' });
  await o.runPlan(g, planOf(g, ['text-counter', A, 'text-counter']));
  const r = await o.ask({ text: 'no', place: 'chat' });
  check(r.reply.source === 'orchestrator:plan' && r.reply.content === 'Understood. I did not run ' + A + '. Nothing was changed.' && !seen.includes('step two') && count(seen, 'no') === 0, 'J08 no ends the plan: the held tool is never asked');
  check(stat(o).planDeclined === 1 && (await o.ask({ text: 'yes', place: 'chat' })).reply.source !== 'orchestrator:plan', 'J09 after no, a later yes starts nothing'); }
{ const g = goalOf(); const seen: string[] = []; const o = createOrchestrator(brainOf(seen), { mode: 'on' });
  await o.runPlan(g, planOf(g, ['text-counter', A, 'text-counter']));
  const r = await o.ask({ text: 'cancel', place: 'chat' });
  check(r.reply.content === CANCEL_REPLY && !seen.includes('step two'), 'J10 cancel ends the plan without running the held tool'); }
{ const g = goalOf(); const seen: string[] = []; const o = createOrchestrator(brainOf(seen), { mode: 'on' });
  await o.runPlan(g, planOf(g, ['text-counter', A, 'text-counter']));
  const r = await o.ask({ text: 'count words in "one"', place: 'chat' });
  check(r.reply.source === 'runner:text-counter' && seen.includes('count words in "one"') && stat(o).planDropped === 1, 'J11 an unrelated message is handled normally and drops the held plan');
  await o.ask({ text: 'yes', place: 'chat' });
  check(!seen.includes('step two'), 'J12 a dropped plan is never run by a later yes'); }

// two risky steps: each needs its own yes, and the first yes does not approve the second
{ const g = goalOf(); const seen: string[] = []; const o = createOrchestrator(brainOf(seen), { mode: 'on' });
  await o.runPlan(g, planOf(g, [A, B, 'text-counter']));
  check(seen.length === 0, 'J13 a risky first step runs nothing');
  const r1 = await o.ask({ text: 'yes', place: 'chat' });
  check(seen.includes('count words in "red"') && !seen.includes('step two') && r1.reply.content.startsWith('Before I run ' + B + ' I need your approval.') && stat(o).planAsked === 2, 'J14 the first yes runs step 1 only; the second risky step asks for its own approval');
  await o.ask({ text: 'yes', place: 'chat' });
  check(seen.includes('step two') && count(seen, 'count words in "red"') === 1, 'J15 the second yes runs step 2 and step 1 is not repeated'); }

// STOP is final; shadow never waits; reset clears
{ const g = goalOf(); const seen: string[] = []; const stopJudge = ((p: Parameters<typeof judgeProposal>[0]) => judgeProposal({ ...p, permission: 'NEVER' })) as typeof judgeProposal;
  const o = createOrchestrator(brainOf(seen), { mode: 'on', judge: stopJudge });
  const run = await o.runPlan(g, planOf(g, ['text-counter', A, 'text-counter']));
  check(run.status === 'HELD' && run.verdict === 'STOP' && stat(o).planAsked === 0, 'J16 a STOP is not a question: nothing waits for a yes');
  await o.ask({ text: 'yes', place: 'chat' });
  check(!seen.includes('step two'), 'J17 a yes never lifts a STOP'); }
{ const g = goalOf(); const seen: string[] = []; const o = createOrchestrator(brainOf(seen), { mode: 'shadow' });
  const run = await o.runPlan(g, planOf(g, ['text-counter', A, 'text-counter']));
  check(run.status === 'HELD' && stat(o).planAsked === 0, 'J18 in shadow the held step is held but nothing waits in chat'); }
{ const g = goalOf(); const seen: string[] = []; const o = createOrchestrator(brainOf(seen), { mode: 'on' });
  await o.runPlan(g, planOf(g, ['text-counter', A, 'text-counter']));
  o.resetDialogue();
  await o.ask({ text: 'yes', place: 'chat' });
  check(!seen.includes('step two') && seen.includes('yes'), 'J19 a new chat clears a held plan: yes goes to the brain as an ordinary message'); }
console.log(`planApproval: ${n} checks; ${f} failed`);
if (f > 0) process.exitCode = 1;
