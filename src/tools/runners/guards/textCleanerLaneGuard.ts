// The brain boundary (FL12) forbids importing src/brain here, so the guard type is declared locally; it must stay the same shape as LaneGuard in src/brain/directLane.ts.
type LaneGuard = (args: Readonly<Record<string, unknown>>, message: string) => string | null;

const FLAGS: Readonly<Record<string, true>> = Object.freeze({ trimEachLine: true, collapseRepeatedSpaces: true, removeBlankLines: true, collapseBlankLines: true, removeZeroWidth: true, normalizeLineEndings: true });
const NOT_PURE: Readonly<Record<string, true>> = Object.freeze({
  how: true, why: true, which: true, should: true, can: true, could: true, what: true, not: true, dont: true, never: true, also: true, then: true, my: true, our: true,
  duplicate: true, duplicates: true, unique: true, sort: true, sorted: true, quotes: true, quote: true, dashes: true, dash: true, punctuation: true, html: true, tags: true, numbers: true, digits: true, letters: true, characters: true, words: true, vowels: true, emoji: true,
  newline: true, newlines: true, trailing: true, leading: true, case: true, uppercase: true, lowercase: true, capital: true, capitals: true, replace: true, translate: true, summarize: true, count: true, spell: true, grammar: true, format: true, formatting: true,
  file: true, document: true, code: true, python: true, regex: true, sql: true, email: true, send: true, convert: true, encode: true, decode: true, hash: true
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
export const textCleanerLaneGuard: LaneGuard = (args, message) => {
  const text = args.text;
  if (typeof text !== 'string' || text === '') return 'the text to clean is missing';
  let flags = 0;
  for (const key of Object.keys(args)) {
    if (key === 'text') continue;
    if (!Object.prototype.hasOwnProperty.call(FLAGS, key) || args[key] !== true) return 'an option is not one the lane applies';
    flags += 1;
  }
  if (flags === 0) return 'no cleaning option was asked for';
  if (text.length > 4000 || message.length > 4300) return 'the text is too long for the lane, so the existing path should decide';
  let quotes = 0;
  for (const char of message) if (char === '"') quotes += 1;
  if (quotes !== 2) return 'the message does not carry exactly one quoted text';
  if (message.includes('`') || message.includes('“') || message.includes('‘') || text.includes('"')) return 'the message carries other quoting, so the existing path should decide';
  const outside: string[] = [];
  let inside = false; let chunk = '';
  for (const char of message) { if (char === '"') { if (!inside) outside.push(chunk); chunk = ''; inside = !inside; } else if (!inside) chunk += char; }
  outside.push(chunk);
  const words = wordsOf(outside.join(' '));
  if (words.length > 12) return 'the words around the text say more than a clean-up request';
  if (words.some((word) => Object.prototype.hasOwnProperty.call(NOT_PURE, word))) return 'the request carries an extra meaning (a question, another operation or a file), so the existing path should decide';
  return null;
};
