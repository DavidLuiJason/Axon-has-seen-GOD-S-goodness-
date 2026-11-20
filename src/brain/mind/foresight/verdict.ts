// J2 VERDICTS WITH CHANCES (pure). Judges a proposed chain of steps (or finds the best one) on a situation.
// Verdicts: WORKS, WORKS_BUT_DIFFERENTLY (a clearly better way exists), WORKS_ONLY_IF (something must hold first), WILL_NOT_WORK, CANNOT_JUDGE.
// A chance is the product of the steps' chances; its basis is the weakest basis among them, and only a hypothesis may be a range.
import { applyStep, holds, unmet } from './situation.ts';
import type { Basis, Cond, EngineResult, Situation, State } from './situation.ts';
import { compareChains, lookAhead } from './lookahead.ts';
import type { Chain, WorstHarm } from './lookahead.ts';

export type Verdict = 'WORKS' | 'WORKS_BUT_DIFFERENTLY' | 'WORKS_ONLY_IF' | 'WILL_NOT_WORK' | 'CANNOT_JUDGE';
export type ChanceResult = { readonly low: number; readonly high: number; readonly basis: Basis };
export type Reason =
  | { readonly code: 'harm'; readonly harmIds: readonly string[] }
  | { readonly code: 'goal-not-reached' }
  | { readonly code: 'unmet'; readonly stepId: string; readonly conditions: readonly Cond[] }
  | { readonly code: 'better-way'; readonly steps: readonly string[] }
  | { readonly code: 'no-safe-path' }
  | { readonly code: 'budget'; readonly nodes: number };
export type JudgedChain = { readonly steps: readonly string[]; readonly outcome: Chain['outcome'] | 'STOPPED'; readonly harms: readonly string[]; readonly worstHarm: WorstHarm; readonly irreversible: number; readonly cost: number };
export type SituationJudgment = {
  readonly verdict: Verdict;
  readonly chain: JudgedChain | null;
  readonly chance: ChanceResult | null;
  readonly better: Chain | null;
  readonly reasons: readonly Reason[];
  readonly searchComplete: boolean;
  readonly nodes: number;
};

const basisRank: Record<Basis, number> = { MODEL: 2, JOURNAL: 1, HYPOTHESIS: 0 };
const round1 = (x: number): number => Math.round(x * 10) / 10;

export function chainChance(sit: Situation, steps: readonly string[]): ChanceResult {
  let low = 100;
  let high = 100;
  let basis: Basis = 'MODEL';
  for (const id of steps) {
    const step = sit.steps.find((s) => s.id === id);
    if (!step) continue;
    low = (low * step.chance.low) / 100;
    high = (high * step.chance.high) / 100;
    if (basisRank[step.chance.basis] < basisRank[basis]) basis = step.chance.basis;
  }
  return { low: round1(low), high: round1(high), basis };
}

const asJudged = (c: Chain): JudgedChain => ({ steps: c.steps, outcome: c.outcome, harms: c.harms, worstHarm: c.worstHarm, irreversible: c.irreversible, cost: c.cost });

export function judgeSituation(sit: Situation, proposed?: readonly string[]): EngineResult<SituationJudgment> {
  const search = lookAhead(sit);
  const base = { searchComplete: search.complete, nodes: search.nodes };
  if (proposed === undefined) {
    if (search.best) return { ok: true, value: { verdict: 'WORKS', chain: asJudged(search.best), chance: chainChance(sit, search.best.steps), better: null, reasons: [], ...base } };
    if (!search.complete) return { ok: true, value: { verdict: 'CANNOT_JUDGE', chain: null, chance: null, better: null, reasons: [{ code: 'budget', nodes: search.nodes }], ...base } };
    return { ok: true, value: { verdict: 'WILL_NOT_WORK', chain: null, chance: null, better: null, reasons: [{ code: 'no-safe-path' }], ...base } };
  }
  if (!Array.isArray(proposed) || proposed.length === 0 || proposed.length > 8 || !proposed.every((p) => typeof p === 'string')) return { ok: false, error: 'bad-input', message: 'A proposed chain is a list of 1 to 8 step ids.' };
  let state: State = sit.items;
  let irreversible = 0;
  let cost = 0;
  const done: string[] = [];
  for (const id of proposed) {
    const step = sit.steps.find((s) => s.id === id);
    if (!step) return { ok: false, error: 'unknown-step', message: 'The step ' + id + ' is not part of this situation.' };
    const r = applyStep(sit, state, step);
    if (!r.ok) {
      if (r.error === 'unmet') {
        const stopped: JudgedChain = { steps: done, outcome: 'STOPPED', harms: [], worstHarm: 'NONE', irreversible, cost };
        return { ok: true, value: { verdict: 'WORKS_ONLY_IF', chain: stopped, chance: chainChance(sit, done), better: search.best, reasons: [{ code: 'unmet', stepId: id, conditions: r.unmet }], ...base } };
      }
      return { ok: false, error: 'unstable', message: 'The rules of this situation never settle.' };
    }
    state = r.state;
    done.push(id);
    irreversible += step.reversible ? 0 : 1;
    cost += step.cost;
    const harmed = sit.harms.filter((h) => holds(state, h.when));
    if (harmed.length > 0) {
      let worst: WorstHarm = 'NONE';
      for (const h of harmed) if (h.severity === 'HIGH' || (h.severity === 'MEDIUM' && worst !== 'HIGH') || (h.severity === 'LOW' && worst === 'NONE')) worst = h.severity;
      const judged: JudgedChain = { steps: [...done], outcome: 'HARM', harms: harmed.map((h) => h.id), worstHarm: worst, irreversible, cost };
      return { ok: true, value: { verdict: 'WILL_NOT_WORK', chain: judged, chance: chainChance(sit, done), better: search.best, reasons: [{ code: 'harm', harmIds: harmed.map((h) => h.id) }], ...base } };
    }
  }
  const finished: Chain = { steps: done, outcome: holds(state, sit.goal) ? 'GOAL' : 'DEAD_END', harms: [], worstHarm: 'NONE', irreversible, cost, finalState: state };
  const chance = chainChance(sit, done);
  if (finished.outcome !== 'GOAL') return { ok: true, value: { verdict: 'WILL_NOT_WORK', chain: asJudged(finished), chance, better: search.best, reasons: [{ code: 'goal-not-reached' }], ...base } };
  if (search.best && compareChains(search.best, finished) < 0 && search.best.steps.join('>') !== finished.steps.join('>')) {
    return { ok: true, value: { verdict: 'WORKS_BUT_DIFFERENTLY', chain: asJudged(finished), chance, better: search.best, reasons: [{ code: 'better-way', steps: search.best.steps }], ...base } };
  }
  return { ok: true, value: { verdict: 'WORKS', chain: asJudged(finished), chance, better: null, reasons: [], ...base } };
}

export { unmet };
