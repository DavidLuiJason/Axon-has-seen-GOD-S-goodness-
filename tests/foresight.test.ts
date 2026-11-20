import { deepStrictEqual } from 'node:assert';
import { validateSituation, applyStep, holds } from '../src/brain/mind/foresight/situation.ts';
import type { Situation, Step, State, Cond, Chance } from '../src/brain/mind/foresight/situation.ts';
import { lookAhead, compareChains } from '../src/brain/mind/foresight/lookahead.ts';
import { judgeSituation, chainChance } from '../src/brain/mind/foresight/verdict.ts';
import { calibrationReport, widenForDrift } from '../src/brain/mind/foresight/calibration.ts';
import { criticalPath, pace, effortRange, goodEnough } from '../src/brain/mind/foresight/schedule.ts';
import { guide } from '../src/brain/mind/foresight/guidance.ts';
import { buildBrief } from '../src/brain/mind/foresight/brief.ts';

let n = 0;
let f = 0;
const check = (ok: boolean, name: string) => { n++; if (!ok) { f++; console.log('FAIL ' + name); } };
const same = (a: unknown, b: unknown) => { try { deepStrictEqual(a, b); return true; } catch { return false; } };
const M = (p: number) => ({ low: p, high: p, basis: 'MODEL' as const });
const step = (id: string, needs: Cond[], effects: Cond[], reversible: boolean, cost: number, chance: Chance = M(100)) => ({ id, label: id, needs, effects, reversible, cost, chance });
const c = (item: string, state: string): Cond => ({ item, state });
const mk = (raw: unknown): Situation => { const r = validateSituation(raw); if (!r.ok) throw new Error('setup ' + r.error); return r.value; };

// ---------- the situations (hand-derived below)
const boulders = {
  id: 'boulders', items: { foot: 'pinned', stone: 'on-foot', medium: 'still', big: 'still', health: 'ok' },
  rules: [{ id: 'r1', when: [c('stone', 'left')], then: [c('foot', 'free')] }, { id: 'r2', when: [c('stone', 'left')], then: [c('medium', 'moving')] }, { id: 'r3', when: [c('medium', 'moving')], then: [c('big', 'moving')] }, { id: 'r4', when: [c('big', 'moving')], then: [c('health', 'crushed')] }, { id: 'r5', when: [c('stone', 'right')], then: [c('foot', 'free')] }],
  steps: [step('push-left', [c('stone', 'on-foot')], [c('stone', 'left')], false, 1), step('push-right', [c('stone', 'on-foot')], [c('stone', 'right')], false, 1)],
  goal: [c('foot', 'free'), c('health', 'ok')], harms: [{ id: 'h1', when: [c('health', 'crushed')], severity: 'HIGH' }], maxDepth: 3, maxNodes: 1000,
};
const backup = {
  id: 'backup', items: { file: 'present', backup: 'missing', space: 'low' },
  rules: [{ id: 'r1', when: [c('file', 'deleted')], then: [c('space', 'ok')] }],
  steps: [step('delete-file', [c('file', 'present')], [c('file', 'deleted')], false, 1), step('make-backup', [c('file', 'present')], [c('backup', 'made')], true, 2, M(90))],
  goal: [c('space', 'ok')], harms: [{ id: 'data-lost', when: [c('file', 'deleted'), c('backup', 'missing')], severity: 'HIGH' }], maxDepth: 3, maxNodes: 1000,
};
const choice = { id: 'choice', items: { job: 'todo' }, rules: [], steps: [step('quick', [c('job', 'todo')], [c('job', 'done')], false, 1), step('careful', [c('job', 'todo')], [c('job', 'done')], true, 3)], goal: [c('job', 'done')], harms: [], maxDepth: 3, maxNodes: 1000 };
const mail = { id: 'mail', items: { draft: 'none', mail: 'unsent' }, rules: [], steps: [step('write-draft', [], [c('draft', 'done')], true, 2), step('send', [c('draft', 'done')], [c('mail', 'sent')], false, 1)], goal: [c('mail', 'sent')], harms: [], maxDepth: 3, maxNodes: 1000 };
const stuck = { id: 'stuck', items: { x: 'a' }, rules: [], steps: [step('s', [c('x', 'a')], [c('x', 'b')], true, 1)], goal: [c('x', 'c')], harms: [], maxDepth: 3, maxNodes: 1000 };

