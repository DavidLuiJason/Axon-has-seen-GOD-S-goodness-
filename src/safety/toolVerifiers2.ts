// P10b MORE PER-TOOL VERIFIERS (pure apart from the platform's own hashing). Adds checks for the hash tool, number to words and the case converter,
// and keeps the earlier ones. Same rule as before: recompute by a second path from the owner's message and compare with the tool's reply;
// anything that cannot be rechecked stays UNVERIFIED (check null) and is never blocked.
import { quotedText, recount, utf8Bytes, verifyToolReply } from './toolVerifiers.ts';
import type { ToolVerification } from './toolVerifiers.ts';

const none = (note: string, output = ''): ToolVerification => ({ output, check: null, note });
const bodyOf = (reply: string): string | null => {
  const cut = reply.indexOf('\n\nRan as task');
  return cut < 0 ? null : reply.slice(0, cut);
};

// ---- MD5, written out (the platform's digest call has no MD5).
const rotl = (x: number, c: number): number => ((x << c) | (x >>> (32 - c))) >>> 0;
const MD5_SHIFTS = [7, 12, 17, 22, 5, 9, 14, 20, 4, 11, 16, 23, 6, 10, 15, 21];
export function md5Hex(bytes: readonly number[]): string {
  const k: number[] = [];
  for (let i = 0; i < 64; i++) k.push(Math.floor(Math.abs(Math.sin(i + 1)) * 4294967296) >>> 0);
  const data = [...bytes, 0x80];
  while (data.length % 64 !== 56) data.push(0);
  const bitLength = bytes.length * 8;
  for (let i = 0; i < 8; i++) data.push(i < 4 ? (bitLength >>> (8 * i)) & 255 : Math.floor(bitLength / 4294967296) >>> (8 * (i - 4)) & 255);
  let a0 = 0x67452301, b0 = 0xefcdab89, c0 = 0x98badcfe, d0 = 0x10325476;
  for (let off = 0; off < data.length; off += 64) {
    const m: number[] = [];
    for (let i = 0; i < 16; i++) m.push((data[off + 4 * i] | (data[off + 4 * i + 1] << 8) | (data[off + 4 * i + 2] << 16) | (data[off + 4 * i + 3] << 24)) >>> 0);
    let a = a0, b = b0, c = c0, d = d0;
    for (let i = 0; i < 64; i++) {
      let f: number, g: number;
      if (i < 16) { f = (b & c) | (~b & d); g = i; }
      else if (i < 32) { f = (d & b) | (~d & c); g = (5 * i + 1) % 16; }
      else if (i < 48) { f = b ^ c ^ d; g = (3 * i + 5) % 16; }
      else { f = c ^ (b | ~d); g = (7 * i) % 16; }
      f = (f + a + k[i] + m[g]) >>> 0;
      a = d; d = c; c = b;
      b = (b + rotl(f, MD5_SHIFTS[(i >> 4) * 4 + (i % 4)])) >>> 0;
    }
    a0 = (a0 + a) >>> 0; b0 = (b0 + b) >>> 0; c0 = (c0 + c) >>> 0; d0 = (d0 + d) >>> 0;
  }
  let out = '';
  for (const word of [a0, b0, c0, d0]) for (let i = 0; i < 4; i++) out += ((word >>> (8 * i)) & 255).toString(16).padStart(2, '0');
  return out;
}

const hex = (buffer: ArrayBuffer): string => Array.from(new Uint8Array(buffer)).map((b) => b.toString(16).padStart(2, '0')).join('');
async function digestHex(algorithm: string, bytes: number[]): Promise<string | null> {
  if (algorithm === 'MD5') return md5Hex(bytes);
  const subtle = (globalThis as { crypto?: { subtle?: { digest(name: string, data: Uint8Array): Promise<ArrayBuffer> } } }).crypto?.subtle;
  if (!subtle) return null;
  try { return hex(await subtle.digest(algorithm, new Uint8Array(bytes))); } catch { return null; }
}

async function verifyHash(payload: string, reply: string): Promise<ToolVerification> {
  const body = bodyOf(reply);
  if (body === null) return none('the reply is not in the expected format');
  const split = body.indexOf(' digest: ');
  if (split < 0) return none('the reply does not show a digest');
  const algorithm = body.slice(0, split);
  const claimed = body.slice(split + ' digest: '.length).trim().toLowerCase();
  const expected = await digestHex(algorithm, utf8Bytes(payload));
  if (expected === null) return none('this platform cannot compute ' + algorithm + ' here', algorithm + ':' + claimed);
  return { output: algorithm + ':' + claimed, check: { kind: 'RECOMPUTE', value: algorithm + ':' + expected }, note: 'hashed again from the quoted text' };
}

