/** Director 471 (ROUND-ALL, wave 3): real-brain proof for the Loan Calculator (new runner, action, loan SHAPER and lane guard).
 * Shape: one amount, one percent rate and one length (years or months). A 0% rate is read as a time by the value reader (reported), so it is not answered. Extra payments, advice and the "monthly payment" without a verb are not answered by the lane (reported). */
import { runLiveProof, type ProofReply } from './helpers/liveProof';
const has = (text: string) => (reply: ProofReply): string | null => (reply.content.includes(text) ? null : `expected "${text}" in ${reply.content.slice(0, 160)}`);
await runLiveProof({
  name: 'liveBrainLoan', toolId: 'loan-calculator',
  answers: [
    ['calculate a loan of 12000 at 1% over 1 year', has('The monthly payment is 1005.42.')],
    ['calculate a loan of 1200 at 12% over 12 months', has('The monthly payment is 106.62.')],
    ['calculate a loan of 20000 at 6% over 5 years', has('The monthly payment is 386.66.')],
    ['estimate a loan of 10000 at 5% over 3 years', has('The monthly payment is 299.71.')],
    ['calculate the payment on a 20000 loan at 6% over 5 years', has('The monthly payment is 386.66.')],
    ['estimate the repayment of a 5000 loan at 8% over 24 months', has('The monthly payment is 226.14.')],
  ],
  mustNot: [
    'how do I calculate a loan of 20000 at 6% over 5 years', 'calculate a loan of 20000 at 6%', 'calculate a loan of 20000 over 5 years', 'calculate a loan at 6% over 5 years',
    'calculate a loan of 20000 at 6% over 5 years with extra payments', 'should I take a loan of 20000 at 6% over 5 years', 'calculate my loan of 20000 at 6% over 5 years',
    'calculate a loan of 20000 at 6% over 5 years in euros', 'calculate a loan of 20000 at 6% over 5 years and compare 30000 at 7%', 'do not calculate a loan of 20000 at 6% over 5 years',
    'calculate a loan of 20000 at 6% over 5 years python code', 'calculate a loan of 20000 at 150% over 5 years', 'calculate 20000 at 6% over 5 years',
    'calculate a loan of 20000 at 6% over 5 years ' + 'a '.repeat(150),
  ],
  others: ['hello', 'thank you', 'what can you do', 'tell me a joke', 'spell the number 42', 'sort the lines "b\na"', 'count words in "one two three"', 'what is 15% of 80', 'encode "hello" as base64', 'replace "cat" with "fox" in "the cat sat"', 'hash "abc" with sha-256'],
});
