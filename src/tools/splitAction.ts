/** Director 471 (ROUND-ALL, wave 3): task action for the stateless Split and Tip tool. It delegates to the finance runner. */
import type { ActionDef } from '../kernel/types';
import { FINANCE_RUNNERS } from './runners/financeRunners';

const SPLIT_RUNNER = FINANCE_RUNNERS.find((runner) => runner.toolId === 'split-bill');

export const SPLIT_ACTION: ActionDef = {
  id: 'finance.split',
  capabilityId: 'axon-tools',
  label: 'Split a bill',
  executionClass: 'instant',
  inputFields: [
    { name: 'bill', type: 'number', required: true, prompt: 'What is the total bill?' },
    { name: 'tipPercent', type: 'number', required: true, prompt: 'What tip percentage?' },
    { name: 'people', type: 'number', required: true, prompt: 'How many people?' },
    { name: 'roundUp', type: 'boolean', required: false, prompt: 'Round each share up to a whole unit?' },
  ],
  outputFields: [{ name: 'reply', type: 'string' }],
  resources: {},
  cancel: 'none',
  evidence: 'The existing Split and Tip engine completed the requested stateless split.',
  run: async (input) => {
    if (!SPLIT_RUNNER) throw new Error('Split and Tip runner is unavailable.');
    const outcome = await SPLIT_RUNNER.run(input, { now: 0, randomBelow: () => 0, random01: () => 0 });
    if (!outcome.ok) throw new Error(`Split and Tip refused: ${outcome.message}`);
    return { reply: outcome.reply };
  },
};
