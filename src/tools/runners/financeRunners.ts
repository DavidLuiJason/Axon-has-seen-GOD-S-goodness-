/**
 * Director 471 (ROUND-ALL, wave 3): runners for the finance tools. PURE adapters between typed arguments and one existing engine each (the C2 contract in runnerTypes.ts).
 * Loan Calculator: amount, yearly rate and term (the term arrives as MILLISECONDS, a duration slot) become the engine input; the engine works in whole cents.
 */
import { calculateLoan } from '../engines/finance/loan';
import { RUNNER_REPLY_LIMIT, runnerFail, shortenReply, type RunnerArgs, type RunnerDeps, type RunnerOutcome, type ToolRunner } from './runnerTypes';

const KEYS: readonly string[] = ['amount', 'yearlyRate', 'term', 'extraPayment'];
/** One month as milliseconds when a year is 365.25 days, so a whole number of years is a whole number of months. */
export const LOAN_MONTH_MS = 2_629_800_000;
const own = (record: object, key: string): boolean => Object.prototype.hasOwnProperty.call(record, key);
const money = (cents: number): string => (cents / 100).toFixed(2);

function runLoan(raw: RunnerArgs): RunnerOutcome {
  const id = 'loan-calculator';
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) return runnerFail(id, 'invalid-input', 'Provide the tool inputs as named values.');
  for (const key of Object.keys(raw)) if (!KEYS.includes(key)) return runnerFail(id, 'invalid-input', 'This input is not accepted.', key);
  for (const key of ['amount', 'yearlyRate', 'term']) if (!own(raw, key) || raw[key] === undefined) return runnerFail(id, 'missing-input', 'Provide this value.', key);
  for (const key of KEYS) {
    const value = raw[key];
    if (value !== undefined && (typeof value !== 'number' || !Number.isFinite(value))) return runnerFail(id, 'invalid-input', 'This value must be a number.', key);
  }
  const ms = raw.term as number;
  if (ms <= 0) return runnerFail(id, 'invalid-input', 'The length of the loan must be more than zero.', 'term');
  const months = Math.round(ms / LOAN_MONTH_MS);
  if (months < 1 || Math.abs(months * LOAN_MONTH_MS - ms) > LOAN_MONTH_MS / 4) return runnerFail(id, 'invalid-input', 'Give the length of the loan in whole months or years.', 'term');
  const result = calculateLoan({
    amount: raw.amount as number, yearlyRate: raw.yearlyRate as number, term: months, termUnit: 'months',
    ...(raw.extraPayment === undefined ? {} : { extraPayment: raw.extraPayment as number }),
  });
  if (!result.ok) return runnerFail(id, 'engine-refused', `The tool could not complete this request (${result.message}).`);
  const saved = result.monthsSaved > 0 ? ` The extra payments save ${money(result.interestSaved)} of interest and ${result.monthsSaved} months.` : '';
  const reply = `The monthly payment is ${money(result.monthlyPayment)}. Over ${result.numberOfPayments} payments you pay ${money(result.totalInterest)} in interest, ${money(result.totalPaid)} in total.${saved}`;
  return { ok: true, toolId: id, result: { ...result, schedule: undefined }, reply: shortenReply(reply, RUNNER_REPLY_LIMIT) };
}

export const FINANCE_RUNNERS: readonly ToolRunner[] = [
  { toolId: 'loan-calculator', run: async (args: RunnerArgs, _deps: RunnerDeps) => { try { return runLoan(args); } catch { return runnerFail('loan-calculator', 'invalid-input', 'The loan inputs could not be read.'); } } },
];
