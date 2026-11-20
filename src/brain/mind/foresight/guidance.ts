// J4 GUIDANCE (pure). Turns a judged situation into a plain record the response part can put into words: the options with what each leads to,
// whether the owner's own plan is the best, one push-back when there is a real problem, and the one question that would let judgment go on.
// It never writes sentences; wording belongs to the response composer.
import type { Cond } from './situation.ts';
import type { SituationJudgment } from './verdict.ts';
import type { Chain } from './lookahead.ts';

export type Option = { readonly steps: readonly string[]; readonly leadsTo: 'GOAL' | 'HARM' | 'NOTHING'; readonly irreversible: number; readonly cost: number; readonly isOwnerPlan: boolean };
export type Pushback = { readonly code: 'harm' | 'goal-not-reached' | 'unmet' | 'better-way' | 'no-safe-path'; readonly detail: readonly string[] };
export type GuidanceRecord = {
  readonly verdict: SituationJudgment['verdict'];
  readonly ownerPlanIsBest: boolean;
  readonly options: readonly Option[];
  readonly pushback: Pushback | null;
  readonly question: { readonly about: 'condition' | 'budget'; readonly item: string | null; readonly state: string | null } | null;
};

const lead = (c: { outcome: string }): Option['leadsTo'] => (c.outcome === 'GOAL' ? 'GOAL' : c.outcome === 'HARM' ? 'HARM' : 'NOTHING');

export function guide(judgment: SituationJudgment, alternatives: readonly Chain[], ownerPlan: readonly string[] | null): GuidanceRecord {
  const options: Option[] = [];
  const key = (steps: readonly string[]): string => steps.join('>');
  const ownerKey = ownerPlan ? key(ownerPlan) : null;
  if (judgment.chain && ownerPlan) options.push({ steps: judgment.chain.steps, leadsTo: lead(judgment.chain), irreversible: judgment.chain.irreversible, cost: judgment.chain.cost, isOwnerPlan: true });
  const seen = new Set(options.map((o) => key(o.steps)));
  const pool: Chain[] = judgment.better ? [judgment.better, ...alternatives] : [...alternatives];
  for (const c of pool) {
    if (options.length >= 3) break;
    if (seen.has(key(c.steps)) || (ownerKey !== null && key(c.steps) === ownerKey)) continue;
    seen.add(key(c.steps));
    options.push({ steps: c.steps, leadsTo: lead(c), irreversible: c.irreversible, cost: c.cost, isOwnerPlan: false });
  }
  if (!ownerPlan && judgment.chain && options.length === 0) options.push({ steps: judgment.chain.steps, leadsTo: lead(judgment.chain), irreversible: judgment.chain.irreversible, cost: judgment.chain.cost, isOwnerPlan: false });
  let pushback: Pushback | null = null;
  let question: GuidanceRecord['question'] = null;
  for (const r of judgment.reasons) {
    if (r.code === 'harm') pushback = { code: 'harm', detail: r.harmIds };
    else if (r.code === 'goal-not-reached') pushback = { code: 'goal-not-reached', detail: [] };
    else if (r.code === 'better-way') pushback = { code: 'better-way', detail: r.steps };
    else if (r.code === 'no-safe-path') pushback = { code: 'no-safe-path', detail: [] };
    else if (r.code === 'unmet') {
      pushback = { code: 'unmet', detail: r.conditions.map((c: Cond) => c.item + '=' + c.state) };
      question = { about: 'condition', item: r.conditions[0].item, state: r.conditions[0].state };
    } else question = { about: 'budget', item: null, state: null };
  }
  return { verdict: judgment.verdict, ownerPlanIsBest: ownerPlan !== null && (judgment.verdict === 'WORKS'), options, pushback, question };
}
