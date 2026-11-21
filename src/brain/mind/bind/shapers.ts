/**
 * SHAPERS (Director 471, ROUND-ALL): for a tool whose arguments are NOT plain slots (a percentage needs its mode and a values record built from
 * the numbers and the little words between them), a shaper reads the typed values and the words of the clause and returns the arguments itself.
 * PURE and STRUCTURAL: it uses the positions of values and single words from closed frozen records (no phrase lists, no regular expressions, FL13).
 * It returns null whenever the clause does not have exactly one of its known shapes, and then the ordinary binder rules apply (and ask).
 * `showsResultOnly` says the shape can only ever show a result (never read or write a file), so the tool's other effects do not hold it back.
 * `whole` says the shape is built entirely by the shaper, so optional slots it left out are not filled by the value rules.
 * `strong` says the SHAPE itself is proof that the person asked for this tool (a percent value, of, a number): it lifts a value-only evidence.
 */
import type { BindInput, BindValue, BindWord } from './argumentBinder';
import { CONVERTER_UNIT_WORDS } from '../../../tools/runners/converterUnitWords';

export interface Shaped { readonly args: Readonly<Record<string, unknown>>; readonly strong: boolean; readonly showsResultOnly?: true; readonly whole?: true }
export type Shaper = (input: BindInput) => Shaped | null;

const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const word = (set: Readonly<Record<string, true>>, norm: string): boolean => Object.prototype.hasOwnProperty.call(set, norm);
function numbersOf(input: BindInput): BindValue[] {
  return (Array.isArray(input.values) ? input.values : []).filter((v) => !!v && (v.kind === 'number' || v.kind === 'percent') && isNum(v.value) && v.error === undefined)
    .slice().sort((a, b) => a.start - b.start);
}
function wordsOf(input: BindInput): BindWord[] { return (Array.isArray(input.words) ? input.words : []).filter((w) => !!w && typeof w.norm === 'string').slice().sort((a, b) => a.start - b.start); }
const between = (words: readonly BindWord[], from: number, to: number, set: Readonly<Record<string, true>>): boolean => words.some((w) => w.start >= from && w.end <= to && word(set, w.norm.toLowerCase()));
const before = (words: readonly BindWord[], at: number, set: Readonly<Record<string, true>>): boolean => words.some((w) => w.end <= at && word(set, w.norm.toLowerCase()));
const after = (words: readonly BindWord[], at: number, set: Readonly<Record<string, true>>): boolean => words.some((w) => w.start >= at && word(set, w.norm.toLowerCase()));
const only = (norm: string): Readonly<Record<string, true>> => Object.freeze({ [norm]: true } as Record<string, true>);

const OF = only('of'); const WHAT = only('what'); const FROM = only('from'); const TO = only('to'); const BY = only('by'); const IS = only('is'); const OFF = only('off');
const CHANGE: Readonly<Record<string, true>> = Object.freeze({ change: true });
const PERCENT_WORD: Readonly<Record<string, true>> = Object.freeze({ percent: true, percentage: true });
const UP: Readonly<Record<string, true>> = Object.freeze({ increase: true, raise: true, add: true });
const DOWN: Readonly<Record<string, true>> = Object.freeze({ decrease: true, reduce: true, subtract: true, take: true });

