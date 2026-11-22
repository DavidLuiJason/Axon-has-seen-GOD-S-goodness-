/**
 * JOB 7 (D111): THE GATE BEFORE A PLANNED STEP RUNS.
 * Judgment used to speak only after a tool had run. A plan is the one place where the brain knows the tool BEFORE running it, so each
 * step is judged first: the situation is built from the tool's declared schema (situation.ts), the council sits only when needed
 * (councilGate.ts), and an ASK or STOP verdict holds the step so the tool never runs. The owner can approve an ASK for named tools
 * (never a STOP). The evidence label is OBSERVED: what is judged here is the tool's DECLARED schema (read from the registry), and no claim about any result is made (a result is only verified after the run, by the recheck). UNKNOWN would wrongly make every write ask forever.
 * Pure apart from the injected judge. No phrases, no regular expressions.
 */
import type { Judgment } from '../judgment/judge.ts';
import type { Proposal } from '../judgment/council.ts';
import { buildSituation } from './situation.ts';
import { NOT_CONVENED, needsCouncil } from './councilGate.ts';

export type StepGate = (stepId: string, toolId: string) => GateDecision;
export type GateDecision =
  | { readonly allow: true; readonly caution: string | null }
  | { readonly allow: false; readonly verdict: 'ASK' | 'STOP'; readonly message: string };
export type JudgeFn = (p: Proposal) => { readonly ok: true; readonly value: Judgment } | { readonly ok: false; readonly error: string; readonly message?: string };

function concerns(j: Judgment): string {
  const out: string[] = [];
  for (const f of j.flags) if (f.severity !== 'LOW' && !out.includes(f.concern)) out.push(f.concern);
  return out.slice(0, 3).join(' ');
}

/** Builds the gate. A council that fails or refuses HOLDS the step (asking is safe; running unjudged is not), except for a plain read, which never needs the council. */
export function makeStepGate(judge: JudgeFn, options: { readonly approvedTools?: readonly string[]; readonly onHeld?: () => void; readonly onFailed?: () => void } = {}): StepGate {
  const approved = new Set(options.approvedTools ?? []);
  return (stepId, toolId) => {
    const sit = buildSituation({ id: 'plan-' + stepId, toolId, repairVerdict: 'KEEP', evidence: 'OBSERVED', missingInputs: [] });
    if (!needsCouncil(sit.proposal)) return { allow: true, caution: null };
    let verdict: Judgment = NOT_CONVENED;
    try {
      const r = judge(sit.proposal);
      if (!r.ok) { options.onFailed?.(); options.onHeld?.(); return { allow: false, verdict: 'ASK', message: 'I could not check ' + toolId + ' before running it, so I have not run it. Shall I go ahead?' }; }
      verdict = r.value;
    } catch {
      options.onFailed?.(); options.onHeld?.();
      return { allow: false, verdict: 'ASK', message: 'I could not check ' + toolId + ' before running it, so I have not run it. Shall I go ahead?' };
    }
    if (verdict.verdict === 'PROCEED') return { allow: true, caution: null };
    if (verdict.verdict === 'PROCEED_WITH_WARNING') return { allow: true, caution: 'A caution about ' + toolId + ': ' + concerns(verdict) };
    if (verdict.verdict === 'ASK' && approved.has(toolId)) return { allow: true, caution: null };
    options.onHeld?.();
    if (verdict.verdict === 'STOP') return { allow: false, verdict: 'STOP', message: 'I will not run ' + toolId + '. ' + concerns(verdict) };
    return { allow: false, verdict: 'ASK', message: 'Before I run ' + toolId + ' I need your approval. ' + concerns(verdict) };
  };
}