// ---- Numbers in English words, both directions.
const SMALL = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];
const TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];
const SCALES = ['', 'thousand', 'million', 'billion', 'trillion', 'quadrillion'];
function below1000(n: number): string {
  const parts: string[] = [];
  if (n >= 100) { parts.push(SMALL[Math.floor(n / 100)] + ' hundred'); n %= 100; }
  if (n >= 20) { parts.push(TENS[Math.floor(n / 10)] + (n % 10 ? '-' + SMALL[n % 10] : '')); } else if (n > 0) parts.push(SMALL[n]);
  return parts.join(' ');
}
export function numberWords(value: bigint): string | null {
  if (value < 0n || value >= 1000000000000000000n) return null;
  if (value === 0n) return 'zero';
  const groups: string[] = [];
  let rest = value;
  let scale = 0;
  while (rest > 0n) {
    const chunk = Number(rest % 1000n);
    if (chunk > 0) groups.unshift(below1000(chunk) + (SCALES[scale] ? ' ' + SCALES[scale] : ''));
    rest /= 1000n;
    scale++;
  }
  return groups.join(' ');
}
/** The number a set of English number words names, in any common style (hyphens, "and"); null when the words are not a number. */
export function parseNumberWords(text: string): bigint | null {
  const tokens = text.toLowerCase().split('-').join(' ').split(' ').filter((t) => t !== '' && t !== 'and');
  if (tokens.length === 0) return null;
  let total = 0n;
  let current = 0n;
  for (const t of tokens) {
    const small = SMALL.indexOf(t);
    const tens = TENS.indexOf(t);
    const scale = SCALES.indexOf(t);
    if (small >= 0) current += BigInt(small);
    else if (tens >= 2) current += BigInt(tens * 10);
    else if (t === 'hundred') current *= 100n;
    else if (scale >= 1) { total += current * 1000n ** BigInt(scale); current = 0n; } else return null;
  }
  return total + current;
}
function digitTokens(message: string): string[] {
  const out: string[] = [];
  for (const raw of message.split(' ')) {
    let t = raw;
    while (t !== '' && (t[t.length - 1] < '0' || t[t.length - 1] > '9') && t[t.length - 1] !== '-') t = t.slice(0, -1);
    if (t === '') continue;
    let all = true;
    for (const c of t) if (c < '0' || c > '9') all = false;
    if (all) out.push(t);
  }
  return out;
}
function verifyNumberWords(message: string, reply: string): ToolVerification {
  const found = digitTokens(message);
  if (found.length !== 1) return none('no single whole number in the message to recheck against');
  const n = BigInt(found[0]);
  const body = bodyOf(reply);
  if (body === null) return none('the reply is not in the expected format');
  const wanted = numberWords(n);
  if (wanted === null) return none('that number is outside the range that can be rechecked');
  const parsed = parseNumberWords(body);
  if (parsed === null) return none('the reply is not number words that can be read back', body);
  // Same number in another style ("and", no hyphens) counts as right; a different number is a mismatch.
  return { output: body, check: { kind: 'RECOMPUTE', value: parsed === n ? body : wanted }, note: 'read the words back into a number' };
}

