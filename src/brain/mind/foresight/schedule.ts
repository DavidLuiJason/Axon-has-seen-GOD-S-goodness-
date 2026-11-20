// J3 PACE, MARGIN, CRITICAL PATH AND EFFORT (pure). Numbers from real history only; with no history it says so instead of inventing a pace.
export type Task = { readonly id: string; readonly effort: number; readonly needs: readonly string[] };
export type CriticalPath = { readonly order: readonly string[]; readonly finish: Readonly<Record<string, number>>; readonly length: number; readonly path: readonly string[]; readonly bottleneck: string };
export type Failure = { readonly ok: false; readonly error: string; readonly message: string };
const fail = (error: string, message: string): Failure => ({ ok: false, error, message });
const round2 = (x: number): number => Math.round(x * 100) / 100;

export function criticalPath(tasks: readonly Task[]): { ok: true; value: CriticalPath } | Failure {
  if (!Array.isArray(tasks) || tasks.length === 0 || tasks.length > 200) return fail('bad-input', 'Give 1 to 200 tasks.');
  const byId = new Map<string, Task>();
  for (const t of tasks) {
    if (typeof t !== 'object' || t === null || typeof t.id !== 'string' || t.id === '' || typeof t.effort !== 'number' || !Number.isFinite(t.effort) || t.effort < 0 || !Array.isArray(t.needs) || !t.needs.every((n: unknown) => typeof n === 'string')) return fail('bad-input', 'A task needs an id, a non-negative effort and a list of needs.');
    if (byId.has(t.id)) return fail('duplicate-task', 'Two tasks share the id ' + t.id + '.');
    byId.set(t.id, t);
  }
  for (const t of tasks) for (const n of t.needs) if (!byId.has(n) || n === t.id) return fail('unknown-need', 'Task ' + t.id + ' needs a task that does not exist (or itself).');
  const finish: Record<string, number> = {};
  const via: Record<string, string | null> = {};
  const order: string[] = [];
  const state = new Map<string, 1 | 2>();
  const visit = (id: string): boolean => {
    const s = state.get(id);
    if (s === 2) return false;
    if (s === 1) return true;
    state.set(id, 1);
    const t = byId.get(id) as Task;
    let best = 0;
    let from: string | null = null;
    for (const n of t.needs) {
      if (visit(n)) return true;
      if (from === null || finish[n] > best) { best = finish[n]; from = n; }
    }
    finish[id] = (t.needs.length > 0 ? best : 0) + t.effort;
    via[id] = from;
    order.push(id);
    state.set(id, 2);
    return false;
  };
  for (const t of tasks) if (visit(t.id)) return fail('cycle', 'The tasks need each other in a circle.');
  let last = tasks[0].id;
  for (const t of tasks) if (finish[t.id] > finish[last]) last = t.id;
  const path: string[] = [];
  for (let cur: string | null = last; cur !== null; cur = via[cur]) path.unshift(cur);
  let bottleneck = path[0];
  for (const id of path) if ((byId.get(id) as Task).effort > (byId.get(bottleneck) as Task).effort) bottleneck = id;
  return { ok: true, value: { order, finish, length: finish[last], path, bottleneck } };
}

export type Pace = { readonly ratePerDay: number; readonly daysNeeded: number; readonly late: boolean; readonly daysLate: number; readonly spread: number; readonly marginDays: number; readonly aimDays: number; readonly requiredRatePerDay: number | null };
/** history: how much got done in how many days, each entry a real stretch of work. remaining: how much is left. daysLeft: days to the deadline. */
export function pace(history: readonly { done: number; days: number }[], remaining: number, daysLeft: number): { ok: true; value: Pace } | Failure {
  if (!Array.isArray(history) || history.length === 0 || history.length > 500) return fail('no-history', 'A pace needs real history of work done.');
  let done = 0;
  let days = 0;
  const rates: number[] = [];
  for (const h of history) {
    if (typeof h !== 'object' || h === null || typeof h.done !== 'number' || typeof h.days !== 'number' || !Number.isFinite(h.done) || !Number.isFinite(h.days) || h.done < 0 || h.days <= 0) return fail('bad-input', 'Each history entry needs done >= 0 and days > 0.');
    done += h.done; days += h.days; rates.push(h.done / h.days);
  }
  if (typeof remaining !== 'number' || !Number.isFinite(remaining) || remaining < 0 || typeof daysLeft !== 'number' || !Number.isFinite(daysLeft) || daysLeft < 0) return fail('bad-input', 'remaining and daysLeft must be non-negative numbers.');
  if (done === 0) return fail('no-progress', 'Nothing was ever done, so no pace can be worked out.');
  const rate = done / days;
  const daysNeeded = remaining / rate;
  const mean = rates.reduce((a, b) => a + b, 0) / rates.length;
  const variance = rates.reduce((a, b) => a + (b - mean) * (b - mean), 0) / rates.length;
  const spread = mean === 0 ? 0 : Math.sqrt(variance) / mean;
  const marginDays = Math.ceil(daysNeeded * spread);
  const aimDays = daysLeft - marginDays;
  const late = daysNeeded > daysLeft;
  return { ok: true, value: { ratePerDay: round2(rate), daysNeeded: round2(daysNeeded), late, daysLate: late ? Math.ceil(daysNeeded - daysLeft) : 0, spread: round2(spread), marginDays, aimDays, requiredRatePerDay: aimDays > 0 ? round2(remaining / aimDays) : null } };
}

export function effortRange(samples: readonly number[]): { ok: true; value: { min: number; median: number; max: number } } | Failure {
  if (!Array.isArray(samples) || samples.length === 0 || samples.length > 1000 || !samples.every((s) => typeof s === 'number' && Number.isFinite(s) && s >= 0)) return fail('bad-input', 'Give 1 to 1000 non-negative effort samples.');
  const sorted = [...samples].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return { ok: true, value: { min: sorted[0], median: sorted.length % 2 === 1 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2, max: sorted[sorted.length - 1] } };
}

/** The effort at which more effort stops paying: the last point before the gain per unit of effort drops below minGain. */
export function goodEnough(points: readonly { effort: number; quality: number }[], minGain: number): { ok: true; value: { stopAt: number; reachedEnd: boolean } } | Failure {
  if (!Array.isArray(points) || points.length < 2 || points.length > 200 || typeof minGain !== 'number' || !Number.isFinite(minGain) || minGain < 0) return fail('bad-input', 'Give 2 to 200 points and a non-negative minGain.');
  for (let i = 0; i < points.length; i++) {
    const p = points[i];
    if (typeof p !== 'object' || p === null || typeof p.effort !== 'number' || typeof p.quality !== 'number' || !Number.isFinite(p.effort) || !Number.isFinite(p.quality)) return fail('bad-input', 'Every point needs a number effort and quality.');
    if (i > 0 && !(p.effort > points[i - 1].effort)) return fail('bad-input', 'Efforts must rise strictly.');
  }
  for (let i = 1; i < points.length; i++) {
    const gain = (points[i].quality - points[i - 1].quality) / (points[i].effort - points[i - 1].effort);
    if (gain < minGain) return { ok: true, value: { stopAt: points[i - 1].effort, reachedEnd: false } };
  }
  return { ok: true, value: { stopAt: points[points.length - 1].effort, reachedEnd: true } };
}
