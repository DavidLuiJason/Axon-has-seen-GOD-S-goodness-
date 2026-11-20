import { createPredictionJournal, PENDING_LIMIT, KEPT_LIMIT } from '../src/brain/mind/orchestrator/predictionJournal.ts';
import { deepStrictEqual } from 'node:assert';

let n = 0;
let f = 0;
const check = (ok: boolean, name: string) => { n++; if (!ok) { f++; console.log('FAIL ' + name); } };
const same = (a: unknown, b: unknown) => { try { deepStrictEqual(a, b); return true; } catch { return false; } };
{
  const j = createPredictionJournal();
  check(j.expect('p1', 70) && j.expect('p2', 90) && j.pendingCount() === 2 && j.list().length === 0, 'J01_expect_waits');
  check(j.outcome('p1', true) && j.pendingCount() === 1 && same(j.list(), [{ id: 'p1', chance: 70, cameTrue: true }]), 'J02_outcome_moves_it_to_the_record');
  check(!j.outcome('p1', false) && !j.outcome('nope', true) && j.list().length === 1, 'J03_an_outcome_needs_an_expectation');
  check(j.expect('p2', 40) && j.pendingCount() === 1 && j.outcome('p2', false) && same(j.list()[1], { id: 'p2', chance: 40, cameTrue: false }), 'J04_same_id_replaces_the_waiting_one');
  const l = j.list() as unknown as { cameTrue: boolean }[];
  l[0].cameTrue = false;
  check(j.list()[0].cameTrue === true, 'J05_list_returns_copies');
  check(!j.expect('', 50) && !j.expect('x', -1) && !j.expect('x', 101) && !j.expect('x', Number.NaN) && !j.expect(5 as never, 50) && !j.expect('x'.repeat(101), 50), 'J06_bad_expectations_refused');
  check(j.expect('zero', 0) && j.expect('hundred', 100), 'J07_edges_ok');
  check(!j.outcome('zero', 'yes' as never) && j.pendingCount() === 2, 'J08_outcome_must_be_true_or_false');
}
{
  const a = createPredictionJournal();
  a.expect('a', 60); a.expect('b', 80); a.outcome('a', false);
  const text = a.exportText();
  const b = createPredictionJournal();
  check(b.importText(text) && b.pendingCount() === 1 && same(b.list(), a.list()) && b.exportText() === text, 'E01_roundtrip');
  const before = b.exportText();
  check(!b.importText('not json') && !b.importText('null') && !b.importText('[]') && b.exportText() === before, 'E02_bad_text_refused_nothing_changed');
  check(!b.importText(JSON.stringify({ version: 2, pending: [], kept: [] })) && !b.importText(JSON.stringify({ version: 1, pending: 'x', kept: [] })), 'E03_wrong_shape');
  check(!b.importText(JSON.stringify({ version: 1, pending: [{ id: 'z', chance: 150 }], kept: [] })) && !b.importText(JSON.stringify({ version: 1, pending: [], kept: [{ id: 'z', chance: 50, cameTrue: 'yes' }] })) && b.exportText() === before, 'E04_one_bad_item_refuses_all');
  check(b.importText(JSON.stringify({ version: 1, pending: [], kept: [] })) && b.pendingCount() === 0 && b.list().length === 0, 'E05_empty_ok');
  check(!b.importText(JSON.stringify({ version: 1, pending: Array.from({ length: PENDING_LIMIT + 1 }, (_, i) => ({ id: 'p' + i, chance: 1 })), kept: [] })), 'E06_too_many_pending');
}
{
  const j = createPredictionJournal();
  for (let i = 0; i < PENDING_LIMIT + 10; i++) j.expect('p' + i, 50);
  check(j.pendingCount() === PENDING_LIMIT && !j.outcome('p0', true) && j.outcome('p' + (PENDING_LIMIT + 9), true), 'L01_pending_limit_keeps_newest');
  const k = createPredictionJournal();
  for (let i = 0; i < KEPT_LIMIT + 5; i++) { k.expect('k' + i, 10); k.outcome('k' + i, i % 2 === 0); }
  const l = k.list();
  check(l.length === KEPT_LIMIT && l[0].id === 'k5' && l[l.length - 1].id === 'k' + (KEPT_LIMIT + 4), 'L02_kept_limit_keeps_newest');
}
console.log(`predictionJournal: ${n} checks; ${f} failed`);
if (f !== 0) process.exitCode = 1;
