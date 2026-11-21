// The brain boundary (FL12) forbids importing src/brain here, so the guard type is declared locally; it must stay the same shape as LaneGuard in src/brain/mind/directLane.ts.
type LaneGuard = (args: Readonly<Record<string, unknown>>, message: string) => string | null;

const NEEDS: Readonly<Record<string, true>> = Object.freeze({ split: true, divide: true, share: true, bill: true });
/** Words that make it a different question: advice, a program, unequal parts, a currency, negation, a personal bill. */
const NOT_PURE: Readonly<Record<string, true>> = Object.freeze({
  how: true, why: true, should: true, can: true, could: true, would: true, python: true, code: true, compare: true, versus: true, parts: true, unequal: true, round: true, rounded: true,
  not: true, never: true, dont: true, euros: true, dollars: true, currency: true, convert: true, my: true, our: true, then: true, also: true, tax: true, vat: true, each: true,
});

function wordsOf(value: string): string[] {
  const words: string[] = [];
  let word = '';
  for (const char of value.toLowerCase()) {
    const code = char.charCodeAt(0);
    if ((code >= 97 && code <= 122) || (code >= 48 && code <= 57)) word += char;
    else if (word) { words.push(word); word = ''; }
  }
  if (word) words.push(word);
  return words;
}
const has = (words: readonly string[], set: Readonly<Record<string, true>>): boolean => words.some((w) => Object.prototype.hasOwnProperty.call(set, w));

const CROWD: Readonly<Record<string, true>> = Object.freeze({ people: true, persons: true, friends: true, ways: true, diners: true });

export const splitBillLaneGuard: LaneGuard = (args, message) => {
  if (message.length > 200) return 'the message is too long for the lane, so the existing path should decide';
  const words = wordsOf(message);
  if (!has(words, NEEDS)) return 'the request does not clearly ask to split a bill';
  if (has(words, NOT_PURE)) return 'the request carries an extra meaning (advice, parts, rounding, a program or a comparison), so the existing path should decide';
  if (words.filter((w) => Object.prototype.hasOwnProperty.call(CROWD, w)).length > 1) return 'the request names more than one group of people, so the existing path should decide';
  for (const key of ['bill', 'tipPercent', 'people']) if (typeof args[key] !== 'number') return 'a bill value is missing';
  if (args.roundUp !== undefined) return 'rounding is not answered by the lane';
  return null;
};
