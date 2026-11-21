// The brain boundary (FL12) forbids importing src/brain here, so the guard type is declared locally; it must stay the same shape as LaneGuard in src/brain/mind/directLane.ts.
type LaneGuard = (args: Readonly<Record<string, unknown>>, message: string) => string | null;

const NEEDS: Readonly<Record<string, true>> = Object.freeze({ loan: true, mortgage: true, repayment: true, payment: true, payments: true, borrow: true, borrowed: true });
/** Words that make it a different question: advice, a program, a comparison, extra payments, a currency, negation. */
const NOT_PURE: Readonly<Record<string, true>> = Object.freeze({
  how: true, why: true, should: true, can: true, could: true, would: true, python: true, code: true, compare: true, versus: true, extra: true, early: true, refinance: true,
  not: true, never: true, dont: true, euros: true, dollars: true, currency: true, convert: true, my: true, our: true, afford: true, schedule: true, tax: true, then: true, also: true,
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

export const loanCalculatorLaneGuard: LaneGuard = (args, message) => {
  if (message.length > 200) return 'the message is too long for the lane, so the existing path should decide';
  const words = wordsOf(message);
  if (!has(words, NEEDS)) return 'the request does not clearly ask about a loan';
  if (has(words, NOT_PURE)) return 'the request carries an extra meaning (advice, extra payments, a program or a comparison), so the existing path should decide';
  for (const key of ['amount', 'yearlyRate', 'term']) if (typeof args[key] !== 'number') return 'a loan value is missing';
  if (args.extraPayment !== undefined) return 'extra payments are not answered by the lane';
  return null;
};
