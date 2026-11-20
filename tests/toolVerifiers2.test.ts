import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { deepStrictEqual } from 'node:assert';
import { md5Hex, numberWords, parseNumberWords, verifyToolReplyFull } from '../src/safety/toolVerifiers2.ts';
import { utf8Bytes } from '../src/safety/toolVerifiers.ts';
import { caseConvert, CASE_CONVERT_MODES } from '../src/tools/engines/text/caseConvert';
import { numberToWords } from '../src/tools/engines/numbers/numberToWords';

let n = 0;
let f = 0;
const check = (ok: boolean, name: string) => { n++; if (!ok) { f++; console.log('FAIL ' + name); } };
const same = (a: unknown, b: unknown) => { try { deepStrictEqual(a, b); return true; } catch { return false; } };
for (const c of JSON.parse(readFileSync('tests/fixtures/toolVerifier2Cases.json', 'utf8')) as Array<{ id: string; input: any; expected: unknown }>) {
  let actual: unknown;
  try { actual = await verifyToolReplyFull(c.input); } catch { actual = '__THREW__'; }
  check(same(actual, c.expected), c.id);
}
// words both ways
check(numberWords(0n) === 'zero' && numberWords(19n) === 'nineteen' && numberWords(20n) === 'twenty' && numberWords(99n) === 'ninety-nine' && numberWords(100n) === 'one hundred' && numberWords(1000n) === 'one thousand' && numberWords(1000000n) === 'one million', 'W01_words');
check(numberWords(-1n) === null && numberWords(1000000000000000000n) === null && numberWords(999999999999999999n)?.startsWith('nine hundred ninety-nine quadrillion') === true, 'W02_range');
check(parseNumberWords('one hundred and twenty-three') === 123n && parseNumberWords('Twenty One') === 21n && parseNumberWords('') === null && parseNumberWords('and') === null && parseNumberWords('twelve apples') === null && parseNumberWords('one thousand two hundred') === 1200n, 'W03_parse');
check(parseNumberWords('hundred') === 0n, 'W04_leading_hundred_is_zero_times_a_hundred');
// independent oracles on random input (seeded, repeatable)
let seed = 77;
const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
const pick = <T,>(a: T[]): T => a[Math.floor(rnd() * a.length)];
for (let i = 0; i < 1500; i++) {
  const bytes = Array.from({ length: Math.floor(rnd() * 200) }, () => Math.floor(rnd() * 256));
  check(md5Hex(bytes) === createHash('md5').update(Buffer.from(bytes)).digest('hex'), 'md5-' + i);
}
for (let i = 0; i < 1500; i++) {
  let s = '';
  for (let d = 0, len = 1 + Math.floor(rnd() * 15); d < len; d++) s += Math.floor(rnd() * 10);
  const big = BigInt(s);
  const real: any = numberToWords(big);
  const text = real.text ?? real.words ?? real.value;
  check(real.ok !== false && numberWords(big) === text && parseNumberWords(text) === big, 'numbers-' + s);
}
const chars = "abcdefghij ABCDEFGHIJ0123456789 .,!?-_'\t\n\r ..!!".split('');
for (let i = 0; i < 1500; i++) {
  let s = '';
  for (let k = 0, len = Math.floor(rnd() * 16); k < len; k++) s += pick(chars);
  for (const mode of CASE_CONVERT_MODES) {
    const r: any = caseConvert(s, mode);
    const v = await verifyToolReplyFull({ toolId: 'case-converter', message: `convert "${s}" to x`, replyContent: r.text + '\n\nRan as task task-1: COMPLETED in 0 ms, from your exact input.' });
    check(v.check !== null && v.check.value === v.output, 'case-' + mode + '-' + i);
  }
}
for (let i = 0; i < 150; i++) {
  const s = pick(['abc', '', 'h\u00e9llo w\u00f6rld', '\u65e5\u672c\u8a9e', 'a'.repeat(Math.floor(rnd() * 130))]);
  for (const [name, node] of [['SHA-256', 'sha256'], ['SHA-1', 'sha1'], ['SHA-384', 'sha384'], ['SHA-512', 'sha512'], ['MD5', 'md5']] as const) {
    const d = createHash(node).update(s, 'utf8').digest('hex');
    const ok = await verifyToolReplyFull({ toolId: 'hash-tool', message: `calculate checksum of "${s}" using ${name}`, replyContent: `${name} digest: ${d}\n\nRan as task task-1: COMPLETED in 0 ms, from your exact input.` });
    const bad = await verifyToolReplyFull({ toolId: 'hash-tool', message: `calculate checksum of "${s}" using ${name}`, replyContent: `${name} digest: ${d.slice(0, -1)}${d.endsWith('0') ? '1' : '0'}\n\nRan as task task-1: COMPLETED in 0 ms, from your exact input.` });
    check(ok.check !== null && ok.check.value === ok.output && bad.check !== null && bad.check.value !== bad.output, 'hash-' + name + '-' + i);
  }
}
check(utf8Bytes('\u00e9').join(',') === '195,169', 'U01_utf8');
console.log(`toolVerifiers2: ${n} checks; ${f} failed`);
if (f !== 0) process.exitCode = 1;
