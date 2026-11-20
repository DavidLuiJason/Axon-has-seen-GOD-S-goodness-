// J1 LOOK-AHEAD (pure). Plays chains of steps forward on a situation within a step depth and a node budget, and ranks what it finds.
// Ranking: reaches the goal without harm, then fewer irreversible steps, then lower cost, then fewer steps, then step ids (so the order is always the same).
import { applyStep, holds } from './situation.ts';
import type { Situation, State } from './situation.ts';

export type WorstHarm = 'NONE' | 'LOW' | 'MEDIUM' | 'HIGH';
export type Chain = {
  readonly steps: readonly string[];
  readonly outcome: 'GOAL' | 'HARM' | 'DEAD_END' | 'LIMIT';
  readonly harms: readonly string[];
  readonly worstHarm: WorstHarm;
  readonly irreversible: number;
  readonly cost: number;
  readonly finalState: State;
};
export type Search = { readonly chains: readonly Chain[]; readonly best: Chain | null; readonly nodes: number; readonly complete: boolean };

const outcomeRank: Record<Chain['outcome'], number> = { GOAL: 0, LIMIT: 1, DEAD_END: 2, HARM: 3 };
const harmRank: Record<WorstHarm, number> = { NONE: 0, LOW: 1, MEDIUM: 2, HIGH: 3 };
const stateKey = (s: State): string => Object.keys(s).sort().map((k) => k + '=' + s[k]).join(';');

export function compareChains(a: Chain, b: Chain): number {
  if (outcomeRank[a.outcome] !== outcomeRank[b.outcome]) return outcomeRank[a.outcome] - outcomeRank[b.outcome];
  if (harmRank[a.worstHarm] !== harmRank[b.worstHarm]) return harmRank[a.worstHarm] - harmRank[b.worstHarm];
  if (a.irreversible !== b.irreversible) return a.irreversible - b.irreversible;
  if (a.cost !== b.cost) return a.cost - b.cost;
  if (a.steps.length !== b.steps.length) return a.steps.length - b.steps.length;
  const ka = a.steps.join('>');
  const kb = b.steps.join('>');
  return ka < kb ? -1 : ka > kb ? 1 : 0;
}

export function lookAhead(sit: Situation): Search {
  const chains: Chain[] = [];
  let nodes = 0;
  let complete = true;
  const harmsIn = (state: State): { ids: string[]; worst: WorstHarm } => {
    const ids: string[] = [];
    let worst: WorstHarm = 'NONE';
    for (const h of sit.harms) if (holds(state, h.when)) { ids.push(h.id); if (harmRank[h.severity] > harmRank[worst]) worst = h.severity; }
    return { ids, worst };
  };
  // Returns how many chains were recorded below this point, so a position with no way forward can be recorded as a dead end.
  function walk(state: State, path: readonly string[], irreversible: number, cost: number, seen: ReadonlySet<string>): number {
    let produced = 0;
    for (const step of sit.steps) {
      if (!complete) return produced;
      if (path.length > 0 && path[path.length - 1] === step.id) continue;
      const r = applyStep(sit, state, step);
      if (!r.ok || !r.changed) continue;
      nodes++;
      if (nodes > sit.maxNodes) { complete = false; return produced; }
      const nextPath = [...path, step.id];
      const nextIrr = irreversible + (step.reversible ? 0 : 1);
      const nextCost = cost + step.cost;
      const harm = harmsIn(r.state);
      const make = (outcome: Chain['outcome']): void => { chains.push({ steps: nextPath, outcome, harms: harm.ids, worstHarm: harm.worst, irreversible: nextIrr, cost: nextCost, finalState: r.state }); produced++; };
      if (harm.ids.length > 0) { make('HARM'); continue; }
      if (holds(r.state, sit.goal)) { make('GOAL'); continue; }
      if (nextPath.length >= sit.maxDepth) { make('LIMIT'); continue; }
      const key = stateKey(r.state);
      if (seen.has(key)) continue;
      const below = walk(r.state, nextPath, nextIrr, nextCost, new Set([...seen, key]));
      produced += below;
      if (below === 0 && complete) { make('DEAD_END'); }
    }
    return produced;
  }
  walk(sit.items, [], 0, 0, new Set([stateKey(sit.items)]));
  const ranked = [...chains].sort(compareChains);
  return { chains: ranked, best: ranked.length > 0 && ranked[0].outcome === 'GOAL' ? ranked[0] : null, nodes, complete };
}
