// J0 SITUATIONS (pure). A situation is a small, typed model: what is here, what each step does, what follows from it, what counts as success and as harm.
// The look-ahead (J1) plays steps forward on this model; it never guesses about the real world beyond what the model says.
export type EngineSuccess<T> = { readonly ok: true; readonly value: T };
export type EngineFailure = { readonly ok: false; readonly error: string; readonly message: string };
export type EngineResult<T> = EngineSuccess<T> | EngineFailure;

export type Cond = { readonly item: string; readonly state: string };
export type Assign = Cond;
export type Basis = 'MODEL' | 'JOURNAL' | 'HYPOTHESIS';
export type Chance = { readonly low: number; readonly high: number; readonly basis: Basis };
export type Rule = { readonly id: string; readonly when: readonly Cond[]; readonly then: readonly Assign[] };
export type Step = {
  readonly id: string;
  readonly label: string;
  readonly needs: readonly Cond[];
  readonly effects: readonly Assign[];
  readonly reversible: boolean;
  readonly cost: number;
  readonly chance: Chance;
};
export type Severity = 'LOW' | 'MEDIUM' | 'HIGH';
export type Harm = { readonly id: string; readonly when: readonly Cond[]; readonly severity: Severity };
export type State = Readonly<Record<string, string>>;
export type Situation = {
  readonly id: string;
  readonly items: State;
  readonly rules: readonly Rule[];
  readonly steps: readonly Step[];
  readonly goal: readonly Cond[];
  readonly harms: readonly Harm[];
  readonly maxDepth: number;
  readonly maxNodes: number;
};

const fail = (error: string, message: string): EngineFailure => ({ ok: false, error, message });
const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const nonEmpty = (v: unknown, max = 200): v is string => typeof v === 'string' && v.trim() !== '' && v.length <= max;
const intIn = (v: unknown, lo: number, hi: number): v is number => typeof v === 'number' && Number.isInteger(v) && v >= lo && v <= hi;
const has = (o: object, k: string): boolean => Object.prototype.hasOwnProperty.call(o, k);

function condsProblem(v: unknown, items: State, max: number, allowEmpty: boolean): string | null {
  if (!Array.isArray(v) || v.length > max || (!allowEmpty && v.length === 0)) return 'a list of conditions is missing or too long';
  for (const c of v) {
    if (!isObj(c) || !nonEmpty(c.item) || !nonEmpty(c.state)) return 'a condition needs an item and a state';
    if (!has(items, c.item as string)) return 'unknown-item';
  }
  return null;
}
function uniqueIds(list: readonly unknown[]): boolean {
  const seen = new Set<string>();
  for (const x of list) { const id = (x as { id: string }).id; if (seen.has(id)) return false; seen.add(id); }
  return true;
}