// ---- Case converter: the answer must be what one of the tool's own modes gives for the quoted text (words and letters of plain ASCII only, except upper/lower).
const isAscii = (s: string): boolean => { for (const c of s) if (c.charCodeAt(0) > 127) return false; return true; };
const isUpperAscii = (c: string): boolean => c >= 'A' && c <= 'Z';
const isLowerAscii = (c: string): boolean => c >= 'a' && c <= 'z';
const isDigitAscii = (c: string): boolean => c >= '0' && c <= '9';
const isAlnum = (c: string): boolean => isUpperAscii(c) || isLowerAscii(c) || isDigitAscii(c);
function asciiWords(text: string): string[] {
  const chars = [...text];
  const words: string[] = [];
  let cur = '';
  for (let i = 0; i < chars.length; i++) {
    const c = chars[i];
    if (!isAlnum(c)) { if (cur !== '') words.push(cur); cur = ''; continue; }
    const prev = i > 0 ? chars[i - 1] : '';
    const next = i + 1 < chars.length ? chars[i + 1] : '';
    const lowerThenUpper = (isLowerAscii(prev) || isDigitAscii(prev)) && isUpperAscii(c);
    const acronymEnd = isUpperAscii(prev) && isUpperAscii(c) && isLowerAscii(next);
    if ((lowerThenUpper || acronymEnd) && cur !== '') { words.push(cur); cur = ''; }
    cur += c;
  }
  if (cur !== '') words.push(cur);
  return words;
}
const cap = (w: string): string => (w === '' ? w : w[0].toUpperCase() + w.slice(1).toLowerCase());
function asciiCandidates(text: string): string[] {
  const noApostrophe = text.split('\u2019').join("'");
  const words = asciiWords(noApostrophe.split("'").join(' ')).map((w) => w.toLowerCase());
  const out: string[] = [text.toUpperCase(), text.toLowerCase(), words.join('_'), words.join('-'), words.map((w) => w.toUpperCase()).join('_'), words.map(cap).join(''), words.map((w, i) => (i === 0 ? w : cap(w))).join('')];
  // Title: every run of letters and digits (with 's-style apostrophe parts) gets a capital first letter.
  let title = '';
  let run = '';
  const flush = () => { title += cap(run); run = ''; };
  const chars = [...noApostrophe];
  for (let i = 0; i < chars.length; i++) {
    const c = chars[i];
    if (isAlnum(c)) run += c;
    else if (c === "'" && run !== '' && i + 1 < chars.length && (isUpperAscii(chars[i + 1]) || isLowerAscii(chars[i + 1]))) run += c;
    else { flush(); title += c; }
  }
  flush();
  out.push(title);
  const lower = text.toLowerCase();
  let sentence = '';
  let state = 0; // 0 normal, 1 just after . ! or ?, 2 after that and some whitespace
  for (let i = 0; i < lower.length; i++) {
    const c = lower[i];
    sentence += (i === 0 || state === 2) && isLowerAscii(c) ? c.toUpperCase() : c;
    if (c === '.' || c === '!' || c === '?') state = 1;
    else if (c.trim() === '' && state !== 0) state = 2;
    else state = 0;
  }
  out.push(sentence);
  return out;
}
function verifyCase(payload: string, reply: string): ToolVerification {
  const body = bodyOf(reply);
  if (body === null) return none('the reply is not in the expected format');
  const candidates = isAscii(payload) ? asciiCandidates(payload) : [payload.toUpperCase(), payload.toLowerCase()];
  if (candidates.includes(body)) return { output: body, check: { kind: 'RECOMPUTE', value: body }, note: 'matches what one of the converter\'s modes gives for the quoted text' };
  return none('the answer does not match any mode this check knows, so it is left unverified', body);
}

/** All per-tool rechecks. Same shape as `verifyToolReply`, but may need the platform's digest call, so it is asynchronous. */
export async function verifyToolReplyFull(input: { readonly toolId: string; readonly message: string; readonly replyContent: string }): Promise<ToolVerification> {
  if (input.toolId === 'number-to-words') return verifyNumberWords(input.message, input.replyContent);
  if (input.toolId === 'hash-tool' || input.toolId === 'case-converter') {
    const q = quotedText(input.message);
    if (q.kind === 'none') return none('no quoted text in the message to recheck against');
    if (q.kind === 'many') return none('more than one quoted text, so it is unclear which one the tool used');
    if (q.kind === 'open') return none('a quote is left open');
    return input.toolId === 'hash-tool' ? verifyHash(q.text, input.replyContent) : verifyCase(q.text, input.replyContent);
  }
  return verifyToolReply(input);
}

/** JOB 4 tail (D926): the old text handler (source local-rules) answers counting requests. Recount from the quoted text; with no quote, recount the whole message (the user's answer to "What text should I count?"). A mismatch with no quote is UNCLEAR, never FAILED, because the handler may have counted a different text. */
export function verifyOldCountReply(input: { readonly message: string; readonly replyContent: string }): ToolVerification {
  const q = quotedText(input.message);
  if (q.kind === 'one') return verifyToolReply({ toolId: 'text-counter', message: input.message, replyContent: input.replyContent });
  if (q.kind === 'many' || q.kind === 'open') return none('the quotes are unclear, so the counted text cannot be told');
  const w = /^Words: (\d+)$/m.exec(input.replyContent), c = /^Characters: (\d+) \((\d+) without spaces\)$/m.exec(input.replyContent), l = /^Letters: (\d+)$/m.exec(input.replyContent), n = /^Lines: (\d+)$/m.exec(input.replyContent);
  if (!w || !c || !l || !n) return none('the reply does not show all four counts');
  const r = recount(input.message);
  const mine = `W=${r.words};C=${r.characters};NS=${r.noSpaces};L=${r.letters};LN=${r.lines}`;
  const claimed = `W=${w[1]};C=${c[1]};NS=${c[2]};L=${l[1]};LN=${n[1]}`;
  if (mine === claimed) return { output: claimed, check: { kind: 'RECOMPUTE', value: mine }, note: 'recounted from the whole message' };
  return none('no quoted text, and the whole message does not match, so the counted text is unclear', claimed);
}
