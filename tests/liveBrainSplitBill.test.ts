/** Director 471 (ROUND-ALL, wave 3): real-brain proof for Split Bill (runner, action, split SHAPER and lane guard).
 * Shape: one bill amount, a count before the word people, and a percent tip or none. Unequal parts, rounding up and advice are not answered by the lane (reported). */
import { runLiveProof, type ProofReply } from './helpers/liveProof';
const has = (text: string) => (reply: ProofReply): string | null => (reply.content.includes(text) ? null : `expected "${text}" in ${reply.content.slice(0, 160)}`);
await runLiveProof({
  name: 'liveBrainSplitBill', toolId: 'split-bill',
  answers: [
    ['split a bill of 120 with a 15% tip among 4 people', has('Each person pays 34.50.')],
    ['split 90 between 3 people with a 10% tip', has('Each person pays 33.00.')],
    ['split a bill of 100 among 3 people', has('The shares are 33.34, 33.33, 33.33.')],
    ['divide a bill of 60 between 2 people with a 20% tip', has('Each person pays 36.00.')],
    ['split a 80 bill among 4 people with a 25% tip', has('Each person pays 25.00.')],
    ['calculate the share of a 200 bill among 5 people with a 10% tip', has('Each person pays 44.00.')],
  ],
  mustNot: [
    'how do I split a bill of 120 with a 15% tip among 4 people', 'split a bill of 120 with a tip among 4 people', 'split a bill of 120 among 4',
    'split a bill with a 15% tip among 4 people', 'split my bill of 120 with a 15% tip among 4 people', 'split a bill of 120 with a 15% tip among 4 people in euros',
    'split a bill of 120 with a 15% tip among 4 people and round up', 'should I split a bill of 120 with a 15% tip among 4 people', 'do not split a bill of 120 among 4 people',
    'split a bill of 120 with a 15% tip among 0 people', 'split a bill of 120 among 4 people python code', 'split a bill of 120 with a 15% tip among 4 people and 5 people',
    'split a bill of 120 with a 150% tip among 4 people', 'split a bill of 120 with a 15% tip among 4 people ' + 'a '.repeat(150),
  ],
  others: ['hello', 'thank you', 'what can you do', 'tell me a joke', 'spell the number 42', 'sort the lines "b\na"', 'count words in "one two three"', 'what is 15% of 80', 'encode "hello" as base64', 'replace "cat" with "fox" in "the cat sat"', 'hash "abc" with sha-256'],
});
