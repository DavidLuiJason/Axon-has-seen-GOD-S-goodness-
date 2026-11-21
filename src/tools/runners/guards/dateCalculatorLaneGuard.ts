// The brain boundary (FL12) forbids importing src/brain here, so the guard type is declared locally; it must stay the same shape as LaneGuard in src/brain/mind/directLane.ts.
type LaneGuard = (args: Readonly<Record<string, unknown>>, message: string) => string | null;

const OPERATIONS: Readonly<Record<string, true>> = Object.freeze({
  add: true, difference: true, weekday: true, 'day-of-year': true, 'iso-week': true, 'count-weekdays': true
});
/** Words that show the person is asking for calendar arithmetic. */
const INTENT: Readonly<Record<string, true>> = Object.freeze({
  day: true, days: true, week: true, weeks: true, weekday: true, weekdays: true, workdays: true, working: true, business: true, month: true, months: true, year: true, years: true,
  between: true, difference: true, add: true, plus: true, minus: true, subtract: true, after: true, before: true, later: true, earlier: true, iso: true, apart: true, from: true
});
/** Words that make the request something other than plain date arithmetic (today, a deadline, a reminder, a clock time, a person's age, a program, a question about how). */
const NOT_PURE: Readonly<Record<string, true>> = Object.freeze({
  today: true, now: true, tomorrow: true, yesterday: true, tonight: true, current: true, birthday: true, age: true, old: true, countdown: true, deadline: true, remind: true, reminder: true, alarm: true,
  calendar: true, schedule: true, meeting: true, appointment: true, event: true, holiday: true, holidays: true, timezone: true, hours: true, minutes: true, seconds: true, time: true, timer: true,
  why: true, should: true, can: true, could: true, python: true, excel: true, sql: true, javascript: true, code: true, formula: true, function: true, program: true,
  not: true, dont: true, never: true, also: true, then: true, next: true, last: true, using: true, my: true, our: true, salary: true, payment: true, pay: true, due: true, expire: true, expires: true, leap: true
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
function hasAny(words: readonly string[], set: Readonly<Record<string, true>>): boolean {
  return words.some(word => Object.prototype.hasOwnProperty.call(set, word));
}

export const dateCalculatorLaneGuard: LaneGuard = (args, message) => {
  const operation = args.operation;
  if (typeof operation !== 'string' || !Object.prototype.hasOwnProperty.call(OPERATIONS, operation)) return 'the date operation is not a supported choice';
  if (typeof args.date !== 'string') return 'the date is missing';
  if ((operation === 'difference' || operation === 'count-weekdays') && typeof args.otherDate !== 'string') return 'the second date is missing';
  if (operation === 'add' && (typeof args.amount !== 'number' || typeof args.unit !== 'string')) return 'the amount and unit are missing';
  if (message.length > 200) return 'the message is too long for the lane, so the existing path should decide';
  if (message.includes('?') && message.split('?').length > 2) return 'the message asks more than one question';
  if (message.includes('"') || message.includes('\n')) return 'the message carries quoted or multi-line material, so the existing path should decide';
  const words = wordsOf(message);
  if (hasAny(words, NOT_PURE)) return 'the request carries an extra meaning (today, a deadline, a reminder, a time of day, a program or a question about how), so the existing path should decide';
  for (let i = 0; i < words.length; i += 1) if (words[i] === 'how' && words[i + 1] !== 'many') return 'a how question asks for an explanation, so the existing path should decide';
  if (!hasAny(words, INTENT)) return 'the request does not clearly ask for date arithmetic';
  if (typeof args.amount === 'number' && Math.abs(args.amount) > 100000) return 'the amount is outside what the lane answers';
  return null;
};