/** Percentage Helper: the five engine modes, each by its own structure of values and words. */
export const percentageShaper: Shaper = (input) => {
  const nums = numbersOf(input); const words = wordsOf(input);
  const out = (mode: string, values: Record<string, number>): Shaped => ({ args: { mode, values }, strong: true });
  if (nums.length !== 2) return null;
  const [a, b] = nums as [BindValue, BindValue];
  const av = a.value as number; const bv = b.value as number;
  // 15% of 80, 12 percent of 50  ->  percent-of
  if (a.kind === 'percent' && b.kind === 'number' && between(words, a.end, b.start, OF) && !after(words, b.end, WHAT)) return out('percent-of', { x: av, y: bv });
  // 15 is 30% of what  ->  percent-of-what (x percent, y the part)
  if (a.kind === 'number' && b.kind === 'percent' && after(words, b.end, OF) && after(words, b.end, WHAT)) return out('percent-of-what', { x: bv, y: av });
  // what percent is 20 of 80, 20 is what percent of 80  ->  what-percent
  if (a.kind === 'number' && b.kind === 'number' && before(words, b.start, WHAT) && (before(words, b.start, PERCENT_WORD) || between(words, a.end, b.start, PERCENT_WORD))) {
    if (between(words, a.end, b.start, OF)) return out('what-percent', { x: av, y: bv });
    if (before(words, a.start, OF) && between(words, a.end, b.start, IS)) return out('what-percent', { x: bv, y: av });
  }
  // percent change from 50 to 75  ->  change
  if (a.kind === 'number' && b.kind === 'number' && after(words, 0, CHANGE) && before(words, a.start, FROM) && between(words, a.end, b.start, TO)) return out('change', { a: av, b: bv });
  // increase 200 by 15%, decrease 200 by 15%  ->  adjust
  if (a.kind === 'number' && b.kind === 'percent' && between(words, a.end, b.start, BY)) {
    if (before(words, a.start, UP) && !before(words, a.start, DOWN)) return out('adjust', { x: bv, y: av });
    if (before(words, a.start, DOWN) && !before(words, a.start, UP)) return out('adjust', { x: -bv, y: av });
  }
  // add 15% to 200, take 10% off 80, subtract 10% from 80  ->  adjust
  if (a.kind === 'percent' && b.kind === 'number') {
    if (before(words, a.start, UP) && !before(words, a.start, DOWN) && between(words, a.end, b.start, TO)) return out('adjust', { x: av, y: bv });
    if (before(words, a.start, DOWN) && !before(words, a.start, UP) && (between(words, a.end, b.start, OFF) || between(words, a.end, b.start, FROM))) return out('adjust', { x: -av, y: bv });
  }
  return null;
};

