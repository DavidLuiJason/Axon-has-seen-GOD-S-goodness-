import type { WebResult } from './webUiTypes.ts';

/**
 * Turns what the owner typed or AXON asked for into one safe address for the native browser.
 * Pure function: no network, no storage. Only http and https pages are ever accepted.
 */
export type NativeNavigationTarget =
  | Readonly<{ ok: true; url: string }>
  | Readonly<{ ok: false; reason: 'invalid'; message: string }>;

const SEARCH_BASE = 'https://www.google.com/search?q=';
const bad = (message: string): NativeNavigationTarget => ({ ok: false, reason: 'invalid', message });

function checkedUrl(raw: string): NativeNavigationTarget {
  let parsed: URL;
  try { parsed = new URL(raw); } catch { return bad('That is not a valid web address.'); }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return bad('Only http and https pages can be opened.');
  if (!parsed.hostname) return bad('That web address has no site name.');
  if (parsed.username || parsed.password) return bad('Web addresses with a name or password inside are not opened.');
  return { ok: true, url: parsed.href };
}

function isIpv4(host: string): boolean {
  const parts = host.split('.');
  return parts.length === 4 && parts.every((p) => /^[0-9]{1,3}$/.test(p) && Number(p) <= 255);
}

export function resolveNativeNavigationTarget(input: string): NativeNavigationTarget {
  const text = String(input ?? '').trim();
  if (!text) return bad('Type a web address or something to search for.');
  // Anything with a space is a search phrase, even if it starts like "price:".
  if (/\s/.test(text)) return { ok: true, url: SEARCH_BASE + encodeURIComponent(text) };

  const scheme = /^([a-z][a-z0-9+.-]*):(.*)$/i.exec(text);
  if (scheme) {
    const rest = scheme[2];
    const portOnly = /^[0-9]{1,5}(?:[/?#].*)?$/.test(rest);
    if (!portOnly) {
      const name = scheme[1].toLowerCase();
      if ((name === 'http' || name === 'https') && rest.startsWith('//')) return checkedUrl(text);
      return bad('Only http and https pages can be opened.');
    }
  }

  const host = text.split(/[/?#]/, 1)[0].replace(/:[0-9]{1,5}$/, '');
  if (!host.includes('.')) return { ok: true, url: SEARCH_BASE + encodeURIComponent(text) };
  const labels = host.split('.');
  const labelsOk = labels.every((l) => /^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/i.test(l));
  if (!labelsOk) return bad('That is not a valid web address.');
  const last = labels[labels.length - 1];
  if (/^[0-9]+$/.test(last) && !isIpv4(host)) return { ok: true, url: SEARCH_BASE + encodeURIComponent(text) };
  return checkedUrl('https://' + text);
}

export function invalidNativeNavigation(target: Extract<NativeNavigationTarget, { ok: false }>): WebResult {
  return { ok: false, reason: 'invalid', message: target.message };
}
