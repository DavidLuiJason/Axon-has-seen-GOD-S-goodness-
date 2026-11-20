// PLAN RUNNER (pure). Runs a validated plan one step at a time through anything that can answer a request in words (the orchestrated brain).
// A step only counts as finished when its answer is VERIFIED: the real state is changed by what was checked, never by a tool saying "done".
import { decideNext } from '../plan/plan.ts';
import type { Goal, JournalLike, Plan } from '../plan/plan.ts';

export type StepAnswer = { readonly verified: boolean; readonly source: string };
export type StepLog = { readonly stepId: string; readonly source: string; readonly verified: boolean };
export type PlanRun =
  | { readonly status: 'DONE'; readonly steps: readonly StepLog[]; readonly state: Readonly<Record<string, string | number | boolean>> }
  | { readonly status: 'ASK'; readonly steps: readonly StepLog[]; readonly question: string; readonly state: Readonly<Record<string, string | number | boolean>> }
  | { readonly status: 'BAD_STEP'; readonly steps: readonly StepLog[]; readonly stepId: string; readonly state: Readonly<Record<string, string | number | boolean>> };

/** Every plan step must carry the request to send in input.text. A step without it stops the run instead of guessing. */
export async function runPlan(goal: Goal, plan: Plan, answerStep: (text: string) => Promise<StepAnswer>): Promise<PlanRun> {
  const state: Record<string, string | number | boolean> = {};
  const journal: JournalLike[] = [];
  const log: StepLog[] = [];
  for (let guard = 0; guard <= goal.maxSteps + 1; guard++) {
    const d = decideNext(goal, plan, state, journal);
    if (d.kind === 'done') return { status: 'DONE', steps: log, state };
    if (d.kind === 'ask') return { status: 'ASK', steps: log, question: d.question, state };
    const planned = plan.steps.find((s) => s.id === d.stepId);
    const text = d.input.text;
    if (!planned || typeof text !== 'string' || text.trim() === '') return { status: 'BAD_STEP', steps: log, stepId: d.stepId, state };
    const answer = await answerStep(text);
    journal.push({ toolId: d.toolId, input: d.input });
    log.push({ stepId: d.stepId, source: answer.source, verified: answer.verified });
    if (answer.verified) state[planned.expectKey] = planned.expectValue;
  }
  return { status: 'ASK', steps: log, question: 'The plan did not finish within its limits. How should I continue?', state };
}
