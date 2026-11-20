// J5 BRIEF (pure). For a request to make something to look at (a poster, a flyer, an image, a screen): lists what a good brief needs, which parts the owner gave,
// which were filled by a visible default, and the single most important missing part to ask about. It makes no pictures and picks no method.
export type Kind = 'poster' | 'flyer' | 'image' | 'screen';
export type Field = { readonly name: string; readonly value: string | null; readonly source: 'owner' | 'default' | 'missing' };
export type Brief = { readonly kind: Kind; readonly fields: readonly Field[]; readonly complete: boolean; readonly askFirst: string | null };
export type Failure = { readonly ok: false; readonly error: string; readonly message: string };

// Field names per kind, most important first (the first missing one is the question worth asking).
const FIELDS: Record<Kind, string> = {
  poster: 'subject text size mood colours',
  flyer: 'subject text size contact mood colours',
  image: 'subject mood size style colours',
  screen: 'purpose content device layout mood colours',
};
const isKind = (k: unknown): k is Kind => typeof k === 'string' && Object.prototype.hasOwnProperty.call(FIELDS, k);
const text = (v: unknown): v is string => typeof v === 'string' && v.trim() !== '' && v.length <= 500;

export function buildBrief(kind: unknown, given: unknown, defaults: unknown): { ok: true; value: Brief } | Failure {
  if (!isKind(kind)) return { ok: false, error: 'bad-input', message: 'The kind must be poster, flyer, image or screen.' };
  if (typeof given !== 'object' || given === null || Array.isArray(given) || typeof defaults !== 'object' || defaults === null || Array.isArray(defaults)) return { ok: false, error: 'bad-input', message: 'given and defaults must be objects.' };
  const names = FIELDS[kind].split(' ');
  for (const [label, source] of [['given', given], ['defaults', defaults]] as const) {
    for (const k of Object.keys(source)) {
      if (!names.includes(k)) return { ok: false, error: 'unknown-field', message: 'The ' + label + ' field ' + k + ' is not part of a ' + kind + ' brief.' };
      const v = (source as Record<string, unknown>)[k];
      if (!text(v)) return { ok: false, error: 'bad-input', message: 'The ' + label + ' field ' + k + ' must be a short non-empty text.' };
    }
  }
  const g = given as Record<string, string>;
  const d = defaults as Record<string, string>;
  const fields: Field[] = names.map((name) => {
    if (Object.prototype.hasOwnProperty.call(g, name)) return { name, value: g[name].trim(), source: 'owner' as const };
    if (Object.prototype.hasOwnProperty.call(d, name)) return { name, value: d[name].trim(), source: 'default' as const };
    return { name, value: null, source: 'missing' as const };
  });
  const missing = fields.find((f) => f.source === 'missing');
  return { ok: true, value: { kind, fields, complete: missing === undefined, askFirst: missing ? missing.name : null } };
}