/** Date Calculator: the operation and its dates, amount and unit, from the dates, one number and single words (a fused word such as day-of-the-week is split into its single words first). */
const DATE_ADD: Readonly<Record<string, true>> = Object.freeze({ add: true, plus: true, after: true, later: true });
const DATE_SUB: Readonly<Record<string, true>> = Object.freeze({ subtract: true, minus: true, before: true, earlier: true });
const DATE_SPAN: Readonly<Record<string, true>> = Object.freeze({ between: true, difference: true, apart: true, until: true });
const DATE_WORKDAYS: Readonly<Record<string, true>> = Object.freeze({ weekdays: true, workdays: true, working: true, business: true });
const DATE_UNITS: Readonly<Record<string, string>> = Object.freeze({ day: 'days', days: 'days', week: 'weeks', weeks: 'weeks', month: 'months', months: 'months', year: 'years', years: 'years' });
function singleWords(input: BindInput): { w: string; start: number; end: number }[] {
  const out: { w: string; start: number; end: number }[] = [];
  for (const x of wordsOf(input)) for (const part of x.norm.toLowerCase().split(' ')) if (part) out.push({ w: part, start: x.start, end: x.end });
  return out;
}
export const dateShaper: Shaper = (input) => {
  const vals = (Array.isArray(input.values) ? input.values : []).filter((v) => !!v).slice().sort((a, b) => a.start - b.start);
  const dates = vals.filter((v) => v.kind === 'date');
  if (dates.some((d) => typeof d.date !== 'string' || d.error !== undefined || (Array.isArray(d.dateAlternatives) && d.dateAlternatives.length > 0))) return null;
  const nums = vals.filter((v) => v.kind === 'number' || v.kind === 'duration');
  if (vals.length !== dates.length + nums.length) return null;
  const ws = singleWords(input);
  const has = (set: Readonly<Record<string, true>>): boolean => ws.some((x) => word(set, x.w));
  const hasW = (name: string): boolean => ws.some((x) => x.w === name);
  const ok = (args: Record<string, unknown>): Shaped => ({ args, strong: true, whole: true });
  if (dates.length === 2 && nums.length === 0) {
    const first = dates[0] as BindValue; const second = dates[1] as BindValue;
    // between two dates is the span from the earlier to the later (ISO dates sort as text)
    const swap = (first.date as string) > (second.date as string);
    const d1 = swap ? second : first; const d2 = swap ? first : second;
    if (has(DATE_WORKDAYS)) return ok({ operation: 'count-weekdays', date: d1.date, otherDate: d2.date });
    if (has(DATE_SPAN) || (hasW('from') && hasW('to'))) return ok({ operation: 'difference', date: d1.date, otherDate: d2.date });
    return null;
  }
  if (dates.length !== 1) return null;
  const d = dates[0] as BindValue;
  if (has(DATE_SPAN) || has(DATE_WORKDAYS)) return null; // a span word with one date is a mixed request: it is asked about, not guessed
  if (nums.length === 0) {
    const iso = hasW('iso') || (hasW('week') && hasW('number'));
    const dayOfYear = hasW('day') && hasW('year');
    const dayOfWeek = hasW('weekday') || (hasW('day') && hasW('week') && !hasW('number'));
    const bareDay = hasW('day') && hasW('what') && !hasW('year') && !hasW('week');
    const kinds = [iso, dayOfYear, dayOfWeek || bareDay].filter((x) => x).length;
    if (kinds !== 1) return null;
    return ok({ operation: iso ? 'iso-week' : dayOfYear ? 'day-of-year' : 'weekday', date: d.date });
  }
  if (nums.length !== 1) return null;
  const n = nums[0] as BindValue; const amount = n.value as number;
  if (!Number.isInteger(amount) || amount < 0) return null;
  let unitWord: string | undefined;
  if (n.kind === 'duration') unitWord = typeof n.unit === 'string' ? n.unit.toLowerCase() : undefined;
  else { const next = ws.filter((x) => x.start >= n.end).sort((a, b) => a.start - b.start)[0]; unitWord = next ? next.w : undefined; }
  if (unitWord === undefined || !Object.prototype.hasOwnProperty.call(DATE_UNITS, unitWord)) return null;
  const unit = DATE_UNITS[unitWord] as string;
  const adds = has(DATE_ADD); const subs = has(DATE_SUB) || (hasW('subtract'));
  const fromWord = hasW('from') && n.start < d.start;
  if (adds && (subs || fromWord)) return null;
  if (subs && adds) return null;
  const sign = subs ? -1 : (adds || (fromWord && !subs) ? 1 : 0);
  if (sign === 0) return null;
  return ok({ operation: 'add', date: d.date, amount: (unit === 'weeks' ? amount * 7 : amount) * sign, unit: unit === 'weeks' ? 'days' : unit });
};

/** Converter, UNIT conversion only (the data and text formats stay with the ordinary rules, which ask): a number, the unit word right after it, and one other unit word after to, in, into or as (or after how many). */
const CONV_JOIN: Readonly<Record<string, true>> = Object.freeze({ to: true, in: true, into: true, as: true });
export const converterShaper: Shaper = (input) => {
  const vals = (Array.isArray(input.values) ? input.values : []).filter((v) => !!v && v.error === undefined).slice().sort((a, b) => a.start - b.start);
  if (vals.length !== 1) return null;
  const n = vals[0] as BindValue;
  if ((n.kind !== 'number' && n.kind !== 'quantity' && n.kind !== 'duration') || !isNum(n.value)) return null;
  const ws = singleWords(input);
  const unitWords = ws.filter((x) => Object.prototype.hasOwnProperty.call(CONVERTER_UNIT_WORDS, x.w));
  if (unitWords.length !== 2) return null;
  const first = unitWords[0] as { w: string; start: number; end: number }; const second = unitWords[1] as { w: string; start: number; end: number };
  const srcFirst = first.start >= n.start && first.start <= n.end + 1; // the unit sits next to the number, for a quantity inside its own span
  const srcSecond = second.start >= n.start && second.start <= n.end + 1;
  let src: { w: string } | undefined; let dst: { w: string } | undefined;
  if (srcFirst && !srcSecond && ws.some((x) => word(CONV_JOIN, x.w) && x.start >= first.end && x.end <= second.start)) { src = first; dst = second; }
  else if (srcSecond && !srcFirst && first.end <= n.start) { src = second; dst = first; }
  if (!src || !dst) return null;
  const from = CONVERTER_UNIT_WORDS[src.w] as string; const to = CONVERTER_UNIT_WORDS[dst.w] as string;
  if (from === to) return null;
  return { args: { from, to, input: String(n.value) }, strong: true, showsResultOnly: true, whole: true };
};

