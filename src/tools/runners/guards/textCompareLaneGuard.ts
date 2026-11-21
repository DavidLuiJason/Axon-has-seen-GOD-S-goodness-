// The brain boundary (FL12) forbids importing src/brain here, so the guard type is declared locally; it must stay the same shape as LaneGuard in src/brain/mind/directLane.ts.
type LaneGuard = (args: Readonly<Record<string, unknown>>, message: string) => string | null;

const MODES: Readonly<Record<string, true>> = Object.freeze({ line: true, word: true });
const NOT_PURE: Readonly<Record<string, true>> = Object.freeze({
  how: true, why: true, which: true, should: true, can: true, could: true, better: true, best: true, worse: true, spell: true, spelling: true, grammar: true, plagiarism: true, plagiarized: true, similarity: true, similar: true, percent: true, percentage: true,
  translate: true, summarize: true, summary: true, file: true, files: true, document: true, documents: true, code: true, git: true, python: true, merge: true, patch: true, sql: true, excel: true, json: true, csv: true,
  not: true, dont: true, never: true, also: true, then: true, email: true, send: true, my: true, our: true, essay: true, resume: true, price: true, prices: true, numbers: true, dates: true, version: true, versions: true, edit: true, fix: true, rewrite: true
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
export const textCompareLaneGuard: LaneGuard = (args, message) => {
  const original = args.original; const revised = args.revised; const mode = args.mode;
  if (typeof original !== 'string' || typeof revised !== 'string') return 'the two texts are missing';
  if (original === '' || revised === '') return 'one of the texts is empty';
  if (typeof mode !== 'string' || !Object.prototype.hasOwnProperty.call(MODES, mode)) return 'the compare mode is not a supported choice';
  if (original.length > 2000 || revised.length > 2000 || message.length > 4200) return 'the texts are too long for the lane, so the existing path should decide';
  let quotes = 0;
  for (const char of message) if (char === '"') quotes += 1;
  if (quotes !== 4) return 'the message does not carry exactly two quoted texts';
  if (message.includes('`') || message.includes('“') || message.includes('‘')) return 'the message carries other quoting, so the existing path should decide';
  // the words OUTSIDE the quoted texts decide what is being asked
  const outside: string[] = [];
  let inside = false; let chunk = '';
  for (const char of message) { if (char === '"') { if (!inside) outside.push(chunk); chunk = ''; inside = !inside; } else if (!inside) chunk += char; }
  outside.push(chunk);
  const words = wordsOf(outside.join(' '));
  if (words.length > 8) return 'the words around the texts say more than a compare request';
  if (words.some((word) => Object.prototype.hasOwnProperty.call(NOT_PURE, word))) return 'the request carries an extra meaning (a question about how, a judgement, a file or a program), so the existing path should decide';
  return null;
};
