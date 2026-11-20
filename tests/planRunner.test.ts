import { runPlan } from '../src/brain/mind/orchestrator/planRunner.ts';
import { formGoal, validatePlan } from '../src/brain/mind/plan/plan.ts';
import type { Goal, Plan } from '../src/brain/mind/plan/plan.ts';
import { deepStrictEqual } from 'node:assert';

let n = 0;
let f = 0;
const check = (ok: boolean, name: string) => { n++; if (!ok) { f++; console.log('FAIL ' + name); } };
const same = (a: unknown, b: unknown) => { try { deepStrictEqual(a, b); return true; } catch { return false; } };
const goalOf = (maxSteps: number): Goal => { const g = formGoal({ id: 'g', statement: 'Count then sort', successKey: 'sorted', successValue: true, maxSteps, constraints: [] }); if (!g.ok) throw new Error('goal'); return g.value; };
const planFor = (goal: Goal, t1 = 'count words in "a b"', t2 = 'sort lines "b\na"'): Plan => { const p = validatePlan(goal, { goalId: 'g', steps: [{ id: 's1', toolId: 'text-counter', input: { text: t1 }, needs: [], expectKey: 'counted', expectValue: true }, { id: 's2', toolId: 'sort-lines', input: { text: t2 }, needs: ['s1'], expectKey: 'sorted', expectValue: true }] }); if (!p.ok) throw new Error('plan ' + p.error); return p.value; };
const answers = (script: boolean[]) => { const sent: string[] = []; let i = 0; return { sent, fn: async (text: string) => { sent.push(text); const v = script[Math.min(i, script.length - 1)]; i++; return { verified: v, source: 'runner:x' }; } }; };

(async () => {
  { const g = goalOf(5); const a = answers([true]); const r = await runPlan(g, planFor(g), a.fn);
    check(r.status === 'DONE' && same(a.sent, ['count words in "a b"', 'sort lines "b\na"']) && same(r.state, { counted: true, sorted: true }) && r.steps.length === 2 && r.steps.every((s) => s.verified), 'P01_two_verified_steps_reach_the_goal'); }
  { const g = goalOf(5); const a = answers([false]); const r = await runPlan(g, planFor(g), a.fn);
    check(r.status === 'ASK' && a.sent.length === 2 && r.steps.length === 2 && r.steps.every((s) => !s.verified) && Object.keys(r.state).length === 0 && r.status === 'ASK' && r.question.includes('not repeat it a third time'), 'P02_unverified_twice_asks_instead_of_a_third_try'); }
  { const g = goalOf(5); const a = answers([false, true, true]); const r = await runPlan(g, planFor(g), a.fn);
    check(r.status === 'DONE' && r.steps.length === 3 && same(r.steps.map((s) => s.verified), [false, true, true]) && a.sent[0] === a.sent[1], 'P03_a_retry_that_verifies_continues'); }
  { const g = goalOf(5); const a = answers([true]); const r = await runPlan(g, planFor(g, '', 'x'), a.fn);
    check(r.status === 'BAD_STEP' && r.stepId === 's1' && a.sent.length === 0, 'P04_empty_text_stops_without_asking_anyone'); }
  { const g = goalOf(5); const a = answers([true]); const p = planFor(g); const bad: Plan = { goalId: 'g', steps: [{ ...p.steps[0], input: { count: 3 } }, p.steps[1]] };
    const r = await runPlan(g, bad, a.fn);
    check(r.status === 'BAD_STEP' && a.sent.length === 0, 'P05_a_step_without_text_stops'); }
  { const g = goalOf(1); const a = answers([true]); const r = await runPlan(g, planFor(goalOf(5)), a.fn);
    check(r.status === 'ASK' && r.steps.length === 1 && r.question.startsWith('The step budget of 1'), 'P06_budget_asks'); }
  { const g = goalOf(5); let threw = false; try { await runPlan(g, planFor(g), async () => { throw new Error('boom'); }); } catch { threw = true; }
    check(threw, 'P07_errors_are_not_hidden'); }
  { const g = goalOf(5); const a = answers([true]); const r = await runPlan(g, planFor(g, '   '), a.fn);
    check(r.status === 'BAD_STEP' && a.sent.length === 0, 'P08_blank_text_stops'); }
  { const g = goalOf(6); const seq = [true, false, false]; let i = 0; const sent: string[] = [];
    const r = await runPlan(g, planFor(g), async (t) => { sent.push(t); return { verified: seq[i++] ?? false, source: 'runner:x' }; });
    check(r.status === 'ASK' && sent.length === 3 && same(r.state, { counted: true }) && sent[1] === sent[2], 'P09_second_step_failing_twice_asks_and_keeps_what_was_verified'); }
  { const g = goalOf(5); const a = answers([true]); const r = await runPlan(g, { goalId: 'g', steps: [] } as unknown as Plan, a.fn);
    check(r.status === 'ASK' && a.sent.length === 0, 'P10_an_empty_plan_asks'); }
  console.log(`planRunner: ${n} checks; ${f} failed`);
  if (f !== 0) process.exitCode = 1;
})();
