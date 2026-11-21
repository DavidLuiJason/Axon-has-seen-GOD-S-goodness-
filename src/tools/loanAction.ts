/** Director 471 (ROUND-ALL, wave 3): task action for the stateless Loan Calculator. It delegates to the finance runner. */
import type { ActionDef } from '../kernel/types';
import { FINANCE_RUNNERS } from './runners/financeRunners';

const LOAN_RUNNER = FINANCE_RUNNERS.find((runner) => runner.toolId === 'loan-calculator');

export const LOAN_ACTION: ActionDef = {
  id: 'finance.loan',
  capabilityId: 'axon-tools',
  label: 'Calculate a loan payment',
  executionClass: 'instant',
  inputFields: [
    { name: 'amount', type: 'number', required: true, prompt: 'How much is the loan?' },
    { name: 'yearlyRate', type: 'number', required: true, prompt: 'What is the yearly interest rate in percent?' },
    { name: 'term', type: 'number', required: true, prompt: 'How long is the loan, in milliseconds?' },
    { name: 'extraPayment', type: 'number', required: false, prompt: 'Is there an extra monthly payment?' },
  ],
  outputFields: [{ name: 'reply', type: 'string' }],
  resources: {},
  cancel: 'none',
  evidence: 'The existing Loan Calculator engine completed the requested stateless repayment calculation.',
  run: async (input) => {
    if (!LOAN_RUNNER) throw new Error('Loan Calculator runner is unavailable.');
    const outcome = await LOAN_RUNNER.run(input, { now: 0, randomBelow: () => 0, random01: () => 0 });
    if (!outcome.ok) throw new Error(`Loan Calculator refused: ${outcome.message}`);
    return { reply: outcome.reply };
  },
};