// ---------- J0 validation
{
  check(validateSituation(boulders).ok === true, 'J0-01-valid');
  const bad = (over: Record<string, unknown>, error: string, name: string) => { const r = validateSituation({ ...boulders, ...over }); check(r.ok === false && r.error === error, name); };
  bad({ id: '' }, 'bad-input', 'J0-02-empty-id');
  bad({ items: {} }, 'bad-input', 'J0-03-no-items');
  bad({ steps: [] }, 'bad-input', 'J0-04-no-steps');
  bad({ goal: [] }, 'bad-input', 'J0-05-empty-goal');
  bad({ goal: [c('nope', 'x')] }, 'unknown-item', 'J0-06-goal-unknown-item');
  bad({ rules: [{ id: 'r', when: [c('nope', 'x')], then: [c('foot', 'free')] }] }, 'unknown-item', 'J0-07-rule-unknown-item');
  bad({ harms: [{ id: 'h', when: [c('nope', 'x')], severity: 'HIGH' }] }, 'unknown-item', 'J0-08-harm-unknown-item');
  bad({ steps: [step('a', [c('nope', 'x')], [], true, 1)] }, 'unknown-item', 'J0-09-step-unknown-item');
  bad({ steps: [step('a', [], [], true, 1), step('a', [], [], true, 1)] }, 'duplicate-id', 'J0-10-duplicate-step');
  bad({ steps: [step('a', [], [], true, 1.5)] }, 'bad-input', 'J0-11-fractional-cost');
  bad({ steps: [step('a', [], [], true, 1, { low: 60, high: 40, basis: 'HYPOTHESIS' })] }, 'bad-input', 'J0-12-low-above-high');
  bad({ steps: [step('a', [], [], true, 1, { low: 40, high: 60, basis: 'MODEL' })] }, 'bad-input', 'J0-13-model-range');
  bad({ steps: [step('a', [], [], true, 1, { low: 40, high: 60, basis: 'JOURNAL' })] }, 'bad-input', 'J0-14-journal-range');
  bad({ steps: [step('a', [], [], true, 1, { low: 0, high: 101, basis: 'HYPOTHESIS' })] }, 'bad-input', 'J0-15-over-100');
  bad({ steps: [step('a', [], [], true, 1, { low: 1, high: 2, basis: 'GUESS' as never })] }, 'bad-input', 'J0-16-bad-basis');
  bad({ maxDepth: 0 }, 'bad-input', 'J0-17-depth-0');
  bad({ maxDepth: 9 }, 'bad-input', 'J0-18-depth-9');
  bad({ maxNodes: 20001 }, 'bad-input', 'J0-19-nodes');
  bad({ harms: [{ id: 'h', when: [c('health', 'crushed')], severity: 'EXTREME' }] }, 'bad-input', 'J0-20-bad-severity');
  check(validateSituation(null).ok === false && validateSituation([]).ok === false && validateSituation('x').ok === false, 'J0-21-not-objects');
  check(validateSituation({ ...boulders, steps: [step('a', [], [], true, 1, { low: 40, high: 60, basis: 'HYPOTHESIS' })] }).ok === true, 'J0-22-hypothesis-range-ok');
  check(validateSituation({ ...boulders, items: { foot: '' } }).ok === false, 'J0-23-empty-state');
  check(validateSituation({ ...boulders, rules: Array.from({ length: 51 }, (_, i) => ({ id: 'x' + i, when: [c('foot', 'pinned')], then: [c('foot', 'free')] })) }).ok === false, 'J0-24-too-many-rules');
}
// ---------- applyStep
{
  const sit = mk(boulders);
  const left = sit.steps[0];
  const r = applyStep(sit, sit.items, left);
  check(r.ok && same(r.fired, ['r1', 'r2', 'r3', 'r4']) && r.state.health === 'crushed' && r.state.foot === 'free' && r.changed, 'A-01-push-left-cascades');
  const again = r.ok ? applyStep(sit, r.state, left) : r;
  check(!again.ok && again.error === 'unmet' && same(again.unmet, [c('stone', 'on-foot')]), 'A-02-needs-unmet');
  const right = applyStep(sit, sit.items, sit.steps[1]);
  check(right.ok && same(right.fired, ['r5']) && right.state.health === 'ok' && right.state.foot === 'free', 'A-03-push-right');
  const noop = applyStep(mk({ ...choice, steps: [step('nothing', [], [], true, 0)] }), { job: 'todo' }, step('nothing', [], [], true, 0));
  check(noop.ok && noop.changed === false, 'A-04-no-change-reported');
  const osc = mk({ id: 'osc', items: { a: 'x', b: 'x' }, rules: [{ id: 'p', when: [c('a', 'x')], then: [c('a', 'y')] }, { id: 'q', when: [c('a', 'y')], then: [c('a', 'x')] }], steps: [step('go', [], [c('b', 'y')], true, 1)], goal: [c('b', 'y')], harms: [], maxDepth: 2, maxNodes: 10 });
  const o = applyStep(osc, osc.items, osc.steps[0]);
  check(!o.ok && o.error === 'unstable', 'A-05-rules-that-never-settle');
  check(sit.items.stone === 'on-foot' && left.effects[0].state === 'left', 'A-06-inputs-untouched');
  check(holds({ a: 'x' }, [c('a', 'x')]) && !holds({ a: 'x' }, [c('a', 'y')]) && holds({}, []), 'A-07-holds');
}
// ---------- J1 look-ahead
{
  const s = lookAhead(mk(boulders));
  check(s.complete && s.nodes === 2 && s.chains.length === 2, 'L-01-boulders-two-chains');
  check(s.best !== null && same(s.best.steps, ['push-right']) && s.best.outcome === 'GOAL' && s.best.irreversible === 1 && s.best.cost === 1, 'L-02-boulders-best-is-push-right');
  const h = s.chains[1];
  check(same(h.steps, ['push-left']) && h.outcome === 'HARM' && same(h.harms, ['h1']) && h.worstHarm === 'HIGH', 'L-03-boulders-push-left-harms');
  const b = lookAhead(mk(backup));
  check(b.best !== null && same(b.best.steps, ['make-backup', 'delete-file']) && b.best.irreversible === 1 && b.best.cost === 3 && b.chains.length === 2 && b.chains[1].outcome === 'HARM' && same(b.chains[1].steps, ['delete-file']), 'L-04-backup-first');
  const ch = lookAhead(mk(choice));
  check(ch.best !== null && same(ch.best.steps, ['careful']) && same(ch.chains.map((x) => x.steps.join()), ['careful', 'quick']), 'L-05-fewer-irreversible-beats-cheaper');
  const st = lookAhead(mk(stuck));
  check(st.best === null && st.complete && st.chains.length === 1 && st.chains[0].outcome === 'DEAD_END' && same(st.chains[0].steps, ['s']), 'L-06-dead-end');
  const lim = lookAhead(mk({ ...mail, maxDepth: 1 }));
  check(lim.best === null && lim.chains.length === 1 && lim.chains[0].outcome === 'LIMIT' && same(lim.chains[0].steps, ['write-draft']), 'L-07-depth-limit');
  const cut = lookAhead(mk({ ...mail, maxNodes: 1 }));
  check(cut.complete === false && cut.chains.length === 0 && cut.best === null && cut.nodes === 2, 'L-08-budget-cut');
  check(same(lookAhead(mk(boulders)), s), 'L-09-deterministic');
  // a step that changes nothing is never taken; a repeat of the same step in a row is never taken
  const loopy = lookAhead(mk({ id: 'l', items: { a: 'x' }, rules: [], steps: [step('flip', [], [c('a', 'y')], true, 1), step('flop', [], [c('a', 'x')], true, 1)], goal: [c('a', 'z')], harms: [], maxDepth: 4, maxNodes: 1000 }));
  check(loopy.chains.every((x) => x.steps.every((id, i) => i === 0 || id !== x.steps[i - 1])), 'L-10-no-immediate-repeat');
  check(loopy.chains.length >= 1 && loopy.chains.every((x) => x.outcome === 'DEAD_END' || x.outcome === 'LIMIT'), 'L-11-cycles-end');
  const idle = lookAhead(mk({ ...choice, steps: [...choice.steps, step('idle', [c('job', 'todo')], [c('job', 'todo')], true, 0)] }));
  check(idle.chains.length === 2 && idle.chains.every((x) => !x.steps.includes('idle')), 'L-14-a-step-that-changes-nothing-is-never-taken');
  const loop2 = lookAhead(mk({ id: 'l2', items: { a: 'x' }, rules: [], steps: [step('flip', [], [c('a', 'y')], true, 1), step('flop', [], [c('a', 'x')], true, 1)], goal: [c('a', 'z')], harms: [], maxDepth: 6, maxNodes: 1000 }));
  check(loop2.chains.length === 1 && same(loop2.chains[0].steps, ['flip']) && loop2.chains[0].outcome === 'DEAD_END', 'L-15-a-state-already-seen-on-the-path-is-not-revisited');
  const a = { steps: ['x'], outcome: 'GOAL' as const, harms: [], worstHarm: 'NONE' as const, irreversible: 0, cost: 5, finalState: {} };
  check(compareChains(a, { ...a, steps: ['y'] }) < 0 && compareChains({ ...a, cost: 4 }, a) < 0 && compareChains({ ...a, irreversible: 1, cost: 0 }, a) > 0 && compareChains(a, { ...a, outcome: 'HARM' }) < 0 && compareChains(a, a) === 0, 'L-12-compare');
  check(compareChains({ ...a, steps: ['p', 'q'] }, { ...a, steps: ['z'] }) > 0 && compareChains({ ...a, worstHarm: 'LOW' }, { ...a, worstHarm: 'HIGH' }) < 0, 'L-13-compare-length-harm');
}
// ---------- J2 verdicts
{
  const sB = mk(boulders);
  let j = judgeSituation(sB, ['push-left']);
  check(j.ok && j.value.verdict === 'WILL_NOT_WORK' && same(j.value.reasons, [{ code: 'harm', harmIds: ['h1'] }]) && j.value.chain?.outcome === 'HARM' && same(j.value.better?.steps, ['push-right']) && same(j.value.chance, M(100)), 'V-01-boulders-left-harms');
  j = judgeSituation(sB, ['push-right']);
  check(j.ok && j.value.verdict === 'WORKS' && j.value.better === null && j.value.chain?.outcome === 'GOAL' && j.value.searchComplete, 'V-02-boulders-right-works');
  j = judgeSituation(sB);
  check(j.ok && j.value.verdict === 'WORKS' && same(j.value.chain?.steps, ['push-right']), 'V-03-best-without-a-proposal');
  const sK = mk(backup);
  j = judgeSituation(sK, ['delete-file']);
  check(j.ok && j.value.verdict === 'WILL_NOT_WORK' && same(j.value.reasons, [{ code: 'harm', harmIds: ['data-lost'] }]) && same(j.value.better?.steps, ['make-backup', 'delete-file']), 'V-04-backup-delete-alone-harms');
  j = judgeSituation(sK, ['make-backup', 'delete-file']);
  check(j.ok && j.value.verdict === 'WORKS' && same(j.value.chance, M(90)) && j.value.chain?.irreversible === 1 && j.value.chain.cost === 3, 'V-05-backup-first-works-90');
  j = judgeSituation(sK, ['make-backup']);
  check(j.ok && j.value.verdict === 'WILL_NOT_WORK' && same(j.value.reasons, [{ code: 'goal-not-reached' }]) && j.value.chain?.outcome === 'DEAD_END', 'V-06-goal-not-reached');
  const sC = mk(choice);
  j = judgeSituation(sC, ['quick']);
  check(j.ok && j.value.verdict === 'WORKS_BUT_DIFFERENTLY' && same(j.value.reasons, [{ code: 'better-way', steps: ['careful'] }]) && same(j.value.better?.steps, ['careful']), 'V-07-better-way');
  j = judgeSituation(sC, ['careful']);
  check(j.ok && j.value.verdict === 'WORKS', 'V-08-best-way-works');
  const sM = mk(mail);
  j = judgeSituation(sM, ['send']);
  check(j.ok && j.value.verdict === 'WORKS_ONLY_IF' && same(j.value.reasons, [{ code: 'unmet', stepId: 'send', conditions: [c('draft', 'done')] }]) && j.value.chain?.outcome === 'STOPPED' && same(j.value.better?.steps, ['write-draft', 'send']), 'V-09-only-if-draft-done');
  j = judgeSituation(sM, ['write-draft', 'send']);
  check(j.ok && j.value.verdict === 'WORKS', 'V-10-works-after-draft');
  j = judgeSituation(mk({ ...mail, maxNodes: 1 }));
  check(j.ok && j.value.verdict === 'CANNOT_JUDGE' && same(j.value.reasons, [{ code: 'budget', nodes: 2 }]) && j.value.chain === null && j.value.searchComplete === false, 'V-11-cannot-judge-budget');
  j = judgeSituation(mk({ ...mail, maxNodes: 1 }), ['write-draft', 'send']);
  check(j.ok && j.value.verdict === 'WORKS' && j.value.searchComplete === false, 'V-12-works-but-search-partial');
  j = judgeSituation(mk(stuck));
  check(j.ok && j.value.verdict === 'WILL_NOT_WORK' && same(j.value.reasons, [{ code: 'no-safe-path' }]), 'V-13-no-safe-path');
  check(judgeSituation(sM, ['nope']).ok === false && (judgeSituation(sM, ['nope']) as { error: string }).error === 'unknown-step', 'V-14-unknown-step');
  check(judgeSituation(sM, []).ok === false && judgeSituation(sM, [1 as never]).ok === false && judgeSituation(sM, Array.from({ length: 9 }, () => 'send')).ok === false, 'V-15-bad-proposals');
  const osc = mk({ id: 'osc', items: { a: 'x', b: 'x' }, rules: [{ id: 'p', when: [c('a', 'x')], then: [c('a', 'y')] }, { id: 'q', when: [c('a', 'y')], then: [c('a', 'x')] }], steps: [step('go', [], [c('b', 'y')], true, 1)], goal: [c('b', 'y')], harms: [], maxDepth: 2, maxNodes: 10 });
  const u = judgeSituation(osc, ['go']);
  check(!u.ok && u.error === 'unstable', 'V-16-unstable-rules');
  // chances
  const three = mk({ ...choice, steps: [step('a', [], [c('job', 'done')], true, 0, M(90)), step('b', [], [c('job', 'done')], true, 0, M(90)), step('c', [], [c('job', 'done')], true, 0, M(90))] });
  check(same(chainChance(three, ['a', 'b', 'c']), { low: 72.9, high: 72.9, basis: 'MODEL' }), 'V-17-three-times-90');
  const mixed = mk({ ...choice, steps: [step('a', [], [c('job', 'done')], true, 0, { low: 50, high: 90, basis: 'HYPOTHESIS' }), step('b', [], [c('job', 'done')], true, 0, { low: 80, high: 80, basis: 'JOURNAL' }), step('c', [], [c('job', 'done')], true, 0, M(100))] });
  check(same(chainChance(mixed, ['a', 'b']), { low: 40, high: 72, basis: 'HYPOTHESIS' }) && same(chainChance(mixed, ['b', 'c']), { low: 80, high: 80, basis: 'JOURNAL' }) && same(chainChance(mixed, ['c']), M(100)) && same(chainChance(mixed, []), M(100)), 'V-18-weakest-basis-and-range');
}
{
  const odd = mk({ ...choice, steps: [step('a', [], [c('job', 'done')], true, 0, M(33)), step('b', [], [c('job', 'done')], true, 0, M(33)), step('c', [], [c('job', 'done')], true, 0, M(33))] });
  check(same(chainChance(odd, ['a', 'b', 'c']), { low: 3.6, high: 3.6, basis: 'MODEL' }) && same(chainChance(odd, ['a', 'b']), { low: 10.9, high: 10.9, basis: 'MODEL' }), 'V-19-chances-are-rounded-to-one-decimal');
}
// ---------- J2 calibration
{
  const preds = [...Array.from({ length: 11 }, (_, i) => ({ id: 'a' + i, chance: 70, cameTrue: i < 8 })), ...Array.from({ length: 10 }, (_, i) => ({ id: 'b' + i, chance: 90, cameTrue: i < 5 }))];
  const r = calibrationReport(preds);
  check(r !== null && same(r, [{ bucket: 70, called: 11, cameTrue: 8, rate: 72.7, drifted: false }, { bucket: 90, called: 10, cameTrue: 5, rate: 50, drifted: true }]), 'K-01-report');
  check(same(calibrationReport([{ id: 'x', chance: 74, cameTrue: true }, { id: 'y', chance: 75, cameTrue: false }]), [{ bucket: 70, called: 1, cameTrue: 1, rate: 100, drifted: false }, { bucket: 80, called: 1, cameTrue: 0, rate: 0, drifted: false }]), 'K-02-rounding-to-nearest-ten');
  check(same(calibrationReport([]), []), 'K-03-empty');
  check(calibrationReport([{ id: 'x', chance: 101, cameTrue: true }]) === null && calibrationReport([{ id: 'x', chance: -1, cameTrue: true }]) === null && calibrationReport([{ id: 1 as never, chance: 5, cameTrue: true }]) === null && calibrationReport('x' as never) === null && calibrationReport([null as never]) === null, 'K-04-bad-input');
  check(same(calibrationReport(Array.from({ length: 9 }, (_, i) => ({ id: 'z' + i, chance: 90, cameTrue: false }))), [{ bucket: 90, called: 9, cameTrue: 0, rate: 0, drifted: false }]), 'K-05-too-few-calls-never-drifts');
  const drift = calibrationReport(Array.from({ length: 10 }, (_, i) => ({ id: 'z' + i, chance: 50, cameTrue: i < 7 })));
  check(same(drift, [{ bucket: 50, called: 10, cameTrue: 7, rate: 70, drifted: true }]) && same(calibrationReport(Array.from({ length: 10 }, (_, i) => ({ id: 'z' + i, chance: 50, cameTrue: i < 6 }))), [{ bucket: 50, called: 10, cameTrue: 6, rate: 60, drifted: false }]), 'K-06-drift-threshold-is-more-than-15');
  const rep = r ?? [];
  check(same(widenForDrift(80, 100, rep), { low: 70, high: 100, widened: true }) && same(widenForDrift(70, 70, rep), { low: 70, high: 70, widened: false }) && same(widenForDrift(0, 0, rep), { low: 0, high: 0, widened: false }) && same(widenForDrift(85, 95, rep), { low: 75, high: 100, widened: true }), 'K-07-widen');
}
{
  const exact = calibrationReport(Array.from({ length: 20 }, (_, i) => ({ id: 'e' + i, chance: 50, cameTrue: i < 13 })));
  check(same(exact, [{ bucket: 50, called: 20, cameTrue: 13, rate: 65, drifted: false }]), 'K-08-exactly-15-points-is-not-drift');
  const dr = calibrationReport(Array.from({ length: 10 }, (_, i) => ({ id: 'z' + i, chance: 50, cameTrue: i < 7 }))) ?? [];
  check(same(widenForDrift(5, 95, dr), { low: 0, high: 100, widened: true }), 'K-09-widening-stays-between-0-and-100');
}
// ---------- J3 schedule
{
  const t = (id: string, effort: number, needs: string[] = []) => ({ id, effort, needs });
  const r = criticalPath([t('a', 3), t('b', 2, ['a']), t('c', 4, ['a']), t('d', 1, ['b', 'c'])]);
  check(r.ok && same(r.value, { order: ['a', 'b', 'c', 'd'], finish: { a: 3, b: 5, c: 7, d: 8 }, length: 8, path: ['a', 'c', 'd'], bottleneck: 'c' }), 'S-01-critical-path');
  const tie = criticalPath([t('x', 2), t('y', 2), t('z', 1, ['x', 'y'])]);
  check(tie.ok && same(tie.value.path, ['x', 'z']) && tie.value.length === 3 && tie.value.bottleneck === 'x', 'S-02-ties-take-the-first');
  const bad = (tasks: unknown, error: string, name: string) => { const x = criticalPath(tasks as never); check(!x.ok && x.error === error, name); };
  bad([t('a', 1, ['b']), t('b', 1, ['a'])], 'cycle', 'S-03-cycle');
  bad([t('a', 1, ['zz'])], 'unknown-need', 'S-04-unknown-need');
  bad([t('a', 1, ['a'])], 'unknown-need', 'S-05-self-need');
  bad([t('a', 1), t('a', 2)], 'duplicate-task', 'S-06-duplicate');
  bad([], 'bad-input', 'S-07-empty');
  bad([t('a', -1)], 'bad-input', 'S-08-negative-effort');
  bad([{ id: '', effort: 1, needs: [] }], 'bad-input', 'S-09-empty-id');
  bad('x', 'bad-input', 'S-10-not-a-list');
  const single = criticalPath([t('only', 0)]);
  check(single.ok && single.value.length === 0 && same(single.value.path, ['only']) && single.value.bottleneck === 'only', 'S-11-single-zero-effort');
  const tie2 = criticalPath([t('p', 3), t('q', 3, ['p'])]);
  check(tie2.ok && tie2.value.bottleneck === 'p' && same(tie2.value.path, ['p', 'q']) && tie2.value.length === 6, 'S-12-bottleneck-tie-takes-the-first');
  // pace
  const p1 = pace([{ done: 6, days: 3 }, { done: 4, days: 2 }], 20, 12);
  check(p1.ok && same(p1.value, { ratePerDay: 2, daysNeeded: 10, late: false, daysLate: 0, spread: 0, marginDays: 0, aimDays: 12, requiredRatePerDay: 1.67 }), 'P-01-steady-pace');
  const hist = [{ done: 4, days: 2 }, { done: 6, days: 2 }];
  const p2 = pace(hist, 25, 11);
  check(p2.ok && same(p2.value, { ratePerDay: 2.5, daysNeeded: 10, late: false, daysLate: 0, spread: 0.2, marginDays: 2, aimDays: 9, requiredRatePerDay: 2.78 }), 'P-02-margin-from-spread');
  const p3 = pace(hist, 25, 8);
  check(p3.ok && p3.value.late === true && p3.value.daysLate === 2 && p3.value.aimDays === 6 && p3.value.requiredRatePerDay === 4.17, 'P-03-late');
  const p4 = pace(hist, 25, 2);
  check(p4.ok && p4.value.aimDays === 0 && p4.value.requiredRatePerDay === null && p4.value.late === true, 'P-04-no-room-for-margin');
  const p6 = pace(hist, 24, 11);
  check(p6.ok && same(p6.value, { ratePerDay: 2.5, daysNeeded: 9.6, late: false, daysLate: 0, spread: 0.2, marginDays: 2, aimDays: 9, requiredRatePerDay: 2.67 }), 'P-13-margin-rounds-up');
  const p7 = pace([{ done: 6, days: 3 }], 20, 10);
  check(p7.ok && p7.value.daysNeeded === 10 && p7.value.late === false && p7.value.daysLate === 0, 'P-14-exactly-on-time-is-not-late');
  const pe = (h: unknown, r: number, d: number, error: string, name: string) => { const x = pace(h as never, r, d); check(!x.ok && x.error === error, name); };
  pe([], 5, 5, 'no-history', 'P-05-no-history');
  pe([{ done: 0, days: 3 }], 5, 5, 'no-progress', 'P-06-nothing-done');
  pe([{ done: 1, days: 0 }], 5, 5, 'bad-input', 'P-07-zero-days');
  pe([{ done: -1, days: 1 }], 5, 5, 'bad-input', 'P-08-negative-done');
  pe(hist, -1, 5, 'bad-input', 'P-09-negative-remaining');
  pe(hist, 5, Number.NaN, 'bad-input', 'P-10-nan');
  pe('x', 5, 5, 'no-history', 'P-11-not-a-list');
  const p5 = pace(hist, 0, 5);
  check(p5.ok && p5.value.daysNeeded === 0 && p5.value.late === false && p5.value.marginDays === 0, 'P-12-nothing-left');
  // effort
  const e1 = effortRange([3, 1, 2]);
  const e2 = effortRange([4, 1, 3, 2]);
  check(e1.ok && same(e1.value, { min: 1, median: 2, max: 3 }) && e2.ok && same(e2.value, { min: 1, median: 2.5, max: 4 }), 'E-01-range');
  check(!effortRange([]).ok && !effortRange([-1]).ok && !effortRange(['x' as never]).ok && !effortRange('x' as never).ok, 'E-02-bad');
  const pts = [{ effort: 1, quality: 10 }, { effort: 2, quality: 18 }, { effort: 3, quality: 22 }, { effort: 4, quality: 23 }];
  const g1 = goodEnough(pts, 2);
  const g2 = goodEnough(pts, 0.5);
  check(g1.ok && same(g1.value, { stopAt: 3, reachedEnd: false }) && g2.ok && same(g2.value, { stopAt: 4, reachedEnd: true }), 'G-01-diminishing-returns');
  const g3 = goodEnough(pts, 5);
  check(g3.ok && same(g3.value, { stopAt: 2, reachedEnd: false }), 'G-02-early-stop');
  const g4 = goodEnough(pts, 4);
  check(g4.ok && same(g4.value, { stopAt: 3, reachedEnd: false }), 'G-04-a-gain-equal-to-the-minimum-still-pays');
  check(!goodEnough([pts[0]], 1).ok && !goodEnough(pts, -1).ok && !goodEnough([pts[1], pts[0]], 1).ok && !goodEnough([pts[0], pts[0]], 1).ok && !goodEnough([{ effort: 1, quality: 'x' as never }, pts[1]], 1).ok, 'G-03-bad');
}
// ---------- J4 guidance
{
  const sB = mk(boulders);
  const sr = lookAhead(sB);
  const jb = judgeSituation(sB, ['push-left']);
  const g1 = jb.ok ? guide(jb.value, sr.chains, ['push-left']) : null;
  check(g1 !== null && same(g1, { verdict: 'WILL_NOT_WORK', ownerPlanIsBest: false, options: [{ steps: ['push-left'], leadsTo: 'HARM', irreversible: 1, cost: 1, isOwnerPlan: true }, { steps: ['push-right'], leadsTo: 'GOAL', irreversible: 1, cost: 1, isOwnerPlan: false }], pushback: { code: 'harm', detail: ['h1'] }, question: null }), 'U-01-harm-pushback');
  const jw = judgeSituation(sB, ['push-right']);
  const g2 = jw.ok ? guide(jw.value, sr.chains, ['push-right']) : null;
  check(g2 !== null && same(g2, { verdict: 'WORKS', ownerPlanIsBest: true, options: [{ steps: ['push-right'], leadsTo: 'GOAL', irreversible: 1, cost: 1, isOwnerPlan: true }, { steps: ['push-left'], leadsTo: 'HARM', irreversible: 1, cost: 1, isOwnerPlan: false }], pushback: null, question: null }), 'U-02-works-no-pushback');
  const sM = mk(mail);
  const jm = judgeSituation(sM, ['send']);
  const g3 = jm.ok ? guide(jm.value, lookAhead(sM).chains, ['send']) : null;
  check(g3 !== null && g3.verdict === 'WORKS_ONLY_IF' && same(g3.pushback, { code: 'unmet', detail: ['draft=done'] }) && same(g3.question, { about: 'condition', item: 'draft', state: 'done' }) && g3.options[0].isOwnerPlan && g3.options[0].leadsTo === 'NOTHING' && same(g3.options[1].steps, ['write-draft', 'send']), 'U-03-only-if-asks-one-question');
  const sC = mk(choice);
  const jc = judgeSituation(sC, ['quick']);
  const g4 = jc.ok ? guide(jc.value, lookAhead(sC).chains, ['quick']) : null;
  check(g4 !== null && same(g4.pushback, { code: 'better-way', detail: ['careful'] }) && g4.ownerPlanIsBest === false && g4.options.length === 2 && g4.options[0].isOwnerPlan, 'U-04-better-way');
  const jx = judgeSituation(mk({ ...mail, maxNodes: 1 }));
  const g5 = jx.ok ? guide(jx.value, [], null) : null;
  check(g5 !== null && g5.verdict === 'CANNOT_JUDGE' && g5.options.length === 0 && same(g5.question, { about: 'budget', item: null, state: null }) && g5.pushback === null, 'U-05-cannot-judge-asks-about-budget');
  const js = judgeSituation(mk(stuck));
  const g6 = js.ok ? guide(js.value, lookAhead(mk(stuck)).chains, null) : null;
  check(g6 !== null && same(g6.pushback, { code: 'no-safe-path', detail: [] }), 'U-06-no-safe-path');
  const jn = judgeSituation(sB);
  const g7 = jn.ok ? guide(jn.value, sr.chains, null) : null;
  check(g7 !== null && g7.ownerPlanIsBest === false && g7.options.length >= 1 && same(g7.options[0].steps, ['push-right']) && !g7.options[0].isOwnerPlan, 'U-07-no-owner-plan-gives-the-best');
  const many = guide({ verdict: 'WORKS', chain: null, chance: null, better: null, reasons: [], searchComplete: true, nodes: 0 }, Array.from({ length: 6 }, (_, i) => ({ steps: ['s' + i], outcome: 'GOAL' as const, harms: [], worstHarm: 'NONE' as const, irreversible: 0, cost: i, finalState: {} })), null);
  check(many.options.length === 3, 'U-08-three-options-at-most');
}
// ---------- J5 brief
{
  const b1 = buildBrief('poster', { subject: 'Birthday', text: '  Happy Birthday  ' }, { size: 'A4' });
  check(b1.ok && same(b1.value, { kind: 'poster', fields: [{ name: 'subject', value: 'Birthday', source: 'owner' }, { name: 'text', value: 'Happy Birthday', source: 'owner' }, { name: 'size', value: 'A4', source: 'default' }, { name: 'mood', value: null, source: 'missing' }, { name: 'colours', value: null, source: 'missing' }], complete: false, askFirst: 'mood' }), 'B-01-poster-asks-mood');
  const b2 = buildBrief('screen', { purpose: 'p', content: 'c', device: 'd', layout: 'l', mood: 'm', colours: 'k' }, {});
  check(b2.ok && b2.value.complete && b2.value.askFirst === null && b2.value.fields.every((x) => x.source === 'owner'), 'B-02-complete');
  const b3 = buildBrief('image', {}, {});
  check(b3.ok && b3.value.askFirst === 'subject' && b3.value.fields.length === 5 && !b3.value.complete, 'B-03-nothing-given-asks-subject');
  check(buildBrief('flyer', { contact: 'x' }, { contact: 'y' }).ok === true && (buildBrief('flyer', { contact: 'x' }, { contact: 'y' }) as unknown as { value: { fields: { name: string; value: string }[] } }).value.fields.find((x) => x.name === 'contact')?.value === 'x', 'B-04-owner-beats-default');
  const be = (k: unknown, g: unknown, d: unknown, error: string, name: string) => { const x = buildBrief(k, g, d); check(!x.ok && x.error === error, name); };
  be('banner', {}, {}, 'bad-input', 'B-05-unknown-kind');
  be('poster', { colour: 'red' }, {}, 'unknown-field', 'B-06-unknown-field-given');
  be('poster', {}, { layout: 'x' }, 'unknown-field', 'B-07-unknown-field-default');
  be('poster', { subject: '' }, {}, 'bad-input', 'B-08-empty-value');
  be('poster', { subject: 5 }, {}, 'bad-input', 'B-09-number-value');
  be('poster', [], {}, 'bad-input', 'B-10-array');
  be('poster', {}, null, 'bad-input', 'B-11-null-defaults');
  be('poster', { subject: 'x'.repeat(501) }, {}, 'bad-input', 'B-12-too-long');
  const b4 = buildBrief('screen', { mood: 'calm' }, { purpose: 'tool' });
  check(b4.ok && b4.value.askFirst === 'content' && b4.value.fields[0].source === 'default', 'B-13-impact-order');
  const b5 = buildBrief('image', { subject: 's', mood: 'm', size: 'z', style: 'y', colours: 'c' }, {});
  check(b5.ok && b5.value.complete, 'B-14-image-complete');
}
// ---------- random situations: every chain replays, ranking is sorted, best really reaches the goal, verdicts agree with a by-hand replay
let seed = 2026;
const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
const pick = <T,>(a: readonly T[]): T => a[Math.floor(rnd() * a.length)];
const states = ['a', 'b', 'c'] as const;
const itemsPool = ['i1', 'i2', 'i3', 'i4'] as const;
function randomSituation(): Situation | null {
  const items: Record<string, string> = {};
  const names = itemsPool.slice(0, 3 + Math.floor(rnd() * 2));
  for (const k of names) items[k] = pick(states);
  const cond = (): Cond => c(pick(names), pick(states));
  const steps = Array.from({ length: 2 + Math.floor(rnd() * 3) }, (_, i) => step('s' + i, rnd() < 0.5 ? [cond()] : [], [cond()], rnd() < 0.5, Math.floor(rnd() * 5), rnd() < 0.5 ? M(Math.floor(rnd() * 101)) : { low: 20, high: 80, basis: 'HYPOTHESIS' as const }));
  const rules = Array.from({ length: Math.floor(rnd() * 3) }, (_, i) => ({ id: 'r' + i, when: [cond()], then: [cond()] }));
  const harms = Array.from({ length: Math.floor(rnd() * 2) }, (_, i) => ({ id: 'h' + i, when: [cond()], severity: pick(['LOW', 'MEDIUM', 'HIGH'] as const) }));
  const r = validateSituation({ id: 'rand', items, rules, steps, goal: [cond()], harms, maxDepth: 3, maxNodes: 400 });
  return r.ok ? r.value : null;
}
// By-hand replay, written separately from applyStep: effects, then rules until nothing changes.
function replay(sit: Situation, ids: readonly string[]): { state: State; harmIds: string[]; ok: boolean } {
  let st: Record<string, string> = { ...sit.items };
  for (const id of ids) {
    const s = sit.steps.find((x) => x.id === id) as Step;
    if (!s.needs.every((q) => st[q.item] === q.state)) return { state: st, harmIds: [], ok: false };
    for (const e of s.effects) st[e.item] = e.state;
    for (let round = 0; round < 100; round++) {
      let again = false;
      for (const r of sit.rules) if (r.when.every((q) => st[q.item] === q.state) && r.then.some((a) => st[a.item] !== a.state)) { for (const a of r.then) st[a.item] = a.state; again = true; }
      if (!again) break;
    }
  }
  return { state: st, harmIds: sit.harms.filter((h) => h.when.every((q) => st[q.item] === q.state)).map((h) => h.id), ok: true };
}
let sims = 0;
for (let i = 0; i < 400; i++) {
  const sit = randomSituation();
  if (!sit) continue;
  sims++;
  const s = lookAhead(sit);
  check(same(lookAhead(sit), s), 'R-deterministic-' + i);
  check(s.chains.every((ch, k) => k === 0 || compareChains(s.chains[k - 1], ch) <= 0), 'R-sorted-' + i);
  check(s.chains.every((ch) => ch.steps.every((id, k) => k === 0 || id !== ch.steps[k - 1]) && ch.steps.length <= sit.maxDepth), 'R-shape-' + i);
  let allReplay = true;
  for (const ch of s.chains) {
    const rp = replay(sit, ch.steps);
    const goal = holds(rp.state, sit.goal);
    if (!rp.ok || !same(rp.state, ch.finalState) || !same(rp.harmIds, ch.harms)) allReplay = false;
    if (ch.outcome === 'GOAL' && (!goal || rp.harmIds.length > 0)) allReplay = false;
    if (ch.outcome === 'HARM' && rp.harmIds.length === 0) allReplay = false;
    const reversibles = ch.steps.filter((id) => (sit.steps.find((x) => x.id === id) as Step).reversible).length;
    if (ch.irreversible !== ch.steps.length - reversibles) allReplay = false;
    if (ch.cost !== ch.steps.reduce((a, id) => a + (sit.steps.find((x) => x.id === id) as Step).cost, 0)) allReplay = false;
  }
  check(allReplay, 'R-chains-replay-' + i);
  check(s.best === null || s.best.outcome === 'GOAL', 'R-best-is-goal-' + i);
  if (s.best) {
    const j = judgeSituation(sit, s.best.steps);
    check(j.ok && j.value.verdict === 'WORKS' && j.value.better === null, 'R-best-works-' + i);
    for (const ch of s.chains.filter((x) => x.outcome === 'GOAL')) {
      const v = judgeSituation(sit, ch.steps);
      const worse = compareChains(s.best, ch) < 0;
      check(v.ok && v.value.verdict === (worse ? 'WORKS_BUT_DIFFERENTLY' : 'WORKS'), 'R-goal-chains-verdict-' + i);
    }
  } else if (s.complete) {
    const j = judgeSituation(sit);
    check(j.ok && j.value.verdict === 'WILL_NOT_WORK', 'R-no-best-means-will-not-work-' + i);
  }
  for (const ch of s.chains.filter((x) => x.outcome === 'HARM')) {
    const v = judgeSituation(sit, ch.steps);
    check(v.ok && v.value.verdict === 'WILL_NOT_WORK' && v.value.reasons[0].code === 'harm', 'R-harm-chains-verdict-' + i);
    const ch2 = v.ok ? v.value.chain : null;
    check(ch2 !== null && same(ch2.harms, ch.harms) && ch2.worstHarm === ch.worstHarm, 'R-harm-details-' + i);
  }
  const ch0 = s.chains[0];
  if (ch0) { const cc = chainChance(sit, ch0.steps); check(cc.low <= cc.high && cc.low >= 0 && cc.high <= 100, 'R-chance-range-' + i); }
}
check(sims > 300, 'R-enough-valid-random-situations');
console.log(`foresight: ${n} checks; ${f} failed; random situations ${sims}`);
if (f !== 0) process.exitCode = 1;