export function validateSituation(raw: unknown): EngineResult<Situation> {
  if (!isObj(raw) || !nonEmpty(raw.id, 100) || !isObj(raw.items)) return fail('bad-input', 'A situation needs an id and items.');
  const itemNames = Object.keys(raw.items);
  if (itemNames.length === 0 || itemNames.length > 50) return fail('bad-input', 'A situation needs 1 to 50 items.');
  for (const k of itemNames) if (!nonEmpty(k) || !nonEmpty((raw.items as Record<string, unknown>)[k])) return fail('bad-input', 'Every item needs a name and a state.');
  const items = raw.items as State;
  if (!Array.isArray(raw.rules) || raw.rules.length > 50 || !Array.isArray(raw.steps) || raw.steps.length < 1 || raw.steps.length > 30 || !Array.isArray(raw.harms) || raw.harms.length > 20) return fail('bad-input', 'Rules, steps and harms are lists of limited size, and there must be at least one step.');
  for (const r of raw.rules) {
    if (!isObj(r) || !nonEmpty(r.id, 100)) return fail('bad-input', 'A rule needs an id.');
    const p = condsProblem(r.when, items, 10, false) ?? condsProblem(r.then, items, 10, false);
    if (p) return fail(p === 'unknown-item' ? p : 'bad-input', p === 'unknown-item' ? 'A rule names an item that does not exist.' : 'A rule is not valid: ' + p + '.');
  }
  for (const s of raw.steps) {
    if (!isObj(s) || !nonEmpty(s.id, 100) || !nonEmpty(s.label, 300) || typeof s.reversible !== 'boolean' || !intIn(s.cost, 0, 1000) || !isObj(s.chance)) return fail('bad-input', 'A step needs an id, a label, reversible, a whole-number cost and a chance.');
    const p = condsProblem(s.needs, items, 10, true) ?? condsProblem(s.effects, items, 10, true);
    if (p) return fail(p === 'unknown-item' ? p : 'bad-input', p === 'unknown-item' ? 'A step names an item that does not exist.' : 'A step is not valid: ' + p + '.');
    const c = s.chance;
    if (!intIn(c.low, 0, 100) || !intIn(c.high, 0, 100) || c.low > c.high || (c.basis !== 'MODEL' && c.basis !== 'JOURNAL' && c.basis !== 'HYPOTHESIS')) return fail('bad-input', 'A chance needs whole percents low <= high and a basis.');
    if (c.basis !== 'HYPOTHESIS' && c.low !== c.high) return fail('bad-input', 'Only a hypothesis may be a range.');
  }
  for (const h of raw.harms) {
    if (!isObj(h) || !nonEmpty(h.id, 100) || (h.severity !== 'LOW' && h.severity !== 'MEDIUM' && h.severity !== 'HIGH')) return fail('bad-input', 'A harm needs an id and a severity.');
    const p = condsProblem(h.when, items, 10, false);
    if (p) return fail(p === 'unknown-item' ? p : 'bad-input', p === 'unknown-item' ? 'A harm names an item that does not exist.' : 'A harm is not valid: ' + p + '.');
  }
  const gp = condsProblem(raw.goal, items, 10, false);
  if (gp) return fail(gp === 'unknown-item' ? gp : 'bad-input', gp === 'unknown-item' ? 'The goal names an item that does not exist.' : 'The goal is not valid: ' + gp + '.');
  if (!uniqueIds(raw.rules) || !uniqueIds(raw.steps) || !uniqueIds(raw.harms)) return fail('duplicate-id', 'Two rules, two steps or two harms share an id.');
  if (!intIn(raw.maxDepth, 1, 8) || !intIn(raw.maxNodes, 1, 20000)) return fail('bad-input', 'maxDepth must be 1 to 8 and maxNodes 1 to 20000.');
  return { ok: true, value: { id: raw.id, items: { ...items }, rules: raw.rules as readonly Rule[], steps: raw.steps as readonly Step[], goal: raw.goal as readonly Cond[], harms: raw.harms as readonly Harm[], maxDepth: raw.maxDepth, maxNodes: raw.maxNodes } };
}

export const holds = (state: State, conds: readonly Cond[]): boolean => conds.every((c) => state[c.item] === c.state);
export const unmet = (state: State, conds: readonly Cond[]): Cond[] => conds.filter((c) => state[c.item] !== c.state).map((c) => ({ item: c.item, state: c.state }));

export type Applied = { readonly ok: true; readonly state: State; readonly fired: readonly string[]; readonly changed: boolean } | { readonly ok: false; readonly error: 'unmet' | 'unstable'; readonly unmet: readonly Cond[] };

/** Plays one step: checks its needs, applies its effects, then lets the rules follow on until nothing changes. */
export function applyStep(sit: Situation, state: State, step: Step): Applied {
  const missing = unmet(state, step.needs);
  if (missing.length > 0) return { ok: false, error: 'unmet', unmet: missing };
  const next: Record<string, string> = { ...state };
  for (const e of step.effects) next[e.item] = e.state;
  const fired: string[] = [];
  for (let round = 0; round < 100; round++) {
    let moved = false;
    for (const r of sit.rules) {
      if (!holds(next, r.when) || r.then.every((a) => next[a.item] === a.state)) continue;
      for (const a of r.then) next[a.item] = a.state;
      if (!fired.includes(r.id)) fired.push(r.id);
      moved = true;
    }
    if (!moved) return { ok: true, state: next, fired, changed: Object.keys(next).some((k) => next[k] !== state[k]) };
  }
  return { ok: false, error: 'unstable', unmet: [] };
}
