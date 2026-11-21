// The brain boundary (FL12) forbids importing src/brain here, so the guard type is declared locally; it must stay the same shape as LaneGuard in src/brain/mind/directLane.ts.
import { CONVERTER_KINDS } from '../../converter/kinds';
type LaneGuard = (args: Readonly<Record<string, unknown>>, message: string) => string | null;

/** The lane answers MEASUREMENT units only (length, weight, temperature, volume, area, speed, time, data size). */
const MEASURE_KINDS: Readonly<Record<string, true>> = Object.freeze({ length: true, mass: true, temperature: true, volume: true, area: true, speed: true, time: true, data: true });
const NOT_PURE: Readonly<Record<string, true>> = Object.freeze({
  currency: true, dollar: true, dollars: true, euro: true, euros: true, naira: true, money: true, rate: true, exchange: true, price: true, cost: true, tax: true,
  file: true, image: true, picture: true, photo: true, csv: true, json: true, yaml: true, xml: true, html: true, markdown: true, pdf: true, text: true, format: true, hex: true, binary: true, base: true,
  python: true, excel: true, sql: true, javascript: true, code: true, formula: true, function: true, program: true, script: true,
  why: true, should: true, can: true, could: true, not: true, dont: true, never: true, also: true, then: true, and: true, approximately: true, roughly: true, about: true, recipe: true, cooking: true, bake: true,
  my: true, our: true, weather: true, today: true, tomorrow: true, history: true, definition: true, mean: true, meaning: true, difference: true, versus: true, compare: true, bigger: true, heavier: true
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
export const converterLaneGuard: LaneGuard = (args, message) => {
  const from = args.from; const to = args.to; const input = args.input;
  if (typeof from !== 'string' || typeof to !== 'string' || typeof input !== 'string') return 'the units or the value are missing';
  const matches = CONVERTER_KINDS.filter((kind) => kind.units.some((unit) => unit.id === from) && kind.units.some((unit) => unit.id === to));
  if (matches.length !== 1 || !Object.prototype.hasOwnProperty.call(MEASURE_KINDS, (matches[0] as { id: string }).id)) return 'the two units do not belong to exactly one measurement kind';
  if (!Number.isFinite(Number(input)) || Math.abs(Number(input)) > 1e15) return 'the value is outside what the lane converts';
  if (message.length > 120) return 'the message is too long for the lane, so the existing path should decide';
  if (message.includes('"') || message.includes('\n') || message.includes('`')) return 'the message carries quoted or multi-line material, so the existing path should decide';
  const words = wordsOf(message);
  if (words.some((word) => Object.prototype.hasOwnProperty.call(NOT_PURE, word))) return 'the request carries an extra meaning (money, a file format, a program, a question about how or why), so the existing path should decide';
  for (let i = 0; i < words.length; i += 1) if (words[i] === 'how' && words[i + 1] !== 'many' && words[i + 1] !== 'much') return 'a how question asks for an explanation, so the existing path should decide';
  if (message.split('?').length > 2) return 'the message asks more than one question';
  return null;
};