/** Text Compare: only the MODE is shaped (the two texts are placed by their marker words, see bindRoles.ts). When the person did not say line or word, two single-line texts are compared by word and texts with line breaks by line; a said mode is left to the ordinary choice rule. */
const COMPARE_MODE_WORDS: Readonly<Record<string, true>> = Object.freeze({ line: true, lines: true, word: true, words: true, character: true, characters: true, char: true, chars: true, letter: true, letters: true, sentence: true, sentences: true });
export const textCompareShaper: Shaper = (input) => {
  const ws = singleWords(input);
  if (ws.some((x) => word(COMPARE_MODE_WORDS, x.w))) return null;
  const mats = (Array.isArray(input.materials) ? input.materials : []).filter((m) => !!m && isNum(m.start) && isNum(m.end));
  if (mats.length !== 2) return null;
  const multiline = mats.some((m) => input.message.slice(m.start, m.end).includes('\n'));
  return { args: { mode: multiline ? 'line' : 'word' }, strong: false };
};

/** Text Cleaner: only the option FLAGS are shaped, from single words (the text itself is the quoted text). A general clean-up request with no option word turns on the safe trio: trim each line, reduce repeated spaces, collapse extra blank lines. Quotes and dashes are never shaped here (the quoted text would clash with them). */
const CLEAN_REMOVE: Readonly<Record<string, true>> = Object.freeze({ remove: true, delete: true, strip: true, drop: true, get: true, rid: true });
const CLEAN_REDUCE: Readonly<Record<string, true>> = Object.freeze({ collapse: true, extra: true, repeated: true, multiple: true, double: true, consecutive: true, reduce: true });
const CLEAN_GENERAL: Readonly<Record<string, true>> = Object.freeze({ clean: true, tidy: true });
export const textCleanerShaper: Shaper = (input) => {
  const ws = singleWords(input);
  const hasW = (name: string): boolean => ws.some((x) => x.w === name);
  const has = (set: Readonly<Record<string, true>>): boolean => ws.some((x) => word(set, x.w));
  const spaces = hasW('space') || hasW('spaces') || hasW('whitespace');
  const blank = hasW('blank') || hasW('empty');
  const args: Record<string, unknown> = {};
  if (hasW('trim') || hasW('trimmed') || hasW('trimming')) args.trimEachLine = true;
  if (spaces && has(CLEAN_REDUCE)) args.collapseRepeatedSpaces = true; // remove spaces alone would mean delete them all: not shaped
  if (blank) {
    if (has(CLEAN_REMOVE) && !has(CLEAN_REDUCE)) args.removeBlankLines = true;
    else if (has(CLEAN_REDUCE) && !has(CLEAN_REMOVE)) args.collapseBlankLines = true;
    else return null;
  }
  if (hasW('invisible') || (hasW('zero') && hasW('width'))) args.removeZeroWidth = true;
  if (hasW('ending') || hasW('endings')) args.normalizeLineEndings = true;
  if (Object.keys(args).length === 0 && has(CLEAN_GENERAL)) return { args: { trimEachLine: true, collapseRepeatedSpaces: true, collapseBlankLines: true }, strong: false };
  return Object.keys(args).length === 0 ? null : { args, strong: false };
};

export const SHAPERS: Readonly<Record<string, Shaper>> = Object.freeze({
  'percentage-helper': percentageShaper,
  'date-calculator': dateShaper,
  'converter': converterShaper,
  'text-compare': textCompareShaper,
  'text-cleaner': textCleanerShaper,
});
