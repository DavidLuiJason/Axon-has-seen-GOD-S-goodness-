/** Director 471 (ROUND-ALL): real-brain proof for the Text Cleaner. The option flags come from the text cleaner shaper (shapers.ts) by single words; the text is the one quoted text.
 * Every result is worked out by hand: trim first, then repeated spaces, then blank lines. The verb trim (it also moves the Percentage Helper's reduce), singular day, two options in one message ('trim and collapse spaces') and the words delete and empty lines are not matched by the resolver (gaps). Not applied by the lane (it yields): quotes and dashes, trailing or leading, duplicates, newlines, "remove spaces" alone (that would delete every space). */
import { runLiveProof, type ProofReply } from './helpers/liveProof';
const has = (text: string) => (reply: ProofReply): string | null => (reply.content.includes(text) ? null : `expected ${JSON.stringify(text)} in ${JSON.stringify(reply.content.slice(0, 160))}`);
const clean = (message: string, out: string, changes: string): readonly [string, (x: ProofReply) => string | null] => [message, has(`${out}\nChanges: ${changes}.`)];
await runLiveProof({
  name: 'liveBrainTextCleaner', toolId: 'text-cleaner',
  answers: [
    clean('remove extra spaces from "a   b    c"', 'a b c', 'repeated spaces reduced: 5'), clean('clean up "  hello   world  "', 'hello world', 'lines trimmed: 1, repeated spaces reduced: 2'), clean('remove blank lines from "a\n\n\nb"', 'a\nb', 'blank lines removed: 2'),
    clean('collapse blank lines in "a\n\n\n\nb"', 'a\n\nb', 'extra blank lines collapsed: 2'), clean('tidy "a    b"', 'a b', 'repeated spaces reduced: 3'),
    clean('remove blank lines from "x\n\ny"', 'x\ny', 'blank lines removed: 1'), clean('remove extra spaces from "one  two"', 'one two', 'repeated spaces reduced: 1'),
    clean('collapse spaces in "a  b   c"', 'a b c', 'repeated spaces reduced: 3'), clean('clean up "a\n\n\n\nb"', 'a\n\nb', 'extra blank lines collapsed: 2'), clean('remove blank lines from "p\n\n\nq"', 'p\nq', 'blank lines removed: 2'),
    clean('remove the blank lines from "1\n \n2"', '1\n2', 'blank lines removed: 1'), clean('clean up "already clean"', 'already clean', 'none'),
    clean('remove double spaces from "a  b"', 'a b', 'repeated spaces reduced: 1'),
  ],
  mustNot: [
    'how do I remove extra spaces from "a   b"', 'remove duplicate lines from "a\na"', 'remove extra spaces from "a  b" and sort it', 'remove extra spaces', 'remove extra spaces from my text', 'clean up my room', 'clean "a  b" and "c  d"',
    "remove extra spaces from 'a  b'", 'remove quotes from "a"', 'remove trailing spaces from "a  "', 'remove blank lines', 'remove punctuation from "a, b"', 'do not remove extra spaces from "a  b"', 'remove extra spaces from "a  b" and send to Anna',
    'remove newlines from "a\nb"', 'remove all vowels from "hello"', 'remove spaces from "a b"', 'clean "a  b" in python', 'trim "a" and "b"', 'remove extra spaces from "' + 'x  '.repeat(1500) + '"', 'remove extra spaces from "a  b" ' + 'please '.repeat(30),
    'remove blank lines and collapse blank lines in "a\n\nb"', 'remove extra spaces from “a  b”', 'clean up "a  b" and translate it', 'clean up the file "a  b"', 'tidy up my desk "a"',
  ],
  others: ['hello', 'thank you', 'what can you do', 'tell me a joke', 'spell the number 42', 'sort the lines "b\na"', 'count words in "one two three"', 'create QR code containing "hello"', 'what is 15% of 80', 'calculate "2+2"', 'replace "cat" with "fox" in "the cat sat"'],
});
