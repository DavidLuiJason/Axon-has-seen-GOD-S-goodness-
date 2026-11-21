/** Director 471 (ROUND-ALL): real-brain proof for Text Compare. The two texts are placed by their marker words (bindRoles.ts) and the compare MODE by the text compare shaper (shapers.ts): word for single-line texts, line when a text has a line break, or the mode the person says.
 * Every count is worked out by hand: word mode counts words AND the spaces between them as tokens, line mode counts lines.
 * Not matched by the resolver, so reported as gaps: no noun ("compare "a" with "b"" is also a File Compare request, the resolver asks), "diff ..." and "what is the difference between ...". */
import { runLiveProof, type ProofReply } from './helpers/liveProof';
const has = (text: string) => (reply: ProofReply): string | null => (reply.content.includes(text) ? null : `expected "${text}" in ${reply.content.slice(0, 140)}`);
const cmp = (message: string, same: number, add: number, remove: number): readonly [string, (x: ProofReply) => string | null] => [message, has(`Same: ${same}; added: ${add}; removed: ${remove}.`)];
await runLiveProof({
  name: 'liveBrainTextCompare', toolId: 'text-compare',
  answers: [
    cmp('compare text "the cat sat" with "the dog sat"', 4, 1, 1), cmp('compare text "a b" with "a b"', 3, 0, 0), cmp('compare the texts "one two three" and "one two three four"', 5, 2, 0), cmp('compare text "red" with "blue"', 0, 1, 1),
    cmp('compare text "a b c" with "a b d" by line', 0, 1, 1), cmp('compare the texts "hello world" and "hello there world"', 3, 2, 0), cmp('compare the texts "one two" and "two one"', 1, 2, 2), cmp('compare text "x" with "x y"', 1, 2, 0),
    cmp('compare text "a b c d" with "a b c"', 5, 0, 2), cmp('compare text "a b" with "a c" by word', 2, 1, 1), cmp('compare text "Hello" with "hello"', 0, 1, 1), cmp('compare the passages "one two" and "one two"', 3, 0, 0),
    cmp('compare text "a\nb" with "a\nc"', 1, 1, 1), cmp('compare text "a\nb\nc" with "a\nc"', 2, 0, 1), cmp('compare text "a\nb" with "a\nb\nc"', 2, 1, 0), cmp('compare the texts "one\ntwo" and "one\ntwo" by line', 2, 0, 0),
    cmp('compare text "to be or not" with "to be"', 3, 0, 4), cmp('compare text "go" with "go go"', 1, 2, 0),
  ],
  mustNot: [
    'how do I compare "a" with "b"', 'compare text "a" with "b" and "c"', 'compare text "a" with', 'compare text "a"', 'compare text "a" with "b" in python', 'which is better, text "a" or text "b"', 'compare the files "a.txt" and "b.txt"',
    'compare text "a" with "b" for plagiarism', 'compare text "a" with "b" by character', 'compare text "a" with "b" by sentence', 'do not compare text "a" with "b"', 'compare my essay "a" with "b"', 'compare text "" with "b"',
    'compare text "a" with "b" and send it to Anna', 'compare text "a" with "b" and fix the spelling', 'compare text "a" with "b" by line by word', 'compare text "' + 'x '.repeat(1100) + '" with "b"', 'compare prices "10" and "20"',
    "compare text 'a' with 'b'", 'compare text “a” with “b”', 'compare text "a" and "a" and "b"', 'compare the dates "2024-01-01" and "2024-02-01"', 'compare text "a" with "b" similarity percent',
    'compare text "a" with "b" and tell me which version is correct', 'compare text "a" with "b" using git', 'compare text "a" with "b" ' + 'please '.repeat(30), 'compare text "a" with "b" and summarize the changes',
  ],
  others: ['hello', 'thank you', 'what can you do', 'tell me a joke', 'spell the number 42', 'sort the lines "b\na"', 'count words in "one two three"', 'create QR code containing "hello"', 'what is 15% of 80', 'calculate "2+2"', 'replace "cat" with "fox" in "the cat sat"'],
});
